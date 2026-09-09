# AI Automation Hub - Complete System

A centralized, locally-hosted AI agent system with visual pipeline builder, Chrome automation, offline AI models, and WhatsApp/Email communication. Built for Windows with comprehensive security hardening.

## 🎯 Key Features

### Security Hardened
- **No Hardcoded Values** - All configuration from environment variables
- **File Sandboxing** - All operations restricted to configured directory
- **Whitelist Enforcement** - Only approved contacts can trigger actions
- **Emergency Stop** - One-click halt of all automation
- **Path Traversal Protection** - Prevents unauthorized file access

### Visual Pipeline Builder
- **Drag-and-Drop Interface** - Create pipelines visually without coding
- **9 Node Types** - Start, End, AI Query, Web Scrape, Email, WhatsApp, File Save, Wait, Branch
- **Branching Logic** - If/else conditional paths
- **AI-Generated Pipelines** - Describe what you want in plain English
- **Save & Run** - Store pipelines and execute them on demand or on schedule

### Core Capabilities
- **Browser Automation** - Chrome control via Playwright
- **Local AI** - Ollama integration for offline inference
- **Email Monitoring** - IMAP-based inbox listening
- **WhatsApp Automation** - WhatsApp Web integration
- **Task Scheduling** - Cron-based job execution
- **File Management** - Sandboxed file operations

## 📊 Performance (16GB RAM, No GPU)

| Task | Time | Notes |
|------|------|-------|
| AI Query (short) | 8-15s | ~50 tokens @ 5-10 tok/s |
| AI Analysis (50 items) | 2-4 min | Main bottleneck |
| Report Summary | 30-60s | ~500 tokens |
| **Full Pipeline** | **15-25 min** | All steps combined |

**Optimization:** Use smaller models (phi-2, tinyllama) for 2-3x speed, or add NVIDIA GPU for 80-90% reduction.

## 🚀 Quick Start

### 1. Prerequisites
- Windows 10/11 with 16GB+ RAM
- Python 3.10+
- Administrator access
- Gmail account with App Password
- WhatsApp account

### 2. Installation

```bash
# Clone or download project
cd AI_Automation_Hub

# Create virtual environment
python -m venv venv
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Install Playwright browsers
playwright install chromium
```

### 3. Install Ollama

Download from https://ollama.ai and install, then:

```bash
ollama pull llama3.2
ollama serve
```

### 4. Configure Environment

Copy `.env.example` to `.env` and fill in ALL required values:

```env
# SECURITY: REQUIRED - No defaults for security
WHITELIST_CONTACTS=admin@company.com,manager@company.com
ALLOWED_BASE=C:/AI_Automation

# Server
HOST=127.0.0.1
PORT=8000

# Email (optional - leave empty to disable)
EMAIL_SENDER=your-agent@gmail.com
EMAIL_PASSWORD=your-app-password

# WhatsApp (set to true to enable)
WHATSAPP_ENABLED=false

# AI
AI_BACKEND=ollama
DEFAULT_MODEL=llama3.2
```

**Important:** 
- `WHITELIST_CONTACTS` - Only these contacts can trigger actions
- `ALLOWED_BASE` - All file operations restricted here
- No default values for security reasons

### 5. Create Runtime Directories

```bash
mkdir C:\AI_Automation
mkdir C:\AI_Automation\Downloads
mkdir C:\AI_Automation\Reports
mkdir C:\AI_Automation\Models
mkdir C:\AI_Automation\Assets
mkdir C:\AI_Automation\Logs
mkdir C:\AI_Automation\Pipelines
mkdir C:\AI_Automation\BrowserData
```

### 6. First Run

```bash
# Terminal 1: Start Ollama
ollama serve

# Terminal 2: Start AI Hub
python main.py
```

Open browser to `http://localhost:8000`

Scan WhatsApp QR code when prompted (if enabled).

## 🎨 Visual Pipeline Builder

### Creating a Pipeline

1. **Navigate to Pipeline Builder** from the dashboard
2. **Describe your pipeline** in the prompt box:
   - "Scrape news sites, analyze with AI, send email if results found"
   - "Research AI trends, create report, send via WhatsApp"
