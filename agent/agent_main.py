"""
Agent WebSocket client — connects to Hub, handles commands, sends heartbeats.
"""

import asyncio
import json
import logging
import os
import signal
import ssl
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler

import websockets

from agent_config import AgentConfig
from agent_bridge import (
    load_config,
    run_job,
    run_all_jobs,
    get_jobs,
    list_backups,
    tail_log,
)

cfg = AgentConfig()


def _setup_logging() -> None:
    """Configure root logger with console + rotating file handler."""
    numeric_level = getattr(logging, cfg.log_level.upper(), logging.INFO)

    fmt = "%(asctime)s [AGENT] %(levelname)s %(message)s"
    formatter = logging.Formatter(fmt, datefmt="%Y-%m-%d %H:%M:%S")

    root = logging.getLogger()
    root.setLevel(numeric_level)

    # Console handler
    console = logging.StreamHandler()
    console.setLevel(numeric_level)
    console.setFormatter(formatter)
    root.addHandler(console)

    # File handler
    if cfg.log_file:
        log_dir = os.path.dirname(cfg.log_file)
        if log_dir:
            os.makedirs(log_dir, exist_ok=True)

        file_handler = RotatingFileHandler(
            cfg.log_file,
            maxBytes=10 * 1024 * 1024,  # 10 MB
            backupCount=5,
            encoding="utf-8",
        )
        file_handler.setLevel(numeric_level)
        file_handler.setFormatter(formatter)
        root.addHandler(file_handler)


_setup_logging()
log = logging.getLogger("agent")


async def handle_command(message: dict) -> dict:
    """Dispatch incoming command from Hub and return result."""
    cmd = message.get("type", "")
    request_id = message.get("request_id", "")
    payload = message.get("payload", {})

    log.debug("Received command: type=%s request_id=%s", cmd, request_id)
    result: dict = {"type": "command_result", "request_id": request_id}

    try:
        if cmd == "ping":
            result["payload"] = {"pong": True}

        elif cmd == "get_config":
            result["payload"] = load_config(cfg)

        elif cmd == "get_jobs":
            result["payload"] = {"jobs": get_jobs(cfg)}

        elif cmd == "run_job":
            job_name = payload.get("job_name", "")
            log.info("Running job: %s", job_name)
            result["payload"] = run_job(cfg, job_name)
            log.info("Job finished: %s exit_code=%s", job_name, result["payload"].get("exit_code"))

        elif cmd == "run_all":
            log.info("Running all jobs")
            result["payload"] = run_all_jobs(cfg)
            log.info("All jobs finished: exit_code=%s", result["payload"].get("exit_code"))

        elif cmd == "list_backups":
            job_name = payload.get("job_name", "")
            result["payload"] = list_backups(cfg, job_name)

        elif cmd == "tail_log":
            lines = payload.get("lines", 100)
            result["payload"] = {"log": tail_log(cfg, lines)}

        else:
            log.warning("Unknown command received: %s", cmd)
            result["payload"] = {"error": f"Unknown command: {cmd}"}

    except Exception as e:
        log.error("Command %s failed: %s", cmd, e, exc_info=True)
        result["payload"] = {"error": str(e)}

    return result


async def heartbeat(ws):
    """Send periodic heartbeat to Hub."""
    while True:
        try:
            msg = json.dumps({
                "type": "heartbeat",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            await ws.send(msg)
            await asyncio.sleep(cfg.heartbeat_interval)
        except (websockets.ConnectionClosed, asyncio.CancelledError):
            break


async def connect():
    """Main connection loop with auto-reconnect."""
    headers = {"Authorization": f"Bearer {cfg.agent_token}"}

    # Allow self-signed certs in dev
    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE

    while True:
        try:
            log.info("Connecting to %s", cfg.hub_url)
            async with websockets.connect(
                cfg.hub_url,
                additional_headers=headers,
                ssl=ssl_ctx if cfg.hub_url.startswith("wss") else None,
                ping_interval=20,
                ping_timeout=10,
            ) as ws:
                log.info("Connected to Hub")
                hb_task = asyncio.create_task(heartbeat(ws))

                try:
                    async for raw in ws:
                        try:
                            message = json.loads(raw)
                        except json.JSONDecodeError:
                            continue

                        if message.get("type") == "command":
                            result = await handle_command(message)
                            await ws.send(json.dumps(result))
                        elif message.get("type") == "heartbeat_ack":
                            pass  # Hub acknowledged
                        else:
                            log.debug("Unknown message type: %s", message.get("type"))
                finally:
                    hb_task.cancel()

        except (
            websockets.ConnectionClosed,
            ConnectionRefusedError,
            OSError,
        ) as e:
            log.warning("Disconnected: %s. Reconnecting in %ds…", e, cfg.reconnect_delay)
        except asyncio.CancelledError:
            log.info("Agent shutting down")
            break

        await asyncio.sleep(cfg.reconnect_delay)


def main():
    if not cfg.agent_token:
        log.error("BCK_AGENT_AGENT_TOKEN is required")
        return

    log.info(
        "Agent starting (hub=%s, log_level=%s, log_file=%s)",
        cfg.hub_url, cfg.log_level, cfg.log_file,
    )

    loop = asyncio.new_event_loop()

    # Graceful shutdown
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, lambda: loop.stop())
        except NotImplementedError:
            pass  # Windows

    try:
        loop.run_until_complete(connect())
    finally:
        loop.close()


if __name__ == "__main__":
    main()
