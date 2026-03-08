"""
Agent WebSocket client — connects to Hub, handles commands, sends heartbeats.
"""

import asyncio
import json
import logging
import signal
import ssl
from datetime import datetime, timezone

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

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [AGENT] %(levelname)s %(message)s",
)
log = logging.getLogger("agent")

cfg = AgentConfig()


async def handle_command(message: dict) -> dict:
    """Dispatch incoming command from Hub and return result."""
    cmd = message.get("type", "")
    request_id = message.get("request_id", "")
    payload = message.get("payload", {})

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
            result["payload"] = run_job(cfg, job_name)

        elif cmd == "run_all":
            result["payload"] = run_all_jobs(cfg)

        elif cmd == "list_backups":
            job_name = payload.get("job_name", "")
            result["payload"] = list_backups(cfg, job_name)

        elif cmd == "tail_log":
            lines = payload.get("lines", 100)
            result["payload"] = {"log": tail_log(cfg, lines)}

        else:
            result["payload"] = {"error": f"Unknown command: {cmd}"}

    except Exception as e:
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
