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
- encryption options
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
- Nodes can be agent-managed or SSH-managed.
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

See [DEPLOYMENT.md](DEPLOYMENT.md) for the operational details.