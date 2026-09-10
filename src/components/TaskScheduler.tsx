import { useEffect, useState } from 'react';
import { api, type RunReport } from '../api';

interface Job {
  id: string;
  name: string;
  schedule: string;
  next_run: string | null;
  last_run: RunReport | null;
  status: string;
}

export default function TaskScheduler() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [report, setReport] = useState<RunReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.schedulerJobs()
      .then((data: Job[]) => {
        setJobs(data);
        setError(null);
        if (!selectedJob && data.length) setSelectedJob(data[0].id);
        const sel = data.find((j) => j.id === selectedJob) ?? data[0];
        if (sel?.last_run) setReport(sel.last_run);
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const runNow = async (id: string) => {
    setError(null);
    try {
      const r = await api.runSaved(id);
      setReport(r);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
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
        <button className="btn btn-secondary" onClick={load} style={{ padding: '0.5rem 1rem' }}>
          REFRESH
        </button>
      </div>

      {error && (
        <div className="alert alert-warning" style={{ marginBottom: '2rem' }}>
          <p style={{ marginBottom: 0 }}>Could not reach the backend: {error}</p>
        </div>
      )}

      {/* Scheduled Jobs */}
      <h2>SCHEDULED JOBS</h2>
      {!loading && jobs.length === 0 && !error && (
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
          No scheduled jobs yet. Give a saved pipeline a cron schedule in the Pipeline Builder.
        </p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginBottom: '3rem' }}>
        {jobs.map((job) => (
          <div
            key={job.id}
            onClick={() => { setSelectedJob(job.id); if (job.last_run) setReport(job.last_run); }}
            style={{
              background: selectedJob === job.id ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
              border: '1px solid ' + (selectedJob === job.id ? 'var(--accent)' : 'var(--border)'),
              padding: '1.5rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: 0 }}>{job.name}</h3>
              <span className={'status-badge status-' + job.status}>{job.status}</span>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              {job.schedule}
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              Next: {job.next_run ?? '—'}
            </p>
            <button
              className="btn btn-primary"
              onClick={(e) => { e.stopPropagation(); runNow(job.id); }}
              style={{ padding: '0.4rem 0.9rem', fontSize: '0.75rem' }}
            >
              RUN NOW
            </button>
          </div>
        ))}
      </div>

      {/* Pipeline Execution Log */}
      <h2>PIPELINE EXECUTION LOG</h2>
      {!report && (
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          Run a pipeline to see its real execution log here.
        </p>
      )}
      {report && (
        <>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            {report.pipeline} — started {report.started} — total {report.total_seconds}s — status {report.status}
          </p>

          {/* Progress Bar */}
          <div style={{ display: 'flex', gap: '2px', marginBottom: '1.5rem' }}>
            {report.log.map((log, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: '6px',
                  background:
                    log.status === 'success' ? 'var(--success)' :
                    log.status === 'running' ? 'var(--warning)' :
                    log.status === 'error' ? 'var(--danger)' : 'var(--border)',
                }}
              />
            ))}
          </div>

          {/* Log Entries */}
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', marginBottom: '2rem' }}>
            {report.log.map((log, i) => (
              <div key={i} style={{
                display: 'grid',
                gridTemplateColumns: '80px 1fr 80px 100px',
                gap: '1rem',
                padding: '1rem 1.5rem',
                borderBottom: i < report.log.length - 1 ? '1px solid var(--border)' : 'none',
                alignItems: 'center',
              }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: "'Courier New', monospace" }}>
                  {log.time}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{log.step}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{log.details}</div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{log.duration}</div>
                <div>
                  <span className={'status-badge status-' + (log.status === 'success' ? 'active' : log.status === 'error' ? 'error' : 'paused')}>
                    {log.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