3. **Click Generate** - AI creates the pipeline structure
4. **Drag and drop nodes** from the left palette
5. **Connect nodes** by clicking output ports (right) then input ports (left)
6. **Configure nodes** by clicking them and editing properties
7. **Save** the pipeline with a name
8. **Run** the pipeline immediately or schedule it

### Node Types

| Node | Purpose | Config |
|------|---------|--------|
| **START** | Pipeline entry | None |
| **END** | Pipeline exit | None |
| **AI QUERY** | Send prompt to AI | `prompt` |
| **WEB SCRAPE** | Scrape URLs | `urls` |
| **EMAIL SEND** | Send email | `to`, `subject`, `body` |
| **WHATSAPP** | Send WhatsApp | `contact`, `message` |
| **FILE SAVE** | Save to file | `filename`, `content` |
| **WAIT** | Pause execution | `seconds` |
| **BRANCH** | Conditional logic | `condition` (true/false paths) |

### Variable Substitution

Use `{{variable}}` syntax to reference previous node results:

```
Node: AI QUERY
Config: prompt = "Analyze {{scraped_data}}"

Node: EMAIL SEND
Config: body = "Report: {{ai_response}}"
```

### Branching Example

```
START → WEB SCRAPE → AI QUERY → BRANCH
                                    ↓         ↓
                              (true)         (false)
                                  ↓              ↓
                            EMAIL SEND       WAIT 10s
                                  ↓              ↓
                                  └──────→ END ←─┘
```

Branch condition: `{{ai_response}} != ""`

## 🔒 Security Features

### 1. File Sandboxing

All file operations validated against `ALLOWED_BASE`:

```python
def validate_path(requested_path: str) -> Path:
    resolved = (ALLOWED_BASE / requested_path).resolve()
    if not str(resolved).startswith(str(ALLOWED_BASE)):
        raise SecurityError(f"Access denied: {requested_path}")
    return resolved
```

**Blocked:**
- `../Windows/System32` - Path traversal
- `../../etc/passwd` - Path traversal
- `C:/Windows/System32` - Outside sandbox

### 2. Whitelist Enforcement

Only whitelisted contacts can trigger actions:

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

## 📁 Project Structure

```
AI_Automation_Hub/
├── src/                          # Frontend (React)
│   ├── App.tsx                   # Main app
│   ├── components/
│   │   ├── Dashboard.tsx         # Card navigation
│   │   ├── PipelineBuilder.tsx   # Visual pipeline editor
│   │   ├── CodeViewer.tsx        # Source code browser
│   │   ├── SetupGuide.tsx        # Deployment guide
│   │   ├── FileManager.tsx       # File browser
│   │   ├── TaskScheduler.tsx     # Job scheduler
│   │   └── Architecture.tsx      # System diagrams
│   └── data/
│       └── projectFiles.ts       # Python code (no hardcoded values)
├── main.py                       # FastAPI server
├── pipeline_runner.py            # Pipeline execution engine
├── automation.py                 # Browser automation
├── ai_manager.py                 # AI model management
├── email_listener.py             # Email monitoring
├── whatsapp_listener.py          # WhatsApp automation
├── file_manager.py               # Sandboxed file ops
├── requirements.txt              # Python dependencies
├── .env.example                  # Environment template
└── README.md                     # This file
```

## 🔌 API Endpoints

### System
- `GET /api/status` - System status
- `POST /api/emergency-stop` - Halt all automation
- `POST /api/ai/query?prompt=...` - Query AI model

### Pipelines
- `GET /api/pipelines` - List all pipelines
- `POST /api/pipelines` - Save new pipeline
- `GET /api/pipelines/{id}` - Get pipeline
- `DELETE /api/pipelines/{id}` - Delete pipeline
- `POST /api/pipelines/{id}/run` - Run pipeline
- `POST /api/pipelines/generate?prompt=...` - AI-generate pipeline

### Files
- `GET /api/files/list?directory=...` - List files (sandboxed)
- `POST /api/files/upload` - Upload file (sandboxed)

## 🛠️ Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Backend | Python + FastAPI | Web server and API |
| Frontend | React + Custom CSS | Dashboard UI |
| Browser | Playwright + Chromium | Chrome automation |
| AI | Ollama (llama3.2) | Local AI inference |
| Scheduler | APScheduler | Cron-based scheduling |
| Email | IMAP/SMTP | Inbox monitoring |
| Spreadsheets | OpenPyXL | Excel reports |

