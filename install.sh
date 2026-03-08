#!/usr/bin/env bash
# BCK Manager Web — Idempotent Installer
# Usage: sudo bash install.sh
set -euo pipefail

APP_DIR="/opt/bck-manager-web"
VENV_DIR="$APP_DIR/venv"
FRONTEND_DIR="$APP_DIR/frontend"
SERVICE_USER="bckweb"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# Check root
[[ $EUID -ne 0 ]] && err "This script must be run as root"

# ── System dependencies ──────────────────────────────────────────
log "Installing system dependencies…"
if command -v apt-get &>/dev/null; then
    apt-get update -qq
    apt-get install -y -qq python3 python3-venv python3-pip nodejs npm curl
elif command -v dnf &>/dev/null; then
    dnf install -y -q python3 python3-pip nodejs npm curl
elif command -v yum &>/dev/null; then
    yum install -y -q python3 python3-pip nodejs npm curl
else
    warn "Unknown package manager — ensure python3, node, npm are installed"
fi

# ── Create service user ──────────────────────────────────────────
if ! id "$SERVICE_USER" &>/dev/null; then
    log "Creating service user: $SERVICE_USER"
    useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
else
    log "Service user $SERVICE_USER already exists"
fi

# ── Application directory ────────────────────────────────────────
log "Setting up application directory: $APP_DIR"
mkdir -p "$APP_DIR"

# Copy backend
if [[ -d "backend" ]]; then
    cp -r backend "$APP_DIR/"
else
    err "backend/ directory not found in current path"
fi

# Copy agent
if [[ -d "agent" ]]; then
    cp -r agent "$APP_DIR/"
fi

# ── Python virtual environment ───────────────────────────────────
log "Setting up Python virtual environment…"
python3 -m venv "$VENV_DIR"
"$VENV_DIR/bin/pip" install --upgrade pip -q
"$VENV_DIR/bin/pip" install -r "$APP_DIR/backend/requirements.txt" -q
log "Python dependencies installed"

# ── Frontend build ───────────────────────────────────────────────
if [[ -d "frontend" ]]; then
    log "Building frontend…"
    cd frontend
    npm ci --silent 2>/dev/null || npm install --silent
    npm run build
    cd ..

    # Copy built assets
    mkdir -p "$APP_DIR/frontend"
    cp -r frontend/dist "$APP_DIR/frontend/"
    log "Frontend built and deployed"
else
    warn "frontend/ not found — skipping frontend build"
fi

# ── Environment file ─────────────────────────────────────────────
ENV_FILE="$APP_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
    log "Creating .env from template…"
    SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(64))")
    cat > "$ENV_FILE" <<EOF
BCK_WEB_SECRET_KEY=$SECRET_KEY
BCK_WEB_HOST=127.0.0.1
BCK_WEB_PORT=8080
BCK_WEB_MODE=standalone
BCK_MANAGER_PATH=/opt/bck_manager
BCK_CONFIG_PATH=/opt/bck_manager/config.yaml
BCK_LOG_PATH=/var/log/bck_manager.log
BCK_WEB_DB_PATH=$APP_DIR/data/bck_manager_web.db
EOF
    chmod 600 "$ENV_FILE"
    log ".env created with random secret key"
else
    warn ".env already exists — not overwriting"
fi

# ── Data directory ───────────────────────────────────────────────
mkdir -p "$APP_DIR/data"

# ── Ownership ────────────────────────────────────────────────────
chown -R "$SERVICE_USER":"$SERVICE_USER" "$APP_DIR"

# ── Systemd service ──────────────────────────────────────────────
SERVICE_FILE="/etc/systemd/system/bck-manager-web.service"
if [[ -f "bck-manager-web.service" ]]; then
    cp bck-manager-web.service "$SERVICE_FILE"
    systemctl daemon-reload
    systemctl enable bck-manager-web
    log "Systemd service installed and enabled"
else
    warn "bck-manager-web.service not found in current directory"
fi

# ── Caddy (optional) ─────────────────────────────────────────────
if command -v caddy &>/dev/null; then
    log "Caddy detected — copy caddy/Caddyfile.template and customize it"
else
    warn "Caddy not installed — configure your own reverse proxy"
fi

# ── Done ─────────────────────────────────────────────────────────
echo ""
log "Installation complete!"
echo ""
echo "  Next steps:"
echo "    1. Edit $APP_DIR/.env with your settings"
echo "    2. Start the service:  systemctl start bck-manager-web"
echo "    3. Open http://your-server:8080 and create your admin account"
echo ""
