export default function FileManager() {
  const files = [
    { name: 'Downloads/', type: 'folder', size: '--', modified: '2025-01-15', items: 4 },
    { name: 'Reports/', type: 'folder', size: '--', modified: '2025-01-14', items: 3 },
    { name: 'Models/', type: 'folder', size: '--', modified: '2025-01-10', items: 3 },
    { name: 'Assets/', type: 'folder', size: '--', modified: '2025-01-14', items: 3 },
    { name: 'Logs/', type: 'folder', size: '--', modified: '2025-01-15', items: 3 },
    { name: 'BrowserData/', type: 'folder', size: '--', modified: '2025-01-15', items: 0 },
    { name: 'Screenshots/', type: 'folder', size: '--', modified: '2025-01-14', items: 2 },
  ];

  const downloadFiles = [
    { name: 'research_20250112.csv', size: '2.4 MB', modified: '2025-01-12' },
    { name: 'research_20250105.csv', size: '1.8 MB', modified: '2025-01-05' },
    { name: 'model_weights.bin', size: '4.2 GB', modified: '2025-01-10' },
    { name: 'tokenizer.json', size: '12 MB', modified: '2025-01-10' },
  ];

  const reportFiles = [
    { name: 'weekly_report_20250112.xlsx', size: '856 KB', modified: '2025-01-12' },
    { name: 'weekly_report_20250105.xlsx', size: '742 KB', modified: '2025-01-05' },
    { name: 'ai_analysis_summary.html', size: '45 KB', modified: '2025-01-12' },
  ];

  return (
    <div>
      <h1>FILE MANAGER</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        Sandboxed file browser — all operations restricted to C:/AI_Automation/
      </p>

      {/* Security Notice */}
      <div className="alert alert-warning" style={{ marginBottom: '2rem' }}>
        <p style={{ marginBottom: '0.5rem' }}>SANDBOXED ENVIRONMENT</p>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 0 }}>
          All file operations are restricted to C:/AI_Automation/ and its subdirectories.
          Path traversal attempts are blocked and logged. This is a security measure to prevent
          unauthorized file system access.
        </p>
      </div>

      {/* Disk Usage */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Total Space', value: '500 GB' },
          { label: 'Used', value: '127 GB' },
          { label: 'Free', value: '373 GB' },
          { label: 'Usage', value: '25.4%' },
        ].map((stat) => (
          <div key={stat.label} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '1rem' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              {stat.label}
            </p>
            <p style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 0 }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Directory Structure */}
      <h2>SANDBOXED DIRECTORIES</h2>
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', marginBottom: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 80px', padding: '1rem 1.5rem', background: 'var(--bg-tertiary)', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
          <div>Name</div>
          <div>Size</div>
          <div>Modified</div>
          <div>Items</div>
        </div>
        {files.map((file) => (
          <div key={file.name} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 80px', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ fontWeight: 800, color: 'var(--accent)' }}>{file.name}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{file.size}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{file.modified}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{file.items}</div>
          </div>
        ))}
      </div>

      {/* Sample Downloads */}
      <h2>DOWNLOADS DIRECTORY</h2>
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', marginBottom: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '1rem 1.5rem', background: 'var(--bg-tertiary)', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
          <div>File</div>
          <div>Size</div>
          <div>Modified</div>
        </div>
        {downloadFiles.map((file) => (
          <div key={file.name} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: '0.875rem' }}>{file.name}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{file.size}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{file.modified}</div>
          </div>
        ))}
      </div>

      {/* Sample Reports */}
      <h2>REPORTS DIRECTORY</h2>
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', marginBottom: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '1rem 1.5rem', background: 'var(--bg-tertiary)', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
          <div>File</div>
          <div>Size</div>
          <div>Modified</div>
        </div>
        {reportFiles.map((file) => (
          <div key={file.name} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: '0.875rem' }}>{file.name}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{file.size}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{file.modified}</div>
          </div>
        ))}
      </div>

      {/* API Endpoints */}
      <h2>FILE MANAGER API</h2>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Method</th>
              <th>Endpoint</th>
              <th>Description</th>
              <th>Security</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span className="status-badge status-active">GET</span></td>
              <td style={{ fontFamily: "'Courier New', monospace", fontSize: '0.875rem' }}>/api/files/list</td>
              <td>List files in directory</td>
              <td>Path validated against sandbox</td>
            </tr>
            <tr>
              <td><span className="status-badge status-paused">POST</span></td>
              <td style={{ fontFamily: "'Courier New', monospace", fontSize: '0.875rem' }}>/api/files/upload</td>
              <td>Upload file to directory</td>
              <td>Destination validated</td>
            </tr>
            <tr>
              <td><span className="status-badge status-active">GET</span></td>
              <td style={{ fontFamily: "'Courier New', monospace", fontSize: '0.875rem' }}>/api/files/download</td>
              <td>Download a file</td>
              <td>Path validated</td>
            </tr>
            <tr>
              <td><span className="status-badge status-error">DELETE</span></td>
              <td style={{ fontFamily: "'Courier New', monospace", fontSize: '0.875rem' }}>/api/files/delete</td>
              <td>Delete file/folder</td>
              <td>Path validated, logged</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Path Validation Example */}
      <div style={{ marginTop: '2rem' }}>
        <h3>PATH VALIDATION EXAMPLE</h3>
        <div className="code-block" data-lang="PYTHON">
          <pre>{`# All paths are validated against sandbox
ALLOWED_BASE = Path("C:/AI_Automation")

def validate_path(requested_path: str) -> Path:
    resolved = (ALLOWED_BASE / requested_path).resolve()
    
    # SECURITY: Block path traversal
    if not str(resolved).startswith(str(ALLOWED_BASE)):
        raise SecurityError(f"Access denied: {requested_path}")
    
    return resolved

# Examples:
validate_path("Downloads/file.csv")  # OK
validate_path("../Windows/System32")  # BLOCKED
validate_path("../../etc/passwd")     # BLOCKED`}</pre>
        </div>
      </div>
    </div>
  );
}
