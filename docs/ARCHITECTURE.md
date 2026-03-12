# Architecture Overview

BCK Manager Web wraps the BCK Manager backup engine with a browser-based control plane. The repository is organized around four functional areas: backend API, frontend UI, remote agent, and infrastructure integration.

## Component Map

- `backend/`: FastAPI application and orchestration layer.
- `frontend/`: React user interface.
- `agent/`: remote execution bridge for hub-managed nodes.
- `BCK_Manager/`: local reference copy of the underlying backup engine sources.

## Backend

The backend is responsible for:

- authentication and role enforcement;
- SQLite-backed application metadata;
- job CRUD over the BCK Manager YAML configuration;
- execution orchestration for jobs, retention, restore, logs, and fleet actions;
- WebSocket services for logs, terminal, and remote agents.

### Backend Design Principles

- Application metadata lives in SQLite.
- Backup job definitions remain in the BCK Manager configuration file.
- Sensitive fields are masked when read back through the API.
- Sync operations from the BCK Manager code are bridged through thread executors.

## Frontend

The frontend is a React + TypeScript SPA.

Main responsibilities:

- login and first-run setup;
- dashboards and job management;
- storage browsing and restore flows;
- schedule management;
- live log viewing;
- browser terminal;
- fleet and user administration.

The frontend talks to the backend over cookie-authenticated HTTP and WebSocket endpoints.

## Authentication Model

- JWTs are used for session handling.
- Tokens are transported in HTTP-only cookies.
- First-run setup creates the initial admin.
- Roles define route and action visibility.

## User Roles And Permissions

BCK Manager Web uses a three-tier role system.  Every user is assigned exactly one role.

### Role Definitions

| Role | Purpose |
| --- | --- |
| **admin** | Full system access — user management, server management, settings, job CRUD, scheduling, all operational actions. |
| **operator** | Operational access — run existing jobs, restore backups, trigger retention, explore and download from S3 storage, use the browser terminal. Cannot create or modify jobs, schedules, users, or settings. |
| **viewer** | Read-only access — view job definitions, schedule state, execution status, logs, and browse S3 bucket contents.  Cannot run jobs, download files, restore backups, or access the terminal. |

### Permission Matrix

| Feature area | Admin | Operator | Viewer |
| --- | --- | --- | --- |
| View dashboard, jobs, schedule, logs | ✔ | ✔ | ✔ |
| Browse S3 bucket contents | ✔ | ✔ | ✔ |
| Run existing jobs | ✔ | ✔ | — |
| Download files from S3 | ✔ | ✔ | — |
| Restore backups | ✔ | ✔ | — |
| Trigger retention | ✔ | ✔ | — |
| Browser terminal | ✔ | ✔ | — |
| Create / edit / delete jobs | ✔ | — | — |
| Create / edit / delete schedules | ✔ | — | — |
| Toggle job or schedule enabled state | ✔ | — | — |
| Delete S3 objects | ✔ | — | — |
| Manage users | ✔ | — | — |
| Manage fleet servers | ✔ | — | — |
| Manage settings, endpoints, keys | ✔ | — | — |

### Backend Enforcement

Roles are enforced through FastAPI dependency injection.  Three dependency functions control access:

- `get_current_user` — any authenticated user (all roles).
- `require_operator_or_admin` — blocks viewers; allows operators and admins.
- `require_admin` — blocks everyone except admins.

Each router endpoint declares the appropriate dependency.  A request from a user with insufficient privileges receives HTTP 403 Forbidden.

### Frontend Enforcement

The frontend provides defence-in-depth through two mechanisms:

1. **Route guards** — the `RoleGuard` component wraps routes that require a minimum role.  Unauthorized users are redirected to the dashboard.
2. **UI visibility** — action buttons (create, delete, run, toggle) are conditionally rendered based on the current user's role.  The sidebar hides menu items that the user cannot access.

The backend remains the authoritative security boundary; frontend guards are a usability measure.

## Storage Explorer

The Storage Explorer allows users to browse and interact with objects stored on S3-compatible endpoints.

### Workflow

1. **Select an S3 endpoint** — the dropdown lists all configured endpoints (secrets are masked).
2. **Select a bucket** — buckets are loaded dynamically from the chosen endpoint.
3. **Browse** — objects and folders are displayed in a navigable table with breadcrumb navigation.
4. **Download** (operator and admin only) — files can be downloaded directly.  If a file ends in `.enc` (encrypted backup), the backend decrypts it server-side using the passphrase from the associated job configuration before streaming.
5. **Delete** (admin only) — individual objects can be deleted after confirmation.

