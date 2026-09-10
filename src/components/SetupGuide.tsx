import { useState } from 'react';

export default function SetupGuide() {
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [expandedStep, setExpandedStep] = useState<number | null>(1);

  const toggleStep = (id: number) => {
    setCompletedSteps(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const progress = (completedSteps.size / 10) * 100;

  return (
    <div>
      <h1>DEPLOYMENT GUIDE</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        Complete step-by-step instructions from downloading files to running the system
      </p>

      {/* Progress */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '1.5rem', marginBottom: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Setup Progress</span>
          <span style={{ fontSize: '0.875rem', color: 'var(--accent)', fontWeight: 800 }}>
            {completedSteps.size}/10 completed
          </span>
        </div>
        <div className="progress-container">
          <div className="progress-bar" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Prerequisites */}
      <div className="alert alert-warning" style={{ marginBottom: '3rem' }}>
        <p style={{ marginBottom: '0.5rem' }}>PREREQUISITES</p>
        <ul style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', paddingLeft: '1.5rem', marginBottom: 0 }}>
          <li>Windows 10/11 with at least 16GB RAM</li>
          <li>Python 3.10 or higher installed</li>
          <li>Administrator access (for creating directories)</li>
          <li>Gmail account with App Password enabled</li>
          <li>WhatsApp account (for WhatsApp Web automation)</li>
          <li>Stable internet connection (for initial setup)</li>
        </ul>
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {[
          {
            id: 1,
            title: 'Download All Project Files',
            content: (
              <div>
                <p style={{ marginBottom: '1rem' }}>Create a new folder and download all project files:</p>
                <div className="code-block" data-lang="CMD">
                  <pre>{`# Create project directory
mkdir C:\\AI_Automation_Project
cd C:\\AI_Automation_Project

# Download files (or copy from this dashboard)
# You need these files:
# - main.py
# - automation.py
# - ai_manager.py
# - email_listener.py
# - whatsapp_listener.py
# - file_manager.py
# - requirements.txt
# - .env.example`}</pre>
                </div>
                <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Copy each file from the Source Code section and save them in C:\AI_Automation_Project\
                </p>
              </div>
            ),
          },
          {
            id: 2,
            title: 'Create Runtime Directories',
            content: (
              <div>
                <p style={{ marginBottom: '1rem' }}>Create the sandboxed directory structure:</p>
                <div className="code-block" data-lang="CMD">
                  <pre>{`# Create runtime directories
mkdir C:\\AI_Automation
mkdir C:\\AI_Automation\\Downloads
mkdir C:\\AI_Automation\\Reports
mkdir C:\\AI_Automation\\Models
mkdir C:\\AI_Automation\\Assets
mkdir C:\\AI_Automation\\Logs
mkdir C:\\AI_Automation\\BrowserData
mkdir C:\\AI_Automation\\Screenshots

# Verify structure
dir C:\\AI_Automation`}</pre>
                </div>
                <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  These directories are where all automated files will be stored. The system cannot access files outside this structure.
                </p>
              </div>
            ),
          },
          {
            id: 3,
            title: 'Install Python Dependencies',
            content: (
              <div>
                <p style={{ marginBottom: '1rem' }}>Install required Python packages:</p>
                <div className="code-block" data-lang="CMD">
                  <pre>{`# Navigate to project directory
cd C:\\AI_Automation_Project

# Create virtual environment (recommended)
python -m venv venv

# Activate virtual environment
venv\\Scripts\\activate

# Install dependencies
pip install -r requirements.txt

# Verify installation
pip list`}</pre>
                </div>
                <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  This installs FastAPI, Playwright, APScheduler, OpenPyXL, and other required packages.
                </p>
              </div>
            ),
          },
          {
            id: 4,
            title: 'Install Playwright Browsers',
            content: (
              <div>
                <p style={{ marginBottom: '1rem' }}>Install Chromium browser for automation:</p>
                <div className="code-block" data-lang="CMD">
                  <pre>{`# Install Playwright browsers
playwright install chromium

# Verify installation
playwright --version`}</pre>
                </div>
                <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  This downloads Chromium (~150MB) which Playwright will control for web automation.
                </p>
              </div>
            ),
          },
          {
            id: 5,
            title: 'Install and Configure Ollama',
            content: (
              <div>
                <p style={{ marginBottom: '1rem' }}>Download and set up Ollama for local AI:</p>
                <div className="code-block" data-lang="CMD">
                  <pre>{`# Download Ollama from https://ollama.ai
# Install the Windows version

# After installation, pull a model
ollama pull llama3.2

# Verify Ollama is running
ollama list

# Start Ollama service (runs in background)
ollama serve`}</pre>
                </div>
                <div className="alert alert-info" style={{ marginTop: '1rem', marginBottom: 0 }}>
                  <p style={{ fontSize: '0.875rem', marginBottom: 0 }}>
                    llama3.2 requires ~2GB RAM. On 16GB RAM without GPU, expect 5-10 tokens/second.
                    For faster performance, use smaller models: <code>ollama pull phi-2</code> or <code>ollama pull tinyllama</code>
                  </p>
                </div>
              </div>
            ),
          },
          {
            id: 6,
            title: 'Configure Environment Variables',
            content: (
              <div>
                <p style={{ marginBottom: '1rem' }}>Set up your credentials and configuration:</p>
                <div className="code-block" data-lang="CMD">
                  <pre>{`# Copy the template
copy .env.example .env

# Edit the .env file
notepad .env`}</pre>
                </div>
                <p style={{ marginTop: '1rem', marginBottom: '1rem' }}>Fill in these values in .env:</p>
                <div className="code-block" data-lang="ENV">
                  <pre>{`# Email Configuration
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
ALLOWED_BASE=C:/AI_Automation`}</pre>
                </div>
                <div className="alert alert-warning" style={{ marginTop: '1rem', marginBottom: 0 }}>
                  <p style={{ fontSize: '0.875rem', marginBottom: 0 }}>
                    <strong>For Gmail:</strong> Enable IMAP in Gmail settings, then create an App Password at myaccount.google.com/apppasswords.
                    Do NOT use your regular Gmail password.
                  </p>
                </div>
              </div>
            ),
          },
          {
            id: 7,
            title: 'First Run: WhatsApp Login',
            content: (
              <div>
                <p style={{ marginBottom: '1rem' }}>Start the system and log into WhatsApp Web:</p>
                <div className="code-block" data-lang="CMD">
                  <pre>{`# Make sure Ollama is running (in separate terminal)
ollama serve

# In project directory, start the system
cd C:\\AI_Automation_Project
venv\\Scripts\\activate
python main.py`}</pre>
                </div>
                <p style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                  Chrome will open automatically. You'll see the WhatsApp Web QR code.
                </p>
                <div className="alert alert-info" style={{ marginBottom: 0 }}>
                  <p style={{ fontSize: '0.875rem', marginBottom: 0 }}>
                    <strong>Action Required:</strong> Open WhatsApp on your phone, go to Settings {'>'} Linked Devices,
                    and scan the QR code displayed in Chrome. The session will be saved for future runs.
                  </p>
                </div>
              </div>
            ),
          },
          {
            id: 8,
            title: 'Verify System Status',
            content: (
              <div>
                <p style={{ marginBottom: '1rem' }}>Check that all systems are running:</p>
                <div className="code-block" data-lang="CMD">
                  <pre>{`# Open browser to dashboard
# Navigate to: http://localhost:8000

# Or check via command line
curl http://localhost:8000/api/status

# Test AI query
curl -X POST "http://localhost:8000/api/ai/query?prompt=Hello"

# Check file manager
curl http://localhost:8000/api/files/list`}</pre>
                </div>
                <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  All modules should show as initialized. The emergency stop button should be visible in the top-right corner.
                </p>
              </div>
            ),
          },
          {
            id: 9,
            title: 'Test the Sunday Pipeline',
            content: (
              <div>
                <p style={{ marginBottom: '1rem' }}>Manually trigger the pipeline to test:</p>
                <div className="code-block" data-lang="CMD">
                  <pre>{`# Trigger pipeline manually
curl -X POST http://localhost:8000/api/automation/run-pipeline

# Check logs
type C:\\AI_Automation\\Logs\\server.log`}</pre>
                </div>
                <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  The pipeline will run through all 8 steps. On CPU-only (16GB RAM, no GPU), expect 15-25 minutes total.
                </p>
                <div className="alert alert-info" style={{ marginTop: '1rem', marginBottom: 0 }}>
                  <p style={{ fontSize: '0.875rem', marginBottom: 0 }}>
                    <strong>Timing Breakdown:</strong> Research (45s) + Scrape (25s) + AI Analysis (2.5 min) +
                    Report (5s) + Styling (5s) + Images (20s) + Summary (30s) + Send (30s) = ~15-25 minutes
                  </p>
                </div>
              </div>
            ),
          },
          {
            id: 10,
            title: 'Set Up Auto-Start (Optional)',
            content: (
              <div>
                <p style={{ marginBottom: '1rem' }}>Configure the system to start automatically on Windows boot:</p>
                <div className="code-block" data-lang="CMD">
                  <pre>{`# Create startup batch file
echo @echo off > C:\\AI_Automation_Project\\start.bat
echo cd C:\\AI_Automation_Project >> C:\\AI_Automation_Project\\start.bat
echo call venv\\Scripts\\activate >> C:\\AI_Automation_Project\\start.bat
echo start /b ollama serve {'>>'} C:\\AI_Automation_Project\\start.bat
echo timeout /t 5 {'>>'} C:\\AI_Automation_Project\\start.bat
echo python main.py {'>>'} C:\\AI_Automation_Project\\start.bat

# Add to Windows startup
# Press Win+R, type: shell:startup
# Copy start.bat shortcut to the startup folder`}</pre>
                </div>
                <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  The system will now start automatically when Windows boots. Ollama starts first, then the main app after a 5-second delay.
                </p>
              </div>
            ),
          },
        ].map((step) => (
          <div
            key={step.id}
            style={{
              background: 'var(--bg-secondary)',
              border: `1px solid ${completedSteps.has(step.id) ? 'var(--success)' : 'var(--border)'}`,
              overflow: 'hidden',
            }}
          >
            <button
              onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '1.5rem',
                padding: '1.5rem',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                color: 'var(--text-primary)',
              }}
            >
              <button
                onClick={(e) => { e.stopPropagation(); toggleStep(step.id); }}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  border: `2px solid ${completedSteps.has(step.id) ? 'var(--success)' : 'var(--border)'}`,
                  background: completedSteps.has(step.id) ? 'var(--success)' : 'transparent',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '1.125rem', marginBottom: '0.25rem' }}>
                  STEP {step.id}: {step.title}
                </h3>
              </div>
            </button>

            {expandedStep === step.id && (
              <div style={{ padding: '0 1.5rem 1.5rem 1.5rem', borderTop: '1px solid var(--border)' }}>
                <div style={{ paddingTop: '1.5rem' }}>{step.content}</div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Final Notes */}
      <div style={{ marginTop: '3rem' }}>
        <h2>SYSTEM IS READY</h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Once all steps are complete, your AI Automation Hub is fully operational.
          The system runs on localhost:8000 with all security measures active.
        </p>
        <div className="alert alert-success">
          <p style={{ marginBottom: '0.5rem' }}>SECURITY STATUS</p>
          <ul style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', paddingLeft: '1.5rem', marginBottom: 0 }}>
            <li>File operations restricted to C:/AI_Automation/</li>
            <li>Only whitelisted contacts can trigger actions</li>
            <li>Emergency stop button available at all times</li>
            <li>All operations logged to C:/AI_Automation/Logs/</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
