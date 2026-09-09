import { useState } from 'react';
import Dashboard from './components/Dashboard';
import Architecture from './components/Architecture';
import CodeViewer from './components/CodeViewer';
import SetupGuide from './components/SetupGuide';
import FileManager from './components/FileManager';
import TaskScheduler from './components/TaskScheduler';

export type Page = 'dashboard' | 'architecture' | 'code' | 'setup' | 'files' | 'scheduler';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [systemStopped, setSystemStopped] = useState(false);

  const handleEmergencyStop = () => {
    setSystemStopped(true);
    setTimeout(() => setSystemStopped(false), 3000);
  };

  return (
    <div>
      {/* Emergency Stop Button */}
      <button
        className="emergency-stop"
        onClick={handleEmergencyStop}
        title="Immediately stop all automation tasks"
      >
        {systemStopped ? 'SYSTEM STOPPED' : 'EMERGENCY STOP'}
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
      </div>
    </div>
  );
}

export default App;
