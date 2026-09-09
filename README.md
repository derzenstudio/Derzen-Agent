# AI Automation Hub - Complete System Documentation

## Overview

A centralized, locally-hosted AI agent system that controls Chrome, manages files, runs offline AI models, and communicates via WhatsApp and Email. Built for a dedicated Windows device with comprehensive security hardening.

## Key Features

### Security Hardening
- **File System Sandboxing**: All file operations restricted to `C:/AI_Automation/` directory
- **Whitelist Enforcement**: Only whitelisted contacts can trigger actions via email/WhatsApp
- **Emergency Stop**: One-click button to immediately halt all automation
- **Path Traversal Protection**: Prevents unauthorized file system access
- **Localhost Only**: Server binds to 127.0.0.1, not accessible from network

### Core Modules
1. **Browser Automation** (Playwright): Chrome control, web scraping, file downloads
2. **AI Manager** (Ollama): Local offline AI inference with llama3.2
3. **Email Listener** (IMAP): Continuous inbox monitoring with whitelist
4. **WhatsApp Listener**: WhatsApp Web automation with whitelist
5. **Task Scheduler** (APScheduler): Cron-based job scheduling
6. **File Manager**: Sandboxed file operations

## Performance Estimates (16GB RAM, No GPU)

### AI Inference Speed
- **llama3.2**: 5-10 tokens/second (CPU-only)
- **phi-2 (2.7B)**: 15-25 tokens/second (CPU-only)
- **tinyllama (1.1B)**: 20-30 tokens/second (CPU-only)

### Task Timing Breakdown

| Task | Estimated Time | Notes |
|------|---------------|-------|
| AI Query (short) | 8-15 seconds | ~50 token response |
| AI Data Analysis | 2-4 minutes | 50 items with scoring |
| Report Summary | 30-60 seconds | ~500 token HTML |
| WhatsApp Parse+Reply | 10-20 seconds | ~100 tokens |
| **Full Sunday Pipeline** | **15-25 minutes** | All 8 steps |
| Email Check Cycle | 0.5-1 second | IMAP polling |
| WhatsApp Check Cycle | 2-3 seconds | DOM read |

### Sunday Pipeline Breakdown
1. Research (3 tabs): ~45 seconds
2. Data Scraping: ~25 seconds
3. **AI Analysis: ~2.5 minutes** (bottleneck)
4. Report Generation: ~3 seconds
5. Brand Styling: ~2 seconds
6. Image Fetching: ~20 seconds
7. **Summary Generation: ~30 seconds** (bottleneck)
8. Email + WhatsApp Send: ~30 seconds

**Total: ~15-25 minutes**

### Optimization Tips
- Use smaller models (phi-2, tinyllama) for 2-3x speed improvement
- Add NVIDIA GPU (even GTX 1660) for 80-90% reduction in AI tasks
- Pipeline with GPU: ~3-5 minutes total

## Complete Deployment Guide

### Step 1: Download All Project Files

Create project directory and download files:

```cmd
mkdir C:\AI_Automation_Project
cd C:\AI_Automation_Project
```

Download these files from the dashboard (Source Code section):
- `main.py` - FastAPI server with security hardening
- `automation.py` - Playwright browser automation
- `ai_manager.py` - Local AI model management
- `email_listener.py` - IMAP email listener
- `whatsapp_listener.py` - WhatsApp Web listener
- `file_manager.py` - Sandboxed file manager
- `requirements.txt` - Python dependencies
- `.env.example` - Environment template

### Step 2: Create Runtime Directories

```cmd
mkdir C:\AI_Automation
mkdir C:\AI_Automation\Downloads
mkdir C:\AI_Automation\Reports
mkdir C:\AI_Automation\Models
mkdir C:\AI_Automation\Assets
mkdir C:\AI_Automation\Logs
mkdir C:\AI_Automation\BrowserData
mkdir C:\AI_Automation\Screenshots
```

### Step 3: Install Python Dependencies

```cmd
cd C:\AI_Automation_Project

# Create virtual environment
python -m venv venv

# Activate virtual environment
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Step 4: Install Playwright Browsers

```cmd
playwright install chromium
```

### Step 5: Install and Configure Ollama

1. Download Ollama from https://ollama.ai
2. Install the Windows version
3. Pull AI model:

```cmd
ollama pull llama3.2

# Or for faster performance:
ollama pull phi-2
ollama pull tinyllama
```

4. Start Ollama service:

```cmd
ollama serve
```

### Step 6: Configure Environment Variables

```cmd
copy .env.example .env
notepad .env
```

Fill in your configuration:

```env
# Email Configuration
IMAP_SERVER=imap.gmail.com
EMAIL_SENDER=your-agent@gmail.com
EMAIL_PASSWORD=your-app-password

# SECURITY: Whitelisted contacts (comma-separated)
WHITELIST_CONTACTS=admin@company.com,manager@company.com,Admin,Boss

# WhatsApp Configuration
WHATSAPP_WHITELIST=Admin,Manager,Boss

# AI Model
AI_BACKEND=ollama
DEFAULT_MODEL=llama3.2

