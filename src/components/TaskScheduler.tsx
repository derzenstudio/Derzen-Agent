import { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Clock, RotateCcw, Calendar, Zap, CheckCircle2, AlertCircle } from 'lucide-react';

interface ScheduledJob {
  id: string;
  name: string;
  schedule: string;
  nextRun: string;
  status: 'active' | 'paused' | 'completed' | 'error';
  lastRun?: string;
  steps: number;
}

interface PipelineLog {
  id: number;
  timestamp: string;
  step: string;
  status: 'success' | 'running' | 'pending' | 'error';
  duration?: string;
  details: string;
}

const mockJobs: ScheduledJob[] = [
  {
    id: 'sunday_pipeline',
    name: 'Sunday Research & Report Pipeline',
    schedule: 'Every Sunday at 9:00 AM',
    nextRun: '2025-01-19 09:00:00',
    status: 'active',
    lastRun: '2025-01-12 09:00:15',
    steps: 8,
  },
  {
    id: 'email_check',
    name: 'Email Inbox Monitor',
    schedule: 'Every 30 seconds',
    nextRun: 'Continuous',
    status: 'active',
    lastRun: '2025-01-15 14:32:00',
    steps: 1,
  },
  {
    id: 'whatsapp_check',
    name: 'WhatsApp Message Monitor',
    schedule: 'Every 5 seconds',
    nextRun: 'Continuous',
    status: 'active',
    lastRun: '2025-01-15 14:32:05',
    steps: 1,
  },
  {
    id: 'model_update',
    name: 'Model Update Check',
    schedule: 'Every Monday at 2:00 AM',
    nextRun: '2025-01-20 02:00:00',
    status: 'paused',
    lastRun: '2025-01-13 02:00:00',
    steps: 3,
  },
];

const mockPipelineLog: PipelineLog[] = [
  { id: 1, timestamp: '09:00:00', step: 'Pipeline Started', status: 'success', duration: '0.1s', details: 'Scheduler triggered the pipeline' },
  { id: 2, timestamp: '09:00:01', step: 'Research Phase', status: 'success', duration: '45.2s', details: 'Opened 3 tabs: arxiv.org, huggingface.co, github.com' },
  { id: 3, timestamp: '09:00:46', step: 'Data Scraping', status: 'success', duration: '23.8s', details: 'Scraped 47 items across all sources' },
  { id: 4, timestamp: '09:01:10', step: 'AI Analysis', status: 'success', duration: '12.4s', details: 'Model: llama3.2 — Identified 5 themes, scored all items' },
  { id: 5, timestamp: '09:01:22', step: 'Report Generation', status: 'success', duration: '3.2s', details: 'Generated weekly_report_20250112.xlsx (38 items)' },
  { id: 6, timestamp: '09:01:25', step: 'Brand Styling', status: 'success', duration: '1.8s', details: 'Applied company brand guide (colors, fonts, borders)' },
  { id: 7, timestamp: '09:01:27', step: 'Image Fetching', status: 'success', duration: '18.5s', details: 'Downloaded 8 images from Google Drive "Brand Assets"' },
  { id: 8, timestamp: '09:01:46', step: 'Summary & Delivery', status: 'success', duration: '8.3s', details: 'Email sent to 3 recipients, WhatsApp message sent' },
];

