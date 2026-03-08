# Deployment Guide

This guide covers installation, infrastructure layout, operations, and maintenance for BCK Manager Web.

## Supported Topologies

### Standalone

Use this when the web UI runs on the same machine as BCK Manager.

- Web API, frontend, SQLite metadata DB, and BCK Manager live on one host.
- Simplest deployment model.
- Best for single-server or single-tenant environments.

### Hub

Use this when one control plane manages multiple remote hosts.

- Central web UI runs on a hub host.
- Remote hosts are integrated either by agent or by SSH.
- Agents connect outbound to the hub, which avoids common NAT and firewall problems.

## Prerequisites

- Linux host with systemd.
- BCK Manager already installed on managed nodes.
- Python 3 available on hosts.
- Node.js 20+ on the machine that executes the frontend build.
- A reverse proxy for production, preferably Caddy.

## Key Files

- Environment template: [../.env.example](../.env.example)
- Web installer: [../install.sh](../install.sh)
- Agent installer: [../install-agent.sh](../install-agent.sh)
- Web service: [../bck-manager-web.service](../bck-manager-web.service)
- Agent service: [../bck-manager-agent.service](../bck-manager-agent.service)
- Caddy template: [../caddy/Caddyfile.template](../caddy/Caddyfile.template)

## Standalone Installation

1. Install BCK Manager on the target host.
2. Clone this repository to the host.
3. Run:

```bash
sudo bash install.sh
```

4. Edit `/opt/bck_manager_web/.env`.
5. Check the core values:

```env
BCK_WEB_MODE=standalone
BCK_WEB_HOST=127.0.0.1
BCK_WEB_PORT=8080
BCK_MANAGER_PATH=/opt/bck_manager
BCK_CONFIG_PATH=/opt/bck_manager/config.yaml
BCK_LOG_PATH=/var/log/bck_manager.log
BCK_WEB_DB_PATH=/opt/bck_manager_web/data/bck_manager_web.db
```

6. Enable and start the service:

```bash
sudo systemctl enable --now bck-manager-web
```

7. Open the UI and create the first admin account.

## Hub Installation

1. Install the hub using [../install.sh](../install.sh).
2. Set `BCK_WEB_MODE=hub` in `/opt/bck_manager_web/.env`.
3. Publish the hub behind TLS.
4. Confirm that the hub can serve WebSocket endpoints through the reverse proxy.
5. Add remote servers from the Fleet section in the UI.

Recommended hub checks:

- `/api/v1/system/status` returns successfully.
- `/docs` is reachable for API reference.
- Reverse proxy forwards WebSockets correctly.

## Agent Installation

1. Run on the remote node:

```bash
sudo bash install-agent.sh
```

2. Edit `/opt/bck_manager_agent/.env`:

```env
BCK_AGENT_HUB_URL=wss://hub.example.com/api/v1/fleet/agent-ws
BCK_AGENT_AGENT_TOKEN=<token-from-hub>
BCK_AGENT_BCK_MANAGER_PATH=/opt/bck_manager
BCK_AGENT_CONFIG_PATH=/opt/bck_manager/config.yaml
```

3. Enable and start the service:

```bash
sudo systemctl enable --now bck-manager-agent
```

4. Verify the server becomes online in the Fleet UI.

## SSH-Managed Nodes

The hub also supports SSH-managed nodes.

Use this when:

- you do not want to install the agent;
- the host is reachable from the hub;
- SSH keys and allowed users are already managed.

Document and control:

- SSH user
- SSH port
- SSH key path
- BCK Manager path
- BCK Manager config path

## Environment Variables

See [../.env.example](../.env.example) for the full web application template.

Important groups:

- Deployment mode and bind settings.
- JWT secret and token lifetimes.
- BCK Manager integration paths.
- SQLite metadata database path.
- Update checker metadata.
- Caddy/TLS variables.

## Reverse Proxy And TLS

For production, bind Uvicorn to `127.0.0.1` and publish only through a reverse proxy.

### Caddy

Use [../caddy/Caddyfile.template](../caddy/Caddyfile.template) as the baseline.

Core behaviors already included:

- TLS termination
- WebSocket forwarding
- hardened response headers
- reverse proxy to `127.0.0.1:8080`

Typical flow:

1. Copy the template to `/etc/caddy/Caddyfile`.
2. Export or substitute `CADDY_HOSTNAME`, `CADDY_ACME_EMAIL`, and the TLS directive.
3. Reload Caddy.

## Systemd Operations

### Web

```bash
sudo systemctl status bck-manager-web
sudo journalctl -u bck-manager-web -f
sudo systemctl restart bck-manager-web
```

### Agent

```bash
sudo systemctl status bck-manager-agent
sudo journalctl -u bck-manager-agent -f
sudo systemctl restart bck-manager-agent
```

## Data And Backup Strategy

The web application stores metadata in SQLite only.

Data to preserve:

- `/opt/bck_manager_web/.env`
- `/opt/bck_manager_web/data/bck_manager_web.db`
- the authoritative BCK Manager configuration file

Backup recommendation:

1. Stop the web service.
2. Copy the SQLite DB and `.env`.
3. Restart the service.

## Upgrades

Recommended upgrade flow:

1. Backup `.env`, SQLite DB, and the BCK Manager config.
2. Pull the new repository revision.
3. Review [../CHANGELOG.md](../CHANGELOG.md).
4. Re-run the installer.
5. Restart services.
6. Validate login, jobs, fleet status, and logs.

## Rollback Basics

1. Stop impacted services.
2. Restore the prior repository revision.
3. Restore `.env` and the SQLite DB if schema changes were involved.
4. Restart services.

## Troubleshooting

### Installer fails on Node version

The frontend build requires Node.js 20+.

### UI loads but jobs do not appear

Check:

- `BCK_MANAGER_PATH`
- `BCK_CONFIG_PATH`
- file permissions on the BCK Manager config

### Logs page is empty

Check `BCK_LOG_PATH` and whether the service user can read the file.

### Agent stays offline

Check:

- outbound connectivity from the agent to the hub
- TLS trust and WebSocket path
- `BCK_AGENT_HUB_URL`
- `BCK_AGENT_AGENT_TOKEN`

### Terminal access fails

Check both user-side and server-side terminal allowlists in the application.

## Production Checklist

- Use a strong random `BCK_WEB_SECRET_KEY`.
- Keep Uvicorn bound to localhost.
- Terminate TLS at the reverse proxy.
- Restrict SSH credentials for hub-managed nodes.
- Protect `.env` with filesystem permissions.
- Back up the SQLite metadata database and BCK Manager config.
- Review GitHub issue reports carefully because they are currently the public support channel.