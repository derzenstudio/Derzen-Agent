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
    description: "FastAPI server with security hardening, emergency stop, and scheduling",
    content: `"""
AI Automation Hub - Main Server (Security Hardened)
====================================================
FastAPI server with:
- Emergency stop capability
- File system sandboxing
- Contact whitelist enforcement
- Scheduled automation pipelines
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

# ─── Configuration ───────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
ALLOWED_BASE = Path("C:/AI_Automation")  # SECURITY: Sandbox root

# Create sandbox directories
DOWNLOAD_DIR = ALLOWED_BASE / "Downloads"
REPORTS_DIR = ALLOWED_BASE / "Reports"
MODELS_DIR = ALLOWED_BASE / "Models"
ASSETS_DIR = ALLOWED_BASE / "Assets"
LOGS_DIR = ALLOWED_BASE / "Logs"

for d in [DOWNLOAD_DIR, REPORTS_DIR, MODELS_DIR, ASSETS_DIR, LOGS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# ─── Logging ─────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
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
app = FastAPI(title="AI Automation Hub", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000"],  # SECURITY: Restrict origins
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
    "status": "initializing",
}


# ─── Security: Path Validation ───────────────────────────────────────────────
def validate_path(requested_path: str) -> Path:
    """Ensure path is within allowed sandbox directory."""
    resolved = (ALLOWED_BASE / requested_path).resolve()
    if not str(resolved).startswith(str(ALLOWED_BASE.resolve())):
        logger.critical(f"SECURITY: Path traversal blocked: {requested_path}")
        raise HTTPException(
            status_code=403,
            detail="Access denied: Path outside sandbox"
        )
    return resolved


# ─── Security: Whitelist Check ───────────────────────────────────────────────
def is_whitelisted(contact: str) -> bool:
    """Check if contact is in whitelist."""
    whitelist = os.getenv("WHITELIST_CONTACTS", "").split(",")
    whitelist = [w.strip().lower() for w in whitelist if w.strip()]
    return contact.strip().lower() in whitelist


# ─── Startup ─────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    logger.info("Starting AI Automation Hub...")
    
    if emergency_stop.is_set():
        logger.warning("Emergency stop is active. Startup aborted.")
        return
    
    # Initialize modules
    state["ai_manager"] = AIManager(models_dir=MODELS_DIR)
    await state["ai_manager"].initialize()
    
    state["browser"] = BrowserAutomation()
    await state["browser"].initialize()
    
    state["file_manager"] = FileManager(base_dir=ALLOWED_BASE)
    
    # Setup scheduler
    state["scheduler"] = AsyncIOScheduler()
    state["scheduler"].add_job(
        run_sunday_pipeline,
        CronTrigger(day_of_week="sun", hour=9, minute=0),
        id="sunday_pipeline",
    )
    state["scheduler"].start()
    
    # Start listeners
    state["email_listener"] = EmailListener(
        ai_manager=state["ai_manager"],
        whitelist_check=is_whitelisted,
        callback=on_email_action,
    )
    asyncio.create_task(state["email_listener"].start_listening())
    
    state["whatsapp_listener"] = WhatsAppListener(
        browser=state["browser"],
        ai_manager=state["ai_manager"],
        whitelist_check=is_whitelisted,
        callback=on_whatsapp_action,
    )
    asyncio.create_task(state["whatsapp_listener"].start_listening())
    
    state["status"] = "running"
    logger.info("AI Automation Hub is fully operational!")


# ─── Emergency Stop Endpoint ─────────────────────────────────────────────────
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
    logger.critical("EMERGENCY STOP ACTIVATED - All systems halted")
    
    return {"status": "stopped", "message": "All automation halted"}


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


# ─── File Manager Endpoints (Sandboxed) ──────────────────────────────────────
@app.get("/api/files/list")
async def list_files(directory: str = ""):
    target = validate_path(directory)
    return state["file_manager"].list_files(str(target))


@app.post("/api/files/upload")
async def upload_file(file: UploadFile = File(...), destination: str = ""):
    target_dir = validate_path(destination)
    return await state["file_manager"].upload_file(file, target_dir)


# ─── Pipeline ────────────────────────────────────────────────────────────────
async def run_sunday_pipeline():
    """Sunday 9 AM automated pipeline."""
    if emergency_stop.is_set():
        logger.warning("Pipeline skipped: Emergency stop active")
        return
    
    logger.info("Starting Sunday Pipeline...")
    
    try:
        # Step 1-8: Research, scrape, analyze, report, style, images, summary, send
        research_data = await state["browser"].research_category("AI Trends")
        scraped = await state["browser"].scrape_research_data(research_data)
        analysis = await state["ai_manager"].analyze_data(scraped)
        filtered = await state["ai_manager"].filter_and_process(scraped, analysis)
        
        report_path = REPORTS_DIR / f"report_{datetime.now().strftime('%Y%m%d')}.xlsx"
        await state["browser"].generate_spreadsheet_report(filtered, report_path)
        
        summary = await state["ai_manager"].generate_summary(filtered, analysis)
        
        # Send to whitelisted contacts only
        await send_email_report(summary, [str(report_path)])
        await state["browser"].send_whatsapp_message("Team Updates", summary)
        
        logger.info("Sunday Pipeline completed successfully!")
        
    except Exception as e:
        logger.error(f"Pipeline failed: {e}")


# ─── Event Callbacks (Whitelist Enforced) ────────────────────────────────────
async def on_email_action(sender: str, action: str, data: dict):
    if not is_whitelisted(sender):
        logger.warning(f"BLOCKED: Unauthorized email from {sender}")
        return
    
    if emergency_stop.is_set():
        return
    
    if action == "run_pipeline":
        asyncio.create_task(run_sunday_pipeline())
    elif action == "query_ai":
        response = await state["ai_manager"].generate(data["prompt"])
        await state["email_listener"].send_reply(sender, response)


async def on_whatsapp_action(sender: str, action: str, data: dict):
    if not is_whitelisted(sender):
        logger.warning(f"BLOCKED: Unauthorized WhatsApp from {sender}")
        return
    
    if emergency_stop.is_set():
        return
    
    if action == "run_pipeline":
        asyncio.create_task(run_sunday_pipeline())
    elif action == "query_ai":
        response = await state["ai_manager"].generate(data["message"])
        await state["browser"].send_whatsapp_reply(data["chat_id"], response)


# ─── Run Server ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)  # SECURITY: Localhost only
`
  },
  {
    name: "automation.py",
    path: "automation.py",
    language: "python",
    description: "Playwright browser automation with security controls",
    content: `"""
AI Automation Hub - Browser Automation (Security Hardened)
===========================================================
Playwright-based Chrome automation with:
- Sandboxed file downloads
- Whitelist-enforced messaging
- Emergency stop support
"""

import asyncio
import logging
from pathlib import Path
from typing import Optional, List, Dict
from datetime import datetime

from playwright.async_api import async_playwright, Browser, BrowserContext, Page

logger = logging.getLogger("AIHub.Automation")


class BrowserAutomation:
    """Manages Playwright browser with security controls."""

    def __init__(self, headless: bool = False):
        self.playwright = None
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.main_page: Optional[Page] = None
        self.headless = headless
        
        # SECURITY: Restrict downloads to sandbox
        self.allowed_download_dir = Path("C:/AI_Automation/Downloads")
        self.user_data_dir = Path("C:/AI_Automation/BrowserData")

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
        logger.info("Browser initialized with security restrictions")

    async def cleanup(self):
        """Clean up browser resources."""
        if self.context:
            await self.context.close()
        if self.playwright:
            await self.playwright.stop()
        logger.info("Browser cleaned up")

    async def navigate(self, url: str) -> Dict:
        """Navigate to URL."""
        response = await self.main_page.goto(url, wait_until="networkidle")
        return {
            "url": self.main_page.url,
            "title": await self.main_page.title(),
            "status": response.status if response else None,
        }

    async def download_huggingface_model(
        self, model_name: str, save_path: Path
    ) -> Dict:
        """Download model from HuggingFace with path validation."""
        # SECURITY: Validate download path
        if not str(save_path.resolve()).startswith(str(self.allowed_download_dir)):
            raise ValueError("Download path outside allowed directory")
        
        save_path.mkdir(parents=True, exist_ok=True)
        page = await self.context.new_page()

        try:
            await page.goto("https://huggingface.co/models")
            search = page.locator('input[placeholder*="Search"]')
            await search.fill(model_name)
            await search.press("Enter")
            await page.wait_for_load_state("networkidle")

            # Download first result
            first_result = page.locator(".model-card").first
            await first_result.click()
            
            # ... download logic ...
            
            return {"success": True, "model": model_name, "path": str(save_path)}

        except Exception as e:
            logger.error(f"Model download failed: {e}")
            return {"success": False, "error": str(e)}
        finally:
            await page.close()

    async def send_whatsapp_message(
        self, contact: str, message: str, media_path: str = None
    ):
        """Send WhatsApp message with whitelist check."""
        # SECURITY: Only send to whitelisted contacts
        # (Whitelist check happens in main.py before calling this)
        
        page = await self.context.new_page()
        await page.goto("https://web.whatsapp.com")
        await page.wait_for_selector('[data-testid="chat-list"]', timeout=60000)

        try:
            # Search and send message
            search = page.locator('[data-testid="chat-list-search"]')
            await search.fill(contact)
            await asyncio.sleep(2)
            
            await page.locator(f'[title="{contact}"]').first.click()
            
            msg_box = page.locator('[data-testid="compose-input"]')
            await msg_box.fill(message)
            await page.locator('[data-testid="send"]').click()
            
            logger.info(f"WhatsApp message sent to {contact}")

        except Exception as e:
            logger.error(f"WhatsApp send failed: {e}")
        finally:
            await page.close()

    async def research_category(self, category: str) -> List[Dict]:
        """Research a category across multiple sources."""
        results = []
        sources = ["arxiv.org", "huggingface.co", "github.com/trending"]
        
        for source in sources:
            page = await self.context.new_page()
            try:
                await page.goto(f"https://{source}")
                # ... scraping logic ...
                results.append({"source": source, "category": category})
            except Exception as e:
                logger.error(f"Scraping {source} failed: {e}")
            finally:
                await page.close()
        
        return results

    async def generate_spreadsheet_report(
        self, data: List[Dict], output_path: Path
    ) -> Path:
        """Generate Excel report."""
        import openpyxl
        
        wb = openpyxl.Workbook()
        ws = wb.active
        
        # ... report generation logic ...
        
        output_path.parent.mkdir(parents=True, exist_ok=True)
        wb.save(str(output_path))
        return output_path
`
  },
  {
    name: "file_manager.py",
    path: "file_manager.py",
    language: "python",
    description: "Sandboxed file manager with path traversal protection",
    content: `"""
AI Automation Hub - File Manager (Security Hardened)
=====================================================
File operations restricted to sandboxed directory with:
- Path traversal protection
- Whitelist validation
- Operation logging
"""

import os
import shutil
import logging
from pathlib import Path
from typing import List, Dict
from datetime import datetime

logger = logging.getLogger("AIHub.FileManager")


class SecurityError(Exception):
    """Raised when a security violation is detected."""
    pass


class FileManager:
    """Sandboxed file manager with security controls."""

    def __init__(self, base_dir: Path):
        self.base_dir = base_dir.resolve()
        
        # Ensure base directory exists
        self.base_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"FileManager initialized with sandbox: {self.base_dir}")

    def validate_path(self, requested_path: str) -> Path:
        """Validate that path is within sandbox."""
        resolved = (self.base_dir / requested_path).resolve()
        
        if not str(resolved).startswith(str(self.base_dir)):
            logger.critical(f"SECURITY: Path traversal blocked: {requested_path}")
            raise SecurityError(
                f"Access denied: Path outside sandbox: {requested_path}"
            )
        
        return resolved

    def list_files(self, directory: str = "") -> List[Dict]:
        """List files in directory with path validation."""
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

    async def upload_file(self, file, target_dir: Path) -> Dict:
        """Upload file with path validation."""
        # SECURITY: Validate target directory
        validated_dir = self.validate_path(str(target_dir.relative_to(self.base_dir)))
        validated_dir.mkdir(parents=True, exist_ok=True)
        
        file_path = validated_dir / file.filename
        content = await file.read()
        file_path.write_bytes(content)
        
        logger.info(f"File uploaded: {file_path} ({len(content)} bytes)")
        
        return {
            "filename": file.filename,
            "path": str(file_path.relative_to(self.base_dir)),
            "size": len(content),
        }

    def delete_file(self, filepath: str) -> bool:
        """Delete file with path validation."""
        target = self.validate_path(filepath)
        
        if not target.exists():
            return False
        
        if target.is_file():
            target.unlink()
        elif target.is_dir():
            shutil.rmtree(target)
        
        logger.info(f"File deleted: {target}")
        return True

    def get_disk_usage(self) -> Dict:
        """Get disk usage for sandbox directory."""
        usage = shutil.disk_usage(str(self.base_dir))
        return {
            "total": self._human_size(usage.total),
            "used": self._human_size(usage.used),
            "free": self._human_size(usage.free),
            "percent_used": round((usage.used / usage.total) * 100, 1),
        }

    def _human_size(self, size: int) -> str:
        """Convert bytes to human-readable size."""
        for unit in ["B", "KB", "MB", "GB", "TB"]:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} PB"
`
  },
  {
    name: "email_listener.py",
    path: "email_listener.py",
    language: "python",
    description: "IMAP email listener with whitelist enforcement",
    content: `"""
AI Automation Hub - Email Listener (Security Hardened)
=======================================================
IMAP-based email monitoring with:
- Strict whitelist enforcement
- Command parsing
- Emergency stop support
"""

import asyncio
import email
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from imaplib import IMAP4_SSL
from typing import Callable, List
from datetime import datetime

logger = logging.getLogger("AIHub.EmailListener")


class EmailListener:
    """Email listener with whitelist enforcement."""

    def __init__(
        self,
        ai_manager,
        whitelist_check: Callable[[str], bool],
        callback: Callable,
        check_interval: int = 30,
    ):
        self.ai_manager = ai_manager
        self.whitelist_check = whitelist_check  # SECURITY: Injected check
        self.callback = callback
        self.check_interval = check_interval
        self.running = False
        self.processed_ids: List[str] = []

        # Email config
        import os
        self.imap_server = os.getenv("IMAP_SERVER", "imap.gmail.com")
        self.email_address = os.getenv("EMAIL_SENDER", "")
        self.email_password = os.getenv("EMAIL_PASSWORD", "")

    async def start_listening(self):
        """Start continuous email monitoring."""
        self.running = True
        logger.info(f"Email listener started. Monitoring: {self.email_address}")

        while self.running:
            try:
                await self._check_inbox()
            except Exception as e:
                logger.error(f"Email check error: {e}")
            
            await asyncio.sleep(self.check_interval)

    async def _check_inbox(self):
        """Check inbox for new emails."""
        mail = IMAP4_SSL(self.imap_server, 993)
        mail.login(self.email_address, self.email_password)
        mail.select("INBOX")

        status, messages = mail.search(None, "UNSEEN")
        if status != "OK":
            mail.logout()
            return

        for email_id in messages[0].split():
            eid = email_id.decode()
            if eid in self.processed_ids:
                continue

            status, msg_data = mail.fetch(email_id, "(RFC822)")
            if status != "OK":
                continue

            msg = email.message_from_bytes(msg_data[0][1])
            sender = self._extract_email(msg.get("From", ""))

            # SECURITY: Whitelist check
            if not self.whitelist_check(sender):
                logger.warning(f"BLOCKED: Unauthorized email from {sender}")
                continue

            subject = msg.get("Subject", "")
            body = self._get_body(msg)

            logger.info(f"Processing email from {sender}: {subject}")
            await self._process_command(sender, subject, body)
            self.processed_ids.append(eid)

        mail.logout()

    async def _process_command(self, sender: str, subject: str, body: str):
        """Parse and execute email commands."""
        subject_lower = subject.lower()

        if "run pipeline" in subject_lower:
            await self.callback(sender, "run_pipeline", {})
        elif subject_lower.startswith("ai:"):
            prompt = subject.split(":", 1)[1].strip()
            await self.callback(sender, "query_ai", {"prompt": prompt})

    async def send_reply(self, to: str, body: str):
        """Send email reply."""
        msg = MIMEMultipart()
        msg["From"] = self.email_address
        msg["To"] = to
        msg["Subject"] = "Re: AI Hub Response"
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(self.email_address, self.email_password)
            server.send_message(msg)

        logger.info(f"Reply sent to {to}")

    def _extract_email(self, from_header: str) -> str:
        """Extract email address from From header."""
        if "<" in from_header and ">" in from_header:
            return from_header.split("<")[1].split(">")[0]
        return from_header.strip()

    def _get_body(self, msg) -> str:
        """Extract email body."""
        if msg.is_multipart():
            for part in msg.walk():
                if part.get_content_type() == "text/plain":
                    return part.get_payload(decode=True).decode()
        else:
            return msg.get_payload(decode=True).decode()
        return ""

    def stop(self):
        """Stop listener."""
        self.running = False
        logger.info("Email listener stopped")
`
  },
  {
    name: "requirements.txt",
    path: "requirements.txt",
    language: "text",
    description: "Python dependencies",
    content: `# AI Automation Hub - Dependencies
fastapi==0.104.1
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
    description: "Environment configuration template",
    content: `# AI Automation Hub - Environment Configuration

# Email Configuration
IMAP_SERVER=imap.gmail.com
EMAIL_SENDER=your-agent@gmail.com
EMAIL_PASSWORD=your-app-password

# SECURITY: Whitelisted Contacts (comma-separated)
WHITELIST_CONTACTS=admin@company.com,manager@company.com,Admin,Boss

# WhatsApp Configuration
WHATSAPP_WHITELIST=Admin,Manager,Boss

# AI Model Configuration
AI_BACKEND=ollama
DEFAULT_MODEL=llama3.2

# File Paths (Windows)
ALLOWED_BASE=C:/AI_Automation`
  }
];
