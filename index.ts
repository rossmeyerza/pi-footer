import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { truncateToWidth } from "@earendil-works/pi-tui";

type WppCostedAssistantMessage = AssistantMessage & {
  wppCost?: { total: number };
};

type WppPolishCostEntry = {
  kind: "polish";
  model: string;
  usage?: AssistantMessage["usage"];
  wppCost?: { total: number };
};

function isWppPolishCostEntry(value: unknown): value is WppPolishCostEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return entry.kind === "polish" && typeof entry.model === "string";
}

function footerModelLabel(model?: { id: string; provider: string }): string {
  return model ? `${model.provider}/${model.id}` : "no-model";
}

export default function (pi: ExtensionAPI) {
  let footerSessionStart = Date.now();

  const fmtTokens = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
    return `${n}`;
  };
  const fmtElapsed = (ms: number): string => {
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m${s % 60 > 0 ? `${s % 60}s` : ""}`;
    const h = Math.floor(m / 60);
    return `${h}h${m % 60 > 0 ? `${m % 60}m` : ""}`;
  };

  // Register the footer for each session, independent of the selected provider.
  pi.on("session_start", (_event, ctx) => {
    footerSessionStart = Date.now();
    if (!ctx.hasUI) return;
    ctx.ui.setFooter((tui, theme, footerData) => {
      const unsub = footerData.onBranchChange(() => tui.requestRender());
      const timer = setInterval(() => tui.requestRender(), 30_000);
      return {
        dispose() {
          unsub();
          clearInterval(timer);
        },
        invalidate() {},
        render(width: number): string[] {
          let input = 0;
          let output = 0;
          let cost = 0;
          let wppCost = 0;
          let wppCostedMessages = 0;
          let cacheRead = 0;
          let cacheWrite = 0;
          for (const e of ctx.sessionManager.getBranch()) {
            if (e.type === "message" && e.message.role === "assistant") {
              const msg = e.message as WppCostedAssistantMessage;
              const u = msg.usage;
              if (!u) continue;
              input += u.input;
              output += u.output;
              cost += u.cost.total;
              if (msg.wppCost) {
                wppCost += msg.wppCost.total;
                wppCostedMessages++;
              }
              cacheRead += u.cacheRead;
              cacheWrite += u.cacheWrite;
            } else if (e.type === "custom" && e.customType === "wpp-polish-cost" && isWppPolishCostEntry(e.data)) {
              if (e.data.usage) {
                input += e.data.usage.input;
                output += e.data.usage.output;
                cost += e.data.usage.cost.total;
                cacheRead += e.data.usage.cacheRead;
                cacheWrite += e.data.usage.cacheWrite;
              }
              if (e.data.wppCost) {
                wppCost += e.data.wppCost.total;
                wppCostedMessages++;
              }
            }
          }
          const promptTotal = input + cacheRead + cacheWrite;
          const cachePct = promptTotal > 0 ? Math.round((100 * cacheRead) / promptTotal) : 0;

          const usage = ctx.getContextUsage();
          const pct = usage?.percent ?? 0;
          const pctColor = pct > 75 ? "error" : pct > 50 ? "warning" : "success";
          const ctxMakeup =
            usage?.tokens != null && usage.contextWindow > 0
              ? ` ${fmtTokens(usage.tokens)}/${fmtTokens(usage.contextWindow)}`
              : "";
          const cacheColor = cachePct >= 50 ? "success" : cachePct > 0 ? "accent" : "dim";

          const tokenStats = [
            theme.fg("accent", `${fmtTokens(input)}/${fmtTokens(output)}`),
            theme.fg("warning", `$${cost.toFixed(2)}`) +
              theme.fg("dim", `/${wppCostedMessages > 0 ? `$${wppCost.toFixed(2)}` : "--"}-wpp`),
            theme.fg(pctColor, `${pct.toFixed(0)}%`) + theme.fg("dim", ctxMakeup),
            theme.fg(cacheColor, `⚡${cachePct}%`),
          ].join(" ");

          const elapsed = theme.fg("dim", `⏱${fmtElapsed(Date.now() - footerSessionStart)}`);
          const parts = ctx.cwd.split("/");
          const short = parts.length > 2 ? parts.slice(-2).join("/") : ctx.cwd;
          const cwdStr = theme.fg("muted", `⌂ ${short}`);
          const branch = footerData.getGitBranch();
          const branchStr = branch ? theme.fg("accent", `⎇ ${branch}`) : "";
          const thinking = pi.getThinkingLevel();
          const thinkColor =
            thinking === "high" || thinking === "xhigh"
              ? "warning"
              : thinking === "medium"
                ? "accent"
                : thinking === "low"
                  ? "dim"
                  : "muted";
          const modelStr = `${theme.fg(thinkColor, "◆")} ${theme.fg("accent", footerModelLabel(ctx.model))}`;
          const sep = theme.fg("dim", " | ");
          const infoParts = [tokenStats, elapsed];
          if (branchStr) infoParts.push(branchStr);
          return [
            truncateToWidth([modelStr, cwdStr].join(sep), width),
            truncateToWidth(infoParts.join(sep), width),
          ];
        },
      };
    });
  });
}
