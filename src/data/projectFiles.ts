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
    description: "FastAPI server, scheduling loop, and application entry point",
    content: `"""
AI Automation Hub - Main Server
================================
FastAPI server that serves the web UI, manages scheduling,
and orchestrates all automation modules.
"""

import os
import sys
import json
import asyncio
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict

from fastapi import FastAPI, WebSocket, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from automation import BrowserAutomation
from ai_manager import AIManager
from email_listener import EmailListener
from whatsapp_listener import WhatsAppListener
from file_manager import FileManager

# ─── Configuration ───────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
DOWNLOAD_DIR = Path("C:/AI_Automation/Downloads")
REPORTS_DIR = Path("C:/AI_Automation/Reports")
MODELS_DIR = Path("C:/AI_Automation/Models")
ASSETS_DIR = Path("C:/AI_Automation/Assets")
LOGS_DIR = Path("C:/AI_Automation/Logs")

# Create directories
for d in [DOWNLOAD_DIR, REPORTS_DIR, MODELS_DIR, ASSETS_DIR, LOGS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# ─── Logging Setup ───────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler(LOGS_DIR / "server.log"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger("AIHub")

# ─── FastAPI App ─────────────────────────────────────────────────────────────
app = FastAPI(
    title="AI Automation Hub",
    description="Centralized AI Agent Controller",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Global State ────────────────────────────────────────────────────────────
state = {
    "browser": None,
    "ai_manager": None,
    "scheduler": None,
    "email_listener": None,
    "whatsapp_listener": None,
    "tasks": [],
    "logs": [],
    "status": "initializing",
}

# ─── WebSocket for Real-time Updates ─────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        logger.info(f"WebSocket client disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

manager = ConnectionManager()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle incoming commands from UI
            msg = json.loads(data)
            if msg.get("type") == "command":
                await handle_command(msg["payload"])
    except Exception as e:
        manager.disconnect(websocket)


async def handle_command(payload: dict):
    """Process commands from the web UI."""
    cmd = payload.get("action")
    if cmd == "run_sunday_pipeline":
        asyncio.create_task(run_sunday_pipeline())
    elif cmd == "download_model":
        model_name = payload.get("model_name", "")
        asyncio.create_task(download_ai_model(model_name))
    elif cmd == "get_status":
        await manager.broadcast({"type": "status", "data": state["status"]})


# ─── Startup & Shutdown ─────────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    logger.info("🚀 AI Automation Hub starting up...")
    state["status"] = "starting"

    # Initialize AI Manager (load offline model)
    state["ai_manager"] = AIManager(models_dir=MODELS_DIR)
    await state["ai_manager"].initialize()
    logger.info("✅ AI Manager initialized")

    # Initialize Browser Automation
    state["browser"] = BrowserAutomation()
    await state["browser"].initialize()
    logger.info("✅ Browser Automation initialized")

    # Initialize File Manager
    state["file_manager"] = FileManager(
        download_dir=DOWNLOAD_DIR,
        reports_dir=REPORTS_DIR,
        assets_dir=ASSETS_DIR,
    )

    # Setup Scheduler
    state["scheduler"] = AsyncIOScheduler()

    # Schedule the Sunday 9 AM Pipeline
    state["scheduler"].add_job(
        run_sunday_pipeline,
        CronTrigger(day_of_week="sun", hour=9, minute=0),
        id="sunday_pipeline",
        name="Sunday Research & Report Pipeline",
    )
    state["scheduler"].start()
    logger.info("✅ Scheduler started - Sunday 9 AM pipeline scheduled")

    # Start Email Listener
    state["email_listener"] = EmailListener(
        ai_manager=state["ai_manager"],
        callback=on_email_action,
    )
    asyncio.create_task(state["email_listener"].start_listening())
    logger.info("✅ Email Listener started")

    # Start WhatsApp Listener
    state["whatsapp_listener"] = WhatsAppListener(
        browser=state["browser"],
        ai_manager=state["ai_manager"],
        callback=on_whatsapp_action,
    )
    asyncio.create_task(state["whatsapp_listener"].start_listening())
    logger.info("✅ WhatsApp Listener started")

    state["status"] = "running"
    logger.info("🎉 AI Automation Hub is fully operational!")


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down AI Automation Hub...")
    if state["scheduler"]:
        state["scheduler"].shutdown()
    if state["browser"]:
        await state["browser"].cleanup()
    state["status"] = "stopped"


# ─── API Endpoints ───────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def serve_dashboard():
    """Serve the main dashboard UI."""
    dashboard_path = BASE_DIR / "static" / "index.html"
    if dashboard_path.exists():
        return FileResponse(dashboard_path)
    return "<h1>AI Automation Hub</h1><p>Dashboard not found. Place files in /static/</p>"


@app.get("/api/status")
async def get_status():
    """Get current system status."""
    return {
        "status": state["status"],
        "timestamp": datetime.now().isoformat(),
        "modules": {
            "browser": state["browser"] is not None,
            "ai_manager": state["ai_manager"] is not None,
            "scheduler": state["scheduler"] is not None,
            "email_listener": state["email_listener"] is not None,
            "whatsapp_listener": state["whatsapp_listener"] is not None,
        },
        "scheduled_jobs": [
            {"id": job.id, "name": job.name, "next_run": str(job.next_run_time)}
            for job in state["scheduler"].get_jobs()
        ] if state["scheduler"] else [],
    }


@app.post("/api/automation/browse")
async def browse_url(url: str):
    """Instruct the browser to navigate to a URL."""
    if not state["browser"]:
        raise HTTPException(status_code=503, detail="Browser not initialized")
    result = await state["browser"].navigate(url)
    return {"success": True, "result": result}


@app.post("/api/automation/download-model")
async def download_model(model_name: str, save_path: Optional[str] = None):
    """Download an AI model from Hugging Face."""
    if not state["browser"]:
        raise HTTPException(status_code=503, detail="Browser not initialized")
    target = Path(save_path) if save_path else MODELS_DIR / model_name
    result = await state["browser"].download_huggingface_model(model_name, target)
    return {"success": True, "model_path": str(target), "result": result}


@app.post("/api/automation/run-pipeline")
async def trigger_pipeline():
    """Manually trigger the Sunday pipeline."""
    asyncio.create_task(run_sunday_pipeline())
    return {"success": True, "message": "Pipeline triggered"}


@app.post("/api/ai/query")
async def query_ai(prompt: str, model: Optional[str] = None):
    """Query the local AI model."""
    if not state["ai_manager"]:
        raise HTTPException(status_code=503, detail="AI Manager not initialized")
    response = await state["ai_manager"].generate(prompt, model=model)
    return {"success": True, "response": response}


# ─── File Manager Endpoints ─────────────────────────────────────────────────

@app.get("/api/files/list")
async def list_files(directory: str = ""):
    """List files in a directory."""
    target = DOWNLOAD_DIR / directory if directory else DOWNLOAD_DIR
    if not target.exists():
        raise HTTPException(status_code=404, detail="Directory not found")
    files = []
    for item in target.iterdir():
        files.append({
            "name": item.name,
            "path": str(item),
            "is_dir": item.is_dir(),
            "size": item.stat().st_size if item.is_file() else None,
            "modified": datetime.fromtimestamp(item.stat().st_mtime).isoformat(),
        })
    return {"files": files, "directory": str(target)}


@app.post("/api/files/upload")
async def upload_file(file: UploadFile = File(...), destination: str = ""):
    """Upload a file to a Windows directory."""
    target_dir = DOWNLOAD_DIR / destination if destination else DOWNLOAD_DIR
    target_dir.mkdir(parents=True, exist_ok=True)
    file_path = target_dir / file.filename
    content = await file.read()
    file_path.write_bytes(content)
    return {"success": True, "path": str(file_path), "size": len(content)}


@app.get("/api/files/download/{filename}")
async def download_file(filename: str):
    """Download a file from the managed directory."""
    file_path = DOWNLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path, filename=filename)


@app.delete("/api/files/delete")
async def delete_file(filepath: str):
    """Delete a file from the managed directory."""
    target = Path(filepath)
    if not target.exists():
        raise HTTPException(status_code=404, detail="File not found")
    if target.is_file():
        target.unlink()
    elif target.is_dir():
        import shutil
        shutil.rmtree(target)
    return {"success": True, "deleted": str(target)}


# ─── Pipeline Functions ─────────────────────────────────────────────────────

async def run_sunday_pipeline():
    """
    The Sunday 9 AM Multi-Step Pipeline:
    1. Research a category via Chrome
    2. Scrape data → CSV/Spreadsheet
    3. AI analysis & filtering
    4. Generate report in spreadsheet
    5. Apply brand styling
    6. Fetch images from Google Drive
    7. Create summary
    8. Send via Email & WhatsApp
    """
    logger.info("🔄 Starting Sunday Pipeline...")
    state["status"] = "running_pipeline"
    await manager.broadcast({"type": "pipeline_status", "step": "started"})

    browser = state["browser"]
    ai = state["ai_manager"]

    try:
        # Step 1: Research
        await manager.broadcast({"type": "pipeline_status", "step": "researching"})
        logger.info("📖 Step 1: Opening research tabs...")
        research_data = await browser.research_category(
            category="AI & Machine Learning Trends 2025",
            sources=["arxiv.org", "huggingface.co", "github.com/trending"],
        )

        # Step 2: Scrape & Format
        await manager.broadcast({"type": "pipeline_status", "step": "scraping"})
        logger.info("📊 Step 2: Scraping and formatting data...")
        scraped_data = await browser.scrape_research_data(research_data)
        csv_path = REPORTS_DIR / f"research_{datetime.now().strftime('%Y%m%d')}.csv"
        await format_to_csv(scraped_data, csv_path)

        # Step 3: AI Analysis
        await manager.broadcast({"type": "pipeline_status", "step": "analyzing"})
        logger.info("🧠 Step 3: AI analyzing data...")
        analysis = await ai.analyze_data(scraped_data)
        filtered_data = await ai.filter_and_process(scraped_data, analysis)

        # Step 4: Generate Report
        await manager.broadcast({"type": "pipeline_status", "step": "reporting"})
        logger.info("📝 Step 4: Generating report...")
        report_path = await browser.generate_spreadsheet_report(
            filtered_data, REPORTS_DIR / "weekly_report.xlsx"
        )

        # Step 5: Apply Brand Styling
        await manager.broadcast({"type": "pipeline_status", "step": "styling"})
        logger.info("🎨 Step 5: Applying brand guide...")
        await browser.apply_brand_styling(report_path, brand_config={
            "primary_color": "#1a73e8",
            "font": "Roboto",
            "header_bg": "#f8f9fa",
            "logo_path": str(ASSETS_DIR / "logo.png"),
        })

        # Step 6: Fetch Images from Google Drive
        await manager.broadcast({"type": "pipeline_status", "step": "images"})
        logger.info("🖼️ Step 6: Fetching images from Google Drive...")
        images = await browser.fetch_drive_images(
            folder_name="Brand Assets",
            save_to=ASSETS_DIR,
        )

        # Step 7: Create Summary
        await manager.broadcast({"type": "pipeline_status", "step": "summarizing"})
        logger.info("📋 Step 7: Creating summary...")
        summary = await ai.generate_summary(filtered_data, analysis)

        # Step 8: Send via Email & WhatsApp
        await manager.broadcast({"type": "pipeline_status", "step": "sending"})
        logger.info("📤 Step 8: Sending reports...")

        # Send Email
        await send_email_report(
            subject=f"Weekly AI Report - {datetime.now().strftime('%B %d, %Y')}",
            body=summary,
            attachments=[str(report_path)],
        )

        # Send WhatsApp
        await browser.send_whatsapp_message(
            contact="Team Updates",
            message=summary,
            media_path=str(report_path),
        )

        state["status"] = "running"
        await manager.broadcast({"type": "pipeline_status", "step": "completed"})
        logger.info("✅ Sunday Pipeline completed successfully!")

    except Exception as e:
        logger.error(f"❌ Pipeline failed: {e}")
        state["status"] = "error"
        await manager.broadcast({"type": "pipeline_status", "step": "failed", "error": str(e)})


async def format_to_csv(data: List[Dict], output_path: Path):
    """Format scraped data to CSV."""
    import csv
    if not data:
        return
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=data[0].keys())
        writer.writeheader()
        writer.writerows(data)
    logger.info(f"CSV saved to {output_path}")


async def send_email_report(subject: str, body: str, attachments: List[str]):
    """Send email with report."""
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    from email.mime.base import MIMEBase
    from email import encoders

    config = {
        "smtp_server": "smtp.gmail.com",
        "smtp_port": 587,
        "sender": os.getenv("EMAIL_SENDER", "agent@company.com"),
        "password": os.getenv("EMAIL_PASSWORD", ""),
        "recipients": os.getenv("EMAIL_RECIPIENTS", "team@company.com").split(","),
    }

    msg = MIMEMultipart()
    msg["From"] = config["sender"]
    msg["To"] = ", ".join(config["recipients"])
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "html"))

    for filepath in attachments:
        with open(filepath, "rb") as f:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(f.read())
            encoders.encode_base64(part)
            part.add_header("Content-Disposition", f"attachment; filename={Path(filepath).name}")
            msg.attach(part)

    with smtplib.SMTP(config["smtp_server"], config["smtp_port"]) as server:
        server.starttls()
        server.login(config["sender"], config["password"])
        server.send_message(msg)

    logger.info(f"📧 Email sent to {config['recipients']}")


# ─── Event Callbacks ────────────────────────────────────────────────────────

async def on_email_action(action: str, data: dict):
    """Handle actions triggered by email commands."""
    logger.info(f"📧 Email action triggered: {action}")
    if action == "run_pipeline":
        asyncio.create_task(run_sunday_pipeline())
    elif action == "query_ai":
        response = await state["ai_manager"].generate(data["prompt"])
        await state["email_listener"].send_reply(data["sender"], response)
    await manager.broadcast({"type": "email_action", "action": action, "data": data})


async def on_whatsapp_action(action: str, data: dict):
    """Handle actions triggered by WhatsApp commands."""
    logger.info(f"💬 WhatsApp action triggered: {action}")
    if action == "run_pipeline":
        asyncio.create_task(run_sunday_pipeline())
    elif action == "query_ai":
        response = await state["ai_manager"].generate(data["message"])
        await state["browser"].send_whatsapp_reply(data["chat_id"], response)
    elif action == "file_request":
        files = await state["file_manager"].list_files(data.get("directory", ""))
        await state["browser"].send_whatsapp_reply(data["chat_id"], json.dumps(files))
    await manager.broadcast({"type": "whatsapp_action", "action": action, "data": data})


# ─── Run Server ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
`
  },
  {
    name: "automation.py",
    path: "automation.py",
    language: "python",
    description: "Playwright browser automation - Chrome control, HF downloads, WhatsApp Web",
    content: `"""
AI Automation Hub - Browser Automation Module
===============================================
Handles all Chrome/Playwright automation including:
- Browser lifecycle management
- Hugging Face model downloads
- WhatsApp Web interactions
- Web scraping & data collection
- Google Drive file management
- Spreadsheet generation
"""

import asyncio
import json
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime

from playwright.async_api import async_playwright, Browser, BrowserContext, Page

logger = logging.getLogger("AIHub.Automation")


class BrowserAutomation:
    """Manages Playwright browser instances for automation tasks."""

    def __init__(self, headless: bool = False):
        self.playwright = None
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.main_page: Optional[Page] = None
        self.headless = headless
        self.user_data_dir = Path("C:/AI_Automation/BrowserData")
        self.user_data_dir.mkdir(parents=True, exist_ok=True)

    async def initialize(self):
        """Launch browser with persistent context."""
        self.playwright = await async_playwright().start()

        # Use persistent context to maintain login sessions
        self.context = await self.playwright.chromium.launch_persistent_context(
            user_data_dir=str(self.user_data_dir),
            headless=self.headless,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--window-size=1920,1080",
            ],
            viewport={"width": 1920, "height": 1080},
            locale="en-US",
            timezone_id="America/New_York",
        )

        # Get or create main page
        if self.context.pages:
            self.main_page = self.context.pages[0]
        else:
            self.main_page = await self.context.new_page()

        logger.info("✅ Browser initialized with persistent context")

    async def cleanup(self):
        """Clean up browser resources."""
        if self.context:
            await self.context.close()
        if self.playwright:
            await self.playwright.stop()
        logger.info("Browser cleaned up")

    # ─── Navigation & Interaction ────────────────────────────────────────────

    async def navigate(self, url: str, wait_until: str = "networkidle") -> Dict:
        """Navigate to a URL and return page info."""
        page = self.main_page
        response = await page.goto(url, wait_until=wait_until)
        return {
            "url": page.url,
            "title": await page.title(),
            "status": response.status if response else None,
        }

    async def click(self, selector: str, page: Optional[Page] = None):
        """Click an element."""
        p = page or self.main_page
        await p.click(selector, timeout=10000)

    async def type_text(self, selector: str, text: str, page: Optional[Page] = None):
        """Type text into an element."""
        p = page or self.main_page
        await p.fill(selector, text)

    async def screenshot(self, path: str = None, page: Optional[Page] = None) -> bytes:
        """Take a screenshot."""
        p = page or self.main_page
        screenshot_path = path or f"C:/AI_Automation/Screenshots/screen_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        Path(screenshot_path).parent.mkdir(parents=True, exist_ok=True)
        return await p.screenshot(path=screenshot_path)

    async def new_tab(self, url: str = "about:blank") -> Page:
        """Open a new browser tab."""
        page = await self.context.new_page()
        if url != "about:blank":
            await page.goto(url, wait_until="networkidle")
        return page

    # ─── Hugging Face Model Download ─────────────────────────────────────────

    async def download_huggingface_model(
        self, model_name: str, save_path: Path
    ) -> Dict[str, Any]:
        """
        Search and download a model from Hugging Face.
        Navigates the HF website, finds the model, and downloads files.
        """
        logger.info(f"🔍 Searching Hugging Face for model: {model_name}")
        page = await self.new_tab()

        try:
            # Step 1: Navigate to Hugging Face models
            await page.goto("https://huggingface.co/models", wait_until="networkidle")

            # Step 2: Search for the model
            search_input = page.locator('input[placeholder*="Search"]')
            await search_input.fill(model_name)
            await search_input.press("Enter")
            await page.wait_for_load_state("networkidle")

            # Step 3: Click the first matching model
            first_result = page.locator(".model-card, .overview").first
            await first_result.click()
            await page.wait_for_load_state("networkidle")

            # Step 4: Navigate to the Files tab
            files_tab = page.locator('a[href*="/tree/main"], [data-testid="files-tab"]')
            if await files_tab.count() > 0:
                await files_tab.first.click()
                await page.wait_for_load_state("networkidle")

            # Step 5: Download model files
            save_path.mkdir(parents=True, exist_ok=True)

            # Find all downloadable files
            file_links = page.locator('a[href*="/resolve/main/"]')
            count = await file_links.count()

            downloaded_files = []
            for i in range(min(count, 10)):  # Limit to 10 files max
                link = file_links.nth(i)
                href = await link.get_attribute("href")
                if href:
                    filename = href.split("/")[-1]
                    file_save_path = save_path / filename

                    # Use Playwright's download handler
                    async with page.expect_download(timeout=120000) as download_info:
                        await link.click()
                    download = await download_info.value
                    await download.save_as(str(file_save_path))
                    downloaded_files.append(filename)
                    logger.info(f"📥 Downloaded: {filename}")

            return {
                "success": True,
                "model": model_name,
                "save_path": str(save_path),
                "files": downloaded_files,
                "file_count": len(downloaded_files),
            }

        except Exception as e:
            logger.error(f"❌ Model download failed: {e}")
            return {"success": False, "error": str(e)}
        finally:
            await page.close()

    # ─── Research & Scraping ─────────────────────────────────────────────────

    async def research_category(
        self, category: str, sources: List[str]
    ) -> List[Dict]:
        """Open tabs to research a category across multiple sources."""
        results = []

        for source in sources:
            page = await self.new_tab(f"https://{source}")
            await asyncio.sleep(2)  # Let page settle

            try:
                if "arxiv" in source:
                    data = await self._scrape_arxiv(page, category)
                elif "huggingface" in source:
                    data = await self._scrape_huggingface(page, category)
                elif "github" in source:
                    data = await self._scrape_github_trending(page, category)
                else:
                    data = await self._generic_scrape(page, category)

                results.extend(data)
            except Exception as e:
                logger.error(f"Error scraping {source}: {e}")
            finally:
                await page.close()

        return results

    async def _scrape_arxiv(self, page: Page, category: str) -> List[Dict]:
        """Scrape research papers from arXiv."""
        # Search arXiv
        search = page.locator('input[name="query"]')
        await search.fill(f"all:{category}")
        await search.press("Enter")
        await page.wait_for_load_state("networkidle")

        papers = []
        entries = page.locator("dl dt, dl dd")
        count = await entries.count()

        for i in range(0, min(count, 20), 2):
            try:
                title_el = entries.nth(i)
                abstract_el = entries.nth(i + 1) if i + 1 < count else None

                title = await title_el.inner_text()
                abstract = await abstract_el.inner_text() if abstract_el else ""

                papers.append({
                    "source": "arxiv",
                    "title": title.strip(),
                    "abstract": abstract.strip()[:500],
                    "category": category,
                    "scraped_at": datetime.now().isoformat(),
                })
            except Exception:
                continue

        return papers

    async def _scrape_huggingface(self, page: Page, category: str) -> List[Dict]:
        """Scrape models from Hugging Face."""
        search = page.locator('input[placeholder*="Search"]')
        await search.fill(category)
        await search.press("Enter")
        await page.wait_for_load_state("networkidle")

        models = []
        cards = page.locator(".model-card, article.overview")
        count = await cards.count()

        for i in range(min(count, 15)):
            try:
                card = cards.nth(i)
                name = await card.locator("h3, .model-name").first.inner_text()
                desc = await card.locator("p, .model-description").first.inner_text()

                models.append({
                    "source": "huggingface",
                    "title": name.strip(),
                    "description": desc.strip()[:300],
                    "category": category,
                    "scraped_at": datetime.now().isoformat(),
                })
            except Exception:
                continue

        return models

    async def _scrape_github_trending(self, page: Page, category: str) -> List[Dict]:
        """Scrape trending repos from GitHub."""
        repos = []
        articles = page.locator("article.Box-row")
        count = await articles.count()

        for i in range(min(count, 15)):
            try:
                article = articles.nth(i)
                name = await article.locator("h2 a").inner_text()
                desc = await article.locator("p").first.inner_text()
                stars = await article.locator('[href$="/stargazers"]').inner_text()

                repos.append({
                    "source": "github",
                    "title": name.strip().replace("\\n", "").strip(),
                    "description": desc.strip()[:300],
                    "stars": stars.strip(),
                    "category": category,
                    "scraped_at": datetime.now().isoformat(),
                })
            except Exception:
                continue

        return repos

    async def _generic_scrape(self, page: Page, category: str) -> List[Dict]:
        """Generic web scraping fallback."""
        content = await page.inner_text("body")
        return [{
            "source": page.url,
            "title": await page.title(),
            "content": content[:1000],
            "category": category,
            "scraped_at": datetime.now().isoformat(),
        }]

    async def scrape_research_data(self, research_results: List[Dict]) -> List[Dict]:
        """Process and clean scraped research data."""
        cleaned = []
        for item in research_results:
            cleaned_item = {
                "source": item.get("source", ""),
                "title": item.get("title", "").strip(),
                "description": item.get("description", item.get("abstract", "")).strip(),
                "category": item.get("category", ""),
                "scraped_at": item.get("scraped_at", ""),
                "stars": item.get("stars", ""),
            }
            if cleaned_item["title"]:
                cleaned.append(cleaned_item)
        return cleaned

    # ─── Spreadsheet & Report Generation ─────────────────────────────────────

    async def generate_spreadsheet_report(
        self, data: List[Dict], output_path: Path
    ) -> Path:
        """Generate a report as an Excel spreadsheet via browser automation."""
        try:
            import openpyxl
            from openpyxl.styles import Font, Alignment, PatternFill

            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = "Research Report"

            # Headers
            headers = ["Source", "Title", "Description", "Category", "Date"]
            for col, header in enumerate(headers, 1):
                cell = ws.cell(row=1, column=col, value=header)
                cell.font = Font(bold=True, size=12)
                cell.fill = PatternFill(start_color="1a73e8", end_color="1a73e8", fill_type="solid")
                cell.font = Font(bold=True, color="FFFFFF")

            # Data rows
            for row_idx, item in enumerate(data, 2):
                ws.cell(row=row_idx, column=1, value=item.get("source", ""))
                ws.cell(row=row_idx, column=2, value=item.get("title", ""))
                ws.cell(row=row_idx, column=3, value=item.get("description", ""))
                ws.cell(row=row_idx, column=4, value=item.get("category", ""))
                ws.cell(row=row_idx, column=5, value=item.get("scraped_at", ""))

            # Auto-width columns
            for col in ws.columns:
                max_length = max(len(str(cell.value or "")) for cell in col)
                ws.column_dimensions[col[0].column_letter].width = min(max_length + 2, 50)

            output_path.parent.mkdir(parents=True, exist_ok=True)
            wb.save(str(output_path))
            logger.info(f"📊 Report saved to {output_path}")
            return output_path

        except ImportError:
            # Fallback: Generate via Google Sheets in browser
            return await self._generate_via_google_sheets(data, output_path)

    async def _generate_via_google_sheets(
        self, data: List[Dict], fallback_path: Path
    ) -> Path:
        """Fallback: Create report in Google Sheets via browser."""
        page = await self.new_tab("https://sheets.google.com")
        await page.wait_for_load_state("networkidle")

        # Create new spreadsheet
        await page.click('a[href*="create"]')
        await page.wait_for_load_state("networkidle")

        # Input data
        for row_idx, item in enumerate(data[:50], 1):
            await page.fill(f'[data-cell="A{row_idx}"]', item.get("source", ""))
            await page.fill(f'[data-cell="B{row_idx}"]', item.get("title", ""))
            await page.fill(f'[data-cell="C{row_idx}"]', item.get("description", ""))

        await page.close()
        return fallback_path

    async def apply_brand_styling(self, report_path: Path, brand_config: Dict):
        """Apply brand styling to the report spreadsheet."""
        try:
            import openpyxl
            from openpyxl.styles import Font, PatternFill, Border, Side

            wb = openpyxl.load_workbook(str(report_path))
            ws = wb.active

            primary = brand_config.get("primary_color", "#1a73e8").lstrip("#")
            font_name = brand_config.get("font", "Roboto")

            # Style header row
            header_fill = PatternFill(start_color=primary, end_color=primary, fill_type="solid")
            header_font = Font(name=font_name, bold=True, color="FFFFFF", size=11)

            for cell in ws[1]:
                cell.fill = header_fill
                cell.font = header_font
                cell.alignment = {"horizontal": "center"}

            # Style data rows with alternating colors
            light_fill = PatternFill(start_color="f8f9fa", end_color="f8f9fa", fill_type="solid")
            thin_border = Border(
                left=Side(style="thin"),
                right=Side(style="thin"),
                top=Side(style="thin"),
                bottom=Side(style="thin"),
            )

            for row in ws.iter_rows(min_row=2):
                for cell in row:
                    cell.font = Font(name=font_name, size=10)
                    cell.border = thin_border
                    if row[0].row % 2 == 0:
                        cell.fill = light_fill

            wb.save(str(report_path))
            logger.info("🎨 Brand styling applied to report")

        except Exception as e:
            logger.error(f"Error applying brand styling: {e}")

    # ─── Google Drive Integration ────────────────────────────────────────────

    async def fetch_drive_images(self, folder_name: str, save_to: Path) -> List[str]:
        """Navigate to Google Drive and download images from a folder."""
        page = await self.new_tab("https://drive.google.com")
        await page.wait_for_load_state("networkidle")
        save_to.mkdir(parents=True, exist_ok=True)

        downloaded = []
        try:
            # Navigate to the specified folder
            search = page.locator('input[placeholder*="Search"]')
            await search.fill(folder_name)
            await search.press("Enter")
            await page.wait_for_load_state("networkidle")

            # Click the folder
            folder = page.locator(f'div[data-tooltip*="{folder_name}"]')
            if await folder.count() > 0:
                await folder.first.dblclick()
                await page.wait_for_load_state("networkidle")

            # Find and download image files
            image_items = page.locator('[data-tooltip*=".png"], [data-tooltip*=".jpg"], [data-tooltip*=".jpeg"]')
            count = await image_items.count()

            for i in range(min(count, 20)):
                item = image_items.nth(i)
                tooltip = await item.get_attribute("data-tooltip")
                if tooltip:
                    async with page.expect_download(timeout=30000) as dl_info:
                        await item.click()
                        # Right-click context menu for download
                        await page.keyboard.press("Control+KeyS")
                    download = await dl_info.value
                    file_path = save_to / tooltip
                    await download.save_as(str(file_path))
                    downloaded.append(str(file_path))
                    logger.info(f"🖼️ Downloaded image: {tooltip}")

        except Exception as e:
            logger.error(f"Error fetching Drive images: {e}")
        finally:
            await page.close()

        return downloaded

    # ─── WhatsApp Web Automation ─────────────────────────────────────────────

    async def send_whatsapp_message(
        self, contact: str, message: str, media_path: str = None
    ):
        """Send a message (and optional media) via WhatsApp Web."""
        page = await self.new_tab("https://web.whatsapp.com")

        # Wait for WhatsApp to load
        await page.wait_for_selector('[data-testid="chat-list"]', timeout=60000)

        try:
            # Search for contact
            search_box = page.locator('[data-testid="chat-list-search"]')
            await search_box.fill(contact)
            await asyncio.sleep(2)

            # Click the contact
            contact_result = page.locator(f'[title="{contact}"]').first
            await contact_result.click()
            await asyncio.sleep(1)

            # Send media if provided
            if media_path:
                attach_btn = page.locator('[data-testid="attach-menu"]')
                await attach_btn.click()
                await asyncio.sleep(0.5)

                # Upload file
                file_input = page.locator('input[type="file"]')
                await file_input.set_input_files(media_path)
                await asyncio.sleep(2)

                # Click send
                send_btn = page.locator('[data-testid="send"]')
                await send_btn.click()
                await asyncio.sleep(1)

            # Type and send message
            msg_box = page.locator('[data-testid="compose-input"]')
            await msg_box.fill(message)
            await asyncio.sleep(0.5)

            send_btn = page.locator('[data-testid="send"]')
            await send_btn.click()

            logger.info(f"💬 WhatsApp message sent to {contact}")

        except Exception as e:
            logger.error(f"Error sending WhatsApp message: {e}")
        finally:
            await page.close()

    async def send_whatsapp_reply(self, chat_id: str, message: str):
        """Reply to a specific WhatsApp chat."""
        page = self.main_page
        try:
            msg_box = page.locator('[data-testid="compose-input"]')
            await msg_box.fill(message)
            send_btn = page.locator('[data-testid="send"]')
            await send_btn.click()
            logger.info(f"💬 Reply sent to chat: {chat_id}")
        except Exception as e:
            logger.error(f"Error sending reply: {e}")

    # ─── Monitoring ──────────────────────────────────────────────────────────

    async def get_open_tabs(self) -> List[Dict]:
        """Get list of all open browser tabs."""
        tabs = []
        for page in self.context.pages:
            tabs.append({
                "url": page.url,
                "title": await page.title(),
            })
        return tabs
`
  },
  {
    name: "ai_manager.py",
    path: "ai_manager.py",
    language: "python",
    description: "Local AI model management - Ollama/HuggingFace transformers integration",
    content: `"""
AI Automation Hub - AI Manager Module
=======================================
Handles loading, managing, and querying local offline AI models.
Supports both Ollama and HuggingFace Transformers backends.
"""

import asyncio
import json
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime

logger = logging.getLogger("AIHub.AIManager")


class AIManager:
    """Manages local AI models for inference."""

    def __init__(self, models_dir: Path, backend: str = "ollama"):
        self.models_dir = models_dir
        self.backend = backend
        self.model = None
        self.tokenizer = None
        self.ollama_url = "http://localhost:11434"
        self.available_models: List[str] = []
        self.current_model: Optional[str] = None

    async def initialize(self):
        """Initialize the AI backend and load default model."""
        self.models_dir.mkdir(parents=True, exist_ok=True)

        if self.backend == "ollama":
            await self._init_ollama()
        elif self.backend == "transformers":
            await self._init_transformers()

        # List available models
        self.available_models = await self.list_models()
        logger.info(f"Available models: {self.available_models}")

    async def _init_ollama(self):
        """Initialize Ollama backend."""
        import aiohttp

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.ollama_url}/api/tags") as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        models = [m["name"] for m in data.get("models", [])]
                        logger.info(f"Ollama models found: {models}")

                        # Pull a default model if none available
                        if not models:
                            logger.info("No Ollama models found. Pulling llama3.2...")
                            await self.pull_model("llama3.2")
                    else:
                        logger.warning("Ollama not responding. Will use transformers fallback.")
                        self.backend = "transformers"
        except Exception as e:
            logger.warning(f"Ollama connection failed: {e}. Using transformers fallback.")
            self.backend = "transformers"

    async def _init_transformers(self):
        """Initialize HuggingFace Transformers backend."""
        try:
            from transformers import AutoModelForCausalLM, AutoTokenizer

            # Use a small model suitable for local inference
            model_name = "microsoft/phi-2"
            model_path = self.models_dir / model_name.replace("/", "_")

            if model_path.exists():
                logger.info(f"Loading model from local cache: {model_path}")
                self.tokenizer = AutoTokenizer.from_pretrained(
                    str(model_path), trust_remote_code=True
                )
                self.model = AutoModelForCausalLM.from_pretrained(
                    str(model_path), trust_remote_code=True, device_map="auto"
                )
            else:
                logger.info(f"Downloading model: {model_name}")
                self.tokenizer = AutoTokenizer.from_pretrained(
                    model_name, trust_remote_code=True
                )
                self.model = AutoModelForCausalLM.from_pretrained(
                    model_name, trust_remote_code=True, device_map="auto"
                )
                # Cache locally
                self.model.save_pretrained(str(model_path))
                self.tokenizer.save_pretrained(str(model_path))

            self.current_model = model_name
            logger.info(f"✅ Transformers model loaded: {model_name}")

        except Exception as e:
            logger.error(f"Failed to initialize transformers: {e}")
            logger.info("AI Manager running in API-only mode (Ollama required)")

    async def pull_model(self, model_name: str) -> bool:
        """Pull a model via Ollama."""
        import aiohttp

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.ollama_url}/api/pull",
                    json={"name": model_name, "stream": False},
                    timeout=aiohttp.ClientTimeout(total=600),
                ) as resp:
                    if resp.status == 200:
                        logger.info(f"✅ Model pulled: {model_name}")
                        return True
        except Exception as e:
            logger.error(f"Failed to pull model {model_name}: {e}")
        return False

    async def list_models(self) -> List[str]:
        """List all available models."""
        models = []

        if self.backend == "ollama":
            import aiohttp
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(f"{self.ollama_url}/api/tags") as resp:
                        if resp.status == 200:
                            data = await resp.json()
                            models = [m["name"] for m in data.get("models", [])]
            except Exception:
                pass

        # Also check local model directory
        for item in self.models_dir.iterdir():
            if item.is_dir() and (item / "config.json").exists():
                models.append(item.name)

        return list(set(models))

    async def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        max_tokens: int = 1024,
        temperature: float = 0.7,
    ) -> str:
        """Generate text from a prompt using the local AI model."""
        if self.backend == "ollama":
            return await self._generate_ollama(prompt, model, max_tokens, temperature)
        elif self.backend == "transformers":
            return await self._generate_transformers(prompt, max_tokens, temperature)
        else:
            return "Error: No AI backend available"

    async def _generate_ollama(
        self, prompt: str, model: str, max_tokens: int, temperature: float
    ) -> str:
        """Generate using Ollama API."""
        import aiohttp

        model_name = model or "llama3.2"

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.ollama_url}/api/generate",
                    json={
                        "model": model_name,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "num_predict": max_tokens,
                            "temperature": temperature,
                        },
                    },
                    timeout=aiohttp.ClientTimeout(total=120),
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return data.get("response", "")
                    else:
                        return f"Error: Ollama returned status {resp.status}"
        except Exception as e:
            return f"Error generating response: {e}"

    async def _generate_transformers(
        self, prompt: str, max_tokens: int, temperature: float
    ) -> str:
        """Generate using HuggingFace Transformers."""
        if not self.model or not self.tokenizer:
            return "Error: Transformers model not loaded"

        try:
            # Run in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                self._transformers_inference,
                prompt,
                max_tokens,
                temperature,
            )
            return result
        except Exception as e:
            return f"Error generating response: {e}"

    def _transformers_inference(
        self, prompt: str, max_tokens: int, temperature: float
    ) -> str:
        """Synchronous transformers inference (runs in executor)."""
        import torch

        inputs = self.tokenizer(prompt, return_tensors="pt")

        # Move to device
        device = next(self.model.parameters()).device
        inputs = {k: v.to(device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=max_tokens,
                temperature=temperature,
                do_sample=True,
                pad_token_id=self.tokenizer.eos_token_id,
            )

        response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        # Remove the prompt from the response
        if response.startswith(prompt):
            response = response[len(prompt):].strip()

        return response

    # ─── Data Analysis Functions ─────────────────────────────────────────────

    async def analyze_data(self, data: List[Dict]) -> Dict[str, Any]:
        """Analyze scraped data using the AI model."""
        data_summary = json.dumps(data[:20], indent=2)[:3000]

        prompt = f"""Analyze the following research data and provide:
1. Key themes and patterns
2. Most relevant/important items
3. Recommended focus areas
4. Quality score for each item (1-10)

Data:
{data_summary}

Provide your analysis in JSON format:
{{"themes": [...], "top_items": [...], "focus_areas": [...], "scores": {{}}}}"""

        response = await self.generate(prompt, max_tokens=2048)

        try:
            # Try to parse JSON from response
            json_start = response.find("{")
            json_end = response.rfind("}") + 1
            if json_start >= 0 and json_end > json_start:
                return json.loads(response[json_start:json_end])
        except json.JSONDecodeError:
            pass

        return {
            "themes": ["Analysis completed"],
            "top_items": [],
            "focus_areas": [],
            "scores": {},
            "raw_response": response,
        }

    async def filter_and_process(
        self, data: List[Dict], analysis: Dict
    ) -> List[Dict]:
        """Filter and process data based on AI analysis."""
        scores = analysis.get("scores", {})
        top_items = analysis.get("top_items", [])

        filtered = []
        for item in data:
            title = item.get("title", "")
            # Keep items that scored well or are in top items
            score = scores.get(title, 5)
            if score >= 6 or title in top_items:
                item["ai_score"] = score
                item["processed"] = True
                filtered.append(item)

        # Sort by AI score
        filtered.sort(key=lambda x: x.get("ai_score", 0), reverse=True)
        return filtered

    async def generate_summary(
        self, data: List[Dict], analysis: Dict
    ) -> str:
        """Generate a human-readable summary of the report."""
        data_text = json.dumps(data[:10], indent=2)[:2000]
        themes = analysis.get("themes", [])

        prompt = f"""Create a professional weekly report summary based on this data:

Key Themes: {', '.join(themes)}
Data Points: {len(data)} items analyzed

Top findings:
{data_text}

Write a concise, professional summary suitable for email distribution.
Include: Executive summary, Key findings, Recommendations, and Next steps.
Format as HTML for email."""

        summary = await self.generate(prompt, max_tokens=1500)
        return summary

    # ─── Model Management ────────────────────────────────────────────────────

    async def download_model_from_hf(self, model_id: str) -> bool:
        """Download a model from HuggingFace to local storage."""
        try:
            from huggingface_hub import snapshot_download

            local_dir = self.models_dir / model_id.replace("/", "_")
            snapshot_download(
                repo_id=model_id,
                local_dir=str(local_dir),
                local_dir_use_symlinks=False,
            )
            logger.info(f"✅ Model downloaded: {model_id} → {local_dir}")
            return True
        except Exception as e:
            logger.error(f"Failed to download model {model_id}: {e}")
            return False

    async def switch_model(self, model_name: str) -> bool:
        """Switch to a different model."""
        if self.backend == "ollama":
            self.current_model = model_name
            return True
        elif self.backend == "transformers":
            model_path = self.models_dir / model_name
            if model_path.exists():
                try:
                    from transformers import AutoModelForCausalLM, AutoTokenizer
                    self.tokenizer = AutoTokenizer.from_pretrained(str(model_path))
                    self.model = AutoModelForCausalLM.from_pretrained(
                        str(model_path), device_map="auto"
                    )
                    self.current_model = model_name
                    return True
                except Exception as e:
                    logger.error(f"Failed to switch model: {e}")
        return False

    def get_status(self) -> Dict:
        """Get current AI manager status."""
        return {
            "backend": self.backend,
            "current_model": self.current_model,
            "available_models": self.available_models,
            "models_dir": str(self.models_dir),
        }
`
  },
  {
    name: "email_listener.py",
    path: "email_listener.py",
    language: "python",
    description: "IMAP email listener for event-driven triggers",
    content: `"""
AI Automation Hub - Email Listener Module
===========================================
Monitors a dedicated email inbox via IMAP for commands
from whitelisted contacts. Triggers automated tasks
and sends replies.
"""

import asyncio
import email
import logging
import smtplib
import json
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import decode_header
from imaplib import IMAP4_SSL
from typing import Callable, Optional, Dict, List
from datetime import datetime

logger = logging.getLogger("AIHub.EmailListener")


class EmailListener:
    """Listens for emails and triggers automation tasks."""

    def __init__(
        self,
        ai_manager,
        callback: Callable,
        check_interval: int = 30,
    ):
        self.ai_manager = ai_manager
        self.callback = callback
        self.check_interval = check_interval
        self.running = False
        self.processed_ids: List[str] = []

        # Email configuration (from environment variables)
        import os
        self.imap_server = os.getenv("IMAP_SERVER", "imap.gmail.com")
        self.imap_port = int(os.getenv("IMAP_PORT", "993"))
        self.email_address = os.getenv("EMAIL_SENDER", "agent@company.com")
        self.email_password = os.getenv("EMAIL_PASSWORD", "")
        self.smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))

        # Whitelisted contacts (commands only accepted from these)
        self.whitelist = os.getenv(
            "EMAIL_WHITELIST", "admin@company.com,manager@company.com"
        ).split(",")

    async def start_listening(self):
        """Start the continuous email listening loop."""
        self.running = True
        logger.info(f"📧 Email listener started. Monitoring: {self.email_address}")
        logger.info(f"   Whitelist: {self.whitelist}")

        while self.running:
            try:
                await self._check_inbox()
            except Exception as e:
                logger.error(f"Email check error: {e}")

            await asyncio.sleep(self.check_interval)

    async def _check_inbox(self):
        """Check the inbox for new emails."""
        try:
            mail = IMAP4_SSL(self.imap_server, self.imap_port)
            mail.login(self.email_address, self.email_password)
            mail.select("INBOX")

            # Search for unseen emails
            status, messages = mail.search(None, "UNSEEN")
            if status != "OK":
                mail.logout()
                return

            email_ids = messages[0].split()

            for email_id in email_ids:
                eid = email_id.decode()
                if eid in self.processed_ids:
                    continue

                # Fetch email
                status, msg_data = mail.fetch(email_id, "(RFC822)")
                if status != "OK":
                    continue

                raw_email = msg_data[0][1]
                msg = email.message_from_bytes(raw_email)

                # Extract sender
                sender = self._extract_email_address(msg.get("From", ""))

                # Check whitelist
                if sender not in self.whitelist:
                    logger.info(f"Ignored email from non-whitelisted: {sender}")
                    continue

                # Parse email content
                subject = self._decode_header(msg.get("Subject", ""))
                body = self._get_email_body(msg)

                logger.info(f"📧 New command email from {sender}: {subject}")

                # Process the command
                await self._process_command(sender, subject, body)

                # Mark as processed
                self.processed_ids.append(eid)

            mail.logout()

        except Exception as e:
            logger.error(f"IMAP connection error: {e}")

    async def _process_command(self, sender: str, subject: str, body: str):
        """Parse and execute email commands."""
        subject_lower = subject.lower()
        body_lower = body.lower()

        # Command: Run the weekly pipeline
        if "run pipeline" in subject_lower or "run pipeline" in body_lower:
            await self.callback("run_pipeline", {"sender": sender})

        # Command: AI Query
        elif subject_lower.startswith("ai:") or subject_lower.startswith("query:"):
            prompt = subject.split(":", 1)[1].strip() if ":" in subject else body
            await self.callback("query_ai", {"sender": sender, "prompt": prompt})

        # Command: Get status
        elif "status" in subject_lower:
            status_msg = self._get_status_message()
            await self.send_reply(sender, status_msg)

        # Command: File request
        elif "files" in subject_lower or "list files" in body_lower:
            await self.callback("list_files", {"sender": sender, "directory": body.strip()})

        # Default: AI interpretation
        else:
            response = await self.ai_manager.generate(
                f"Email from {sender}:\\nSubject: {subject}\\n\\nBody: {body}\\n\\n"
                "Please interpret this as a command and respond appropriately."
            )
            await self.callback("query_ai", {"sender": sender, "prompt": body})

    def _get_status_message(self) -> str:
        """Generate a status report message."""
        return f"""
        <h2>AI Automation Hub - Status Report</h2>
        <p><strong>Time:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
        <p><strong>AI Backend:</strong> {self.ai_manager.get_status()['backend']}</p>
        <p><strong>Current Model:</strong> {self.ai_manager.get_status()['current_model']}</p>
        <p><strong>Emails Processed:</strong> {len(self.processed_ids)}</p>
        """

    async def send_reply(self, to: str, body: str, subject: str = "Re: AI Hub Response"):
        """Send a reply email."""
        try:
            msg = MIMEMultipart("alternative")
            msg["From"] = self.email_address
            msg["To"] = to
            msg["Subject"] = subject

            # Send as both plain text and HTML
            plain = MIMEText(body, "plain")
            html = MIMEText(f"<html><body>{body}</body></html>", "html")
            msg.attach(plain)
            msg.attach(html)

            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.email_address, self.email_password)
                server.send_message(msg)

            logger.info(f"📧 Reply sent to {to}")

        except Exception as e:
            logger.error(f"Failed to send reply: {e}")

    def _extract_email_address(self, from_header: str) -> str:
        """Extract email address from From header."""
        if "<" in from_header and ">" in from_header:
            return from_header.split("<")[1].split(">")[0]
        return from_header.strip()

    def _decode_header(self, header: str) -> str:
        """Decode email header."""
        decoded_parts = decode_header(header)
        result = ""
        for part, charset in decoded_parts:
            if isinstance(part, bytes):
                result += part.decode(charset or "utf-8", errors="replace")
            else:
                result += part
        return result

    def _get_email_body(self, msg) -> str:
        """Extract the body text from an email message."""
        body = ""
        if msg.is_multipart():
            for part in msg.walk():
                content_type = part.get_content_type()
                if content_type == "text/plain":
                    payload = part.get_payload(decode=True)
                    if payload:
                        charset = part.get_content_charset() or "utf-8"
                        body = payload.decode(charset, errors="replace")
                        break
                elif content_type == "text/html" and not body:
                    payload = part.get_payload(decode=True)
                    if payload:
                        charset = part.get_content_charset() or "utf-8"
                        body = payload.decode(charset, errors="replace")
        else:
            payload = msg.get_payload(decode=True)
            if payload:
                charset = msg.get_content_charset() or "utf-8"
                body = payload.decode(charset, errors="replace")
        return body

    def stop(self):
        """Stop the listener."""
        self.running = False
        logger.info("Email listener stopped")
`
  },
  {
    name: "whatsapp_listener.py",
    path: "whatsapp_listener.py",
    language: "python",
    description: "WhatsApp Web listener via Playwright for event-driven triggers",
    content: `"""
AI Automation Hub - WhatsApp Listener Module
==============================================
Monitors WhatsApp Web via Playwright for messages
from whitelisted contacts. Parses commands and
triggers automation tasks.
"""

import asyncio
import json
import logging
from typing import Callable, Optional, List, Dict
from datetime import datetime

logger = logging.getLogger("AIHub.WhatsAppListener")


class WhatsAppListener:
    """Monitors WhatsApp Web for incoming commands."""

    def __init__(
        self,
        browser,
        ai_manager,
        callback: Callable,
        check_interval: int = 5,
    ):
        self.browser = browser
        self.ai_manager = ai_manager
        self.callback = callback
        self.check_interval = check_interval
        self.running = False
        self.last_message_count = 0
        self.processed_messages: List[str] = []
        self.whatsapp_page = None

        # Whitelisted contacts
        import os
        self.whitelist = os.getenv(
            "WHATSAPP_WHITELIST", "Admin,Manager,Boss"
        ).split(",")

        # Chat to monitor
        self.monitor_chat = os.getenv("WHATSAPP_MONITOR_CHAT", "AI Commands")

    async def start_listening(self):
        """Start monitoring WhatsApp Web."""
        self.running = True
        logger.info("💬 WhatsApp listener started")
        logger.info(f"   Monitoring chat: {self.monitor_chat}")
        logger.info(f"   Whitelist: {self.whitelist}")

        # Wait for browser to be ready
        await asyncio.sleep(5)

        while self.running:
            try:
                await self._check_messages()
            except Exception as e:
                logger.error(f"WhatsApp check error: {e}")
                # Try to reconnect
                await self._reconnect()

            await asyncio.sleep(self.check_interval)

    async def _reconnect(self):
        """Reconnect to WhatsApp Web."""
        try:
            self.whatsapp_page = await self.browser.new_tab("https://web.whatsapp.com")
            await self.whatsapp_page.wait_for_selector(
                '[data-testid="chat-list"]', timeout=60000
            )
            logger.info("✅ WhatsApp Web reconnected")
        except Exception as e:
            logger.error(f"Reconnection failed: {e}")

    async def _check_messages(self):
        """Check for new messages in the monitored chat."""
        if not self.whatsapp_page:
            self.whatsapp_page = await self.browser.new_tab("https://web.whatsapp.com")
            await self.whatsapp_page.wait_for_selector(
                '[data-testid="chat-list"]', timeout=60000
            )

        page = self.whatsapp_page

        try:
            # Navigate to the monitored chat
            search = page.locator('[data-testid="chat-list-search"]')
            await search.fill(self.monitor_chat)
            await asyncio.sleep(2)

            # Click the chat
            chat = page.locator(f'[title="{self.monitor_chat}"]').first
            if await chat.count() == 0:
                return

            await chat.click()
            await asyncio.sleep(1)

            # Get all messages
            messages = page.locator('[data-testid="msg-container"]')
            count = await messages.count()

            if count <= self.last_message_count:
                self.last_message_count = count
                return

            # Process new messages
            for i in range(self.last_message_count, count):
                msg_container = messages.nth(i)

                # Get message text
                msg_text_el = msg_container.locator('[data-testid="text"]')
                if await msg_text_el.count() == 0:
                    continue

                msg_text = await msg_text_el.inner_text()

                # Get sender info
                sender_el = msg_container.locator('[data-testid="sender-name"]')
                sender = await sender_el.inner_text() if await sender_el.count() > 0 else "Unknown"

                # Check whitelist
                if sender not in self.whitelist:
                    continue

                # Check if already processed
                msg_id = f"{sender}:{msg_text[:50]}"
                if msg_id in self.processed_messages:
                    continue

                logger.info(f"💬 New command from {sender}: {msg_text}")
                self.processed_messages.append(msg_id)

                # Process the command
                await self._process_command(sender, msg_text)

            self.last_message_count = count

        except Exception as e:
            logger.error(f"Error checking messages: {e}")

    async def _process_command(self, sender: str, message: str):
        """Parse and execute WhatsApp commands."""
        msg_lower = message.lower().strip()

        # Command: Run pipeline
        if msg_lower in ["run pipeline", "start pipeline", "/pipeline"]:
            await self.callback("run_pipeline", {"chat_id": self.monitor_chat})

        # Command: AI Query
        elif msg_lower.startswith("/ai ") or msg_lower.startswith("/ask "):
            prompt = message.split(" ", 1)[1] if " " in message else message
            response = await self.ai_manager.generate(prompt)
            await self.browser.send_whatsapp_reply(self.monitor_chat, response)

        # Command: Status
        elif msg_lower in ["/status", "status"]:
            status = self._get_status_text()
            await self.browser.send_whatsapp_reply(self.monitor_chat, status)

        # Command: Help
        elif msg_lower in ["/help", "help"]:
            help_text = self._get_help_text()
            await self.browser.send_whatsapp_reply(self.monitor_chat, help_text)

        # Command: File list
        elif msg_lower.startswith("/files") or msg_lower.startswith("list files"):
            await self.callback(
                "file_request",
                {"chat_id": self.monitor_chat, "directory": message.split(" ", 1)[-1] if " " in message else ""}
            )

        # Default: AI interpretation
        else:
            response = await self.ai_manager.generate(
                f"WhatsApp message from {sender}: {message}\\n\\n"
                "Interpret this as a command and respond helpfully. Keep response under 500 characters."
            )
            await self.browser.send_whatsapp_reply(self.monitor_chat, response)

    def _get_status_text(self) -> str:
        """Get status as formatted text."""
        ai_status = self.ai_manager.get_status()
        return f"""🤖 *AI Automation Hub Status*

⏰ Time: {datetime.now().strftime('%Y-%m-%d %H:%M')}
🧠 Backend: {ai_status['backend']}
📦 Model: {ai_status['current_model'] or 'None loaded'}
📧 Messages processed: {len(self.processed_messages)}
✅ System: Running"""

    def _get_help_text(self) -> str:
        """Get help text."""
        return """🤖 *AI Hub Commands*

*/pipeline* - Run the weekly research pipeline
*/ai <prompt>* - Query the AI model
*/status* - Get system status
*/files [dir]* - List files in directory
*/help* - Show this help

Or just send any message and the AI will try to interpret it!"""

    def stop(self):
        """Stop the listener."""
        self.running = False
        logger.info("WhatsApp listener stopped")
`
  },
  {
    name: "file_manager.py",
    path: "file_manager.py",
    language: "python",
    description: "Local file management for Windows directories",
    content: `"""
AI Automation Hub - File Manager Module
=========================================
Manages local file operations on Windows directories.
Provides file listing, upload, download, and organization.
"""

import os
import shutil
import logging
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime

logger = logging.getLogger("AIHub.FileManager")


class FileManager:
    """Manages local file operations."""

    def __init__(
        self,
        download_dir: Path,
        reports_dir: Path,
        assets_dir: Path,
    ):
        self.download_dir = download_dir
        self.reports_dir = reports_dir
        self.assets_dir = assets_dir

        # Ensure directories exist
        for d in [download_dir, reports_dir, assets_dir]:
            d.mkdir(parents=True, exist_ok=True)

    def list_files(self, directory: str = "", recursive: bool = False) -> List[Dict]:
        """List files in a directory."""
        base_dirs = {
            "downloads": self.download_dir,
            "reports": self.reports_dir,
            "assets": self.assets_dir,
        }

        if directory in base_dirs:
            target = base_dirs[directory]
        elif directory:
            target = self.download_dir / directory
        else:
            target = self.download_dir

        if not target.exists():
            return []

        files = []
        if recursive:
            for item in target.rglob("*"):
                files.append(self._file_info(item))
        else:
            for item in target.iterdir():
                files.append(self._file_info(item))

        return sorted(files, key=lambda x: (not x["is_dir"], x["name"].lower()))

    def _file_info(self, path: Path) -> Dict:
        """Get file information."""
        stat = path.stat()
        return {
            "name": path.name,
            "path": str(path),
            "relative_path": str(path.relative_to(self.download_dir.parent)),
            "is_dir": path.is_dir(),
            "size": stat.st_size if path.is_file() else None,
            "size_human": self._human_size(stat.st_size) if path.is_file() else None,
            "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            "created": datetime.fromtimestamp(stat.st_ctime).isoformat(),
            "extension": path.suffix if path.is_file() else None,
        }

    def _human_size(self, size: int) -> str:
        """Convert bytes to human-readable size."""
        for unit in ["B", "KB", "MB", "GB", "TB"]:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} PB"

    def save_file(self, filename: str, content: bytes, directory: str = "") -> Path:
        """Save a file to the managed directory."""
        target_dir = self.download_dir / directory if directory else self.download_dir
        target_dir.mkdir(parents=True, exist_ok=True)
        file_path = target_dir / filename
        file_path.write_bytes(content)
        logger.info(f"File saved: {file_path} ({len(content)} bytes)")
        return file_path

    def read_file(self, filepath: str) -> bytes:
        """Read a file from the managed directory."""
        path = Path(filepath)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {filepath}")
        return path.read_bytes()

    def delete_file(self, filepath: str) -> bool:
        """Delete a file or directory."""
        path = Path(filepath)
        if not path.exists():
            return False

        if path.is_file():
            path.unlink()
            logger.info(f"File deleted: {path}")
        elif path.is_dir():
            shutil.rmtree(path)
            logger.info(f"Directory deleted: {path}")
        return True

    def move_file(self, source: str, destination: str) -> bool:
        """Move a file to a new location."""
        src = Path(source)
        dst = Path(destination)
        if not src.exists():
            return False
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src), str(dst))
        logger.info(f"File moved: {src} → {dst}")
        return True

    def copy_file(self, source: str, destination: str) -> bool:
        """Copy a file."""
        src = Path(source)
        dst = Path(destination)
        if not src.exists():
            return False
        dst.parent.mkdir(parents=True, exist_ok=True)
        if src.is_file():
            shutil.copy2(str(src), str(dst))
        else:
            shutil.copytree(str(src), str(dst))
        return True

    def get_disk_usage(self) -> Dict:
        """Get disk usage information."""
        usage = shutil.disk_usage(str(self.download_dir))
        return {
            "total": self._human_size(usage.total),
            "used": self._human_size(usage.used),
            "free": self._human_size(usage.free),
            "percent_used": round((usage.used / usage.total) * 100, 1),
        }

    def search_files(self, pattern: str, directory: str = "") -> List[Dict]:
        """Search for files matching a pattern."""
        target = self.download_dir / directory if directory else self.download_dir
        results = []
        for item in target.rglob(f"*{pattern}*"):
            results.append(self._file_info(item))
        return results

    def get_total_size(self, directory: str = "") -> int:
        """Get total size of a directory."""
        target = self.download_dir / directory if directory else self.download_dir
        total = 0
        for item in target.rglob("*"):
            if item.is_file():
                total += item.stat().st_size
        return total
`
  },
  {
    name: "requirements.txt",
    path: "requirements.txt",
    language: "text",
    description: "Python dependencies for the project",
    content: `# AI Automation Hub - Python Dependencies
# ==========================================

# Web Framework
fastapi==0.104.1
uvicorn[standard]==0.24.0
python-multipart==0.0.6
websockets==12.0

# Browser Automation
playwright==1.40.0

# AI/ML - HuggingFace
transformers==4.36.0
torch==2.1.1
huggingface-hub==0.19.4
accelerate==0.25.0
sentencepiece==0.1.99

# Scheduling
APScheduler==3.10.4

# Email
# (IMAP/SMTP built into Python stdlib)

# Data Processing
openpyxl==3.1.2
pandas==2.1.4
python-dateutil==2.8.2

# HTTP Client
aiohttp==3.9.1
httpx==0.25.2

# Utilities
python-dotenv==1.0.0
pydantic==2.5.2
loguru==0.7.2

# Optional: For advanced AI features
# ollama==0.1.6
# llama-cpp-python==0.2.20
`
  },
  {
    name: ".env.example",
    path: ".env.example",
    language: "text",
    description: "Environment variables template",
    content: `# AI Automation Hub - Environment Configuration
# ================================================
# Copy this file to .env and fill in your values

# Email Configuration
IMAP_SERVER=imap.gmail.com
IMAP_PORT=993
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
EMAIL_SENDER=your-agent@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_RECIPIENTS=team@company.com,manager@company.com

# Email Whitelist (comma-separated)
EMAIL_WHITELIST=admin@company.com,manager@company.com

# WhatsApp Configuration
WHATSAPP_WHITELIST=Admin,Manager,Boss
WHATSAPP_MONITOR_CHAT=AI Commands

# AI Model Configuration
AI_BACKEND=ollama
DEFAULT_MODEL=llama3.2
OLLAMA_URL=http://localhost:11434

# File Paths (Windows)
DOWNLOAD_DIR=C:/AI_Automation/Downloads
REPORTS_DIR=C:/AI_Automation/Reports
MODELS_DIR=C:/AI_Automation/Models
ASSETS_DIR=C:/AI_Automation/Assets

# Server Configuration
HOST=0.0.0.0
PORT=8000
DEBUG=true
`
  },
  {
    name: "setup_guide.py",
    path: "setup/setup_guide.py",
    language: "python",
    description: "Automated setup script for Windows deployment",
    content: `"""
AI Automation Hub - Windows Setup Script
==========================================
Run this script to set up the entire system on a Windows machine.
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path


def run_command(cmd: str, shell: bool = True) -> tuple:
    """Run a shell command and return output."""
    result = subprocess.run(cmd, shell=shell, capture_output=True, text=True)
    return result.returncode, result.stdout, result.stderr


def setup():
    """Complete setup process."""
    print("=" * 60)
    print("  AI Automation Hub - Windows Setup")
    print("=" * 60)

    # Step 1: Check Python version
    print("\\n[1/8] Checking Python version...")
    code, out, err = run_command("python --version")
    if code != 0:
        print("❌ Python not found. Please install Python 3.10+ from python.org")
        sys.exit(1)
    print(f"✅ {out.strip()}")

    # Step 2: Create project directories
    print("\\n[2/8] Creating project directories...")
    dirs = [
        "C:/AI_Automation",
        "C:/AI_Automation/Downloads",
        "C:/AI_Automation/Reports",
        "C:/AI_Automation/Models",
        "C:/AI_Automation/Assets",
        "C:/AI_Automation/Logs",
        "C:/AI_Automation/BrowserData",
        "C:/AI_Automation/Screenshots",
    ]
    for d in dirs:
        Path(d).mkdir(parents=True, exist_ok=True)
        print(f"   ✅ {d}")

    # Step 3: Create virtual environment
    print("\\n[3/8] Creating virtual environment...")
    venv_path = Path("venv")
    if not venv_path.exists():
        run_command("python -m venv venv")
        print("✅ Virtual environment created")
    else:
        print("✅ Virtual environment already exists")

    # Step 4: Install dependencies
    print("\\n[4/8] Installing Python dependencies...")
    if sys.platform == "win32":
        pip_path = str(venv_path / "Scripts" / "pip")
    else:
        pip_path = str(venv_path / "bin" / "pip")

    run_command(f"{pip_path} install -r requirements.txt")
    print("✅ Dependencies installed")

    # Step 5: Install Playwright browsers
    print("\\n[5/8] Installing Playwright browsers...")
    if sys.platform == "win32":
        playwright_path = str(venv_path / "Scripts" / "playwright")
    else:
        playwright_path = str(venv_path / "bin" / "playwright")

    run_command(f"{playwright_path} install chromium")
    print("✅ Playwright Chromium installed")

    # Step 6: Install Ollama
    print("\\n[6/8] Checking Ollama installation...")
    code, out, err = run_command("ollama --version")
    if code != 0:
        print("⚠️  Ollama not found. Please install from: https://ollama.ai")
        print("   After installing, run: ollama pull llama3.2")
    else:
        print(f"✅ {out.strip()}")
        # Pull default model
        print("   Pulling default model (llama3.2)...")
        run_command("ollama pull llama3.2")
        print("✅ Model ready")

    # Step 7: Setup environment file
    print("\\n[7/8] Setting up environment configuration...")
    env_file = Path(".env")
    if not env_file.exists():
        shutil.copy(".env.example", ".env")
        print("✅ .env file created from template")
        print("⚠️  Please edit .env with your actual credentials!")
    else:
        print("✅ .env file already exists")

    # Step 8: Final instructions
    print("\\n[8/8] Setup complete!")
    print()
    print("=" * 60)
    print("  NEXT STEPS:")
    print("=" * 60)
    print()
    print("1. Edit .env file with your email/WhatsApp credentials")
    print("2. Make sure Ollama is running (ollama serve)")
    print("3. Start the server:")
    print()
    if sys.platform == "win32":
        print("   venv\\\\Scripts\\\\activate")
    else:
        print("   source venv/bin/activate")
    print("   python main.py")
    print()
    print("4. Open browser to: http://localhost:8000")
    print()
    print("=" * 60)


if __name__ == "__main__":
    setup()
`
  }
];

export const directoryStructure = `AI-Automation-Hub/
├── main.py                  # FastAPI server & scheduler
├── automation.py            # Playwright browser automation
├── ai_manager.py            # Local AI model management
├── email_listener.py        # IMAP email listener
├── whatsapp_listener.py     # WhatsApp Web listener
├── file_manager.py          # Local file management
├── requirements.txt         # Python dependencies
├── .env                     # Environment config (create from .env.example)
├── .env.example             # Environment template
├── static/
│   ├── index.html           # Dashboard UI
│   ├── style.css            # Dashboard styles
│   └── app.js               # Dashboard JavaScript
├── setup/
│   └── setup_guide.py       # Automated setup script
└── C:/AI_Automation/        # Runtime data (created at runtime)
    ├── Downloads/
    ├── Reports/
    ├── Models/
    ├── Assets/
    ├── Logs/
    ├── BrowserData/
    └── Screenshots/`;
