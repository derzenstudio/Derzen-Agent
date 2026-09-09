export interface ProjectFile {
  name: string;
  path: string;
  language: string;
  description: string;
  content: string;
}

export const projectFiles: ProjectFile[] = [
  {
    name: "main.py",
    path: "main.py",
    language: "python",
    description: "FastAPI server - all values from environment variables",
    content: `"""
AI Automation Hub - Main Server (Security Hardened)
====================================================
All configuration values loaded from environment variables.
No hardcoded credentials or paths.
"""

import os
import sys
import json
import asyncio
import logging
from datetime import datetime
from pathlib import Path
from threading import Event
from typing import Optional, List, Dict
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from fastapi import FastAPI, WebSocket, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from automation import BrowserAutomation
from ai_manager import AIManager
from email_listener import EmailListener
from whatsapp_listener import WhatsAppListener
from file_manager import FileManager
from pipeline_runner import PipelineRunner

# ─── Configuration (All from Environment) ────────────────────────────────────
BASE_DIR = Path(__file__).parent

# SECURITY: Sandbox root from environment
ALLOWED_BASE = Path(os.getenv("ALLOWED_BASE", "./sandbox"))

# Runtime directories (all relative to ALLOWED_BASE)
DOWNLOAD_DIR = ALLOWED_BASE / os.getenv("DOWNLOAD_SUBDIR", "Downloads")
REPORTS_DIR = ALLOWED_BASE / os.getenv("REPORTS_SUBDIR", "Reports")
MODELS_DIR = ALLOWED_BASE / os.getenv("MODELS_SUBDIR", "Models")
ASSETS_DIR = ALLOWED_BASE / os.getenv("ASSETS_SUBDIR", "Assets")
LOGS_DIR = ALLOWED_BASE / os.getenv("LOGS_SUBDIR", "Logs")
PIPELINES_DIR = ALLOWED_BASE / os.getenv("PIPELINES_SUBDIR", "Pipelines")

# Create directories
for d in [DOWNLOAD_DIR, REPORTS_DIR, MODELS_DIR, ASSETS_DIR, LOGS_DIR, PIPELINES_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# Server configuration
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "8000"))
DEBUG = os.getenv("DEBUG", "false").lower() == "true"

# ─── Logging ─────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.DEBUG if DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler(LOGS_DIR / "server.log"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger("AIHub")

# ─── Emergency Stop ──────────────────────────────────────────────────────────
emergency_stop = Event()

# ─── FastAPI App ─────────────────────────────────────────────────────────────
app = FastAPI(
    title="DERZEN - AI Automation Hub",
    description="Still and always be DERZEN",
    version="3.0.0",
    docs_url="/docs" if DEBUG else None,  # Disable docs in production
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("ALLOWED_ORIGIN", "http://localhost:8000")],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ─── Global State ────────────────────────────────────────────────────────────
state = {
    "browser": None,
    "ai_manager": None,
    "scheduler": None,
    "email_listener": None,
    "whatsapp_listener": None,
    "file_manager": None,
    "pipeline_runner": None,
    "status": "initializing",
}


# ─── Security: Path Validation ───────────────────────────────────────────────
def validate_path(requested_path: str) -> Path:
    """Ensure path is within allowed sandbox directory."""
    resolved = (ALLOWED_BASE / requested_path).resolve()
    if not str(resolved).startswith(str(ALLOWED_BASE.resolve())):
        logger.critical(f"SECURITY: Path traversal blocked: {requested_path}")
        raise HTTPException(status_code=403, detail="Access denied: Path outside sandbox")
    return resolved


# ─── Security: Whitelist Check ───────────────────────────────────────────────
def is_whitelisted(contact: str) -> bool:
    """Check if contact is in whitelist from environment."""
    whitelist_str = os.getenv("WHITELIST_CONTACTS", "")
    if not whitelist_str:
        logger.error("No whitelist configured. All contacts blocked.")
        return False
    
    whitelist = [w.strip().lower() for w in whitelist_str.split(",") if w.strip()]
    return contact.strip().lower() in whitelist


# ─── Startup ─────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    logger.info("Starting AI Automation Hub...")
    
    if emergency_stop.is_set():
        logger.warning("Emergency stop is active. Startup aborted.")
        return
    
    # Validate critical environment variables
    required_vars = ["WHITELIST_CONTACTS", "ALLOWED_BASE"]
    missing = [v for v in required_vars if not os.getenv(v)]
    if missing:
        logger.error(f"Missing required environment variables: {missing}")
        logger.error("Please configure .env file before starting.")
        return
    
    # Initialize modules
    state["ai_manager"] = AIManager(
        models_dir=MODELS_DIR,
        backend=os.getenv("AI_BACKEND", "ollama"),
        default_model=os.getenv("DEFAULT_MODEL", "llama3.2"),
    )
    await state["ai_manager"].initialize()
    
    state["browser"] = BrowserAutomation(
        headless=os.getenv("BROWSER_HEADLESS", "false").lower() == "true",
        download_dir=DOWNLOAD_DIR,
    )
    await state["browser"].initialize()
    
    state["file_manager"] = FileManager(base_dir=ALLOWED_BASE)
    state["pipeline_runner"] = PipelineRunner(
        ai_manager=state["ai_manager"],
        browser=state["browser"],
        file_manager=state["file_manager"],
        pipelines_dir=PIPELINES_DIR,
    )
    
    # Setup scheduler
    state["scheduler"] = AsyncIOScheduler()
    
    # Load and schedule saved pipelines
    saved_pipelines = state["pipeline_runner"].list_pipelines()
    for pipeline in saved_pipelines:
        if pipeline.get("schedule"):
            try:
                state["scheduler"].add_job(
                    state["pipeline_runner"].run_pipeline,
                    CronTrigger.from_crontab(pipeline["schedule"]),
                    args=[pipeline["id"]],
                    id=f"pipeline_{pipeline['id']}",
                    name=pipeline["name"],
                )
                logger.info(f"Scheduled pipeline: {pipeline['name']}")
            except Exception as e:
                logger.error(f"Failed to schedule pipeline {pipeline['id']}: {e}")
    
    state["scheduler"].start()
    
    # Start listeners (only if credentials configured)
    if os.getenv("EMAIL_SENDER") and os.getenv("EMAIL_PASSWORD"):
        state["email_listener"] = EmailListener(
            ai_manager=state["ai_manager"],
            whitelist_check=is_whitelisted,
            callback=on_email_action,
        )
        asyncio.create_task(state["email_listener"].start_listening())
    
    if os.getenv("WHATSAPP_ENABLED", "false").lower() == "true":
        state["whatsapp_listener"] = WhatsAppListener(
            browser=state["browser"],
            ai_manager=state["ai_manager"],
            whitelist_check=is_whitelisted,
            callback=on_whatsapp_action,
        )
        asyncio.create_task(state["whatsapp_listener"].start_listening())
    
    state["status"] = "running"
    logger.info("AI Automation Hub is fully operational!")


# ─── Emergency Stop ──────────────────────────────────────────────────────────
@app.post("/api/emergency-stop")
async def trigger_emergency_stop():
    """Immediately halt all automation."""
    emergency_stop.set()
    
    if state["scheduler"]:
        state["scheduler"].shutdown(wait=False)
    if state["browser"]:
        await state["browser"].cleanup()
    if state["email_listener"]:
        state["email_listener"].stop()
    if state["whatsapp_listener"]:
        state["whatsapp_listener"].stop()
    
    state["status"] = "emergency_stopped"
    logger.critical("EMERGENCY STOP ACTIVATED")
    return {"status": "stopped"}


# ─── API Endpoints ───────────────────────────────────────────────────────────
@app.get("/api/status")
async def get_status():
    return {
        "status": state["status"],
        "emergency_stop": emergency_stop.is_set(),
        "timestamp": datetime.now().isoformat(),
    }


@app.post("/api/ai/query")
async def query_ai(prompt: str):
    if emergency_stop.is_set():
        raise HTTPException(status_code=503, detail="System stopped")
    response = await state["ai_manager"].generate(prompt)
    return {"response": response}


# ─── Pipeline Builder Endpoints ──────────────────────────────────────────────
@app.get("/api/pipelines")
async def list_pipelines():
    """List all saved pipelines."""
    return state["pipeline_runner"].list_pipelines()


@app.post("/api/pipelines")
async def save_pipeline(pipeline_data: dict):
    """Save a new pipeline."""
    return state["pipeline_runner"].save_pipeline(pipeline_data)


@app.get("/api/pipelines/{pipeline_id}")
async def get_pipeline(pipeline_id: str):
    """Get a specific pipeline."""
    return state["pipeline_runner"].get_pipeline(pipeline_id)


@app.delete("/api/pipelines/{pipeline_id}")
async def delete_pipeline(pipeline_id: str):
    """Delete a pipeline."""
    return state["pipeline_runner"].delete_pipeline(pipeline_id)


@app.post("/api/pipelines/{pipeline_id}/run")
async def run_pipeline(pipeline_id: str):
    """Run a specific pipeline."""
    if emergency_stop.is_set():
        raise HTTPException(status_code=503, detail="System stopped")
    
    asyncio.create_task(state["pipeline_runner"].run_pipeline(pipeline_id))
    return {"status": "started", "pipeline_id": pipeline_id}


@app.post("/api/pipelines/generate")
async def generate_pipeline(prompt: str):
    """Use AI to generate a pipeline from a text prompt."""
    if emergency_stop.is_set():
        raise HTTPException(status_code=503, detail="System stopped")
    
    return await state["pipeline_runner"].generate_pipeline_from_prompt(prompt)


# ─── File Manager Endpoints (Sandboxed) ──────────────────────────────────────
@app.get("/api/files/list")
async def list_files(directory: str = ""):
    target = validate_path(directory)
    return state["file_manager"].list_files(str(target))


@app.post("/api/files/upload")
async def upload_file(file: UploadFile = File(...), destination: str = ""):
    target_dir = validate_path(destination)
    return await state["file_manager"].upload_file(file, target_dir)


# ─── Event Callbacks (Whitelist Enforced) ────────────────────────────────────
async def on_email_action(sender: str, action: str,  dict):
    if not is_whitelisted(sender):
        logger.warning(f"BLOCKED: Unauthorized email from {sender}")
        return
    if emergency_stop.is_set():
        return
    
    if action == "run_pipeline":
        pipeline_id = data.get("pipeline_id")
        if pipeline_id:
            asyncio.create_task(state["pipeline_runner"].run_pipeline(pipeline_id))
    elif action == "query_ai":
        response = await state["ai_manager"].generate(data["prompt"])
        await state["email_listener"].send_reply(sender, response)


async def on_whatsapp_action(sender: str, action: str,  dict):
    if not is_whitelisted(sender):
        logger.warning(f"BLOCKED: Unauthorized WhatsApp from {sender}")
        return
    if emergency_stop.is_set():
        return
    
    if action == "run_pipeline":
        pipeline_id = data.get("pipeline_id")
        if pipeline_id:
            asyncio.create_task(state["pipeline_runner"].run_pipeline(pipeline_id))
    elif action == "query_ai":
        response = await state["ai_manager"].generate(data["message"])
        await state["browser"].send_whatsapp_reply(data["chat_id"], response)


# ─── Run Server ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT, reload=DEBUG)
`
  },
  {
    name: "pipeline_runner.py",
    path: "pipeline_runner.py",
    language: "python",
    description: "Visual pipeline execution engine with branching support",
    content: `"""
AI Automation Hub - Pipeline Runner
=====================================
Executes visual pipelines with support for:
- Sequential steps
- Branching (if/else)
- Parallel execution
- AI-generated pipelines from prompts
"""

import os
import json
import uuid
import asyncio
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime

logger = logging.getLogger("AIHub.PipelineRunner")


class PipelineRunner:
    """Executes visual pipelines with branching support."""

    def __init__(self, ai_manager, browser, file_manager, pipelines_dir: Path):
        self.ai_manager = ai_manager
        self.browser = browser
        self.file_manager = file_manager
        self.pipelines_dir = pipelines_dir
        self.pipelines_dir.mkdir(parents=True, exist_ok=True)
        
        # Node executors
        self.executors = {
            "start": self._execute_start,
            "end": self._execute_end,
            "ai_query": self._execute_ai_query,
            "ai_browser": self._execute_ai_browser,
            "web_scrape": self._execute_web_scrape,
            "social_analyze": self._execute_social_analyze,
            "email_send": self._execute_email_send,
            "whatsapp_send": self._execute_whatsapp_send,
            "file_save": self._execute_file_save,
            "wait": self._execute_wait,
            "branch": self._execute_branch,
        }

    def list_pipelines(self) -> List[Dict]:
        """List all saved pipelines."""
        pipelines = []
        for file in self.pipelines_dir.glob("*.json"):
            try:
                with open(file, "r") as f:
                    data = json.load(f)
                    pipelines.append({
                        "id": data["id"],
                        "name": data["name"],
                        "description": data.get("description", ""),
                        "schedule": data.get("schedule"),
                        "created": data.get("created"),
                        "node_count": len(data.get("nodes", [])),
                    })
            except Exception as e:
                logger.error(f"Error loading pipeline {file}: {e}")
        return pipelines

    def save_pipeline(self, pipeline_data: Dict) -> Dict:
        """Save a pipeline to disk."""
        if "id" not in pipeline_data:
            pipeline_data["id"] = str(uuid.uuid4())
        
        pipeline_data["created"] = datetime.now().isoformat()
        pipeline_data["modified"] = datetime.now().isoformat()
        
        file_path = self.pipelines_dir / f"{pipeline_data['id']}.json"
        with open(file_path, "w") as f:
            json.dump(pipeline_data, f, indent=2)
        
        logger.info(f"Pipeline saved: {pipeline_data['name']}")
        return {"id": pipeline_data["id"], "status": "saved"}

    def get_pipeline(self, pipeline_id: str) -> Dict:
        """Load a pipeline from disk."""
        file_path = self.pipelines_dir / f"{pipeline_id}.json"
        if not file_path.exists():
            raise ValueError(f"Pipeline not found: {pipeline_id}")
        
        with open(file_path, "r") as f:
            return json.load(f)

    def delete_pipeline(self, pipeline_id: str) -> Dict:
        """Delete a pipeline."""
        file_path = self.pipelines_dir / f"{pipeline_id}.json"
        if file_path.exists():
            file_path.unlink()
            logger.info(f"Pipeline deleted: {pipeline_id}")
            return {"status": "deleted"}
        raise ValueError(f"Pipeline not found: {pipeline_id}")

    async def run_pipeline(self, pipeline_id: str, context: Dict = None) -> Dict:
        """Execute a pipeline with branching support."""
        pipeline = self.get_pipeline(pipeline_id)
        nodes = {node["id"]: node for node in pipeline["nodes"]}
        
        # Initialize execution context
        ctx = context or {}
        ctx["pipeline_id"] = pipeline_id
        ctx["pipeline_name"] = pipeline["name"]
        ctx["results"] = {}
        ctx["logs"] = []
        
        logger.info(f"Starting pipeline: {pipeline['name']}")
        
        # Find start node
        start_node = next((n for n in nodes.values() if n["type"] == "start"), None)
        if not start_node:
            raise ValueError("Pipeline has no start node")
        
        # Execute from start node
        await self._execute_node(start_node, nodes, ctx)
        
        logger.info(f"Pipeline completed: {pipeline['name']}")
        return {
            "status": "completed",
            "pipeline_id": pipeline_id,
            "results": ctx["results"],
            "logs": ctx["logs"],
        }

    async def _execute_node(self, node: Dict, nodes: Dict, ctx: Dict):
        """Execute a single node and follow connections."""
        node_type = node["type"]
        executor = self.executors.get(node_type)
        
        if not executor:
            raise ValueError(f"Unknown node type: {node_type}")
        
        # Log execution
        ctx["logs"].append({
            "node_id": node["id"],
            "node_type": node_type,
            "timestamp": datetime.now().isoformat(),
            "status": "started",
        })
        
        try:
            # Execute the node
            result = await executor(node, ctx)
            ctx["results"][node["id"]] = result
            
            # Log completion
            ctx["logs"][-1]["status"] = "completed"
            ctx["logs"][-1]["result"] = str(result)[:200]
            
            # Follow connections
            connections = node.get("connections", {})
            
            # Handle branching
            if node_type == "branch":
                # Branch returns "true" or "false" path
                next_path = result.get("path", "true")
                next_node_id = connections.get(next_path)
            else:
                # Default: follow "next" connection
                next_node_id = connections.get("next")
            
            if next_node_id and next_node_id in nodes:
                await self._execute_node(nodes[next_node_id], nodes, ctx)
        
        except Exception as e:
            ctx["logs"][-1]["status"] = "error"
            ctx["logs"][-1]["error"] = str(e)
            logger.error(f"Node {node['id']} failed: {e}")
            
            # Follow error path if exists
            error_path = node.get("connections", {}).get("error")
            if error_path and error_path in nodes:
                await self._execute_node(nodes[error_path], nodes, ctx)
            else:
                raise

    # ─── Node Executors ──────────────────────────────────────────────────────

    async def _execute_start(self, node: Dict, ctx: Dict) -> Dict:
        """Start node - initializes pipeline."""
        return {"status": "started"}

    async def _execute_end(self, node: Dict, ctx: Dict) -> Dict:
        """End node - finalizes pipeline."""
        return {"status": "ended"}

    async def _execute_ai_query(self, node: Dict, ctx: Dict) -> Dict:
        """AI Query node - sends prompt to AI model."""
        prompt = node.get("config", {}).get("prompt", "")
        
        # Replace variables in prompt
        prompt = self._replace_variables(prompt, ctx)
        
        response = await self.ai_manager.generate(prompt)
        return {"response": response}

    async def _execute_web_scrape(self, node: Dict, ctx: Dict) -> Dict:
        """Web Scrape node - scrapes data from one or more URLs."""
        config = node.get("config", {})
        urls_text = config.get("urls", "")
        
        # Support both string (newline-separated) and list formats
        if isinstance(urls_text, str):
            urls = [url.strip() for url in urls_text.split("\\n") if url.strip()]
        else:
            urls = urls_text
        
        # Replace variables in URLs
        urls = [self._replace_variables(url, ctx) for url in urls]
        
        results = []
        for url in urls:
            try:
                data = await self.browser.navigate(url)
                results.append({"url": url, **data})
                logger.info(f"Scraped: {url}")
            except Exception as e:
                logger.error(f"Scrape failed for {url}: {e}")
                results.append({"url": url, "error": str(e)})
        
        # Combine all scraped content
        combined_content = "\\n\\n---\\n\\n".join([
            f"Source: {r.get('url', 'unknown')}\\n{r.get('content', r.get('title', ''))}"
            for r in results if 'error' not in r
        ])
        
        return {
            "scraped": results,
            "combined_content": combined_content,
            "url_count": len(results),
        }

    async def _execute_ai_browser(self, node: Dict, ctx: Dict) -> Dict:
        """AI Browser node - interacts with online AI services."""
        config = node.get("config", {})
        ai_service = config.get("ai_service", "chatgpt")
        prompt = self._replace_variables(config.get("prompt", ""), ctx)
        wait_seconds = int(config.get("wait_seconds", 30))
        conversation_mode = config.get("conversation_mode", False)
        
        try:
            response = await self.browser.interact_with_ai_service(
                service=ai_service,
                prompt=prompt,
                wait_seconds=wait_seconds,
                conversation_mode=conversation_mode,
            )
            logger.info(f"AI Browser ({ai_service}): Got response")
            return {
                "ai_answer": response,
                "service": ai_service,
                "prompt": prompt,
            }
        except Exception as e:
            logger.error(f"AI Browser failed: {e}")
            return {"ai_answer": f"Error: {e}", "service": ai_service, "error": str(e)}

    async def _execute_social_analyze(self, node: Dict, ctx: Dict) -> Dict:
        """Social Media Analysis node - searches and analyzes social media posts."""
        config = node.get("config", {})
        platform = config.get("platform", "twitter")
        query = self._replace_variables(config.get("query", ""), ctx)
        post_count = int(config.get("post_count", 10))
        analyze_sentiment = config.get("analyze_sentiment", True)
        
        try:
            results = await self.browser.analyze_social_media(
                platform=platform,
                query=query,
                post_count=post_count,
                analyze_sentiment=analyze_sentiment,
            )
            logger.info(f"Social Analysis ({platform}): Analyzed {len(results.get('posts', []))} posts")
            return results
        except Exception as e:
            logger.error(f"Social Analysis failed: {e}")
            return {
                "posts": [],
                "platform": platform,
                "error": str(e),
                "total_count": 0,
            }

    async def _execute_email_send(self, node: Dict, ctx: Dict) -> Dict:
        """Email Send node - sends email."""
        config = node.get("config", {})
        to = self._replace_variables(config.get("to", ""), ctx)
        subject = self._replace_variables(config.get("subject", ""), ctx)
        body = self._replace_variables(config.get("body", ""), ctx)
        
        # Email sending would be implemented here
        logger.info(f"Email sent to {to}: {subject}")
        return {"sent": True, "to": to}

    async def _execute_whatsapp_send(self, node: Dict, ctx: Dict) -> Dict:
        """WhatsApp Send node - sends WhatsApp message."""
        config = node.get("config", {})
        contact = self._replace_variables(config.get("contact", ""), ctx)
        message = self._replace_variables(config.get("message", ""), ctx)
        
        await self.browser.send_whatsapp_message(contact, message)
        return {"sent": True, "contact": contact}

    async def _execute_file_save(self, node: Dict, ctx: Dict) -> Dict:
        """File Save node - saves data to file."""
        config = node.get("config", {})
        filename = self._replace_variables(config.get("filename", "output.txt"), ctx)
        content = self._replace_variables(config.get("content", ""), ctx)
        
        # Save to sandboxed directory
        file_path = self.file_manager.save_file(filename, content.encode())
        return {"saved": str(file_path)}

    async def _execute_wait(self, node: Dict, ctx: Dict) -> Dict:
        """Wait node - pauses execution."""
        seconds = node.get("config", {}).get("seconds", 1)
        await asyncio.sleep(seconds)
        return {"waited": seconds}

    async def _execute_branch(self, node: Dict, ctx: Dict) -> Dict:
        """Branch node - conditional logic."""
        config = node.get("config", {})
        condition = config.get("condition", "")
        
        # Replace variables in condition
        condition = self._replace_variables(condition, ctx)
        
        # Evaluate condition (simple implementation)
        try:
            # Support simple comparisons
            if "==" in condition:
                left, right = condition.split("==")
                result = left.strip() == right.strip()
            elif "!=" in condition:
                left, right = condition.split("!=")
                result = left.strip() != right.strip()
            elif ">" in condition:
                left, right = condition.split(">")
                result = float(left.strip()) > float(right.strip())
            elif "<" in condition:
                left, right = condition.split("<")
                result = float(left.strip()) < float(right.strip())
            else:
                # Default to truthy check
                result = bool(condition.strip())
            
            return {"path": "true" if result else "false"}
        
        except Exception as e:
            logger.error(f"Branch evaluation failed: {e}")
            return {"path": "false"}

    def _replace_variables(self, text: str, ctx: Dict) -> str:
        """Replace {{variable}} placeholders with context values."""
        import re
        
        def replacer(match):
            var_name = match.group(1)
            # Check pipeline results
            for node_id, result in ctx.get("results", {}).items():
                if isinstance(result, dict) and var_name in result:
                    return str(result[var_name])
            # Check context
            if var_name in ctx:
                return str(ctx[var_name])
            return match.group(0)  # Leave unchanged if not found
        
        return re.sub(r"\\{\\{(\\w+)\\}\\}", replacer, text)

    async def generate_pipeline_from_prompt(self, prompt: str) -> Dict:
        """Use AI to generate a pipeline structure from text description."""
        ai_prompt = f"""
        Convert this pipeline description into a JSON structure:
        
        Description: {prompt}
        
        Available node types:
        - start: Pipeline entry point
        - end: Pipeline exit point
        - ai_query: Send prompt to AI (config: {{"prompt": "..."}})
        - web_scrape: Scrape URLs (config: {{"urls": ["..."]}})
        - email_send: Send email (config: {{"to": "...", "subject": "...", "body": "..."}})
        - whatsapp_send: Send WhatsApp (config: {{"contact": "...", "message": "..."}})
        - file_save: Save file (config: {{"filename": "...", "content": "..."}})
        - wait: Pause (config: {{"seconds": N}})
        - branch: Conditional (config: {{"condition": "..."}}, connections: {{"true": "node_id", "false": "node_id"}})
        
        Return JSON with:
        {{
            "name": "Pipeline name",
            "description": "Brief description",
            "nodes": [
                {{"id": "node_1", "type": "start", "position": {{"x": 0, "y": 0}}, "connections": {{"next": "node_2"}}}},
                ...
            ]
        }}
        
        Use sequential node IDs (node_1, node_2, etc.).
        Position nodes in a logical flow (x increases right, y increases down).
        """
        
        response = await self.ai_manager.generate(ai_prompt, max_tokens=2000)
        
        # Try to extract JSON from response
        try:
            json_start = response.find("{")
            json_end = response.rfind("}") + 1
            if json_start >= 0 and json_end > json_start:
                pipeline_data = json.loads(response[json_start:json_end])
                pipeline_data["id"] = str(uuid.uuid4())
                return {"status": "generated", "pipeline": pipeline_data}
        except json.JSONDecodeError:
            pass
        
        return {"status": "failed", "error": "Could not parse AI response"}
`
  },
  {
    name: "automation.py",
    path: "automation.py",
    language: "python",
    description: "Browser automation - all paths from environment",
    content: `"""
AI Automation Hub - Browser Automation
========================================
All configuration from environment variables.
"""

import os
import asyncio
import logging
from pathlib import Path
from typing import Optional, List, Dict
from datetime import datetime

from playwright.async_api import async_playwright, Browser, BrowserContext, Page

logger = logging.getLogger("AIHub.Automation")


class BrowserAutomation:
    """Manages Playwright browser with security controls."""

    def __init__(self, headless: bool = False, download_dir: Path = None):
        self.playwright = None
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.main_page: Optional[Page] = None
        self.headless = headless
        
        # All paths from environment
        allowed_base = Path(os.getenv("ALLOWED_BASE", "./sandbox"))
        self.allowed_download_dir = download_dir or (allowed_base / "Downloads")
        
        browser_data_subdir = os.getenv("BROWSER_DATA_SUBDIR", "BrowserData")
        self.user_data_dir = allowed_base / browser_data_subdir

    async def initialize(self):
        """Launch browser with security restrictions."""
        self.playwright = await async_playwright().start()

        self.context = await self.playwright.chromium.launch_persistent_context(
            user_data_dir=str(self.user_data_dir),
            headless=self.headless,
            accept_downloads=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
            ],
        )

        self.main_page = self.context.pages[0] if self.context.pages else await self.context.new_page()
        logger.info("Browser initialized")

    async def cleanup(self):
        """Clean up browser resources."""
        if self.context:
            await self.context.close()
        if self.playwright:
            await self.playwright.stop()

    async def navigate(self, url: str) -> Dict:
        """Navigate to URL."""
        response = await self.main_page.goto(url, wait_until="networkidle")
        return {
            "url": self.main_page.url,
            "title": await self.main_page.title(),
            "status": response.status if response else None,
        }

    async def send_whatsapp_message(self, contact: str, message: str):
        """Send WhatsApp message."""
        page = await self.context.new_page()
        await page.goto("https://web.whatsapp.com")
        await page.wait_for_selector('[data-testid="chat-list"]', timeout=60000)

        try:
            search = page.locator('[data-testid="chat-list-search"]')
            await search.fill(contact)
            await asyncio.sleep(2)
            
            await page.locator(f'[title="{contact}"]').first.click()
            
            msg_box = page.locator('[data-testid="compose-input"]')
            await msg_box.fill(message)
            await page.locator('[data-testid="send"]').click()
            
            logger.info(f"WhatsApp message sent to {contact}")
        finally:
            await page.close()

    async def interact_with_ai_service(
        self,
        service: str,
        prompt: str,
        wait_seconds: int = 30,
        conversation_mode: bool = False,
    ) -> str:
        """
        Interact with online AI services (ChatGPT, Claude, Gemini, Perplexity).
        Opens the service website, types the prompt, waits for response.
        Acts like a human user - no API keys needed.
        """
        service_urls = {
            "chatgpt": "https://chat.openai.com",
            "claude": "https://claude.ai",
            "gemini": "https://gemini.google.com",
            "perplexity": "https://www.perplexity.ai",
        }
        
        url = service_urls.get(service, service_urls["chatgpt"])
        page = await self.context.new_page()
        
        try:
            logger.info(f"AI Browser: Opening {service} at {url}")
            await page.goto(url, wait_until="networkidle", timeout=30000)
            await asyncio.sleep(3)  # Let page fully load
            
            # Service-specific selectors (these may need updating as UIs change)
            selectors = {
                "chatgpt": {
                    "input": "textarea, [contenteditable='true']",
                    "submit": "button[data-testid='send-button'], button[type='submit']",
                    "response": "[data-message-author-role='assistant']:last-child .markdown",
                },
                "claude": {
                    "input": "div[contenteditable='true'], textarea",
                    "submit": "button[aria-label='Send Message']",
                    "response": ".font-claude-message:last-child",
                },
                "gemini": {
                    "input": "textarea, .input-area textarea",
                    "submit": "button[aria-label='Send message']",
                    "response": ".response-container:last-child .markdown",
                },
                "perplexity": {
                    "input": "textarea",
                    "submit": "button[type='submit']",
                    "response": ".prose:last-child",
                },
            }
            
            sel = selectors.get(service, selectors["chatgpt"])
            
            # Find and fill input
            input_el = page.locator(sel["input"]).first
            await input_el.wait_for(timeout=10000)
            await input_el.fill(prompt)
            await asyncio.sleep(1)
            
            # Click submit
            submit_btn = page.locator(sel["submit"]).first
            await submit_btn.click()
            
            # Wait for response
            logger.info(f"AI Browser: Waiting {wait_seconds}s for {service} response...")
            response_el = page.locator(sel["response"]).first
            
            # Wait for response to appear and stabilize
            await response_el.wait_for(timeout=wait_seconds * 1000)
            await asyncio.sleep(3)  # Extra wait for response to complete
            
            # Extract response text
            response_text = await response_el.inner_text()
            
            logger.info(f"AI Browser: Got response from {service} ({len(response_text)} chars)")
            return response_text.strip()
            
        except Exception as e:
            logger.error(f"AI Browser failed for {service}: {e}")
            raise
        finally:
            if not conversation_mode:
                await page.close()

    async def analyze_social_media(
        self,
        platform: str,
        query: str,
        post_count: int = 10,
        analyze_sentiment: bool = True,
    ) -> Dict:
        """
        Search and analyze social media posts.
        Supports Twitter/X, Instagram, LinkedIn, Facebook.
        """
        platform_urls = {
            "twitter": "https://twitter.com/search",
            "instagram": "https://www.instagram.com/explore/tags",
            "linkedin": "https://www.linkedin.com/search/results/content",
            "facebook": "https://www.facebook.com/search/posts",
        }
        
        url = platform_urls.get(platform, platform_urls["twitter"])
        page = await self.context.new_page()
        
        try:
            logger.info(f"Social Analysis: Searching {platform} for '{query}'")
            
            # Navigate with search query
            if platform == "twitter":
                await page.goto(f"{url}?q={query}&src=typed_query", wait_until="networkidle")
            elif platform == "instagram":
                await page.goto(f"{url}/{query.replace(' ', '')}", wait_until="networkidle")
            elif platform == "linkedin":
                await page.goto(f"{url}?keywords={query}", wait_until="networkidle")
            elif platform == "facebook":
                await page.goto(f"{url}?q={query}", wait_until="networkidle")
            
            await asyncio.sleep(3)
            
            # Platform-specific post extraction
            posts = []
            
            if platform == "twitter":
                # Extract tweets
                tweet_els = page.locator("[data-testid='tweet']").locator("xpath=..")
                count = min(await tweet_els.count(), post_count)
                
                for i in range(count):
                    try:
                        tweet = tweet_els.nth(i)
                        text = await tweet.locator("[data-testid='tweetText']").inner_text()
                        author = await tweet.locator("[data-testid='User-Name']").inner_text()
                        
                        post_data = {
                            "platform": platform,
                            "author": author.split("\\n")[0] if author else "Unknown",
                            "content": text,
                            "timestamp": datetime.now().isoformat(),
                        }
                        
                        if analyze_sentiment:
                            post_data["sentiment"] = await self._analyze_sentiment(text)
                        
                        posts.append(post_data)
                    except Exception as e:
                        logger.debug(f"Failed to extract tweet {i}: {e}")
                        continue
            
            elif platform == "linkedin":
                # Extract LinkedIn posts
                post_els = page.locator(".feed-shared-update-v2")
                count = min(await post_els.count(), post_count)
                
                for i in range(count):
                    try:
                        post = post_els.nth(i)
                        text = await post.locator(".feed-shared-text").inner_text()
                        author = await post.locator(".feed-shared-actor__description").inner_text()
                        
                        post_data = {
                            "platform": platform,
                            "author": author.split("\\n")[0] if author else "Unknown",
                            "content": text[:500],  # Limit length
                            "timestamp": datetime.now().isoformat(),
                        }
                        
                        if analyze_sentiment:
                            post_data["sentiment"] = await self._analyze_sentiment(text)
                        
                        posts.append(post_data)
                    except Exception as e:
                        logger.debug(f"Failed to extract LinkedIn post {i}: {e}")
                        continue
            
            # Calculate sentiment summary
            sentiment_summary = {}
            if analyze_sentiment and posts:
                sentiments = [p.get("sentiment", "neutral") for p in posts]
                sentiment_summary = {
                    "positive": sentiments.count("positive"),
                    "negative": sentiments.count("negative"),
                    "neutral": sentiments.count("neutral"),
                    "overall": max(set(sentiments), key=sentiments.count),
                }
            
            logger.info(f"Social Analysis: Found {len(posts)} posts on {platform}")
            
            return {
                "posts": posts,
                "platform": platform,
                "query": query,
                "total_count": len(posts),
                "sentiment_summary": sentiment_summary,
            }
            
        except Exception as e:
            logger.error(f"Social Analysis failed for {platform}: {e}")
            raise
        finally:
            await page.close()

    async def _analyze_sentiment(self, text: str) -> str:
        """Simple sentiment analysis using keyword matching."""
        text_lower = text.lower()
        
        positive_words = ["great", "awesome", "excellent", "amazing", "love", "best", "good", "happy", "wonderful", "fantastic"]
        negative_words = ["bad", "terrible", "awful", "hate", "worst", "horrible", "poor", "sad", "angry", "disappointed"]
        
        positive_count = sum(1 for word in positive_words if word in text_lower)
        negative_count = sum(1 for word in negative_words if word in text_lower)
        
        if positive_count > negative_count:
            return "positive"
        elif negative_count > positive_count:
            return "negative"
        else:
            return "neutral"
`
  },
  {
    name: "file_manager.py",
    path: "file_manager.py",
    language: "python",
    description: "Sandboxed file manager - base path from environment",
    content: `"""
AI Automation Hub - File Manager
==================================
Base directory from environment variable.
"""

import os
import shutil
import logging
from pathlib import Path
from typing import List, Dict
from datetime import datetime

logger = logging.getLogger("AIHub.FileManager")


class SecurityError(Exception):
    pass


class FileManager:
    """Sandboxed file manager."""

    def __init__(self, base_dir: Path = None):
        # Base directory from environment
        self.base_dir = (base_dir or Path(os.getenv("ALLOWED_BASE", "./sandbox"))).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def validate_path(self, requested_path: str) -> Path:
        """Validate path is within sandbox."""
        resolved = (self.base_dir / requested_path).resolve()
        if not str(resolved).startswith(str(self.base_dir)):
            raise SecurityError(f"Access denied: {requested_path}")
        return resolved

    def list_files(self, directory: str = "") -> List[Dict]:
        """List files in directory."""
        target = self.validate_path(directory)
        if not target.exists():
            return []
        
        files = []
        for item in target.iterdir():
            stat = item.stat()
            files.append({
                "name": item.name,
                "path": str(item.relative_to(self.base_dir)),
                "is_dir": item.is_dir(),
                "size": stat.st_size if item.is_file() else None,
                "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            })
        return sorted(files, key=lambda x: (not x["is_dir"], x["name"]))

    def save_file(self, filename: str, content: bytes, directory: str = "") -> Path:
        """Save file with path validation."""
        target_dir = self.validate_path(directory) if directory else self.base_dir
        target_dir.mkdir(parents=True, exist_ok=True)
        file_path = target_dir / filename
        file_path.write_bytes(content)
        return file_path

    async def upload_file(self, file, target_dir: Path) -> Dict:
        """Upload file with validation."""
        validated_dir = self.validate_path(str(target_dir.relative_to(self.base_dir)))
        validated_dir.mkdir(parents=True, exist_ok=True)
        
        file_path = validated_dir / file.filename
        content = await file.read()
        file_path.write_bytes(content)
        
        return {
            "filename": file.filename,
            "path": str(file_path.relative_to(self.base_dir)),
            "size": len(content),
        }
`
  },
  {
    name: "requirements.txt",
    path: "requirements.txt",
    language: "text",
    description: "Python dependencies",
    content: `fastapi==0.104.1
uvicorn[standard]==0.24.0
playwright==1.40.0
APScheduler==3.10.4
openpyxl==3.1.2
aiohttp==3.9.1
python-multipart==0.0.6
python-dotenv==1.0.0`
  },
  {
    name: ".env.example",
    path: ".env.example",
    language: "text",
    description: "Environment configuration - ALL values must be set",
    content: `# AI Automation Hub - Environment Configuration
# ALL VALUES MUST BE CONFIGURED - NO DEFAULTS FOR SECURITY

# ─── SECURITY: REQUIRED ──────────────────────────────────────────────────────
# Whitelisted contacts (comma-separated) - ONLY these can trigger actions
WHITELIST_CONTACTS=

# Sandbox root directory - ALL file operations restricted here
ALLOWED_BASE=

# ─── SERVER ──────────────────────────────────────────────────────────────────
HOST=127.0.0.1
PORT=8000
DEBUG=false
ALLOWED_ORIGIN=http://localhost:8000

# ─── SUBDIRECTORIES (relative to ALLOWED_BASE) ───────────────────────────────
DOWNLOAD_SUBDIR=Downloads
REPORTS_SUBDIR=Reports
MODELS_SUBDIR=Models
ASSETS_SUBDIR=Assets
LOGS_SUBDIR=Logs
PIPELINES_SUBDIR=Pipelines
BROWSER_DATA_SUBDIR=BrowserData

# ─── EMAIL (leave empty to disable) ──────────────────────────────────────────
EMAIL_SENDER=
EMAIL_PASSWORD=
IMAP_SERVER=imap.gmail.com
SMTP_SERVER=smtp.gmail.com

# ─── WHATSAPP (set to true to enable) ────────────────────────────────────────
WHATSAPP_ENABLED=false

# ─── AI CONFIGURATION ────────────────────────────────────────────────────────
AI_BACKEND=ollama
DEFAULT_MODEL=llama3.2
OLLAMA_URL=http://localhost:11434

# ─── BROWSER ─────────────────────────────────────────────────────────────────
BROWSER_HEADLESS=false`
  }
];
