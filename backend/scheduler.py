"""
DERZEN - Task scheduling.

Thin wrapper over APScheduler's AsyncIOScheduler. A saved pipeline can be given
a cron expression; the scheduler then runs it automatically. The most recent run
report per job is kept in memory so the frontend Task Scheduler can display real
execution logs instead of placeholders.
"""
from __future__ import annotations

from typing import Dict, List

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

import pipeline_runner
import storage

_scheduler = AsyncIOScheduler()
_last_runs: Dict[str, dict] = {}


def start() -> None:
    if not _scheduler.running:
        _scheduler.start()


def shutdown() -> None:
    if _scheduler.running:
        _scheduler.shutdown(wait=False)


async def _run_job(pipeline_id: str) -> None:
    pipeline = storage.get_pipeline(pipeline_id)
    if pipeline is None:
        return
    _last_runs[pipeline_id] = await pipeline_runner.run_pipeline(pipeline)


def schedule_pipeline(pipeline_id: str, cron_expression: str) -> None:
    """(Re)schedule a pipeline using a 5-field cron expression."""
    trigger = CronTrigger.from_crontab(cron_expression)
    _scheduler.add_job(
        _run_job,
        trigger=trigger,
        args=[pipeline_id],
        id=pipeline_id,
        replace_existing=True,
    )


def unschedule_pipeline(pipeline_id: str) -> None:
    if _scheduler.get_job(pipeline_id):
        _scheduler.remove_job(pipeline_id)


def jobs() -> List[dict]:
    """Return the scheduled jobs with their next run time and last result."""
    out: List[dict] = []
    for job in _scheduler.get_jobs():
        pipeline = storage.get_pipeline(job.id)
        out.append(
            {
                "id": job.id,
                "name": pipeline.get("name", job.id) if pipeline else job.id,
                "schedule": str(job.trigger),
                "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
                "last_run": _last_runs.get(job.id),
                "status": "active",
            }
        )
    return out


def last_run(pipeline_id: str) -> dict | None:
    return _last_runs.get(pipeline_id)


def record_run(pipeline_id: str, report: dict) -> None:
    """Store an on-demand run report so it shows up alongside scheduled runs."""
    _last_runs[pipeline_id] = report