export default function TaskScheduler() {
  const [selectedJob, setSelectedJob] = useState<string>('sunday_pipeline');
  const [pipelineRunning, setPipelineRunning] = useState(false);

  const handleTriggerPipeline = () => {
    setPipelineRunning(true);
    setTimeout(() => setPipelineRunning(false), 3000);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Task Scheduler</h1>
          <p className="text-gray-400 mt-1">
            Manage scheduled jobs and monitor pipeline execution
          </p>
        </div>
        <button
          onClick={handleTriggerPipeline}
          disabled={pipelineRunning}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            pipelineRunning
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 cursor-wait'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
          }`}
        >
          {pipelineRunning ? (
            <>
              <RotateCcw size={16} className="animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play size={16} />
              Trigger Pipeline Now
            </>
          )}
        </button>
      </div>

      {/* Scheduled Jobs */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Scheduled Jobs</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {mockJobs.map((job) => (
            <motion.button
              key={job.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setSelectedJob(job.id)}
              className={`text-left p-4 rounded-xl border transition-all ${
                selectedJob === job.id
                  ? 'bg-gray-800 border-emerald-500/30'
                  : 'bg-gray-900 border-gray-800 hover:border-gray-700'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    job.status === 'active' ? 'bg-emerald-400' :
                    job.status === 'paused' ? 'bg-amber-400' :
                    job.status === 'error' ? 'bg-red-400' : 'bg-gray-400'
                  }`} />
                  <h3 className="text-sm font-semibold text-white">{job.name}</h3>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  job.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
                  job.status === 'paused' ? 'bg-amber-500/10 text-amber-400' :
                  'bg-gray-500/10 text-gray-400'
                }`}>
                  {job.status}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Calendar size={11} />
                  {job.schedule}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clock size={11} />
                  Next: {job.nextRun}
                </div>
                {job.lastRun && (
                  <div className="flex items-center gap-2 text-[10px] text-gray-600">
                    Last run: {job.lastRun}
                  </div>
                )}
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Pipeline Execution Log */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">
          Pipeline Execution Log
          <span className="text-xs text-gray-500 ml-2 font-normal">Last run: Jan 12, 2025</span>
        </h2>
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {/* Pipeline Steps Visualization */}
          <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-800">
            <div className="flex items-center gap-1">
              {mockPipelineLog.map((log, i) => (
                <div key={log.id} className="flex items-center gap-1 flex-1">
                  <div className={`h-1.5 flex-1 rounded-full ${
                    log.status === 'success' ? 'bg-emerald-500' :
                    log.status === 'running' ? 'bg-amber-500 animate-pulse' :
                    log.status === 'error' ? 'bg-red-500' : 'bg-gray-700'
                  }`} />
                  {i < mockPipelineLog.length - 1 && <div className="w-0.5" />}
                </div>
              ))}
            </div>
          </div>

          {/* Log Entries */}
          <div className="divide-y divide-gray-800/50">
            {mockPipelineLog.map((log, i) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-4 px-4 py-3 hover:bg-gray-800/30 transition-colors"
              >
                <div className="flex-shrink-0">
                  {log.status === 'success' ? (
                    <CheckCircle2 size={16} className="text-emerald-400" />
                  ) : log.status === 'running' ? (
                    <RotateCcw size={16} className="text-amber-400 animate-spin" />
                  ) : log.status === 'error' ? (
                    <AlertCircle size={16} className="text-red-400" />
                  ) : (
                    <Clock size={16} className="text-gray-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-white">{log.step}</span>
                    {log.duration && (
                      <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
                        {log.duration}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{log.details}</p>
                </div>
                <span className="text-[10px] text-gray-600 font-mono flex-shrink-0">{log.timestamp}</span>
              </motion.div>
            ))}
          </div>

          {/* Summary */}
          <div className="px-4 py-3 bg-gray-800/30 border-t border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-xs text-gray-400">
                <Zap size={12} className="inline mr-1 text-amber-400" />
                Total: 113.3s
              </span>
              <span className="text-xs text-gray-400">
                <CheckCircle2 size={12} className="inline mr-1 text-emerald-400" />
                8/8 steps completed
              </span>
            </div>
            <span className="text-xs text-emerald-400 font-medium">Pipeline Successful</span>
          </div>
        </div>
      </div>

      {/* Scheduler Configuration */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Scheduler Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] text-gray-500 uppercase tracking-wider">Pipeline Schedule</label>
            <div className="bg-gray-800 rounded-lg px-3 py-2 text-xs text-gray-300 font-mono">
              CronTrigger(day_of_week="sun", hour=9, minute=0)
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] text-gray-500 uppercase tracking-wider">Email Check Interval</label>
            <div className="bg-gray-800 rounded-lg px-3 py-2 text-xs text-gray-300 font-mono">
              interval=30 seconds
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] text-gray-500 uppercase tracking-wider">WhatsApp Check Interval</label>
            <div className="bg-gray-800 rounded-lg px-3 py-2 text-xs text-gray-300 font-mono">
              interval=5 seconds
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
