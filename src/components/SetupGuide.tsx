import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Circle, Terminal, Download, Key, Power, Globe, AlertTriangle } from 'lucide-react';

interface Step {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  commands?: string[];
  notes?: string[];
}

const steps: Step[] = [
  {
    id: 1,
    title: 'Install Prerequisites',
    description: 'Install Python 3.10+, Node.js (optional), and Git on your Windows machine.',
    icon: <Download size={20} />,
    commands: [
      '# Download Python from python.org (3.10+)',
      '# Or use winget:',
      'winget install Python.Python.3.11',
      '',
      '# Verify installation:',
      'python --version',
      'pip --version',
    ],
    notes: [
      'Make sure to check "Add Python to PATH" during installation',
      'Python 3.10 or higher is required',
      'Git is needed for cloning repositories',
    ],
  },
  {
    id: 2,
    title: 'Install Ollama',
    description: 'Download and install Ollama for running local AI models offline.',
    icon: <Globe size={20} />,
    commands: [
      '# Download from https://ollama.ai',
      '# Or via winget:',
      'winget install Ollama.Ollama',
      '',
      '# Start Ollama service:',
      'ollama serve',
      '',
      '# Pull a model (in another terminal):',
      'ollama pull llama3.2',
      'ollama pull mistral',
    ],
    notes: [
      'Ollama runs as a background service on Windows',
      'llama3.2 is recommended for general tasks',
      'Requires at least 8GB RAM (16GB recommended)',
      'GPU acceleration is automatic if NVIDIA drivers are installed',
    ],
  },
  {
    id: 3,
    title: 'Clone & Setup Project',
    description: 'Clone the repository and set up the Python virtual environment.',
    icon: <Terminal size={20} />,
    commands: [
      '# Clone the project:',
      'git clone https://github.com/your-repo/ai-automation-hub.git',
      'cd ai-automation-hub',
      '',
      '# Create virtual environment:',
      'python -m venv venv',
      '',
      '# Activate virtual environment:',
      'venv\\Scripts\\activate',
      '',
      '# Install dependencies:',
      'pip install -r requirements.txt',
    ],
    notes: [
      'Always activate the virtual environment before running',
      'The venv folder should not be committed to git',
    ],
  },
  {
    id: 4,
    title: 'Install Playwright Browsers',
    description: 'Install the Chromium browser that Playwright will control.',
    icon: <Globe size={20} />,
    commands: [
      '# Install Playwright browsers:',
      'playwright install chromium',
      '',
      '# Or install all browsers:',
      'playwright install',
      '',
      '# Verify:',
      'playwright --version',
    ],
    notes: [
      'Chromium is required for all automation tasks',
      'The browser runs in non-headless mode by default',
      'Persistent context saves login sessions between runs',
    ],
  },
  {
    id: 5,
    title: 'Configure Environment',
    description: 'Set up your email, WhatsApp, and system configuration.',
    icon: <Key size={20} />,
    commands: [
      '# Copy the template:',
      'copy .env.example .env',
      '',
      '# Edit .env with your settings:',
      'notepad .env',
    ],
    notes: [
      'For Gmail: Create an App Password at myaccount.google.com/apppasswords',
      'IMAP must be enabled in Gmail settings',
      'WhatsApp Web must be logged in on first run',
      'Add trusted contacts to the whitelist',
      'Set your preferred AI model (default: llama3.2)',
    ],
  },
  {
    id: 6,
    title: 'First Run & WhatsApp Login',
    description: 'Run the server for the first time to set up WhatsApp Web session.',
    icon: <Power size={20} />,
    commands: [
      '# Make sure Ollama is running:',
      'ollama serve',
      '',
      '# Start the AI Hub:',
      'python main.py',
      '',
      '# Server starts at http://localhost:8000',
      '# Chrome will open for WhatsApp login',
    ],
    notes: [
      'On first run, scan the QR code in Chrome to log into WhatsApp Web',
      'The session is saved in C:/AI_Automation/BrowserData/',
      'Subsequent runs will reuse the saved session',
      'The dashboard UI is available at localhost:8000',
    ],
  },
  {
    id: 7,
    title: 'Verify All Systems',
    description: 'Check that all modules are running correctly.',
    icon: <CheckCircle2 size={20} />,
    commands: [
      '# Check API status:',
      'curl http://localhost:8000/api/status',
      '',
      '# Test AI query:',
      'curl -X POST "http://localhost:8000/api/ai/query?prompt=Hello"',
      '',
      '# Check file manager:',
      'curl http://localhost:8000/api/files/list',
    ],
    notes: [
      'All modules should show as initialized in the status response',
      'The scheduler should show the Sunday 9 AM job',
      'Email and WhatsApp listeners should be active',
    ],
  },
  {
    id: 8,
    title: 'Set Up Auto-Start (Optional)',
    description: 'Configure the system to start automatically on Windows boot.',
    icon: <Power size={20} />,
    commands: [
      '# Create a batch file for startup:',
      'echo @echo off > start_hub.bat',
      'echo cd C:\\path\\to\\ai-automation-hub >> start_hub.bat',
      'echo call venv\\Scripts\\activate >> start_hub.bat',
      'echo ollama serve ^& start /b python main.py >> start_hub.bat',
      '',
      '# Add to Windows Task Scheduler:',
      '# Or place shortcut in: shell:startup',
    ],
    notes: [
      'Use Windows Task Scheduler for more control',
      'Set the task to run at system startup',
      'Ensure Ollama starts before the main app',
      'Consider running as a Windows Service for production',
    ],
  },
];

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

  const progress = (completedSteps.size / steps.length) * 100;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Setup Guide</h1>
        <p className="text-gray-400 mt-1">
          Step-by-step deployment instructions for Windows
        </p>
      </div>

      {/* Progress Bar */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400">Setup Progress</span>
          <span className="text-xs text-emerald-400 font-medium">{completedSteps.size}/{steps.length} completed</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Warning */}
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex gap-3">
        <AlertTriangle size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-amber-200 font-medium">Prerequisites</p>
          <p className="text-xs text-amber-200/70 mt-1">
            This system requires a dedicated Windows device with at least 16GB RAM, 
            an NVIDIA GPU (recommended for AI), and unrestricted file system access.
            Email credentials and WhatsApp Web login are required.
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: step.id * 0.05 }}
            className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
          >
            {/* Step Header */}
            <button
              onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
              className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-800/50 transition-colors"
            >
              <button
                onClick={(e) => { e.stopPropagation(); toggleStep(step.id); }}
                className="flex-shrink-0"
              >
                {completedSteps.has(step.id) ? (
                  <CheckCircle2 size={22} className="text-emerald-400" />
                ) : (
                  <Circle size={22} className="text-gray-600" />
                )}
              </button>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                completedSteps.has(step.id) ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-400'
              }`}>
                {step.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">
                  Step {step.id}: {step.title}
                </p>
                <p className="text-xs text-gray-400 truncate">{step.description}</p>
              </div>
            </button>

            {/* Expanded Content */}
            {expandedStep === step.id && (
              <div className="px-4 pb-4 space-y-3 border-t border-gray-800 pt-3">
                {step.commands && (
                  <div className="bg-gray-950 rounded-lg p-3 overflow-x-auto">
                    <pre className="text-xs text-gray-300 font-mono leading-relaxed">
                      {step.commands.map((cmd, i) => (
                        <div key={i} className={cmd.startsWith('#') ? 'text-gray-500' : cmd === '' ? 'h-2' : 'text-emerald-300'}>
                          {cmd}
                        </div>
                      ))}
                    </pre>
                  </div>
                )}
                {step.notes && step.notes.length > 0 && (
                  <div className="space-y-1.5">
                    {step.notes.map((note, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-[10px] text-amber-400 mt-1">●</span>
                        <p className="text-xs text-gray-400">{note}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
