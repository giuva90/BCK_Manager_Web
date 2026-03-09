"""Cron manager — read/write root's crontab via python-crontab.

Only entries tagged with the ``bck-manager-web:`` comment prefix are
touched.  Other crontab entries are never modified.
"""

import logging

from crontab import CronTab

from backend.models.cron_job import CronJob

logger = logging.getLogger("bck_web.cron")

COMMENT_PREFIX = "bck-manager-web:"
BCK_CMD = "/usr/local/bin/bck-manager"
LOG_FILE = "/var/log/bck_manager_cron.log"


def build_command(job_name: str | None = None) -> str:
    if job_name:
        return f"{BCK_CMD} --run-job {job_name} >> {LOG_FILE} 2>&1"
    return f"{BCK_CMD} --run-all >> {LOG_FILE} 2>&1"


def sync_to_crontab(cron_jobs: list[CronJob]) -> None:
    """Sync the DB cron list to the system crontab.

    Removes all ``bck-manager-web:`` entries first, then writes enabled ones.
    """
    cron = CronTab(user="root")
    # Remove only our entries
    cron.remove_all(comment=COMMENT_PREFIX)
    for job in cron_jobs:
        if not job.enabled:
            continue
        entry = cron.new(
            command=job.command,
            comment=f"{COMMENT_PREFIX}{job.id}",
        )
        entry.setall(job.cron_expression)
    cron.write()
    logger.info("Crontab synced: %d jobs written", sum(1 for j in cron_jobs if j.enabled))


def get_next_runs(cron_expression: str, count: int = 5) -> list[str]:
    """Return the next *count* scheduled run times as ISO strings."""
    from crontab import CronTab
    from datetime import datetime

    cron = CronTab(tab="")
    entry = cron.new(command="true")
    entry.setall(cron_expression)
    schedule = entry.schedule()
    runs = []
    for _ in range(count):
        runs.append(schedule.get_next().isoformat())
    return runs
