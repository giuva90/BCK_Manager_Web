#!/usr/bin/env bash
# BCK Manager Agent — Installer
# Usage: sudo bash install-agent.sh
set -euo pipefail

AGENT_DIR="/opt/bck_manager_agent"
VENV_DIR="$AGENT_DIR/venv"
SERVICE_USER="bckagent"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ── Uninstall mode ──────────────────────────────────────────────
if [[ "${1:-}" == "--uninstall" ]]; then
    [[ $EUID -ne 0 ]] && err "This script must be run as root"
    echo ""
    warn "This will permanently remove the BCK Manager Agent, its data, logs, and service user."
    read -r -p "Are you sure? [y/N] " _confirm
    [[ "${_confirm,,}" != "y" ]] && { log "Aborted."; exit 0; }

    log "Stopping and disabling bck-manager-agent service…"
    systemctl stop bck-manager-agent 2>/dev/null || true
    systemctl disable bck-manager-agent 2>/dev/null || true
    rm -f /etc/systemd/system/bck-manager-agent.service
    systemctl daemon-reload

    log "Removing agent directory: $AGENT_DIR"
    rm -rf "$AGENT_DIR"

    log "Removing log directory: /var/log/bck_manager_agent"
    rm -rf /var/log/bck_manager_agent

    if id "$SERVICE_USER" &>/dev/null; then
        log "Removing service user: $SERVICE_USER"
        userdel "$SERVICE_USER" 2>/dev/null || true
    fi

    echo ""
    log "BCK Manager Agent has been uninstalled."
    exit 0
fi

[[ $EUID -ne 0 ]] && err "This script must be run as root"

# ── Stop service if currently running ───────────────────────────
if systemctl is-active --quiet bck-manager-agent 2>/dev/null; then
    log "Stopping bck-manager-agent service for upgrade…"
    systemctl stop bck-manager-agent
    _WAS_RUNNING=1
else
    _WAS_RUNNING=0
fi

# ── System deps ──────────────────────────────────────────────────
log "Installing system dependencies…"
if command -v apt-get &>/dev/null; then
    apt-get update -qq
    apt-get install -y -qq python3 python3-venv python3-pip
elif command -v dnf &>/dev/null; then
    dnf install -y -q python3 python3-pip
elif command -v yum &>/dev/null; then
    yum install -y -q python3 python3-pip
fi

# ── Service user ─────────────────────────────────────────────────
if ! id "$SERVICE_USER" &>/dev/null; then
    log "Creating service user: $SERVICE_USER"
    useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
fi

# ── Agent directory ──────────────────────────────────────────────
log "Setting up agent directory: $AGENT_DIR"
mkdir -p "$AGENT_DIR"

if [[ -d "agent" ]]; then
    cp -r agent/* "$AGENT_DIR/"
else
    err "agent/ directory not found"
fi

# ── Python venv ──────────────────────────────────────────────────
log "Setting up Python virtual environment…"
python3 -m venv "$VENV_DIR"
"$VENV_DIR/bin/pip" install --upgrade pip -q
"$VENV_DIR/bin/pip" install -r "$AGENT_DIR/requirements.txt" -q

# ── Log directory ────────────────────────────────────────────────
mkdir -p /var/log/bck_manager_agent
chown "$SERVICE_USER":"$SERVICE_USER" /var/log/bck_manager_agent

# ── Environment ──────────────────────────────────────────────────
ENV_FILE="$AGENT_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
    cat > "$ENV_FILE" <<EOF
BCK_AGENT_HUB_URL=wss://your-hub-server/api/v1/fleet/agent-ws
BCK_AGENT_AGENT_TOKEN=paste-token-here
BCK_AGENT_BCK_MANAGER_PATH=/opt/bck_manager
BCK_AGENT_CONFIG_PATH=/opt/bck_manager/config.yaml
BCK_AGENT_LOG_LEVEL=INFO
BCK_AGENT_LOG_FILE=/var/log/bck_manager_agent/agent.log
EOF
    chmod 600 "$ENV_FILE"
    log ".env created — edit it with your Hub URL and token"
else
    warn ".env already exists"
fi

# ── Ownership ────────────────────────────────────────────────────
chown -R "$SERVICE_USER":"$SERVICE_USER" "$AGENT_DIR"

# ── Systemd ──────────────────────────────────────────────────────
SERVICE_FILE="/etc/systemd/system/bck-manager-agent.service"
if [[ -f "bck-manager-agent.service" ]]; then
    cp bck-manager-agent.service "$SERVICE_FILE"
    systemctl daemon-reload
    systemctl enable bck-manager-agent
    log "Agent service installed and enabled"
fi

echo ""
log "Agent installation complete!"
echo ""
if [[ "$_WAS_RUNNING" -eq 1 ]]; then
    echo -e "  ${YELLOW}The service was stopped for the upgrade.${NC}"
    echo "  Restart it with:"
    echo ""
    echo "    systemctl start bck-manager-agent"
else
    echo "  Next steps:"
    echo "    1. Edit $AGENT_DIR/.env with your settings (HUB_URL, HUB_TOKEN, AGENT_ID)"
    echo "    2. Start the service:  systemctl start bck-manager-agent"
    echo "    3. The agent will appear in the fleet dashboard after connecting"
fi
echo ""
echo "  To uninstall:  sudo bash install-agent.sh --uninstall"
echo ""
