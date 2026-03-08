# Contributing

Thanks for contributing to BCK Manager Web.

## Scope

Contributions are welcome for:

- backend API behavior;
- frontend UX and reliability;
- deployment assets and documentation;
- fleet, agent, and infrastructure integrations;
- tests and CI improvements.

## Before Opening A Pull Request

1. Open an issue for significant changes.
2. Keep changes focused and easy to review.
3. Avoid mixing refactors with behavior changes unless they are inseparable.
4. Do not commit secrets, `.env` files, or live infrastructure data.

## Development Expectations

- Keep `BCK_Manager/` as reference material unless a change explicitly targets the reference copy.
- Preserve the split between SQLite metadata and the BCK Manager configuration source of truth.
- Prefer fixing the root cause over adding surface-level patches.
- Keep docs updated when install paths, environment variables, or runtime assumptions change.

## Validation

Before submitting, run the relevant checks for your change.

Typical examples:

- backend dependency install and startup validation;
- frontend type-check;
- frontend build on Node.js 20+;
- smoke checks for installers or systemd assets when those files change.

## Pull Request Guidelines

- Explain what changed and why.
- Include operational impact if deployment or config behavior changed.
- Note any follow-up work deliberately left out.
- Link the related issue.

Use the pull request template when opening the PR.