import { useEffect, useState } from 'react';
import { api, type FileEntry, type DiskUsage } from '../api';

export default function FileManager() {
  const [directory, setDirectory] = useState('');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [disk, setDisk] = useState<DiskUsage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.listFiles(directory)
      .then((res) => {
        if (!active) return;
        setEntries(res.entries);
        setDisk(res.disk);
        setError(null);
      })
      .catch((err) => active && setError((err as Error).message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [directory]);

  const openFolder = (entry: FileEntry) => {
    if (entry.type === 'folder') {
      const name = entry.name.replace(/\/$/, '');
      setDirectory(directory ? directory + '/' + name : name);
    }
  };

  const goUp = () => {
    const parts = directory.split('/').filter(Boolean);
    parts.pop();
    setDirectory(parts.join('/'));
  };

  return (
    <div>
      <h1>FILE MANAGER</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        Sandboxed file browser — all operations restricted to your configured ALLOWED_BASE.
      </p>

      {/* Security Notice */}
      <div className="alert alert-warning" style={{ marginBottom: '2rem' }}>
        <p style={{ marginBottom: '0.5rem' }}>SANDBOXED ENVIRONMENT</p>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 0 }}>
          All file operations are restricted to ALLOWED_BASE and its subdirectories.
          Path traversal attempts are blocked and logged by the backend.
        </p>
      </div>

      {error && (
        <div className="alert alert-warning" style={{ marginBottom: '2rem' }}>
          <p style={{ marginBottom: 0 }}>Could not reach the backend: {error}</p>
        </div>
      )}

      {/* Disk Usage */}
      {disk && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
          {[
            { label: 'Total Space', value: disk.total },
            { label: 'Used', value: disk.used },
            { label: 'Free', value: disk.free },
            { label: 'Usage', value: disk.usage_percent + '%' },
          ].map((stat) => (
            <div key={stat.label} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '1rem' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                {stat.label}
              </p>
              <p style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 0 }}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Directory contents */}
      <h2>{directory ? '/' + directory : 'SANDBOX ROOT'}</h2>
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', marginBottom: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 80px', padding: '1rem 1.5rem', background: 'var(--bg-tertiary)', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
          <div>Name</div>
          <div>Size</div>
          <div>Modified</div>
          <div>Items</div>
        </div>

        {directory && (
          <div
            onClick={goUp}
            style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 80px', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
          >
            <div style={{ fontWeight: 800, color: 'var(--accent)' }}>../</div>
            <div>--</div><div></div><div></div>
          </div>
        )}

        {loading && (
          <div style={{ padding: '1.5rem', color: 'var(--text-muted)' }}>Loading…</div>
        )}

        {!loading && entries.length === 0 && !error && (
          <div style={{ padding: '1.5rem', color: 'var(--text-muted)' }}>This directory is empty.</div>
        )}

        {entries.map((file) => (
          <div
            key={file.name}
            onClick={() => openFolder(file)}
            style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 80px', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', cursor: file.type === 'folder' ? 'pointer' : 'default', transition: 'background 0.2s' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{ fontWeight: file.type === 'folder' ? 800 : 400, color: file.type === 'folder' ? 'var(--accent)' : 'var(--text-primary)', fontFamily: file.type === 'file' ? "'Courier New', monospace" : undefined, fontSize: '0.9rem' }}>
              {file.name}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{file.size}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{file.modified}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{file.items ?? ''}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
