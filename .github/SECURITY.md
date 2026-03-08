# Security Policy

## Reporting A Vulnerability

At the moment, the project uses GitHub issues as the public support and reporting channel.

If you discover a security issue:

1. Open a GitHub issue with the minimum information needed to describe the impact.
2. Avoid publishing exploit details, secrets, tokens, private endpoints, or customer data.
3. State clearly that the report is security-sensitive.

This is a temporary compromise. For a public project, a private reporting channel is recommended and should be added in a future revision.

## What To Include

- affected version or commit;
- deployment mode involved;
- impact summary;
- reproduction conditions;
- mitigation ideas, if known.

## Hardening Recommendations

- Keep `BCK_WEB_HOST` bound to localhost behind a reverse proxy.
- Use a strong random `BCK_WEB_SECRET_KEY`.
- Protect `.env` files with restrictive permissions.
- Do not expose raw Uvicorn directly to the Internet.
- Restrict SSH credentials and terminal allowlists.
- Review logs and audit activity after admin or fleet changes.

## Scope Notes

The repository includes a reference `BCK_Manager/` directory. Security reports should clarify whether the issue affects the web control plane, the reference backup engine, or both.