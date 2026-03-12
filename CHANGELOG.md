# Changelog

All notable changes to this project will be documented in this file.

## 0.2.0 - 2026-03-13

### Added
- **Job Execution History**: persistent SQLite storage of every job run (local and fleet agents). New `/history` API with filters (job, status, server, date range, triggered_by) and pagination. Dashboard recap card shows last-24 h success/failure counts and a recent-executions table.
- **Restore history tracking**: file and volume restore operations are now recorded in the execution history with `triggered_by` set to `restore:<user>` / `restore-volume:<user>`.

### Fixed
- **Storage Explorer**: endpoint selector, bucket listing, and object browsing now work correctly. boto3 uppercase field names (`Name`, `Key`, `Size`, `LastModified`) are normalized to lowercase before reaching the frontend.
- **Restore page**: fixed field name mismatch (`backup_key` → `s3_key`) that caused every restore attempt to return HTTP 422. Volume restore no longer requires the caller to specify `target_volume`; it is derived automatically from the job configuration (`<volume_name>_restored` for new-volume mode, `<volume_name>` for replace mode).
- **Log streaming**: the WebSocket live-stream no longer disconnects when the log file does not exist yet. It keeps polling until the file appears, so the connection stays alive on a freshly started service.
- **RBAC**: job create/update/delete and cron create/update/delete endpoints now correctly require admin role instead of operator.

### Changed
- Dashboard: removed the redundant "Job Status" grid (job state is visible in the Jobs page and the new Recent Executions table).
- Install scripts (`install.sh`, `install-agent.sh`): services are now stopped gracefully before file operations during an upgrade. Both scripts accept `--uninstall` to fully remove the installation.
- Frontend dev-server proxy port is now read from `BCK_WEB_PORT` in the root `.env` file via `vite.config.ts`, eliminating the previously hard-coded `8080`.
- `frontend/package.json` version kept in sync with `backend/config.py` `app_version`.

## 0.1.0 - 2026-03-08

Initial public project baseline.

- Added FastAPI backend with authentication, models, schemas, services, and API routers.
- Added React frontend with routing, auth flow, dashboards, jobs, storage, restore, logs, terminal, settings, users, and fleet pages.
- Added remote agent implementation for hub-managed nodes.
- Added installer scripts, systemd units, environment template, and Caddy reverse proxy template.
- Added repository documentation, GitHub policy files, and CI baseline.
- Normalized installer paths to `/opt/bck_manager_web` and `/opt/bck_manager_agent`.