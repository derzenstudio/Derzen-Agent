import { type Page } from '../App';
import {
  Globe,
  Brain,
  Mail,
  MessageCircle,
  CalendarClock,
  FolderOpen,
  ArrowRight,
  Zap,
  Activity,
  Server,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface DashboardProps {
  onNavigate: (page: Page) => void;
}

const modules = [
  {
    title: 'Browser Automation',
    description: 'Playwright-powered Chrome control for web scraping, form filling, and file downloads.',
    icon: <Globe size={24} />,
    color: 'from-blue-500 to-cyan-500',
    stats: '12 functions',
    page: 'code' as Page,
  },
  {
    title: 'AI Engine',
    description: 'Local offline AI via Ollama or HuggingFace Transformers. No cloud dependency.',
    icon: <Brain size={24} />,
    color: 'from-purple-500 to-pink-500',
    stats: 'Ollama + HF',
    page: 'code' as Page,
  },
  {
    title: 'Email Listener',
    description: 'IMAP-based inbox monitoring with whitelist filtering and auto-reply capabilities.',
    icon: <Mail size={24} />,
    color: 'from-orange-500 to-red-500',
    stats: 'Real-time',
    page: 'code' as Page,
  },
  {
    title: 'WhatsApp Listener',
    description: 'WhatsApp Web monitoring via Playwright for event-driven command processing.',
    icon: <MessageCircle size={24} />,
    color: 'from-green-500 to-emerald-500',
    stats: 'Real-time',
    page: 'code' as Page,
  },
  {
    title: 'Task Scheduler',
    description: 'APScheduler-powered cron jobs for the Sunday 9 AM multi-step pipeline.',
    icon: <CalendarClock size={24} />,
    color: 'from-amber-500 to-yellow-500',
    stats: '8 steps',
    page: 'scheduler' as Page,
  },
  {
    title: 'File Manager',
    description: 'Direct Windows filesystem access for uploads, downloads, and organization.',
    icon: <FolderOpen size={24} />,
    color: 'from-indigo-500 to-violet-500',
    stats: 'Full access',
    page: 'files' as Page,
  },
];

const pipelineSteps = [
  { step: 1, label: 'Research', icon: '🔍' },
  { step: 2, label: 'Scrape', icon: '📊' },
  { step: 3, label: 'AI Analysis', icon: '🧠' },
  { step: 4, label: 'Report', icon: '📝' },
  { step: 5, label: 'Styling', icon: '🎨' },
  { step: 6, label: 'Images', icon: '🖼️' },
  { step: 7, label: 'Summary', icon: '📋' },
  { step: 8, label: 'Send', icon: '📤' },
];

export default function Dashboard({ onNavigate }: DashboardProps) {
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-bold text-white"
          >
            AI Automation Hub
          </motion.h1>
          <p className="text-gray-400 mt-1">
            Centralized AI Agent — Chrome Control, Local AI, WhatsApp & Email Automation
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-400 font-medium">localhost:8000</span>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Modules', value: '6', icon: <Server size={16} />, color: 'text-blue-400' },
          { label: 'Pipeline Steps', value: '8', icon: <Zap size={16} />, color: 'text-amber-400' },
          { label: 'AI Backends', value: '2', icon: <Brain size={16} />, color: 'text-purple-400' },
          { label: 'Listeners', value: '2', icon: <Activity size={16} />, color: 'text-green-400' },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900 border border-gray-800 rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={stat.color}>{stat.icon}</span>
              <span className="text-xs text-gray-400">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Module Cards */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">System Modules</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((mod, i) => (
            <motion.button
              key={mod.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => onNavigate(mod.page)}
              className="text-left bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${mod.color} flex items-center justify-center text-white`}>
                  {mod.icon}
                </div>
                <ArrowRight size={16} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">{mod.title}</h3>
              <p className="text-xs text-gray-400 leading-relaxed">{mod.description}</p>
              <div className="mt-3">
                <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{mod.stats}</span>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Sunday Pipeline Visualization */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">
          Sunday 9 AM Pipeline
          <span className="text-xs text-gray-500 ml-2 font-normal">Automated weekly workflow</span>
        </h2>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex flex-wrap items-center gap-2">
            {pipelineSteps.map((step, i) => (
              <div key={step.step} className="flex items-center gap-2">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg border border-gray-700"
                >
                  <span className="text-lg">{step.icon}</span>
                  <div>
                    <p className="text-xs font-medium text-white">{step.label}</p>
                    <p className="text-[10px] text-gray-500">Step {step.step}</p>
                  </div>
                </motion.div>
                {i < pipelineSteps.length - 1 && (
                  <ArrowRight size={14} className="text-gray-600 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tech Stack */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Technology Stack</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { name: 'Python', version: '3.10+', category: 'Runtime' },
            { name: 'FastAPI', version: '0.104', category: 'Web Framework' },
            { name: 'Playwright', version: '1.40', category: 'Automation' },
            { name: 'Ollama', version: 'Latest', category: 'AI Backend' },
            { name: 'Transformers', version: '4.36', category: 'AI Backend' },
            { name: 'APScheduler', version: '3.10', category: 'Scheduling' },
            { name: 'OpenPyXL', version: '3.1', category: 'Spreadsheets' },
            { name: 'IMAP/SMTP', version: 'stdlib', category: 'Email' },
          ].map((tech) => (
            <div key={tech.name} className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5">
              <p className="text-sm font-medium text-white">{tech.name}</p>
              <p className="text-[10px] text-gray-500">{tech.category} · v{tech.version}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
