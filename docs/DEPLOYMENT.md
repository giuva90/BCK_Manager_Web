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
BCK_WEB_LOG_LEVEL=INFO
BCK_WEB_LOG_FILE=/var/log/bck_manager_web/web.log
```

6. Enable and start the service:

```bash
sudo systemctl enable --now bck-manager-web
```

7. Open the UI in a browser and complete the first-run setup wizard.

### First-run setup wizard

On the first visit after a clean installation, BCK Manager Web detects that no users exist in the database and automatically redirects the browser to the setup wizard at `/setup`.  If you navigate directly to the host URL (e.g. `http://<server>:8080`) the app will redirect you there automatically.

The wizard asks for:

- **Username** — the initial admin account name (minimum 3 characters)
- **Email** — used for account identification
- **Password** — minimum 8 characters

After submitting, the admin account is created and you are logged in immediately.  The status endpoint (`GET /api/v1/setup`) will return `{"needs_setup": false}` once any user exists.  If you attempt to submit the creation form again (`POST /api/v1/setup`), the server returns HTTP 410 Gone, preventing accidental re-setup.

> **Tip:** if you receive `{"detail":"Not Found"}` when navigating to the setup wizard, the most common cause is that the frontend static files were not built or are not reachable. Verify that `frontend/dist/` exists inside `$APP_DIR` and that the service started without errors:
>
> ```bash
> sudo journalctl -u bck-manager-web -n 50
> tail -f /var/log/bck_manager_web/web.log
> ```

## Hub Installation

1. Install the hub using [../install.sh](../install.sh).
2. Set `BCK_WEB_MODE=hub` in `/opt/bck_manager_web/.env`.
3. Publish the hub behind TLS.
4. Confirm that the hub can serve WebSocket endpoints through the reverse proxy.
5. Add remote servers from the Fleet section in the UI.
6. Optionally register the hub itself as a "local" fleet node to manage its own backups through the Fleet UI.

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
BCK_AGENT_LOG_LEVEL=INFO
BCK_AGENT_LOG_FILE=/var/log/bck_manager_agent/agent.log
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
- Logging level and log file paths.
- Update checker metadata.
- Caddy/TLS variables.

### Logging Configuration

#### Web Interface

| Variable | Default | Description |
| --- | --- | --- |
| `BCK_WEB_LOG_LEVEL` | `INFO` | Python log level: `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL` |
| `BCK_WEB_LOG_FILE` | `/var/log/bck_manager_web/web.log` | Absolute path to the web application log file |

#### Agent

| Variable | Default | Description |
| --- | --- | --- |
| `BCK_AGENT_LOG_LEVEL` | `INFO` | Python log level: `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL` |
| `BCK_AGENT_LOG_FILE` | `/var/log/bck_manager_agent/agent.log` | Absolute path to the agent log file |

Logs are written simultaneously to:

1. **stdout/stderr** — captured by `journalctl` when running as a systemd service.
2. **rotating log files** — 10 MB per file, 5 backup files retained.

Set the level to `DEBUG` for maximum verbosity during troubleshooting.  Revert to `INFO` or `WARNING` for normal operation.

```bash
# Example: enable debug logging for the web interface
sudo sed -i 's/^BCK_WEB_LOG_LEVEL=.*/BCK_WEB_LOG_LEVEL=DEBUG/' /opt/bck_manager_web/.env
sudo systemctl restart bck-manager-web

# View logs
tail -f /var/log/bck_manager_web/web.log
sudo journalctl -u bck-manager-web -f
```

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

# Log file (in addition to journalctl)
tail -f /var/log/bck_manager_web/web.log
```

### Agent

```bash
sudo systemctl status bck-manager-agent
sudo journalctl -u bck-manager-agent -f
sudo systemctl restart bck-manager-agent

# Log file (in addition to journalctl)
tail -f /var/log/bck_manager_agent/agent.log
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
4. Re-run the installer (it will stop the service automatically if running).
5. Restart services.
6. Validate login, jobs, fleet status, and logs.

