"""
DERZEN - FastAPI application.

Wires all backend modules into a local HTTP API consumed by the React frontend.
Binds to HOST/PORT from config (localhost by default) and only allows the
configured CORS origin. This is the single entry point: run 'python main.py'.
"""
from __future__ import annotations

from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import ai_manager
import config
import file_manager
import generator
import pipeline_runner
import runtime
import scheduler
import storage
from automation import browser


@asynccontextmanager
async def lifespan(app: FastAPI):
    config.ensure_directories()
    scheduler.start()
    # Re-arm any pipelines that carry a schedule.
    for pipeline in storage.list_pipelines():
        if pipeline.get("schedule"):
            try:
                scheduler.schedule_pipeline(pipeline["id"], pipeline["schedule"])
            except ValueError:
                pass
    yield
    scheduler.shutdown()
    await browser.cleanup()


app = FastAPI(title="DERZEN", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[config.ALLOWED_ORIGIN],
    allow_methods=["*"],
    allow_headers=["*"],
)


class PromptBody(BaseModel):
    prompt: str
    model: str | None = None


class GenerateBody(BaseModel):
    prompt: str


# ── System ────────────────────────────────────────────────────────────────────
@app.get("/api/status")
async def status():
    return {
        "emergency_stop": runtime.is_engaged(),
        "ai_available": await ai_manager.is_available(),
        "ai_models": await ai_manager.list_models() if await ai_manager.is_available() else [],
        "email_enabled": config.EMAIL_ENABLED,
        "whatsapp_enabled": config.WHATSAPP_ENABLED,
        "allowed_base": str(config.ALLOWED_BASE),
    }


@app.post("/api/emergency-stop")
async def emergency_stop():
    runtime.engage()
    scheduler.shutdown()
    await browser.cleanup()
    return {"stopped": True}


@app.post("/api/emergency-stop/reset")
async def emergency_stop_reset():
    runtime.reset()
    scheduler.start()
    return {"stopped": False}


# ── AI ────────────────────────────────────────────────────────────────────────
@app.post("/api/ai/query")
async def ai_query(body: PromptBody):
    try:
        return {"response": await ai_manager.query(body.prompt, body.model)}
    except ai_manager.AIError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


# ── Pipelines ───────────────────────────────────────────────────────────────
@app.get("/api/pipelines")
async def list_pipelines():
    return storage.list_pipelines()


@app.post("/api/pipelines")
async def save_pipeline(pipeline: dict):
    saved = storage.save_pipeline(pipeline)
    if saved.get("schedule"):
        try:
            scheduler.schedule_pipeline(saved["id"], saved["schedule"])
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=f"Bad cron: {exc}")
    return saved


@app.get("/api/pipelines/{pipeline_id}")
async def get_pipeline(pipeline_id: str):
    pipeline = storage.get_pipeline(pipeline_id)
    if pipeline is None:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return pipeline


@app.delete("/api/pipelines/{pipeline_id}")
async def delete_pipeline(pipeline_id: str):
    scheduler.unschedule_pipeline(pipeline_id)
    return {"deleted": storage.delete_pipeline(pipeline_id)}


@app.post("/api/pipelines/{pipeline_id}/run")
async def run_pipeline(pipeline_id: str):
    pipeline = storage.get_pipeline(pipeline_id)
    if pipeline is None:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    report = await pipeline_runner.run_pipeline(pipeline)
    scheduler.record_run(pipeline_id, report)
    return report


@app.post("/api/pipelines/run")
async def run_inline(pipeline: dict):
    """Run a pipeline that has not been saved yet (from the builder)."""
    return await pipeline_runner.run_pipeline(pipeline)


@app.post("/api/pipelines/generate")
async def generate_pipeline(body: GenerateBody):
    return await generator.generate(body.prompt)


# ── Scheduler ─────────────────────────────────────────────────────────────────
@app.get("/api/scheduler/jobs")
async def scheduler_jobs():
    return scheduler.jobs()


# ── Files ─────────────────────────────────────────────────────────────────────
@app.get("/api/files/list")
async def list_files(directory: str = ""):
    try:
        return {
            "directory": directory,
            "entries": file_manager.list_dir(directory),
            "disk": file_manager.disk_usage(),
        }
    except file_manager.SecurityError as exc:
        raise HTTPException(status_code=403, detail=str(exc))


if __name__ == "__main__":
    config.ensure_directories()
    uvicorn.run("main:app", host=config.HOST, port=config.PORT, reload=config.DEBUG)
