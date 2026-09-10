import { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Architecture from './components/Architecture';
import CodeViewer from './components/CodeViewer';
import SetupGuide from './components/SetupGuide';
import FileManager from './components/FileManager';
import TaskScheduler from './components/TaskScheduler';
import PipelineBuilder from './components/PipelineBuilder';
import { api } from './api';

export type Page = 'dashboard' | 'architecture' | 'code' | 'setup' | 'files' | 'scheduler' | 'pipeline-builder';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [systemStopped, setSystemStopped] = useState(false);
  const [busy, setBusy] = useState(false);

  // Reflect the real backend stop state on load.
  useEffect(() => {
    api.status()
      .then((s) => setSystemStopped(s.emergency_stop))
      .catch(() => {/* backend offline: leave default */});
  }, []);

  const handleEmergencyStop = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (systemStopped) {
        await api.emergencyReset();
        setSystemStopped(false);
      } else {
        await api.emergencyStop();
        setSystemStopped(true);
      }
    } catch (err) {
      alert('Could not reach the backend: ' + (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {/* Emergency Stop Button - now calls the real backend */}
      <button
        className="emergency-stop"
        onClick={handleEmergencyStop}
        disabled={busy}
        title="Immediately stop all automation tasks"
      >
        {systemStopped ? 'RESUME SYSTEM' : 'EMERGENCY STOP'}
      </button>

      <div className="container">
        {currentPage === 'dashboard' && (
          <Dashboard onNavigate={setCurrentPage} />
        )}
        {currentPage !== 'dashboard' && (
          <button
            className="btn btn-secondary"
            onClick={() => setCurrentPage('dashboard')}
            style={{ marginBottom: '2rem' }}
          >
            BACK TO DASHBOARD
          </button>
        )}
        {currentPage === 'architecture' && <Architecture />}
        {currentPage === 'code' && <CodeViewer />}
        {currentPage === 'setup' && <SetupGuide />}
        {currentPage === 'files' && <FileManager />}
        {currentPage === 'scheduler' && <TaskScheduler />}
        {currentPage === 'pipeline-builder' && <PipelineBuilder />}
      </div>
    </div>
  );
}

export default App;
