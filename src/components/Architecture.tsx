export default function Architecture() {
  return (
    <div>
      <h1>SYSTEM ARCHITECTURE</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '3rem' }}>
        Complete overview of how all components interact in the AI Automation Hub
      </p>

      {/* Core Architecture */}
      <h2>CORE ARCHITECTURE</h2>
      <div className="code-block" data-lang="DIAGRAM" style={{ marginBottom: '3rem' }}>
        <pre>{`
┌─────────────────────────────────────────────────────────────────┐
│                    AI AUTOMATION HUB (FastAPI)                    │
│                         localhost:8000                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   PLAYWRIGHT │  │  AI MANAGER  │  │   TASK SCHEDULER     │  │
│  │   BROWSER    │  │  (Ollama)    │  │   (APScheduler)      │  │
│  │              │  │              │  │                      │  │
│  │ • Chrome     │  │ • llama3.2   │  │ • Sunday 9AM         │  │
│  │   Control    │  │ • phi-2      │  │ • Email Poll (30s)   │  │
│  │ • Scraping   │  │ • Analysis   │  │ • WA Poll (5s)       │  │
│  │ • Downloads  │  │ • Summaries  │  │                      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   EMAIL      │  │  WHATSAPP    │  │   FILE MANAGER       │  │
│  │   LISTENER   │  │  LISTENER    │  │   (Sandboxed)        │  │
│  │              │  │              │  │                      │  │
│  │ • IMAP Poll  │  │ • Web Auto   │  │ • C:/AI_Automation/  │  │
│  │ • Whitelist  │  │ • Whitelist  │  │ • Downloads/         │  │
│  │ • SMTP Reply │  │ • Commands   │  │ • Reports/           │  │
│  └──────────────┘  └──────────────┘  │ • Models/            │  │
│                                       │ • Assets/            │  │
│                                       └──────────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
        `}</pre>
      </div>

      {/* Security Architecture */}
      <h2>SECURITY ARCHITECTURE</h2>
      <div style={{ marginBottom: '3rem' }}>
        <h3>1. File System Sandboxing</h3>
        <div className="alert alert-warning">
          <p style={{ marginBottom: '0.5rem' }}>CRITICAL SECURITY MEASURE</p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 0 }}>
            All file operations are restricted to C:/AI_Automation/ and its subdirectories.
            The FileManager class validates every path operation against an allowed list.
            Any attempt to access files outside the sandbox is blocked and logged.
          </p>
        </div>
        <div className="code-block" data-lang="PYTHON">
          <pre>{`# Security: Path validation in file_manager.py
ALLOWED_BASE = Path("C:/AI_Automation")

def validate_path(requested_path: str) -> Path:
    """Ensure path is within allowed directory."""
    resolved = (ALLOWED_BASE / requested_path).resolve()
    if not str(resolved).startswith(str(ALLOWED_BASE)):
        raise SecurityError(
            f"Path traversal blocked: {requested_path}"
        )
    return resolved`}</pre>
        </div>

        <h3 style={{ marginTop: '2rem' }}>2. Contact Whitelist Enforcement</h3>
        <div className="alert alert-warning">
          <p style={{ marginBottom: '0.5rem' }}>CRITICAL SECURITY MEASURE</p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 0 }}>
            Both email and WhatsApp listeners enforce strict whitelisting.
            Messages from non-whitelisted contacts are logged but ignored.
            No commands are processed from unknown senders.
          </p>
        </div>
        <div className="code-block" data-lang="PYTHON">
          <pre>{`# Security: Whitelist enforcement in listeners.py
WHITELIST = os.getenv("WHITELIST_CONTACTS", "").split(",")

def is_authorized(sender: str) -> bool:
    """Check if sender is in whitelist."""
    sender_clean = sender.strip().lower()
    return sender_clean in [w.strip().lower() for w in WHITELIST]

# Every incoming message goes through this check
if not is_authorized(message.sender):
    logger.warning(f"BLOCKED: Unauthorized sender: {message.sender}")
    return  # Silently ignore`}</pre>
        </div>

        <h3 style={{ marginTop: '2rem' }}>3. Emergency Stop System</h3>
        <div className="alert alert-warning">
          <p style={{ marginBottom: '0.5rem' }}>CRITICAL SECURITY MEASURE</p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 0 }}>
            The emergency stop button immediately halts all automation tasks,
            closes browser instances, stops listeners, and prevents new commands
            from being processed until manually restarted.
          </p>
        </div>
        <div className="code-block" data-lang="PYTHON">
          <pre>{`# Security: Emergency stop in main.py
emergency_stop = Event()

@app.post("/api/emergency-stop")
async def trigger_emergency_stop():
    """Immediately halt all automation."""
    emergency_stop.set()
    
    # Stop scheduler
    scheduler.shutdown(wait=False)
    
    # Close browser
    await browser.cleanup()
    
    # Stop listeners
    email_listener.stop()
    whatsapp_listener.stop()
    
    logger.critical("EMERGENCY STOP ACTIVATED")
    return {"status": "stopped"}`}</pre>
        </div>
      </div>

      {/* Data Flow */}
      <h2>DATA FLOW: SUNDAY PIPELINE</h2>
      <div className="timeline" style={{ marginBottom: '3rem' }}>
        <div className="timeline-item">
          <div className="timeline-time">09:00:00</div>
          <div className="timeline-title">Scheduler Trigger</div>
          <div className="timeline-desc">APScheduler fires the Sunday pipeline job</div>
        </div>
        <div className="timeline-item">
          <div className="timeline-time">09:00:01 - 09:00:45</div>
          <div className="timeline-title">Research Phase</div>
          <div className="timeline-desc">Playwright opens 3 tabs (arXiv, HuggingFace, GitHub) and searches for AI trends</div>
        </div>
        <div className="timeline-item">
          <div className="timeline-time">09:00:46 - 09:01:10</div>
          <div className="timeline-title">Data Scraping</div>
          <div className="timeline-desc">Extract titles, descriptions, and metadata from all sources</div>
        </div>
        <div className="timeline-item">
          <div className="timeline-time">09:01:11 - 09:03:30</div>
          <div className="timeline-title">AI Analysis (CPU: ~2.5 min)</div>
          <div className="timeline-desc">Ollama llama3.2 analyzes 50 items, assigns relevance scores, identifies themes</div>
        </div>
        <div className="timeline-item">
          <div className="timeline-time">09:03:31 - 09:03:35</div>
          <div className="timeline-title">Report Generation</div>
          <div className="timeline-desc">OpenPyXL creates formatted Excel report with filtered data</div>
        </div>
        <div className="timeline-item">
          <div className="timeline-time">09:03:36 - 09:03:40</div>
          <div className="timeline-title">Brand Styling</div>
          <div className="timeline-desc">Apply company colors, fonts, and formatting rules</div>
        </div>
        <div className="timeline-item">
          <div className="timeline-time">09:03:41 - 09:04:00</div>
          <div className="timeline-title">Image Integration</div>
          <div className="timeline-desc">Download relevant images from Google Drive brand assets folder</div>
        </div>
        <div className="timeline-item">
          <div className="timeline-time">09:04:01 - 09:04:30</div>
          <div className="timeline-title">Summary Generation (CPU: ~30s)</div>
          <div className="timeline-desc">AI creates executive summary in HTML format</div>
        </div>
        <div className="timeline-item">
          <div className="timeline-time">09:04:31 - 09:05:00</div>
          <div className="timeline-title">Distribution</div>
          <div className="timeline-desc">Send summary via Email (SMTP) and WhatsApp Web automation</div>
        </div>
      </div>

      {/* Communication Protocols */}
      <h2>COMMUNICATION PROTOCOLS</h2>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Protocol</th>
              <th>Port</th>
              <th>Purpose</th>
              <th>Security</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>HTTP/REST</td>
              <td>8000</td>
              <td>Dashboard API and WebSocket</td>
              <td>Localhost only (127.0.0.1)</td>
            </tr>
            <tr>
              <td>IMAP</td>
              <td>993</td>
              <td>Email inbox monitoring</td>
              <td>SSL/TLS encryption</td>
            </tr>
            <tr>
              <td>SMTP</td>
              <td>587</td>
              <td>Email sending</td>
              <td>TLS encryption</td>
            </tr>
            <tr>
              <td>HTTP (Ollama)</td>
              <td>11434</td>
              <td>Local AI model inference</td>
              <td>Localhost only</td>
            </tr>
            <tr>
              <td>HTTPS (WhatsApp)</td>
              <td>443</td>
              <td>WhatsApp Web automation</td>
              <td>End-to-end encrypted</td>
            </tr>
            <tr>
              <td>CDP (Chrome)</td>
              <td>Dynamic</td>
              <td>Browser DevTools Protocol</td>
              <td>Local IPC only</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
