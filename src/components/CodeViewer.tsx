import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { projectFiles, type ProjectFile } from '../data/projectFiles';
import { FileCode, Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';

export default function CodeViewer() {
  const [selectedFile, setSelectedFile] = useState<ProjectFile>(projectFiles[0]);
  const [copied, setCopied] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'Core': true,
    'Listeners': true,
    'Config': true,
  });

  const groups: Record<string, ProjectFile[]> = {
    'Core': projectFiles.filter(f => ['main.py', 'automation.py', 'ai_manager.py'].includes(f.name)),
    'Listeners': projectFiles.filter(f => ['email_listener.py', 'whatsapp_listener.py'].includes(f.name)),
    'Config': projectFiles.filter(f => ['file_manager.py', 'requirements.txt', '.env.example', 'setup_guide.py'].includes(f.name)),
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">Source Code</h1>
        <p className="text-gray-400 mt-1">
          Complete Python codebase for the AI Automation Hub
        </p>
      </div>

      <div className="flex gap-6 h-[calc(100vh-200px)]">
        {/* File Tree */}
        <div className="w-64 flex-shrink-0 bg-gray-900 border border-gray-800 rounded-xl overflow-y-auto">
          <div className="p-3 border-b border-gray-800">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Project Files</p>
          </div>
          <div className="p-2">
            {Object.entries(groups).map(([groupName, files]) => (
              <div key={groupName} className="mb-2">
                <button
                  onClick={() => toggleGroup(groupName)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-medium text-gray-400 hover:text-white transition-colors"
                >
                  {expandedGroups[groupName] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  {groupName}
                </button>
                {expandedGroups[groupName] && (
                  <div className="ml-2 space-y-0.5">
                    {files.map((file) => (
                      <button
                        key={file.name}
                        onClick={() => setSelectedFile(file)}
                        className={`flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs transition-colors ${
                          selectedFile.name === file.name
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800'
                        }`}
                      >
                        <FileCode size={12} />
                        {file.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Code Display */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* File Header */}
          <div className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-t-xl px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-white">{selectedFile.name}</h3>
              <p className="text-[10px] text-gray-500 mt-0.5">{selectedFile.description}</p>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-300 transition-colors"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {/* Code Block */}
          <div className="flex-1 overflow-auto bg-[#1e1e1e] border border-gray-800 border-t-0 rounded-b-xl">
            <SyntaxHighlighter
              language={selectedFile.language === 'python' ? 'python' : selectedFile.language === 'text' ? 'text' : 'python'}
              style={vscDarkPlus}
              customStyle={{
                margin: 0,
                padding: '1rem',
                background: 'transparent',
                fontSize: '12px',
                lineHeight: '1.6',
              }}
              showLineNumbers
              lineNumberStyle={{ color: '#555', fontSize: '10px' }}
            >
              {selectedFile.content}
            </SyntaxHighlighter>
          </div>
        </div>
      </div>
    </div>
  );
}
