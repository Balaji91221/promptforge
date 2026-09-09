# Security Policy

## Supported versions

PromptForge is pre-1.0. Only the latest commit on `main` receives security
fixes.

| Version | Supported |
|---|---|
| `main` | yes |
| anything older | no |

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Use GitHub's private reporting instead:

1. Go to the repository's **Security** tab.
2. Click **Report a vulnerability**.
3. Describe the issue, the affected file or component, and steps to reproduce.

You will get an acknowledgement within 7 days. Once a fix is ready it is
released on `main` and the advisory is published with credit to the reporter,
unless they prefer to stay anonymous.

## What counts

Anything that breaks the project's privacy promise or lets an attacker act on
a user's behalf, for example:

- The extension sending the user's text anywhere other than the provider the
  user configured, or sending it without an explicit tap.
- API keys leaking out of `chrome.storage.local` (logs, sync, third parties).
- A chat site being able to read or overwrite the extension's stored config.
- Prompt-injection paths where page content can alter the rewrite request.
- Remote-code or dependency issues in the build that ship to users.

## Design notes for reviewers

- The browser extension is local-first. Text leaves the device only when the
  user taps **Forge**, and only to the model provider they configured with
  their own key. Keys are stored in `chrome.storage.local`, device-scoped.
- The manifest requests host permissions only for supported chat sites and
  provider API hosts. It never requests `<all_urls>`.
- Provider calls run in the background service worker, never in page context.
- `apps/backend` is an optional development proxy. It is not deployed by this
  repository and is not required for the extension to work.

## Dependencies

Dependabot opens weekly pull requests for npm and GitHub Actions updates.
`npm audit` is part of the contributor checklist, not a blocking CI step,
because upstream advisories in unused code paths would otherwise block
unrelated work.
