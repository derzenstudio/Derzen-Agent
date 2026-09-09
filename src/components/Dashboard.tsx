import { useState } from 'react';
import { type Page } from '../App';

interface DashboardProps {
  onNavigate: (page: Page) => void;
}

const navCards = [
  { page: 'pipeline-builder' as Page, title: 'Build a Pipeline', desc: 'Create automations visually — no coding needed. Start from a template or describe what you want in plain English.' },
  { page: 'architecture' as Page, title: 'System Architecture', desc: 'How all components connect and communicate' },
  { page: 'code' as Page, title: 'Source Code', desc: 'Complete Python codebase with security hardening' },
  { page: 'setup' as Page, title: 'Deployment Guide', desc: 'Step-by-step from download to running system' },
  { page: 'files' as Page, title: 'File Manager', desc: 'Sandboxed file browser for managed directories' },
  { page: 'scheduler' as Page, title: 'Task Scheduler', desc: 'Sunday pipeline and recurring job management' },
];

const pipelineSteps = [
  { step: 1, label: 'Research', desc: 'Open Chrome tabs to research category' },
  { step: 2, label: 'Scrape', desc: 'Extract data and format to CSV' },
  { step: 3, label: 'AI Analysis', desc: 'Offline model filters and processes data' },
  { step: 4, label: 'Report', desc: 'Generate spreadsheet report' },
  { step: 5, label: 'Styling', desc: 'Apply brand guide formatting' },
  { step: 6, label: 'Images', desc: 'Fetch assets from Google Drive' },
  { step: 7, label: 'Summary', desc: 'AI creates executive summary' },
  { step: 8, label: 'Send', desc: 'Deliver via Email and WhatsApp' },
];

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [expandedCard, setExpandedCard] = useState<Page | null>(null);

  const handleCardClick = (page: Page) => {
    if (expandedCard === page) {
      setExpandedCard(null);
    } else {
      setExpandedCard(page);
    }
  };

  const handleEnterSection = (page: Page) => {
    onNavigate(page);
    setExpandedCard(null);
  };

  return (
    <div>
      {/* Hero */}
      <div style={{ marginBottom: '4rem', paddingTop: '2rem' }}>
        <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)', marginBottom: '0.5rem' }}>
          AI AUTOMATION
        </h1>
        <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)', color: 'var(--accent)', marginBottom: '1.5rem' }}>
          HUB
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.125rem', maxWidth: '600px' }}>
          A centralized, locally-hosted AI agent that controls Chrome, manages files,
          runs offline AI models, and communicates via WhatsApp and Email.
          Built for a dedicated Windows device with full security sandboxing.
        </p>
      </div>

      {/* Security Status */}
      <div className="alert alert-success" style={{ marginBottom: '3rem' }}>
        <p style={{ marginBottom: '0.5rem' }}>SECURITY STATUS: ALL SYSTEMS HARDENED</p>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 0 }}>
          File operations restricted to sandboxed directories. Only whitelisted contacts can trigger actions.
          Emergency stop available at all times.
        </p>
      </div>

      {/* Navigation Cards */}
      <h2 style={{ marginBottom: '1.5rem' }}>EXPLORE</h2>
      <div className="nav-cards">
        {navCards.map((card) => (
          <div key={card.page}>
            <div
              className="nav-card"
              onClick={() => handleCardClick(card.page)}
            >
              <h3>{card.title}</h3>
              <p>{card.desc}</p>
              <p style={{ color: 'var(--accent)', fontSize: '0.875rem', marginTop: '1rem', marginBottom: 0 }}>
                {expandedCard === card.page ? 'COLLAPSE' : 'EXPAND'}
              </p>
            </div>

            {/* Expanded Section Preview */}
            {expandedCard === card.page && (
              <div className="section-content">
                <SectionPreview page={card.page} onEnter={() => handleEnterSection(card.page)} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pipeline Overview */}
      <div style={{ marginTop: '4rem' }}>
        <h2>SUNDAY 9 AM PIPELINE</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          Automated weekly workflow triggered by APScheduler cron job
        </p>
        <div className="timeline">
          {pipelineSteps.map((step) => (
            <div className="timeline-item" key={step.step}>
              <div className="timeline-time">STEP {step.step}</div>
              <div className="timeline-title">{step.label}</div>
              <div className="timeline-desc">{step.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Estimates */}
      <div style={{ marginTop: '4rem' }}>
        <h2>PERFORMANCE ESTIMATES</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Based on 16GB RAM, no NVIDIA GPU, using Ollama with llama3.2 (CPU inference)
        </p>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Estimated Time</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>AI Query (short response)</td>
                <td>8-15 seconds</td>
                <td>~50 token response, CPU-only inference</td>
              </tr>
              <tr>
                <td>AI Data Analysis (full pipeline)</td>
                <td>2-4 minutes</td>
                <td>Analyzing 50 items with scoring</td>
              </tr>
              <tr>
                <td>Report Summary Generation</td>
                <td>30-60 seconds</td>
                <td>~500 token HTML summary</td>
              </tr>
              <tr>
                <td>WhatsApp Message Parse + Reply</td>
                <td>10-20 seconds</td>
                <td>Short response, ~100 tokens</td>
              </tr>
              <tr>
                <td>Full Sunday Pipeline (all 8 steps)</td>
                <td>15-25 minutes</td>
                <td>Research + scrape + 3 AI calls + formatting</td>
              </tr>
              <tr>
                <td>Email Check Cycle</td>
                <td>0.5-1 second</td>
                <td>IMAP polling, no AI unless command received</td>
              </tr>
              <tr>
                <td>WhatsApp Check Cycle</td>
                <td>2-3 seconds</td>
                <td>Playwright DOM read, no AI unless command</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="alert alert-info" style={{ marginTop: '1.5rem' }}>
          <p style={{ marginBottom: '0.5rem' }}>IMPORTANT: CPU-ONLY PERFORMANCE</p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 0 }}>
            Without an NVIDIA GPU, Ollama runs entirely on CPU. The llama3.2 model (approximately 2GB)
            will generate tokens at roughly 5-10 tokens/second on a modern quad-core processor.
            For faster performance, consider using smaller models like phi-2 (2.7B) or tinyllama (1.1B),
            which can achieve 15-25 tokens/second on CPU. Adding an NVIDIA GPU (even a GTX 1660)
            would reduce all AI tasks by 80-90%.
          </p>
        </div>
      </div>

      {/* Tech Stack */}
      <div style={{ marginTop: '4rem', marginBottom: '4rem' }}>
        <h2>TECHNOLOGY STACK</h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Component</th>
                <th>Technology</th>
                <th>Purpose</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Backend</td><td>Python + FastAPI</td><td>Web server and API endpoints</td></tr>
              <tr><td>Browser</td><td>Playwright + Chromium</td><td>Chrome automation and scraping</td></tr>
              <tr><td>AI Engine</td><td>Ollama (llama3.2)</td><td>Local offline AI inference</td></tr>
              <tr><td>AI Fallback</td><td>HuggingFace Transformers</td><td>Alternative AI backend</td></tr>
              <tr><td>Scheduler</td><td>APScheduler</td><td>Cron-based task scheduling</td></tr>
              <tr><td>Email</td><td>IMAP/SMTP (stdlib)</td><td>Inbox monitoring and sending</td></tr>
              <tr><td>Spreadsheets</td><td>OpenPyXL</td><td>Excel report generation</td></tr>
              <tr><td>Frontend</td><td>Custom HTML/CSS/JS</td><td>Dashboard UI (no frameworks)</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SectionPreview({ page, onEnter }: { page: Page; onEnter: () => void }) {
  const previews: Record<Page, string> = {
    dashboard: '',
    'pipeline-builder': 'Build automations without writing a single line of code. Choose from ready-made templates, describe what you want in plain English, or drag-and-drop steps onto a canvas. Includes undo/redo, live testing, and branching logic with YES/NO paths.',
    architecture: 'View the complete system architecture showing how FastAPI, Playwright, Ollama, IMAP, and WhatsApp Web all interconnect through the central hub. Includes data flow diagrams and communication protocols.',
    code: 'Browse the complete Python codebase including security-hardened main.py, automation.py with sandboxed file operations, ai_manager.py with Ollama integration, and event-driven listeners with whitelist enforcement.',
    setup: 'Complete step-by-step guide from downloading all files, organizing the directory structure, installing dependencies, configuring credentials, and launching the system for the first time.',
    files: 'Interactive file manager showing the sandboxed directory structure. All file operations are restricted to C:/AI_Automation/ and its subdirectories for security.',
    scheduler: 'View and manage scheduled jobs including the Sunday 9 AM pipeline, email polling, WhatsApp monitoring, and model update checks. Includes execution logs and timing estimates.',
  };

  return (
    <div>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        {previews[page]}
      </p>
      <button className="btn btn-primary" onClick={onEnter}>
        ENTER SECTION
      </button>
    </div>
  );
}