## Versioning

The application version is the **single source of truth** defined in `backend/config.py` (`app_version`).

- It is served by the API at `GET /api/v1/system/status` → `"version"` field.
- The dashboard **reads it from the API** — no frontend rebuild is needed to display the correct version.
- `frontend/package.json` `"version"` should be kept in sync with `app_version` when cutting a release.
- `CHANGELOG.md` must have a matching `## <version>` entry.

When bumping the version, update these three files:

```
backend/config.py          app_version = "x.y.z"
frontend/package.json      "version": "x.y.z"
CHANGELOG.md               ## x.y.z - YYYY-MM-DD
```

## Rollback Basics

1. Stop impacted services.
2. Restore the prior repository revision.
3. Restore `.env` and the SQLite DB if schema changes were involved.
4. Restart services.

## Local Development on Windows

This section covers running the full stack locally on a Windows machine for UI development and testing.  No systemd or Caddy is required — Uvicorn and the Vite dev server are sufficient.

### Prerequisites

- Python 3.10+ (in PATH)
- Node.js 20+
- An installed copy of BCK Manager for Windows.  Run the PowerShell installer from the `BCK_Manager/` folder (elevated prompt):

```powershell
powershell -ExecutionPolicy Bypass -File BCK_Manager\install.ps1
```

This places BCK Manager files under `C:\ProgramData\bck_manager` and creates `config.yaml` from the example template.  Edit `C:\ProgramData\bck_manager\config.yaml` with real or stub S3 credentials before starting the backend.

### 1 — Create a `.env` file

Copy the example template and adjust all Linux paths to Windows equivalents:

```powershell
Copy-Item .env.example .env
```

Minimal set of values to change — edit `.env` with any text editor:

```env
BCK_WEB_MODE=standalone
BCK_WEB_HOST=127.0.0.1
BCK_WEB_PORT=8080

# Generate with: python -c "import secrets; print(secrets.token_urlsafe(48))"
BCK_WEB_SECRET_KEY=CHANGE_ME_STRONG_RANDOM_STRING_MIN_32_CHARS

BCK_MANAGER_PATH=C:/ProgramData/bck_manager
BCK_CONFIG_PATH=C:/ProgramData/bck_manager/config.yaml
BCK_LOG_PATH=C:/ProgramData/bck_manager/bck_manager.log

BCK_WEB_DB_PATH=C:/ProgramData/bck_manager_web/bck_web.db
BCK_WEB_LOG_LEVEL=DEBUG
BCK_WEB_LOG_FILE=C:/ProgramData/bck_manager_web/web.log
```

> **Note:** use forward slashes (`/`) or escaped backslashes (`\\`) in `.env` values — Python's `os.makedirs` handles both on Windows.

Generate the secret key and paste it in:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

### 2 — Start the backend

Open a terminal in the repository root.

```powershell
# Create and activate a virtual environment
python -m venv .venv
.venv\Scripts\Activate.ps1

# Install backend dependencies
pip install -r backend\requirements.txt

# Run Uvicorn
uvicorn backend.main:app --host 127.0.0.1 --port 8080 --reload
```

The API is now live at `http://localhost:8080/api/v1`.  Interactive docs are at `http://localhost:8080/api/docs`.

> If `python-crontab` raises an import error on Windows, it can be skipped for UI testing — the cron router will simply return errors when called.

### 3 — Start the frontend dev server

Open a second terminal in the repository root.

```powershell
cd frontend
npm install
npm run dev
```

The Vite dev server starts at `http://localhost:5173`.  All `/api` requests are proxied to the backend automatically (configured in `vite.config.ts`).  The proxy target port is read from `BCK_WEB_PORT` in the root `.env` file — if you change the backend port, only `.env` needs updating, no changes to `vite.config.ts` are required.

### 4 — First-run setup wizard

Open `http://localhost:5173` in a browser.  The app detects that no users exist and redirects to `/setup`.  Create the initial admin account there.

### 5 — Working with a stub config

