# Pi footer

A separate, two-line footer for the Pi terminal interface.

The first line shows the provider, model and folder.
The second line shows tokens, costs, context use, cache use, elapsed time and the Git branch.
The footer uses Pi's active theme and limits each line to the terminal width.

## Install

```bash
pi install git:github.com/rossmeyerza/pi-footer
```

Run `/reload` in Pi after installation.
Disable other custom footers to prevent conflicts.
Remove any separate copy of this extension before installation to prevent duplicate registration.

## Costs

The first cost is the total from Pi's assistant messages and WPP polish entries.
The optional `-wpp` cost uses WPP cost metadata when the session contains it.
The footer shows `--` when that metadata is absent.
WPP costs are reference estimates, not personal charges.
The footer works with other providers and does not require the WPP extension.

## Local development

Load the source directly:

```bash
pi -e ./index.ts
```

The extension registers the footer for each session and removes its timer when Pi disposes the footer.