# File Paths
ALLOWED_BASE=C:/AI_Automation
```

**For Gmail:**
1. Enable IMAP in Gmail settings
2. Go to myaccount.google.com/apppasswords
3. Create an App Password (do NOT use regular password)
4. Use the App Password in `.env`

### Step 7: First Run - WhatsApp Login

Open two terminal windows:

**Terminal 1 - Start Ollama:**
```cmd
ollama serve
```

**Terminal 2 - Start AI Hub:**
```cmd
cd C:\AI_Automation_Project
venv\Scripts\activate
python main.py
```

Chrome will open automatically with WhatsApp Web QR code.

**Action Required:**
1. Open WhatsApp on your phone
2. Go to Settings > Linked Devices
3. Scan the QR code displayed in Chrome
4. Session will be saved for future runs

### Step 8: Verify System Status

Open browser to: `http://localhost:8000`

Or check via command line:

```cmd
curl http://localhost:8000/api/status
curl -X POST "http://localhost:8000/api/ai/query?prompt=Hello"
curl http://localhost:8000/api/files/list
```

All modules should show as initialized. Emergency stop button visible in top-right corner.

### Step 9: Test the Sunday Pipeline

```cmd
curl -X POST http://localhost:8000/api/automation/run-pipeline
```

Monitor logs:

```cmd
type C:\AI_Automation\Logs\server.log
```

Expected completion time: 15-25 minutes (CPU-only)

### Step 10: Set Up Auto-Start (Optional)

Create startup batch file:

```cmd
echo @echo off > C:\AI_Automation_Project\start.bat
echo cd C:\AI_Automation_Project >> C:\AI_Automation_Project\start.bat
echo call venv\Scripts\activate >> C:\AI_Automation_Project\start.bat
echo start /b ollama serve >> C:\AI_Automation_Project\start.bat
echo timeout /t 5 >> C:\AI_Automation_Project\start.bat
echo python main.py >> C:\AI_Automation_Project\start.bat
```

Add to Windows startup:
1. Press Win+R
2. Type: `shell:startup`
3. Copy `start.bat` shortcut to the startup folder

## Security Features

### 1. File System Sandboxing
All file operations are validated against `ALLOWED_BASE` directory:

```python
def validate_path(requested_path: str) -> Path:
    resolved = (ALLOWED_BASE / requested_path).resolve()
    if not str(resolved).startswith(str(ALLOWED_BASE)):
        raise SecurityError(f"Access denied: {requested_path}")
    return resolved
```

**Blocked examples:**
- `../Windows/System32` - Path traversal blocked
- `../../etc/passwd` - Path traversal blocked
- `C:/Windows/System32` - Outside sandbox blocked

### 2. Whitelist Enforcement
Email and WhatsApp listeners check every sender:

```python
def is_whitelisted(contact: str) -> bool:
    whitelist = os.getenv("WHITELIST_CONTACTS", "").split(",")
    return contact.strip().lower() in [w.strip().lower() for w in whitelist]
```

Unauthorized senders are logged but ignored.

### 3. Emergency Stop
One-click halt of all automation:

```python
@app.post("/api/emergency-stop")
async def trigger_emergency_stop():
    emergency_stop.set()
    scheduler.shutdown(wait=False)
    await browser.cleanup()
    email_listener.stop()
    whatsapp_listener.stop()
```

## Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Backend | Python + FastAPI | Web server and API |
| Browser | Playwright + Chromium | Chrome automation |
| AI Engine | Ollama (llama3.2) | Local AI inference |
| AI Fallback | HuggingFace Transformers | Alternative backend |
| Scheduler | APScheduler | Cron-based scheduling |
| Email | IMAP/SMTP (stdlib) | Inbox monitoring |
| Spreadsheets | OpenPyXL | Excel reports |
| Frontend | Custom HTML/CSS/JS | Dashboard UI |

## File Structure

```
C:\AI_Automation_Project\          # Project files
├── main.py
├── automation.py
├── ai_manager.py
├── email_listener.py
├── whatsapp_listener.py
├── file_manager.py
├── requirements.txt
├── .env
└── venv\

C:\AI_Automation\                   # Runtime data (sandboxed)
├── Downloads\
├── Reports\
├── Models\
├── Assets\
├── Logs\
├── BrowserData\
└── Screenshots\
```

## Troubleshooting

### Ollama not responding
```cmd
# Check if Ollama is running
ollama list

# Restart Ollama
taskkill /f /im ollama.exe
ollama serve
```

### WhatsApp not connecting
- Delete `C:\AI_Automation\BrowserData\` folder
- Restart the system
- Scan QR code again

### Email not receiving
- Verify IMAP is enabled in Gmail
- Check App Password is correct
- Verify whitelist includes your email

### Slow AI performance
- Switch to smaller model: `ollama pull tinyllama`
- Close other applications to free RAM
- Consider adding NVIDIA GPU

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/status` | System status |
| POST | `/api/emergency-stop` | Halt all automation |
| POST | `/api/ai/query` | Query AI model |
| GET | `/api/files/list` | List files (sandboxed) |
| POST | `/api/files/upload` | Upload file (sandboxed) |
| POST | `/api/automation/run-pipeline` | Trigger Sunday pipeline |

## Support

For issues or questions:
1. Check logs: `C:\AI_Automation\Logs\server.log`
2. Verify all services are running
3. Check whitelist configuration
4. Ensure sandbox directories exist

## License

This is a custom-built automation system for internal use.

---

**System Status**: All security measures active, sandbox enforced, whitelist operational, emergency stop available.

**Performance**: 15-25 minutes for full pipeline on CPU-only (16GB RAM). Add GPU for 80-90% speed improvement.
