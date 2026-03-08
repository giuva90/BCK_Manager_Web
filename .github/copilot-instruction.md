# BCK Manager Web — GitHub Copilot Instructions

> **Project**: BCK Manager Web
> **Purpose**: A modern, self-hosted web application that exposes all BCK Manager
> functionality through a polished browser interface, with optional centralized
> multi-server fleet management.
> **BCK Manager repo**: https://github.com/giuva90/BCK_Manager
> **BCK Manager install path (per-server)**: `/opt/bck_manager`

---

## 1. Project Vision & Deployment Modes

BCK Manager Web supports **two deployment modes** that can coexist:

### Mode A — Standalone (single server)
The web app installs on the same machine as BCK Manager. One server, one UI.
This is the default and simplest scenario.

```
[Browser] ──HTTPS──► [BCK Manager Web]  (port 443 via Caddy)
                            │
                     imports directly
                            │
                     [BCK Manager Python modules]
                     /opt/bck_manager/
```

### Mode B — Hub & Spoke (fleet management)
A dedicated **Central Hub** server runs the UI and coordinates multiple remote
**Agent** servers. Each agent has BCK Manager installed. Additionally, the Hub
can manage machines via **SSH only** (no agent required).

```
[Browser] ──HTTPS──► [Central Hub]  (UI + orchestration)
                           │
              ┌────────────┼────────────┐
              │            │            │
         WebSocket    WebSocket      SSH only
         (Agent-1)   (Agent-N)   (bare-server)
```

**Key architectural constraint**: agents initiate the connection to the Hub
(not the other way around). This solves NAT traversal, firewall restrictions,
and dynamic IPs without requiring any inbound port on agent machines.

---

## 2. Tech Stack

