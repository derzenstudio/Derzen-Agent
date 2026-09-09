import { useState } from 'react';

const jobs = [
  { id: 'sunday_pipeline', name: 'Sunday Research & Report Pipeline', schedule: 'Every Sunday at 9:00 AM', nextRun: '2025-01-19 09:00:00', status: 'active' as const, lastRun: '2025-01-12 09:00:15', steps: 8 },
  { id: 'email_check', name: 'Email Inbox Monitor', schedule: 'Every 30 seconds', nextRun: 'Continuous', status: 'active' as const, lastRun: '2025-01-15 14:32:00', steps: 1 },
  { id: 'whatsapp_check', name: 'WhatsApp Message Monitor', schedule: 'Every 5 seconds', nextRun: 'Continuous', status: 'active' as const, lastRun: '2025-01-15 14:32:05', steps: 1 },
  { id: 'model_update', name: 'Model Update Check', schedule: 'Every Monday at 2:00 AM', nextRun: '2025-01-20 02:00:00', status: 'paused' as const, lastRun: '2025-01-13 02:00:00', steps: 3 },
];

const pipelineLog = [
  { id: 1, time: '09:00:00', step: 'Pipeline Started', status: 'success' as const, duration: '0.1s', details: 'Scheduler triggered the pipeline' },
  { id: 2, time: '09:00:01', step: 'Research Phase', status: 'success' as const, duration: '45.2s', details: 'Opened 3 tabs: arxiv.org, huggingface.co, github.com' },
  { id: 3, time: '09:00:46', step: 'Data Scraping', status: 'success' as const, duration: '23.8s', details: 'Scraped 47 items across all sources' },
  { id: 4, time: '09:01:10', step: 'AI Analysis', status: 'success' as const, duration: '2m 24s', details: 'Model: llama3.2 (CPU) — Identified 5 themes, scored all items' },
  { id: 5, time: '09:03:34', step: 'Report Generation', status: 'success' as const, duration: '3.2s', details: 'Generated weekly_report_20250112.xlsx (38 items)' },
  { id: 6, time: '09:03:37', step: 'Brand Styling', status: 'success' as const, duration: '1.8s', details: 'Applied company brand guide (colors, fonts, borders)' },
  { id: 7, time: '09:03:39', step: 'Image Fetching', status: 'success' as const, duration: '18.5s', details: 'Downloaded 8 images from Google Drive "Brand Assets"' },
  { id: 8, time: '09:03:58', step: 'Summary & Delivery', status: 'success' as const, duration: '32.3s', details: 'Email sent to 3 recipients, WhatsApp message sent' },
];

