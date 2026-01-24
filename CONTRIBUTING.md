# Contributing

Thanks for your interest in Desktop Commander.

## Development setup

- Install Node.js 18+
- Install dependencies: `npm install`
- Start dev: `npm run electron:dev`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`

## Safety expectations

This app can control windows, processes, and files. Please be extra careful when changing anything related to:

- file deletion/moves/copies
- process termination
- system sleep/lock
- permission/confirmation gating

Any change that expands tool capability should include:

- a clear explanation in the PR description
- updated documentation if user-facing behavior changes

## Pull requests

- Keep PRs focused and small.
- Prefer adding/adjusting guardrails rather than weakening them.
- Run `npm run typecheck` and `npm run lint` before opening a PR.

## Reporting security issues

Please do not open public issues for security reports. See [SECURITY.md](SECURITY.md).