### API Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/storage/buckets` | Any authenticated | List buckets for a given endpoint. |
| GET | `/storage/browse` | Any authenticated | List objects and folders within a bucket, supporting prefix-based navigation. |
| GET | `/storage/download` | Operator or admin | Stream an object to the browser, with optional server-side decryption. |
| DELETE | `/storage/object` | Admin only | Permanently delete an object from the bucket. |
| POST | `/storage/test` | Operator or admin | Test connectivity to an S3 endpoint. |

All endpoints require an `endpoint` query parameter identifying the configured S3 endpoint by name.  The backend validates that the endpoint exists in the BCK Manager configuration before proceeding.

### Encryption Handling

Files ending in `.enc` are displayed with a lock icon.  When downloading an encrypted file, the backend resolves the encryption passphrase from the associated job configuration and decrypts the file before streaming it to the browser.  This requires the `job` query parameter to be included in the download request.

## Data Ownership

### Stored in SQLite

- users
- revoked tokens
- audit entries
- fleet servers
- cron metadata

### Stored in BCK Manager Configuration

- backup jobs
- storage endpoints and secrets
- encryption keys (named passphrases for AES-256-GCM backup encryption)
- per-job encryption settings
- notification settings managed by the underlying tool

This separation is important: the web layer augments BCK Manager, but does not replace its configuration source of truth for jobs.

## Execution Paths

### Local

In standalone mode, the backend imports and executes BCK Manager functionality on the same host.

### Hub With Agent

In hub mode, a remote agent connects to the hub over WebSocket and executes commands locally on the remote host.

Advantages:

- outbound-only connectivity from remote hosts;
- simpler operation across NAT or restricted inbound firewalls;
- explicit agent heartbeat and reconnection flow.

### Hub With SSH

For nodes without an agent, the hub can also execute remote actions over SSH.

### Local Fleet Node

The hub itself can be registered as a fleet node with `connection_type: "local"`. Commands are routed directly through the BCK Manager bridge rather than over an agent or SSH.  This is useful for managing the hub's own backups through the same fleet interface.

## WebSocket Flows

### Logs

The backend streams log lines to the frontend so operators can watch activity in real time.

### Terminal

The backend brokers an interactive terminal session, with access controlled by both user-level and server-level allowlists.

### Fleet Agents

Remote agents maintain a WebSocket session to the hub and process commands such as:

- configuration reads
- job listing
- job execution
- backup listing
- log tailing

## Deployment Model

### Standalone

- Web app and BCK Manager run on one host.
- Lowest operational complexity.

### Hub And Spoke

- One central hub manages many nodes.
- Nodes can be agent-managed, SSH-managed, or local (the hub itself).
- Best fit for multi-server environments.

## Boundaries

- This project should not be treated as a forked replacement for BCK Manager.
- The `BCK_Manager/` directory is reference material, not the main application surface for this repository.
- Operational changes should target the web layer, deployment assets, and documented integration points rather than modifying the reference sources in place.

## Infrastructure Integration

Production deployment assumes:

- systemd-managed services;
- a reverse proxy in front of Uvicorn;
- TLS termination at the proxy;
- local `.env` files for runtime secrets;
- a backup strategy for the SQLite metadata database and BCK Manager config.

## Logging

Both the web application and the remote agent use Python's standard `logging` module.

### Configuration

| Component | Level variable | File variable | Default path |
| --- | --- | --- | --- |
| Web | `BCK_WEB_LOG_LEVEL` | `BCK_WEB_LOG_FILE` | `/var/log/bck_manager_web/web.log` |
| Agent | `BCK_AGENT_LOG_LEVEL` | `BCK_AGENT_LOG_FILE` | `/var/log/bck_manager_agent/agent.log` |

### Outputs

Each component writes to two destinations simultaneously:

1. **Console (stdout)** — captured by systemd/journald.
2. **Rotating file** — 10 MB per file, 5 backups retained.

### Log hierarchy

The web application organises loggers hierarchically:

- `bck_web` — application lifecycle
- `bck_web.auth` — login, logout, token refresh
- `bck_web.jobs` — job CRUD
- `bck_web.run` — job execution
- `bck_web.fleet` — fleet / agent management
- `bck_web.setup` — initial setup
- `bck_web.database` — database init
- `bck_web.config_manager` — config YAML operations
- `bck_web.cron` — cron sync
- `bck_web.ssh` — SSH remote commands
- `bck_web.update_checker` — version checking
- `bck_web.log_watcher` — log streaming
- `bck_bridge` — BCK Manager API bridge
- `agent_hub` — agent WebSocket sessions
- `terminal_manager` — terminal sessions
- `agent` — remote agent process

Set the level to `DEBUG` to get full request-level details, command output, and WebSocket message traces.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the operational details.