### Backend
| Layer | Choice | Rationale |
|---|---|---|
| Language | **Python 3.10+** | Same as BCK Manager; direct module import |
| Framework | **FastAPI** | Async, WebSocket native, OpenAPI auto-docs |
| ASGI server | **Uvicorn** | Lightweight, production-ready |
| Reverse proxy | **Caddy** | Automatic HTTPS (Let's Encrypt + self-signed), zero-config TLS |
| Database | **SQLite** via **SQLModel** | No external dependency; users, sessions, fleet, audit |
| Auth | **JWT** (python-jose) + **bcrypt** | Stateless, httpOnly cookies |
| Agent communication | **WebSocket** (FastAPI native) | Persistent, bidirectional, agent-initiated |
| SSH management | **asyncssh** | SSH-only machines (no agent), web terminal |
| Web terminal | **asyncssh** + **ptyprocess** (backend) + **xterm.js** (frontend) | Browser console |
| Cron management | **python-crontab** | Read/write root's crontab |
| BCK Manager integration | **Direct Python import** | Preferred over CLI subprocess |
| Process execution | `asyncio.run_in_executor` (ThreadPoolExecutor) | Run sync BCK Manager functions non-blocking |
| Update checker | GitHub Releases API (polling) | Version comparison, one-click update |

### Frontend
| Layer | Choice |
|---|---|
| Framework | **React 18** + **TypeScript** |
| Build tool | **Vite** |
| UI components | **shadcn/ui** (Radix UI + Tailwind CSS) |
| State | **Zustand** |
| Data fetching | **TanStack Query** (React Query) |
| Forms | **React Hook Form** + **Zod** |
| Charts | **Recharts** |
| Terminal emulator | **xterm.js** + **xterm-addon-fit** |
| Icons | **Lucide React** |
| Toasts | **Sonner** |

---

## 3. Repository Structure

```
BCK_Manager_Web/
├── backend/
│   ├── main.py                      # FastAPI app factory, router includes, lifespan
│   ├── config.py                    # App settings (pydantic-settings, reads .env)
│   ├── database.py                  # SQLite engine + session factory
│   ├── models/
│   │   ├── user.py                  # User, Role ORM models
│   │   ├── audit.py                 # AuditLog ORM model
│   │   ├── cron_job.py              # CronJob metadata ORM model
│   │   ├── server.py                # Server (agent or SSH-only) ORM model
│   │   └── agent_session.py         # Active agent WebSocket session model
│   ├── schemas/
│   │   ├── user.py
│   │   ├── backup.py
│   │   ├── s3.py
│   │   ├── cron.py
│   │   └── server.py
│   ├── routers/
│   │   ├── auth.py                  # /auth/*
│   │   ├── users.py                 # /users/* (admin only)
│   │   ├── jobs.py                  # /jobs/*
│   │   ├── run.py                   # /run/*
│   │   ├── restore.py               # /restore/*
│   │   ├── retention.py             # /retention/*
│   │   ├── storage.py               # /storage/*
│   │   ├── filesystem.py            # /filesystem/*
│   │   ├── cron.py                  # /cron/*
│   │   ├── logs.py                  # /logs/*
│   │   ├── terminal.py              # /terminal/*
│   │   ├── fleet.py                 # /fleet/*
│   │   ├── system.py                # /system/*
│   │   └── setup.py                 # /setup (one-time first-admin)
│   ├── services/
│   │   ├── bck_bridge.py            # BCK Manager Python API integration
│   │   ├── config_manager.py        # Read/write config.yaml (atomic)
│   │   ├── cron_manager.py          # python-crontab wrapper
│   │   ├── log_watcher.py           # Tail log + WebSocket broadcast
│   │   ├── download_proxy.py        # Stream S3 objects to browser
│   │   ├── agent_hub.py             # Hub-side: manage agent WebSocket sessions
│   │   ├── ssh_client.py            # asyncssh wrapper for SSH-only machines
│   │   ├── terminal_manager.py      # Web terminal session lifecycle
│   │   └── update_checker.py        # GitHub Releases version check + self-update
│   ├── auth/
│   │   ├── jwt.py
│   │   ├── dependencies.py          # Depends: get_current_user, require_admin, etc.
│   │   └── password.py
│   └── requirements.txt
│
├── agent/                           # Lightweight agent (installed on remote servers)
│   ├── agent_main.py                # Entry point: connects to Hub, handles commands
│   ├── agent_config.py              # Agent settings (.env)
│   ├── agent_bridge.py              # Local BCK Manager integration
│   ├── agent_protocol.py            # WebSocket message schema (shared with Hub)
│   └── requirements.txt             # Minimal: websockets, pydantic, PyYAML
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── router.tsx
│   │   ├── api/
│   │   ├── components/
│   │   │   ├── layout/              # AppShell, Sidebar, Topbar, ServerSwitcher
│   │   │   ├── jobs/                # JobCard, JobForm, JobWizard
│   │   │   ├── storage/             # BucketExplorer, ObjectTable, DownloadButton
│   │   │   ├── filesystem/          # LocalFolderPicker, DockerVolumePicker
│   │   │   ├── logs/                # LogViewer (WebSocket live)
│   │   │   ├── cron/                # CronBuilder, CronTable
│   │   │   ├── fleet/               # ServerCard, FleetOverview
│   │   │   ├── terminal/            # TerminalPane (xterm.js)
│   │   │   └── ui/                  # shadcn/ui re-exports
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── SetupPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── JobsPage.tsx
│   │   │   ├── JobDetailPage.tsx
│   │   │   ├── StorageExplorerPage.tsx
│   │   │   ├── RestorePage.tsx
│   │   │   ├── SchedulePage.tsx
│   │   │   ├── LogsPage.tsx
│   │   │   ├── TerminalPage.tsx
│   │   │   ├── FleetPage.tsx
│   │   │   ├── ServerDetailPage.tsx
│   │   │   ├── SettingsPage.tsx
│   │   │   └── UsersPage.tsx
│   │   ├── store/
│   │   └── lib/
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── package.json
│
├── caddy/
│   └── Caddyfile.template
├── install.sh                       # Idempotent installer (fresh + update)
├── install-agent.sh                 # Agent-only installer for remote servers
├── bck-manager-web.service          # systemd unit (Hub/standalone)
├── bck-manager-agent.service        # systemd unit (agent)
├── .env.example
└── README.md
```

---

## 4. HTTPS & TLS Architecture

### 4.1 Caddy as Reverse Proxy

The installer always installs **Caddy** as the TLS termination layer.
FastAPI/Uvicorn listens on `127.0.0.1:8080` (never exposed directly to the network).
Caddy listens on `0.0.0.0:443` and proxies to Uvicorn.

Benefits: the application never handles certificates. Upgrading TLS config means
editing the Caddyfile and reloading Caddy. HTTP → HTTPS redirect is always enabled.

### 4.2 TLS Modes (user selects during install)

**Mode 1: Automatic HTTPS with Let's Encrypt** (public domain)
```
# Caddyfile
backup.example.com {
    reverse_proxy 127.0.0.1:8080
}
```
Prerequisites: machine reachable on 80/443 from internet, domain resolves to this IP.

**Mode 2: Internal / LAN with self-signed certificate**
```
# Caddyfile
:443 {
    tls internal
    reverse_proxy 127.0.0.1:8080
}
```
Caddy generates a local CA and a proper self-signed cert. Installer prints
instructions for importing the CA into browsers.

**Mode 3: Bring Your Own Certificate** (existing cert, e.g. existing Let's Encrypt)
```
# Caddyfile
backup.example.com {
    tls /etc/ssl/bck/cert.pem /etc/ssl/bck/key.pem
    reverse_proxy 127.0.0.1:8080
}
```

### 4.3 Detecting Existing Let's Encrypt

The installer checks for certbot/acme.sh before proceeding:
```bash
if command -v certbot &>/dev/null; then
    EXISTING_CERTS=$(certbot certificates 2>/dev/null | grep "Certificate Name")
fi
if [ -d ~/.acme.sh ]; then
    EXISTING_ACME=true
fi
```
If found, the installer **offers to reuse existing cert paths** (switches to Mode 3).
**Never run Caddy ACME and certbot/acme.sh on the same domain** — they conflict.

### 4.4 Caddyfile Template

```
# /etc/caddy/Caddyfile  (generated by installer)
{
    admin off
    email {$CADDY_ACME_EMAIL}
}

{$CADDY_HOSTNAME} {
    {$CADDY_TLS_DIRECTIVE}

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
        Referrer-Policy "strict-origin-when-cross-origin"
        -Server
    }

    @websocket {
        header Connection *Upgrade*
        header Upgrade websocket
    }
    handle @websocket {
        reverse_proxy 127.0.0.1:8080
    }

    reverse_proxy 127.0.0.1:8080
}
```

---

## 5. Authentication & User Model

### 5.1 Roles

| Role | Permissions |
|---|---|
| `admin` | Full access: users, all jobs, all servers, settings, fleet management |
| `operator` | Run jobs, restore, explore storage, download, trigger retention, use terminal |
| `viewer` | Read-only: all GET endpoints, no mutations, no terminal |

### 5.2 User Model

```python
class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    email: str = Field(unique=True)
    hashed_password: str
    role: str = Field(default="operator")  # "admin" | "operator" | "viewer"
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: datetime | None = None
    # JSON list of system usernames this web user may access via terminal
    # e.g. '["ubuntu", "deploy"]' — set by admin per user
    allowed_system_users: str = Field(default="[]")
```

### 5.3 JWT & Session

- Access token: 8-hour expiry, `httpOnly` + `Secure` + `SameSite=Strict` cookie.
- Refresh token: 30-day expiry, same cookie policy.
- Payload: `{ sub: username, role: role, jti: uuid4 }`.
- Token revocation: SQLite table `revoked_tokens(jti, expires_at)` — cleaned daily.

### 5.4 First-Run Setup

On startup, if the `users` table is empty:
1. Log: `"[SETUP] No users found. Visit https://<host>/setup to create the first admin."`
2. Enable `POST /setup` endpoint.
3. After first admin created, `/setup` permanently returns `410 Gone`.

---

## 6. Fleet Architecture (Hub & Spoke)

### 6.1 Server Registry Model

```python
class Server(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(unique=True)
    hostname: str
    connection_type: str                    # "agent" | "ssh"
    # Agent-specific
    agent_token_hash: str | None = None     # bcrypt-hashed token
    agent_version: str | None = None
    last_seen: datetime | None = None
    # SSH-specific
    ssh_host: str | None = None
    ssh_port: int = Field(default=22)
    ssh_user: str | None = None
    ssh_key_path: str | None = None         # Path to private key on Hub
    # Common
    is_online: bool = Field(default=False)
    bck_manager_version: str | None = None
    bck_manager_path: str = Field(default="/opt/bck_manager")
    config_path: str = Field(default="/opt/bck_manager/config.yaml")
    notes: str = Field(default="")
    added_at: datetime = Field(default_factory=datetime.utcnow)
    # JSON list of system usernames available in the web terminal for this server
    terminal_users: str = Field(default="[]")
```

### 6.2 Agent WebSocket Protocol

All agent↔hub communication uses a **JSON message envelope** defined in
`agent_protocol.py` (copy this file to both `backend/` and `agent/`):

```python
from pydantic import BaseModel
from typing import Any, Literal

class AgentMessage(BaseModel):
    id: str           # UUID — correlates request to response
    type: Literal[
        # Hub → Agent (commands)
        "ping", "run_job", "run_all", "get_status", "get_jobs", "get_config",
        "list_backups", "restore_file", "restore_volume",
        "apply_retention", "preview_retention",
        "list_buckets", "browse_storage", "download_file",
        "browse_filesystem", "list_volumes", "list_containers",
        "get_logs", "stream_logs_start", "stream_logs_stop",
        # Agent → Hub (responses and push events)
        "pong", "result", "log_line",
        "job_started", "job_finished",
        "heartbeat",        # Sent by agent every 30s
        "registration",     # First message after WebSocket connect
    ]
    payload: dict[str, Any] = {}
    error: str | None = None
```

### 6.3 Agent Connection Lifecycle

```
Agent starts
    │
    ├─► Connect to wss://hub/api/v1/fleet/agent-ws
    │       Header: Authorization: Bearer <AGENT_TOKEN>
    │
    ├─► Send { type: "registration", payload: {
    │       agent_version, bck_manager_version, hostname,
    │       bck_config_path, capabilities: [...]
    │   }}
    │
    ├─► Hub verifies token → registers session in AgentHub
    │
    ├─► Heartbeat every 30s:
    │       { type: "heartbeat", payload: { running_jobs: [...], disk_usage: ... }}
    │       Hub marks agent offline after 90s without heartbeat.
    │
    └─► Handle incoming commands → send { type: "result", id: <same-id>, payload: ... }
```

### 6.4 Agent Hub Service (`agent_hub.py`)

```python
class AgentHub:
    """Registry of currently connected agents. Thread-safe."""
    _sessions: dict[int, AgentSession] = {}

    async def register(self, server_id: int, websocket: WebSocket): ...
    async def unregister(self, server_id: int): ...
    async def send_command(self, server_id: int, msg: AgentMessage) -> AgentMessage:
        """Send command and await correlated response. Timeout: 300s."""

    def is_online(self, server_id: int) -> bool: ...
    def get_all_status(self) -> list[dict]: ...
```

### 6.5 SSH-Only Machine Integration

For machines without an agent, the Hub uses **asyncssh**:

```python
# ssh_client.py
import asyncssh

async def run_remote_command(server: Server, command: str) -> tuple[str, str, int]:
    async with asyncssh.connect(
        server.ssh_host, port=server.ssh_port,
        username=server.ssh_user, client_keys=[server.ssh_key_path],
        known_hosts=None,  # TODO: implement known_hosts verification
    ) as conn:
        result = await conn.run(command)
        return result.stdout, result.stderr, result.exit_status

async def run_bck_manager(server: Server, args: list[str]) -> dict:
    """Run bck-manager with given args on a remote SSH server."""
    cmd = f"sudo /usr/local/bin/bck-manager {' '.join(args)} --config {server.config_path}"
    stdout, stderr, code = await run_remote_command(server, cmd)
    return {"stdout": stdout, "stderr": stderr, "exit_code": code, "success": code == 0}
```

### 6.6 Routing in bck_bridge.py (Hub Mode)

When operating in Hub mode, `bck_bridge.py` inspects `server_id` and routes:
- `connection_type == "agent"` + online → send command via `AgentHub.send_command()`
- `connection_type == "agent"` + offline → raise `HTTPException(503, "Agent offline")`
- `connection_type == "ssh"` → use `ssh_client.run_bck_manager()`

All callers use the same function signatures. Routing is transparent to callers.

### 6.7 Server Context in the UI

A **ServerSwitcher** component in the top navigation bar lets the user select which
server they are operating on. The selected `server_id` is stored in Zustand global state
and sent as a query parameter (`?server_id=N`) or path segment to all relevant API calls.
When switching servers, all TanStack Query caches for job/log/storage data are invalidated.
In standalone mode (no fleet), the ServerSwitcher is hidden.

---

## 7. Update System

### 7.1 Version Checking

```python
# update_checker.py
import httpx
from packaging import version

GITHUB_REPO = "giuva90/BCK_Manager_Web"
GITHUB_API = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest"

async def check_for_update(current_version: str) -> dict | None:
    """Returns update info if newer version available. Cached 6 hours."""
    async with httpx.AsyncClient() as client:
        response = await client.get(GITHUB_API, timeout=10)
        data = response.json()
    latest = data["tag_name"].lstrip("v")
    if version.parse(latest) > version.parse(current_version):
        return {
            "current": current_version,
            "latest": latest,
            "release_url": data["html_url"],
            "release_notes": data["body"],
            "published_at": data["published_at"],
        }
    return None
```

### 7.2 Update Endpoints

```
GET  /api/v1/system/update/check     → { available: bool, latest, notes }
POST /api/v1/system/update/apply     → SSE stream of update script output
```

`POST /apply` runs `update.sh` and streams stdout via SSE. The script:
1. `git fetch && git pull` (or download release tarball).
2. `pip install -r requirements.txt` in venv.
3. `npm ci && npm run build` for frontend.
4. Copy `dist/` to `/opt/bck_manager_web/static/`.
5. `systemctl restart bck-manager-web`.

The UI shows live progress and a "Refresh page" button when complete.

### 7.3 Agent Update Notifications

When the Hub detects an agent running an outdated version, a warning badge appears
on the server card in Fleet view. Agent updates must be applied manually per machine
(remote update is a future feature).

---

## 8. BCK Manager Integration Layer

### 8.1 Direct Import (Standalone / Hub-local)

```python
# bck_bridge.py
import sys, os, asyncio
from concurrent.futures import ThreadPoolExecutor

BCK_MANAGER_PATH = os.environ.get("BCK_MANAGER_PATH", "/opt/bck_manager")
if BCK_MANAGER_PATH not in sys.path:
    sys.path.insert(0, BCK_MANAGER_PATH)

from config_loader import load_config, get_enabled_jobs
from backup import run_backup_job, run_all_jobs
from restore import list_remote_backups, restore_file, restore_volume
from restore import list_buckets_for_endpoint, list_bucket_contents
from retention import apply_retention
from encryption import get_encryption_config
from docker_utils import docker_available, volume_exists, get_containers_using_volume
from s3_client import S3Client
from app_logger import setup_logger
from utils import format_size

_executor = ThreadPoolExecutor(max_workers=4)

async def run_in_thread(fn, *args):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_executor, fn, *args)
```

**Critical**: BCK Manager functions are synchronous and long-running. They MUST
always be called via `run_in_executor`. Never call them directly in an async handler.

### 8.2 Config Manager (`config_manager.py`)

```python
CONFIG_PATH = os.environ.get("BCK_CONFIG_PATH", "/opt/bck_manager/config.yaml")

def read_config(path: str = CONFIG_PATH) -> dict:
    with open(path, "r") as f:
        return yaml.safe_load(f)

def write_config(config: dict, path: str = CONFIG_PATH) -> None:
    """Atomic write: temp file + os.replace() — never corrupts on crash."""
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        yaml.dump(config, f, default_flow_style=False, allow_unicode=True)
    os.replace(tmp, path)

def validate_and_write(config: dict, path: str = CONFIG_PATH) -> None:
    """Validate via BCK Manager's own validator, then write atomically."""
    import tempfile
    with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
        yaml.dump(config, f)
        tmp_validation = f.name
    try:
        from config_loader import load_config
        load_config(tmp_validation)   # raises SystemExit on invalid config
    finally:
        os.unlink(tmp_validation)
    write_config(config, path)
```

**Never expose secrets in API responses.** Fields named `secret_key`, `passphrase`,
`password`, or `access_key` must be replaced with `"••••••••"` in GET responses.
Accept them in write requests only when a non-empty value is provided
(empty string = keep existing value unchanged).

### 8.3 Job State Tracking

```python
from enum import Enum
from dataclasses import dataclass

class JobStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"

@dataclass
class JobState:
    status: JobStatus = JobStatus.IDLE
    started_at: datetime | None = None
    finished_at: datetime | None = None
    last_result: dict | None = None
    triggered_by: str | None = None   # web username

# In-memory store, keyed by f"{server_id}:{job_name}"
_job_states: dict[str, JobState] = {}
```

---

## 9. API Endpoints Reference

All endpoints prefixed with `/api/v1`. All except `/auth/login` and `/setup` require JWT.

### Auth
```
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh
GET    /api/v1/auth/me
POST   /api/v1/setup              # 410 Gone after first admin created
```

### Users (admin only)
```
GET    /api/v1/users
POST   /api/v1/users
GET    /api/v1/users/{id}
PATCH  /api/v1/users/{id}         # role, password, active, allowed_system_users
DELETE /api/v1/users/{id}
```

### Fleet
```
GET    /api/v1/fleet/servers
POST   /api/v1/fleet/servers                    # Register agent or SSH server
GET    /api/v1/fleet/servers/{id}
PATCH  /api/v1/fleet/servers/{id}
DELETE /api/v1/fleet/servers/{id}
GET    /api/v1/fleet/servers/{id}/status        # Live online/offline + running jobs
POST   /api/v1/fleet/servers/{id}/test          # Ping agent / test SSH connectivity
POST   /api/v1/fleet/token/generate             # Generate agent registration token
WS     /api/v1/fleet/agent-ws                   # Agent WebSocket endpoint
```

### Backup Jobs (all accept optional ?server_id=N)
```
GET    /api/v1/jobs
POST   /api/v1/jobs
GET    /api/v1/jobs/{name}
PUT    /api/v1/jobs/{name}
DELETE /api/v1/jobs/{name}
PATCH  /api/v1/jobs/{name}/toggle
```

### Job Execution
```
POST   /api/v1/run/all              Body: { server_id? }
POST   /api/v1/run/job/{name}       Body: { server_id? }
GET    /api/v1/run/status           ?server_id=N
GET    /api/v1/run/status/{name}    ?server_id=N
```

### S3 Storage Explorer
```
GET    /api/v1/storage/buckets      ?endpoint=X&server_id=N
GET    /api/v1/storage/browse       ?endpoint=X&bucket=Y&prefix=Z&server_id=N
GET    /api/v1/storage/download     ?endpoint=X&bucket=Y&key=Z&server_id=N
                                    &decrypt=true&job=JOB_NAME
POST   /api/v1/storage/test         Body: { endpoint_name, server_id? }
```

### Filesystem Browser (admin only)
```
GET    /api/v1/filesystem/browse    ?path=/&server_id=N
GET    /api/v1/filesystem/volumes   ?server_id=N
GET    /api/v1/filesystem/containers?server_id=N
```

### Restore
```
GET    /api/v1/restore/{job}/list           ?server_id=N
POST   /api/v1/restore/{job}/file           Body: { s3_key, server_id? }
POST   /api/v1/restore/{job}/volume         Body: { s3_key, target_volume, mode, server_id? }
```

### Retention
```
POST   /api/v1/retention/preview    Body: { job_name?, server_id? }
POST   /api/v1/retention/apply      Body: { job_name?, server_id? }
```

### Cron
```
GET    /api/v1/cron                 ?server_id=N
POST   /api/v1/cron                 Body: { label, job_name?, cron_expression, server_id? }
PUT    /api/v1/cron/{id}
DELETE /api/v1/cron/{id}
GET    /api/v1/cron/{id}/next-runs
```

### Logs
```
GET    /api/v1/logs/tail            ?lines=100&server_id=N
WS     /api/v1/logs/stream          ?server_id=N
```

### Terminal
```
WS     /api/v1/terminal/connect     ?server_id=N&system_user=ubuntu
```

### System
```
GET    /api/v1/system/status
GET    /api/v1/system/config
PUT    /api/v1/system/settings
GET    /api/v1/system/update/check
POST   /api/v1/system/update/apply  (SSE stream)
```

---

## 10. S3 File Download Proxy

### Flow
1. Browser calls `GET /api/v1/storage/download?endpoint=X&bucket=Y&key=Z`.
2. Backend validates that `endpoint` matches a configured S3 endpoint (security check).
3. If `decrypt=false` (default): stream S3 object bytes directly using `StreamingResponse`.
   Never buffer the full file in memory.
4. If `decrypt=true&job=JOB_NAME`:
   a. Download to a temp file.
   b. Decrypt using `decrypt_file()` from BCK Manager's `encryption.py`.
   c. Stream decrypted file to browser.
   d. Delete temp file in `finally` block.

```python
from fastapi.responses import StreamingResponse

async def stream_s3_object(s3_client, bucket, key, filename):
    def iterfile():
        response = s3_client._client.get_object(Bucket=bucket, Key=key)
        for chunk in response["Body"].iter_chunks(chunk_size=8192):
            yield chunk
    return StreamingResponse(
        iterfile(),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
```

---

## 11. Web Terminal (Browser Console)

### 11.1 Architecture

```
[Browser xterm.js] ←── WebSocket ──► [FastAPI /terminal/connect]
                                              │
                                    asyncssh SSH connection
                                              │
                                     [Remote PTY session]
```

Works for both agent-managed and SSH-only servers (both use SSH).

### 11.2 Security Model — Double Gate

**Gate 1**: Check `requesting_web_user.allowed_system_users` (JSON list set by admin).
**Gate 2**: Check `server.terminal_users` (JSON list set per server by admin).
Both gates must pass. If either fails → close WebSocket with code 4003.

Additional rules:
- Only `admin` and `operator` roles can access the terminal. `viewer` is blocked at route level.
- Every terminal session open/close is written to the audit log (web user, server, system user, timestamps).
- Root (`root`) should not appear in `terminal_users` by default. An admin must explicitly add it.

### 11.3 Implementation

```python
# terminal_manager.py
import asyncssh, json

async def open_terminal_session(websocket, server: Server, system_user: str):
    await websocket.accept()
    try:
        async with asyncssh.connect(
            server.ssh_host, port=server.ssh_port,
            username=system_user, client_keys=[server.ssh_key_path],
            known_hosts=None,
            request_pty=True, term_type="xterm-256color",
        ) as conn:
            async with conn.create_process("bash -l") as process:
                await _bridge(websocket, process)
    except asyncssh.PermissionDenied:
        await websocket.close(code=4003, reason="SSH permission denied")
    except Exception as e:
        await websocket.close(code=4000, reason=str(e))

async def _bridge(websocket, process):
    import asyncio

    async def ws_to_ssh():
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg["type"] == "input":
                process.stdin.write(msg["data"])
            elif msg["type"] == "resize":
                process.change_terminal_size(msg["cols"], msg["rows"])

    async def ssh_to_ws():
        while True:
            data = await process.stdout.read(1024)
            if not data:
                break
            await websocket.send_text(json.dumps({"type": "output", "data": data}))

    await asyncio.gather(ws_to_ssh(), ssh_to_ws())
```

### 11.4 Frontend Terminal Component (xterm.js)

The `TerminalPane` component:
1. Opens WebSocket to `/api/v1/terminal/connect?server_id=N&system_user=ubuntu`.
2. Forwards keystrokes as `{ type: "input", data: string }`.
3. Sends resize events as `{ type: "resize", cols: N, rows: N }` on window resize.
4. Writes received `{ type: "output", data: string }` to the xterm instance.
5. Shows connection status badge and reconnect button.
6. Displays warning banner: "Connected as `ubuntu` on `server-prod-01`."

---

## 12. Cron Job Scheduling

### 12.1 CronJob Model (SQLite)

```python
class CronJob(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    label: str
    server_id: int | None = None       # None = local server in standalone mode
    job_name: str | None = None        # None = --run-all
    command: str                       # Full shell command
    cron_expression: str               # e.g. "0 2 * * *"
    enabled: bool = True
    created_by: str
    created_at: datetime
```

### 12.2 Cron Manager

```python
from crontab import CronTab
COMMENT_PREFIX = "bck-manager-web:"

def sync_to_crontab(cron_jobs: list[CronJob]):
    cron = CronTab(user="root")
    # Remove only entries tagged by this app
    cron.remove_all(comment_matches=rf"{COMMENT_PREFIX}.*")
    for job in cron_jobs:
        if not job.enabled:
            continue
        entry = cron.new(command=job.command, comment=f"{COMMENT_PREFIX}{job.id}")
        entry.setall(job.cron_expression)
    cron.write()

BCK_CMD = "/usr/local/bin/bck-manager"
LOG_FILE = "/var/log/bck_manager_cron.log"

def build_command(job_name: str | None) -> str:
    if job_name:
        return f"{BCK_CMD} --run-job {job_name} >> {LOG_FILE} 2>&1"
    return f"{BCK_CMD} --run-all >> {LOG_FILE} 2>&1"
```

**Never touch crontab entries that do not have the `bck-manager-web:` comment tag.**

---

## 13. Installer (`install.sh`)

The installer is **idempotent** — running it again updates without losing config.

```bash
# install.sh

# 1. Preflight
check_root
check_os                # Debian/Ubuntu only
check_python310
detect_existing         # IS_UPDATE=true/false

# 2. Configuration (fresh install or --reconfigure flag)
if [ "$IS_UPDATE" = false ] || [ "$1" = "--reconfigure" ]; then
    ask_deployment_mode     # "standalone" | "hub" | "agent-only"
    ask_tls_mode            # "letsencrypt" | "self-signed" | "existing-cert" | "manual"
    detect_existing_le      # Offer to reuse certbot/acme.sh certs
    ask_hostname_or_domain
    generate_env_file       # Write /opt/bck_manager_web/.env
fi

# 3. System dependencies
apt_install python3 python3-pip python3-venv nodejs npm caddy

# 4. Application
mkdir -p /opt/bck_manager_web
copy_backend_files
create_or_update_venv
pip_install_requirements

# 5. Frontend
npm ci && npm run build
cp -r dist/ /opt/bck_manager_web/static/

# 6. Caddy
generate_caddyfile_from_template   # → /etc/caddy/Caddyfile
systemctl enable --now caddy

# 7. systemd
install_systemd_service            # bck-manager-web.service
systemctl enable --now bck-manager-web

# 8. Summary
print_success_banner
```

### Agent Installer (`install-agent.sh`)

```bash
# install-agent.sh <HUB_URL> <AGENT_TOKEN>
# Installs only the agent (no UI, no Caddy)
# 1. Install BCK Manager if not present
# 2. Install agent Python deps in separate venv
# 3. Write /opt/bck_manager_agent/.env: HUB_URL, AGENT_TOKEN
# 4. Install and start bck-manager-agent.service
```

The admin generates the token from the Hub UI (Fleet → Add Server → Agent) and copies
the one-liner install command shown there.

### systemd Units

```ini
# bck-manager-web.service
[Unit]
Description=BCK Manager Web Interface
After=network.target caddy.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/bck_manager_web
EnvironmentFile=/opt/bck_manager_web/.env
ExecStart=/opt/bck_manager_web/venv/bin/uvicorn backend.main:app \
    --host ${BCK_WEB_HOST} --port ${BCK_WEB_PORT} --no-access-log
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```ini
# bck-manager-agent.service
[Unit]
Description=BCK Manager Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/bck_manager_agent
EnvironmentFile=/opt/bck_manager_agent/.env
ExecStart=/opt/bck_manager_agent/venv/bin/python agent_main.py
Restart=always
RestartSec=30

[Install]
WantedBy=multi-user.target
```

---

## 14. Environment Variables

### Hub / Standalone `.env`

```env
BCK_WEB_MODE=standalone            # "standalone" | "hub"
BCK_WEB_HOST=127.0.0.1
BCK_WEB_PORT=8080
BCK_WEB_SECRET_KEY=CHANGE_ME_STRONG_RANDOM_STRING_MIN_32_CHARS
BCK_MANAGER_PATH=/opt/bck_manager
BCK_CONFIG_PATH=/opt/bck_manager/config.yaml
BCK_LOG_PATH=/var/log/bck_manager.log
BCK_WEB_DB_PATH=/opt/bck_manager_web/bck_web.db
BCK_WEB_ACCESS_TOKEN_EXPIRE_HOURS=8
BCK_WEB_REFRESH_TOKEN_EXPIRE_DAYS=30
BCK_WEB_GITHUB_REPO=giuva90/BCK_Manager_Web
BCK_WEB_UPDATE_CHECK_INTERVAL_HOURS=6
CADDY_HOSTNAME=backup.example.com
CADDY_TLS_MODE=letsencrypt         # "letsencrypt" | "self-signed" | "manual"
CADDY_ACME_EMAIL=admin@example.com
```

### Agent `.env`

```env
BCK_AGENT_HUB_URL=wss://backup.example.com/api/v1/fleet/agent-ws
BCK_AGENT_TOKEN=<token-generated-by-hub>
BCK_AGENT_SERVER_NAME=my-server-01
BCK_MANAGER_PATH=/opt/bck_manager
BCK_CONFIG_PATH=/opt/bck_manager/config.yaml
BCK_LOG_PATH=/var/log/bck_manager.log
BCK_AGENT_RECONNECT_INTERVAL_SECONDS=30
```

---

## 15. Frontend Pages & Key Components

### Dashboard
- **Standalone**: summary cards (jobs count, last run status, next run, total S3 size),
  recent log feed (auto-refreshing), quick-run buttons per job.
- **Hub mode**: fleet grid (one card per server with online/offline indicator,
  last seen, running jobs) + aggregate stats.

### JobWizard (multi-step form)
1. **Basics** — name, mode (`folder`/`files`/`volume`), server selector (hub mode).
2. **Source** — `LocalFolderPicker` for folder/files; `DockerVolumePicker` for volume.
3. **Destination** — endpoint selector, bucket picker (loaded from S3), prefix input.
4. **Hooks** — optional pre/post shell commands.
5. **Encryption** — toggle, named key selector or inline passphrase.
6. **Retention** — mode selector with guided inputs (sliders for days/counts).
7. **Notifications** — SMTP recipient routing.
8. **Review** — YAML preview of what will be written to `config.yaml`.

### LocalFolderPicker
- Modal with tree view. Calls `GET /api/v1/filesystem/browse?path=X` on expand.
- Shows directories only. Breadcrumb navigation at top.
- Manual text input fallback at the bottom.
- Admin-only (filesystem browsing is privileged).

### DockerVolumePicker
- Calls `GET /api/v1/filesystem/volumes`. Searchable list.
- Shows: volume name, driver, mount point.
- Also shows containers using the volume and their current state.

### StorageExplorer
- Left panel: endpoint + bucket selector.
- Main: object table (Key, Size, Last Modified, Actions).
- Download button: if key ends in `.enc` → dialog "Download encrypted / Decrypt first?".
  If decrypt chosen, passphrase pre-filled from job config if identifiable.
- Breadcrumb prefix navigation. Total size in footer.

### CronBuilder
- Visual expression builder (dropdowns for each cron field) + plain-text input (bidirectionally synced).
- Job selector: "All Jobs" or specific job.
- Human-readable label: "Every day at 02:00 AM".
- Preview of next 5 run times.

### TerminalPage
- Server selector (hub) + system user dropdown (from `server.terminal_users`).
- Full-screen xterm.js pane, dark background, monospace font.
- Connection status badge. Reconnect button.
- Warning banner: "Connected as `ubuntu` on `server-prod-01`."

### FleetPage (hub mode)
- Grid of server cards: name, hostname, connection type badge (`AGENT` / `SSH`),
  online/offline indicator, last seen, BCK Manager version, running jobs count.
- "Add Server" wizard: choose Agent (generates token + shows one-liner install command)
  or SSH (form for host/port/user/key).
- Per-card: View, Edit, Remove, Test connection.

### UpdateNotification (global component in Topbar)
- Badge appears when update available: "v1.2.0 available".
- Click → modal with release notes + "Update now" button.
- Update progress: live SSE log stream + "Refresh page" button on completion.

---

## 16. Security Rules

1. All routes except `/api/v1/auth/login` and `/api/v1/setup` require valid JWT.
2. Admin-only: user CRUD, server CRUD, agent token generation, config writes, filesystem browser.
3. Operator: run jobs, restores, retention, storage explorer, download, terminal.
4. Viewer: all GET endpoints only. No mutations, no terminal.
5. **Never return passphrases, secret keys, or passwords** in any API response.
6. Filesystem browser blocks `/proc`, `/sys`, `/dev`.
7. Download proxy validates that `endpoint` matches a configured S3 endpoint — no arbitrary URLs.
8. Terminal: **double gate** — `user.allowed_system_users` AND `server.terminal_users` must both pass.
9. Agent WebSocket: verify `AGENT_TOKEN` against bcrypt hash before accepting registration.
10. Config writes: always validate via BCK Manager's `load_config()` before persisting.
11. Audit log: all mutations (job changes, runs, restores, user changes, terminal open/close).
12. SSH private keys on Hub: `chmod 600`, owned by root, stored in `/opt/bck_manager_web/ssh_keys/`.
13. Agent tokens stored hashed. Regeneration invalidates old token immediately.
14. HTTPS enforced by Caddy (HTTP → HTTPS redirect always active).
15. Cookies: `httpOnly` + `Secure` + `SameSite=Strict` on all auth cookies.

---

## 17. Key Constraints & Gotchas

1. **BCK Manager functions are synchronous and blocking** — always `run_in_executor`. Never await them directly.
2. **config.yaml is source of truth for job definitions.** SQLite stores only app metadata (users, fleet, cron, audit).
3. **Atomic config writes**: temp file + `os.replace()` always, no exceptions.
4. **Agents initiate connections** — Hub never dials agents.
5. **Agent heartbeat 30s** — Hub marks offline after 90s without heartbeat.
6. **Root access required** — systemd service runs as root. Expected and required for Docker operations.
7. **SSH key management** — private keys on Hub at `/opt/bck_manager_web/ssh_keys/` with `chmod 600`.
8. **Never log passphrases** — strip `passphrase`/`password` fields before any debug logging of config dicts.
9. **`.enc` suffix = encrypted** — storage explorer auto-detects and offers decryption on download.
10. **Crontab tag discipline** — only touch entries with `bck-manager-web:` comment. Never others.
11. **Caddy + existing Let's Encrypt** — installer detects certbot/acme.sh and offers reuse (Mode 3). Never two ACME clients on same domain.
12. **Server context cache invalidation** — switching servers in fleet mode must invalidate all TanStack Query caches for job/log/storage data.
13. **SSH `known_hosts`** — current implementation uses `known_hosts=None` (accepts any host key). A future security hardening task should implement proper known_hosts verification and expose it in the UI.

---

## 18. Future Extensibility (Design For, Do Not Implement Yet)

- **SFTP connector**: the S3 endpoint concept should be generalized to "remote storage
  connectors" with a `type` field (`s3` | `sftp`). Build the UI components with a
  connector-type discriminator pattern so adding SFTP requires only a new form, not a rewrite.
- **Remote agent update**: Hub pushes update command to agents via WebSocket.
- **Webhook notifications**: audit log schema is already designed for this.
- **known_hosts enforcement**: SSH host key verification in `ssh_client.py`.
- **Multi-language i18n**: design string keys from day one; wrap all UI strings in `t()` even if only Italian/English are implemented initially.

---

## 19. Development Quick Start

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8080

# Frontend (separate terminal)
cd frontend
npm install
npm run dev   # Vite on :5173, proxies /api → :8080

# Agent (separate terminal, for fleet development)
cd agent
# Set env: BCK_AGENT_HUB_URL=ws://localhost:8080/api/v1/fleet/agent-ws
#          BCK_AGENT_TOKEN=dev-token
python agent_main.py
```

### Vite Proxy Config (`vite.config.ts`)

```ts
server: {
  proxy: {
    "/api": "http://localhost:8080",
    "/api/v1/logs/stream":    { target: "ws://localhost:8080", ws: true },
    "/api/v1/terminal":       { target: "ws://localhost:8080", ws: true },
    "/api/v1/fleet/agent-ws": { target: "ws://localhost:8080", ws: true },
  }
}
```

---

## 20. UI Design Principles

Professional **DevOps dashboard** — think Grafana meets Portainer.
Users are technical administrators managing server infrastructure.

- **Dark theme by default**, light mode toggle.
- Color palette: deep slate/navy background, cyan or teal accents.
- Monospace font for: log output, S3 keys, file paths, cron expressions, terminal.
- Status colors: green (success/online), red (failed/offline), amber (warning), blue (running).
- All destructive actions (delete job, replace volume, apply retention, remove server) require
  a confirmation dialog explicitly listing what will be affected.
- Skeleton loaders on all async data fetches.
- Toast notifications (Sonner) for all operation results.
- Connection type badge: visually distinct `AGENT` vs `SSH` labels on all server references.
- Responsive: desktop 1280px+ primary, tablet 768px+ secondary. Mobile not required.