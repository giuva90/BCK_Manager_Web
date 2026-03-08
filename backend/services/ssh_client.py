"""asyncssh wrapper for SSH-only machines (no agent installed)."""

import shlex
from typing import Optional

from backend.models.server import Server


async def run_remote_command(
    server: Server, command: str
) -> tuple[str, str, int]:
    """Execute a command on a remote server via SSH.

    Returns (stdout, stderr, exit_status).
    """
    import asyncssh

    async with asyncssh.connect(
        server.ssh_host,
        port=server.ssh_port,
        username=server.ssh_user,
        client_keys=[server.ssh_key_path] if server.ssh_key_path else [],
        known_hosts=None,  # TODO: implement known_hosts verification
    ) as conn:
        result = await conn.run(command)
        return result.stdout or "", result.stderr or "", result.exit_status or 0


async def run_bck_manager(server: Server, args: list[str]) -> dict:
    """Run bck-manager with given args on a remote SSH server."""
    safe_args = " ".join(shlex.quote(a) for a in args)
    cmd = f"sudo /usr/local/bin/bck-manager {safe_args} --config {shlex.quote(server.config_path)}"
    stdout, stderr, code = await run_remote_command(server, cmd)
    return {"stdout": stdout, "stderr": stderr, "exit_code": code, "success": code == 0}


async def test_ssh_connection(server: Server) -> bool:
    """Quick SSH connectivity check."""
    try:
        stdout, _, code = await run_remote_command(server, "echo ok")
        return code == 0 and "ok" in stdout
    except Exception:
        return False