export default function TaskScheduler() {
  const [selectedJob, setSelectedJob] = useState<string>('sunday_pipeline');
  const [pipelineRunning, setPipelineRunning] = useState(false);

  const handleTriggerPipeline = () => {
    setPipelineRunning(true);
    setTimeout(() => setPipelineRunning(false), 3000);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1>TASK SCHEDULER</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Manage scheduled jobs and monitor pipeline execution
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleTriggerPipeline}
          disabled={pipelineRunning}
          style={{ opacity: pipelineRunning ? 0.5 : 1 }}
        >
          {pipelineRunning ? 'RUNNING...' : 'TRIGGER PIPELINE NOW'}
        </button>
      </div>

      {/* Scheduled Jobs */}
      <h2>SCHEDULED JOBS</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginBottom: '3rem' }}>
        {jobs.map((job) => (
          <div
            key={job.id}
            onClick={() => setSelectedJob(job.id)}
            style={{
              background: selectedJob === job.id ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
              border: `1px solid ${selectedJob === job.id ? 'var(--accent)' : 'var(--border)'}`,
              padding: '1.5rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: 0 }}>{job.name}</h3>
              <span className={`status-badge status-${job.status}`}>{job.status}</span>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              {job.schedule}
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 0 }}>
              Next: {job.nextRun} | Last: {job.lastRun}
            </p>
          </div>
        ))}
      </div>

      {/* Pipeline Execution Log */}
      <h2>PIPELINE EXECUTION LOG</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        Last run: January 12, 2025 — Total time: 4 minutes 30 seconds
      </p>

      {/* Progress Bar */}
      <div style={{ display: 'flex', gap: '2px', marginBottom: '1.5rem' }}>
        {pipelineLog.map((log) => (
          <div
            key={log.id}
            style={{
              flex: 1,
              height: '6px',
              background: log.status === 'success' ? 'var(--success)' :
                          log.status === 'running' ? 'var(--warning)' :
                          log.status === 'error' ? 'var(--danger)' : 'var(--border)',
            }}
          />
        ))}
      </div>

      {/* Log Entries */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', marginBottom: '2rem' }}>
        {pipelineLog.map((log, i) => (
          <div key={log.id} style={{
            display: 'grid',
            gridTemplateColumns: '80px 1fr 80px 100px',
            gap: '1rem',
            padding: '1rem 1.5rem',
            borderBottom: i < pipelineLog.length - 1 ? '1px solid var(--border)' : 'none',
            alignItems: 'center',
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: "'Courier New', monospace" }}>
              {log.time}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: log.status === 'success' ? 'var(--success)' :
                              log.status === 'running' ? 'var(--warning)' :
                              log.status === 'error' ? 'var(--danger)' : 'var(--text-muted)',
                  flexShrink: 0,
                }} />
                <span style={{ fontWeight: 800, fontSize: '0.875rem' }}>{log.step}</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 0, paddingLeft: '1.25rem' }}>
                {log.details}
              </p>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '0.25rem 0.5rem', textAlign: 'center' }}>
              {log.duration}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--success)', textAlign: 'right' }}>
              {log.status === 'success' ? 'DONE' : String(log.status).toUpperCase()}
            </div>
          </div>
        ))}

        {/* Summary */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 1.5rem', background: 'var(--bg-tertiary)', borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Total: 4m 30s | 8/8 steps completed
          </span>
          <span style={{ fontSize: '0.875rem', color: 'var(--success)', fontWeight: 800 }}>
            PIPELINE SUCCESSFUL
          </span>
        </div>
      </div>

      {/* Timing Breakdown */}
      <h2>TIMING BREAKDOWN (CPU-ONLY, 16GB RAM)</h2>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Pipeline Step</th>
              <th>Duration</th>
              <th>Bottleneck</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Research (3 tabs)</td>
              <td>~45 seconds</td>
              <td>Network</td>
              <td>Page load times</td>
            </tr>
            <tr>
              <td>Data Scraping</td>
              <td>~25 seconds</td>
              <td>Network</td>
              <td>DOM parsing</td>
            </tr>
            <tr>
              <td>AI Analysis</td>
              <td style={{ color: 'var(--warning)', fontWeight: 800 }}>~2.5 minutes</td>
              <td style={{ color: 'var(--warning)' }}>CPU (AI)</td>
              <td>50 items × llama3.2 @ 5-10 tok/s</td>
            </tr>
            <tr>
              <td>Report Generation</td>
              <td>~3 seconds</td>
              <td>Disk I/O</td>
              <td>OpenPyXL write</td>
            </tr>
            <tr>
              <td>Brand Styling</td>
              <td>~2 seconds</td>
              <td>CPU</td>
              <td>Cell formatting</td>
            </tr>
            <tr>
              <td>Image Fetching</td>
              <td>~20 seconds</td>
              <td>Network</td>
              <td>Google Drive download</td>
            </tr>
            <tr>
              <td>Summary Generation</td>
              <td style={{ color: 'var(--warning)', fontWeight: 800 }}>~30 seconds</td>
              <td style={{ color: 'var(--warning)' }}>CPU (AI)</td>
              <td>~500 tokens @ 5-10 tok/s</td>
            </tr>
            <tr>
              <td>Email + WhatsApp Send</td>
              <td>~30 seconds</td>
              <td>Network</td>
              <td>SMTP + WhatsApp Web</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="alert alert-info" style={{ marginTop: '1.5rem' }}>
        <p style={{ marginBottom: '0.5rem' }}>PERFORMANCE NOTE</p>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 0 }}>
          AI inference is the primary bottleneck on CPU-only systems. The llama3.2 model generates
          approximately 5-10 tokens per second on a modern quad-core CPU with 16GB RAM.
          Switching to phi-2 (2.7B) or tinyllama (1.1B) can increase this to 15-25 tokens/second,
          reducing total pipeline time to 8-12 minutes. Adding an NVIDIA GPU would reduce AI steps by 80-90%.
        </p>
      </div>

      {/* Scheduler Configuration */}
      <div style={{ marginTop: '2rem' }}>
        <h3>SCHEDULER CONFIGURATION</h3>
        <div className="code-block" data-lang="PYTHON">
          <pre>{`# APScheduler configuration in main.py
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

scheduler = AsyncIOScheduler()

# Sunday 9 AM Pipeline
scheduler.add_job(
    run_sunday_pipeline,
    CronTrigger(day_of_week="sun", hour=9, minute=0),
    id="sunday_pipeline",
    name="Sunday Research & Report Pipeline",
)

# Email check every 30 seconds
# (Handled by async loop in email_listener.py)

# WhatsApp check every 5 seconds
# (Handled by async loop in whatsapp_listener.py)

scheduler.start()`}</pre>
        </div>
      </div>
    </div>
  );
}
