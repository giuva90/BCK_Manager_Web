"""
Agent-side BCK Manager bridge — mirrors backend/services/bck_bridge.py
but runs commands locally on the agent machine.
"""

import sys
import subprocess
import json
import yaml
from pathlib import Path
from agent_config import AgentConfig


def _ensure_path(cfg: AgentConfig):
    if cfg.bck_manager_path not in sys.path:
        sys.path.insert(0, cfg.bck_manager_path)


def load_config(cfg: AgentConfig) -> dict:
    config_path = Path(cfg.config_path)
    if not config_path.exists():
        return {"error": f"Config not found: {cfg.config_path}"}
    with open(config_path, "r") as f:
        return yaml.safe_load(f) or {}


def run_job(cfg: AgentConfig, job_name: str) -> dict:
    """Run a backup job via CLI subprocess for process isolation."""
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "bck_manager",
            "--config",
            cfg.config_path,
            "--job",
            job_name,
        ],
        capture_output=True,
        text=True,
        cwd=cfg.bck_manager_path,
        timeout=3600,
    )
    return {
        "exit_code": result.returncode,
        "stdout": result.stdout[-4000:] if result.stdout else "",
        "stderr": result.stderr[-2000:] if result.stderr else "",
    }


def run_all_jobs(cfg: AgentConfig) -> dict:
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "bck_manager",
            "--config",
            cfg.config_path,
        ],
        capture_output=True,
        text=True,
        cwd=cfg.bck_manager_path,
        timeout=7200,
    )
    return {
        "exit_code": result.returncode,
        "stdout": result.stdout[-4000:] if result.stdout else "",
        "stderr": result.stderr[-2000:] if result.stderr else "",
    }


def get_jobs(cfg: AgentConfig) -> list:
    config = load_config(cfg)
    if "error" in config:
        return []
    return list((config.get("backup_jobs") or {}).keys())


def list_backups(cfg: AgentConfig, job_name: str) -> dict:
    _ensure_path(cfg)
    try:
        from config_loader import load_config as _load
        from s3_client import create_s3_client

        config = _load(cfg.config_path)
        jobs = config.get("backup_jobs", {})
        job = jobs.get(job_name)
        if not job:
            return {"error": f"Job '{job_name}' not found"}

        client = create_s3_client(job)
        bucket = job["s3_bucket"]
        prefix = job.get("prefix", job_name)
        resp = client.list_objects_v2(Bucket=bucket, Prefix=prefix)
        objects = [
            {
                "key": obj["Key"],
                "size": obj["Size"],
                "last_modified": obj["LastModified"].isoformat(),
            }
            for obj in resp.get("Contents", [])
        ]
        return {"objects": objects}
    except Exception as e:
        return {"error": str(e)}


def tail_log(cfg: AgentConfig, lines: int = 100) -> str:
    config = load_config(cfg)
    log_file = config.get("settings", {}).get("log_file", "/var/log/bck_manager.log")
    try:
        result = subprocess.run(
            ["tail", "-n", str(lines), log_file],
            capture_output=True,
            text=True,
            timeout=10,
        )
        return result.stdout
    except Exception as e:
        return f"Error reading log: {e}"