## 📖 Usage Examples

### Example 1: Weekly Research Pipeline

**Prompt:** "Every Sunday, scrape AI news from arXiv and HuggingFace, analyze trends, create a report, and email it to the team"

**Generated Pipeline:**
```
START → WEB SCRAPE (arXiv, HuggingFace)
      → AI QUERY (analyze trends)
      → FILE SAVE (report.xlsx)
      → EMAIL SEND (team@company.com)
      → END
```

**Schedule:** `0 9 * * SUN` (Every Sunday at 9 AM)

### Example 2: Conditional Notification

**Prompt:** "Monitor website, if content changed send WhatsApp alert, else wait 1 hour and check again"

**Generated Pipeline:**
```
START → WEB SCRAPE (website)
      → AI QUERY (compare with previous)
      → BRANCH ({{changed}} == "true")
          ↓              ↓
       (true)          (false)
          ↓              ↓
    WHATSAPP SEND     WAIT 3600
          ↓              ↓
          └──────→ END ←─┘
```

### Example 3: Data Processing

**Prompt:** "Download CSV file, analyze with AI, if score > 7 send email, else save to review folder"

**Generated Pipeline:**
```
START → FILE SAVE (download data.csv)
      → AI QUERY (analyze and score)
      → BRANCH ({{score}} > 7)
          ↓              ↓
       (true)          (false)
          ↓              ↓
    EMAIL SEND      FILE SAVE (review/)
          ↓              ↓
          └──────→ END ←─┘
```

## 🔧 Troubleshooting

### Ollama not responding
```bash
ollama list
taskkill /f /im ollama.exe
ollama serve
```

### WhatsApp not connecting
- Delete `C:\AI_Automation\BrowserData\`
- Restart system
- Scan QR code again

### Email not receiving
- Verify IMAP enabled in Gmail
- Check App Password (not regular password)
- Verify whitelist includes your email

### Slow AI performance
- Switch to smaller model: `ollama pull tinyllama`
- Close other applications
- Consider adding NVIDIA GPU

### Pipeline not running
- Check pipeline has START and END nodes
- Verify all nodes are connected
- Check logs: `C:\AI_Automation\Logs\server.log`

## 📝 Environment Variables Reference

### Required (No Defaults)
- `WHITELIST_CONTACTS` - Comma-separated list of approved contacts
- `ALLOWED_BASE` - Root directory for all file operations

### Server
- `HOST` - Server bind address (default: 127.0.0.1)
- `PORT` - Server port (default: 8000)
- `DEBUG` - Enable debug mode (default: false)
- `ALLOWED_ORIGIN` - CORS origin (default: http://localhost:8000)

### Subdirectories (relative to ALLOWED_BASE)
- `DOWNLOAD_SUBDIR` - Downloads folder (default: Downloads)
- `REPORTS_SUBDIR` - Reports folder (default: Reports)
- `MODELS_SUBDIR` - Models folder (default: Models)
- `ASSETS_SUBDIR` - Assets folder (default: Assets)
- `LOGS_SUBDIR` - Logs folder (default: Logs)
- `PIPELINES_SUBDIR` - Pipelines folder (default: Pipelines)
- `BROWSER_DATA_SUBDIR` - Browser data (default: BrowserData)

### Email (Optional)
- `EMAIL_SENDER` - Email address
- `EMAIL_PASSWORD` - App password
- `IMAP_SERVER` - IMAP server (default: imap.gmail.com)
- `SMTP_SERVER` - SMTP server (default: smtp.gmail.com)

### WhatsApp
- `WHATSAPP_ENABLED` - Enable WhatsApp (default: false)

### AI
- `AI_BACKEND` - AI backend (default: ollama)
- `DEFAULT_MODEL` - Default model (default: llama3.2)
- `OLLAMA_URL` - Ollama URL (default: http://localhost:11434)

### Browser
- `BROWSER_HEADLESS` - Run browser headless (default: false)

## 📄 License

Custom-built automation system for internal use.

## ✅ System Status

- ✅ No hardcoded values
- ✅ Visual pipeline builder
- ✅ Branching support
- ✅ AI-generated pipelines
- ✅ Security hardening
- ✅ Complete documentation
- ✅ Performance estimates
- ✅ Builds successfully

**Ready for deployment!**
