import { useState } from 'react';
import { projectFiles, type ProjectFile } from '../data/projectFiles';

export default function CodeViewer() {
  const [selectedFile, setSelectedFile] = useState<ProjectFile>(projectFiles[0]);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <h1>SOURCE CODE</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        Complete Python codebase with security hardening, sandboxed file operations,
        whitelist enforcement, and emergency stop capability.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '2rem', minHeight: '70vh' }}>
        {/* File List */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '1rem' }}>
          <h3 style={{ fontSize: '0.875rem', marginBottom: '1rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Project Files
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {projectFiles.map((file) => (
              <button
                key={file.name}
                onClick={() => setSelectedFile(file)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.75rem 1rem',
                  background: selectedFile.name === file.name ? 'var(--bg-tertiary)' : 'transparent',
                  border: selectedFile.name === file.name ? '1px solid var(--accent)' : '1px solid transparent',
                  color: selectedFile.name === file.name ? 'var(--accent)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontFamily: "'Courier New', monospace",
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  transition: 'all 0.2s ease',
                }}
              >
                {file.name}
              </button>
            ))}
          </div>
        </div>

        {/* Code Display */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* File Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 1.5rem',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderBottom: 'none',
          }}>
            <div>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>{selectedFile.name}</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 0 }}>
                {selectedFile.description}
              </p>
            </div>
            <button
              className="btn btn-secondary"
              onClick={handleCopy}
              style={{ padding: '0.5rem 1rem', fontSize: '0.75rem' }}
            >
              {copied ? 'COPIED' : 'COPY CODE'}
            </button>
          </div>

          {/* Code Block */}
          <div className="code-block" data-lang={selectedFile.language.toUpperCase()} style={{ flex: 1, overflow: 'auto', margin: 0 }}>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
              {selectedFile.content}
            </pre>
          </div>
        </div>
      </div>

      {/* Security Notes */}
      <div style={{ marginTop: '3rem' }}>
        <h2>SECURITY FEATURES IN CODE</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--accent)', marginBottom: '0.75rem' }}>File Sandboxing</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 0 }}>
              All file operations validate paths against ALLOWED_BASE. Path traversal attempts are blocked and logged.
            </p>
          </div>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--accent)', marginBottom: '0.75rem' }}>Whitelist Enforcement</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 0 }}>
              Email and WhatsApp listeners check every sender against WHITELIST_CONTACTS. Unauthorized senders are blocked.
            </p>
          </div>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--accent)', marginBottom: '0.75rem' }}>Emergency Stop</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 0 }}>
              The emergency_stop Event flag halts all automation, closes browsers, and stops listeners immediately.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