If you do not have a real S3 endpoint available, the web UI will still function for authentication, job CRUD, and most navigation.  Operations that actually execute a backup or browse storage will return errors, which is acceptable for frontend testing.  Add at least one dummy job to `config.yaml`:

```yaml
backup_jobs:
  - name: "test-job"
    source_path: "C:/Temp"
    bucket: "test-bucket"
    s3_endpoint: "my-endpoint"
    prefix: "local-test"
    mode: "folder"
    enabled: true
```

### Stopping the stack

```powershell
# Stop Vite: Ctrl+C in its terminal
# Stop Uvicorn: Ctrl+C in its terminal
# Deactivate venv:
deactivate
```

## Troubleshooting

### Enable debug logging

Set `BCK_WEB_LOG_LEVEL=DEBUG` (or `BCK_AGENT_LOG_LEVEL=DEBUG` for the agent) in the corresponding `.env` file and restart the service.  Debug mode logs every command, SQL query detail, SSH session, and WebSocket message.

```bash
# Enable debug logging for the web interface
sudo sed -i 's/^BCK_WEB_LOG_LEVEL=.*/BCK_WEB_LOG_LEVEL=DEBUG/' /opt/bck_manager_web/.env
sudo systemctl restart bck-manager-web

# Watch the log in real time
tail -f /var/log/bck_manager_web/web.log
sudo journalctl -u bck-manager-web -f
```

To revert, set the value back to `INFO` (or `WARNING` for even quieter operation):

```bash
sudo sed -i 's/^BCK_WEB_LOG_LEVEL=.*/BCK_WEB_LOG_LEVEL=INFO/' /opt/bck_manager_web/.env
sudo systemctl restart bck-manager-web
```

### Setup wizard shows `{"detail":"Not Found"}`

This means the browser is reaching the FastAPI backend but the frontend static files are not being served.  Common causes:

1. **Frontend was not built** — the installer must have been interrupted before the `npm run build` step.  Re-run `sudo bash install.sh` from the repository root.
2. **Wrong working directory** — `install.sh` must be executed from the repository root where `frontend/` is a subdirectory.
3. **Permissions** — the service user (`bckweb`) must be able to read `$APP_DIR/frontend/dist/`.

Verify the dist exists:

```bash
ls /opt/bck_manager_web/frontend/dist/index.html
```

If missing, rebuild manually:

```bash
cd /path/to/BCK_Manager_Web
npm ci --prefix frontend && npm run build --prefix frontend
sudo cp -r frontend/dist /opt/bck_manager_web/frontend/
sudo chown -R bckweb:bckweb /opt/bck_manager_web/frontend/
sudo systemctl restart bck-manager-web
```

### Installer fails on Node version

The frontend build requires Node.js 20+.

### UI loads but jobs do not appear

Check:

- `BCK_MANAGER_PATH`
- `BCK_CONFIG_PATH`
- file permissions on the BCK Manager config
- web log file for errors: `tail -f /var/log/bck_manager_web/web.log`

### Logs page is empty

Check `BCK_LOG_PATH` and whether the service user can read the file.

### Agent stays offline

Check:

- outbound connectivity from the agent to the hub
- TLS trust and WebSocket path
- `BCK_AGENT_HUB_URL`
- `BCK_AGENT_AGENT_TOKEN`
- agent log file: `tail -f /var/log/bck_manager_agent/agent.log`

### Terminal access fails

Check both user-side and server-side terminal allowlists in the application.

## Production Checklist

- Use a strong random `BCK_WEB_SECRET_KEY`.
- Keep Uvicorn bound to localhost.
- Terminate TLS at the reverse proxy.
- Restrict SSH credentials for hub-managed nodes.
- Protect `.env` with filesystem permissions.
- Back up the SQLite metadata database and BCK Manager config.
- Verify log file paths are writable by the service user.
- Set `BCK_WEB_LOG_LEVEL=INFO` for production (use `DEBUG` only for troubleshooting).
- Review GitHub issue reports carefully because they are currently the public support channel.