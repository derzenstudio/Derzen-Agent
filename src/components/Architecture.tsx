import { motion } from 'framer-motion';
import { Globe, Brain, Mail, MessageCircle, CalendarClock, HardDrive, Monitor } from 'lucide-react';

export default function Architecture() {
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">System Architecture</h1>
        <p className="text-gray-400 mt-1">
          How the AI Automation Hub components interact
        </p>
      </div>

      {/* Architecture Diagram */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
        <div className="relative">
          {/* Central Hub */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
          >
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <div className="text-center">
                <Monitor size={28} className="text-white mx-auto mb-1" />
                <p className="text-[10px] font-bold text-white">FastAPI</p>
                <p className="text-[8px] text-emerald-100">Core Hub</p>
              </div>
            </div>
          </motion.div>

          {/* Module nodes */}
          <div className="grid grid-cols-3 gap-8 relative">
            {/* Top row */}
            <ModuleNode
              icon={<Globe size={20} />}
              title="Playwright"
              subtitle="Chrome Automation"
              color="blue"
              delay={0.1}
            />
            <div /> {/* Center spacer */}
            <ModuleNode
              icon={<Brain size={20} />}
              title="AI Manager"
              subtitle="Ollama / Transformers"
              color="purple"
              delay={0.2}
            />

            {/* Middle row */}
            <ModuleNode
              icon={<Mail size={20} />}
              title="Email Listener"
              subtitle="IMAP Monitoring"
              color="orange"
              delay={0.3}
            />
            <div /> {/* Center - hub is here */}
            <ModuleNode
              icon={<MessageCircle size={20} />}
              title="WhatsApp"
              subtitle="Web Automation"
              color="green"
              delay={0.4}
            />

            {/* Bottom row */}
            <ModuleNode
              icon={<CalendarClock size={20} />}
              title="Scheduler"
              subtitle="APScheduler"
              color="amber"
              delay={0.5}
            />
            <div /> {/* Center spacer */}
            <ModuleNode
              icon={<HardDrive size={20} />}
              title="File Manager"
              subtitle="Windows FS"
              color="indigo"
              delay={0.6}
            />
          </div>
        </div>
      </div>

      {/* Data Flow */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Data Flow</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FlowCard
            title="Event-Driven Flow"
            steps={[
              'Email/WhatsApp message received',
              'Whitelist check passes',
              'AI parses the command',
              'Appropriate task triggered',
              'Results sent back to sender',
            ]}
            color="green"
          />
          <FlowCard
            title="Scheduled Pipeline Flow"
            steps={[
              'Cron trigger fires (Sun 9 AM)',
              'Chrome opens research tabs',
              'Data scraped & formatted to CSV',
              'AI model analyzes & filters',
              'Report generated with styling',
              'Images fetched from Drive',
              'Summary created by AI',
              'Sent via Email & WhatsApp',
            ]}
            color="amber"
          />
        </div>
      </div>

      {/* Directory Structure */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Project Structure</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <pre className="text-sm text-gray-300 font-mono leading-relaxed overflow-x-auto">
{`AI-Automation-Hub/
├── main.py                  # FastAPI server & scheduler
├── automation.py            # Playwright browser automation
├── ai_manager.py            # Local AI model management
├── email_listener.py        # IMAP email listener
├── whatsapp_listener.py     # WhatsApp Web listener
├── file_manager.py          # Local file management
├── requirements.txt         # Python dependencies
├── .env                     # Environment config
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
    └── Screenshots/`}
          </pre>
        </div>
      </div>

      {/* Communication Protocols */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Communication Protocols</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ProtocolCard
            title="HTTP/WebSocket"
            description="FastAPI serves the dashboard UI and provides REST APIs. WebSocket enables real-time status updates to the UI."
            endpoints={['GET /api/status', 'POST /api/ai/query', 'WS /ws']}
          />
          <ProtocolCard
            title="IMAP/SMTP"
            description="Email listener uses IMAP to monitor inbox and SMTP to send replies. Runs on a continuous polling loop."
            endpoints={['IMAP :993 (SSL)', 'SMTP :587 (TLS)', 'Poll every 30s']}
          />
          <ProtocolCard
            title="Playwright/CDP"
            description="Chrome DevTools Protocol via Playwright for browser automation. Persistent context maintains sessions."
            endpoints={['Chrome CDP', 'WhatsApp Web', 'Google Drive']}
          />
        </div>
      </div>
    </div>
  );
}

function ModuleNode({ icon, title, subtitle, color, delay }: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  color: string;
  delay: number;
}) {
  const colorMap: Record<string, string> = {
    blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30 text-blue-400',
    purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30 text-purple-400',
    orange: 'from-orange-500/20 to-orange-600/20 border-orange-500/30 text-orange-400',
    green: 'from-green-500/20 to-green-600/20 border-green-500/30 text-green-400',
    amber: 'from-amber-500/20 to-amber-600/20 border-amber-500/30 text-amber-400',
    indigo: 'from-indigo-500/20 to-indigo-600/20 border-indigo-500/30 text-indigo-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-b border ${colorMap[color]}`}
    >
      {icon}
      <p className="text-xs font-semibold text-white">{title}</p>
      <p className="text-[10px] text-gray-400">{subtitle}</p>
    </motion.div>
  );
}

function FlowCard({ title, steps, color }: { title: string; steps: string[]; color: string }) {
  const borderColor = color === 'green' ? 'border-green-500/20' : 'border-amber-500/20';
  const dotColor = color === 'green' ? 'bg-green-400' : 'bg-amber-400';

  return (
    <div className={`bg-gray-900 border ${borderColor} rounded-xl p-5`}>
      <h3 className="text-sm font-semibold text-white mb-3">{title}</h3>
      <div className="space-y-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={`w-1.5 h-1.5 rounded-full ${dotColor} flex-shrink-0`} />
            <span className="text-xs text-gray-300">{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProtocolCard({ title, description, endpoints }: {
  title: string;
  description: string;
  endpoints: string[];
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-white mb-2">{title}</h3>
      <p className="text-xs text-gray-400 mb-3">{description}</p>
      <div className="space-y-1">
        {endpoints.map((ep) => (
          <code key={ep} className="block text-[10px] text-emerald-400 bg-gray-800 px-2 py-1 rounded font-mono">
            {ep}
          </code>
        ))}
      </div>
    </div>
  );
}
