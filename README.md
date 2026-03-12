# BCK Manager Web

BCK Manager Web is a web control plane for BCK Manager. It provides a FastAPI backend, a React frontend, and an optional remote agent so backup jobs can be managed from a browser instead of only through local CLI workflows.

The repository supports two operating modes:

- `standalone`: web UI and API run on the same host as BCK Manager.
- `hub`: a central control plane manages multiple hosts through remote agents or SSH.

## What This Repository Contains

- `backend/`: FastAPI API, authentication, SQLite metadata, orchestration services.
- `frontend/`: React + TypeScript UI.
- `agent/`: optional remote agent for hub-and-spoke deployments.
- `docs/`: deployment and architecture documentation.
- `BCK_Manager/`: local reference copy of the underlying backup engine sources. Treat it as read-only reference material.

## Features

- JWT cookie authentication with first-run setup flow.
- Backup job CRUD backed by the BCK Manager YAML configuration.
- Job execution and status tracking from the UI.
- Storage browsing and restore flows.
- Cron-backed scheduling.
- Live log streaming.
- Browser terminal with access controls.
- Fleet management through agents or SSH.

## Architecture Modes

| Mode | Use case | Entry point |
| --- | --- | --- |
| Standalone | One server, local BCK Manager | `install.sh` |
| Hub | Central UI for multiple servers | `install.sh` on hub |
| Agent | Remote server managed by hub | `install-agent.sh` |

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for installation and operations, and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for component-level design.

## Quick Start

### Standalone

1. Install BCK Manager on the target host.
2. Review [.env.example](.env.example).
3. Run the web installer:

```bash
sudo bash install.sh
```

4. Edit `/opt/bck_manager_web/.env`.
5. Start the service:

```bash
sudo systemctl start bck-manager-web
```

6. Open `http://<server>:8080` — on the first visit the app automatically redirects to the setup wizard at `/setup` where you create the initial admin account.

### Hub + Agents

1. Install the hub with `install.sh`.
2. Set `BCK_WEB_MODE=hub` in `/opt/bck_manager_web/.env`.
3. Generate an agent token in the web UI.
4. Install the agent on each remote node:

```bash
sudo bash install-agent.sh
```

5. Edit `/opt/bck_manager_agent/.env` with the hub URL and token.
6. Start the agent service:

```bash
sudo systemctl start bck-manager-agent
```

## Requirements

### Runtime

- Linux host with systemd.
- Python 3.10+ recommended.
- Node.js 20+ for building the frontend.
- Existing BCK Manager installation on the local machine or remote nodes.

### Local Development

- Python tooling for `backend/` and `agent/`.
- Node.js 20.19+ or newer for `frontend/`.

## Repository References

- Environment template: [.env.example](.env.example)
- Web installer: [install.sh](install.sh)
- Agent installer: [install-agent.sh](install-agent.sh)
- Caddy reverse proxy template: [caddy/Caddyfile.template](caddy/Caddyfile.template)
- Web service unit: [bck-manager-web.service](bck-manager-web.service)
- Agent service unit: [bck-manager-agent.service](bck-manager-agent.service)
- Changelog: [CHANGELOG.md](CHANGELOG.md)
- Contributing guide: [.github/CONTRIBUTING.md](.github/CONTRIBUTING.md)
- Security policy: [.github/SECURITY.md](.github/SECURITY.md)

## Operational Notes

- The web application stores app metadata in SQLite. Backup jobs remain sourced from the BCK Manager configuration.
- Do not expose the Uvicorn bind directly to the Internet. Place Caddy or another reverse proxy in front of it.
- Secrets belong in `.env` and the BCK Manager configuration, never in Git.
- Logs are written to both stdout (captured by journald) and rotating log files. Configure log level and path via `BCK_WEB_LOG_LEVEL` / `BCK_WEB_LOG_FILE` (web) or `BCK_AGENT_LOG_LEVEL` / `BCK_AGENT_LOG_FILE` (agent). Set level to `DEBUG` for troubleshooting.
- Public GitHub issues are the current support channel. See [.github/SECURITY.md](.github/SECURITY.md) before reporting security-sensitive issues.

## Version

Current application version: `0.2.0`.

The version is defined in **`backend/config.py`** (`app_version`) and is served
by the backend at `GET /api/v1/system/status`. The dashboard reads it from
that endpoint — there is no separate version file to update in the frontend.
Keep `frontend/package.json` `"version"` in sync when cutting a release.

## License

This repository is released under the MIT License. See [LICENSE](LICENSE).