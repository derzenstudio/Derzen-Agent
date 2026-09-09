import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Folder,
  File,
  FileText,
  FileImage,
  FileSpreadsheet,
  ChevronRight,
  Download,
  Trash2,
  Upload,
  Search,
  HardDrive,
  ArrowUp,
} from 'lucide-react';

interface FileItem {
  name: string;
  type: 'folder' | 'file';
  size?: string;
  modified: string;
  extension?: string;
  children?: FileItem[];
}

const mockFileSystem: FileItem = {
  name: 'C:/AI_Automation',
  type: 'folder',
  modified: '2025-01-15',
  children: [
    {
      name: 'Downloads',
      type: 'folder',
      modified: '2025-01-15',
      children: [
        { name: 'research_20250112.csv', type: 'file', size: '2.4 MB', modified: '2025-01-12', extension: '.csv' },
        { name: 'research_20250105.csv', type: 'file', size: '1.8 MB', modified: '2025-01-05', extension: '.csv' },
        { name: 'model_weights.bin', type: 'file', size: '4.2 GB', modified: '2025-01-10', extension: '.bin' },
        { name: 'tokenizer.json', type: 'file', size: '12 MB', modified: '2025-01-10', extension: '.json' },
      ],
    },
    {
      name: 'Reports',
      type: 'folder',
      modified: '2025-01-14',
      children: [
        { name: 'weekly_report_20250112.xlsx', type: 'file', size: '856 KB', modified: '2025-01-12', extension: '.xlsx' },
        { name: 'weekly_report_20250105.xlsx', type: 'file', size: '742 KB', modified: '2025-01-05', extension: '.xlsx' },
        { name: 'ai_analysis_summary.html', type: 'file', size: '45 KB', modified: '2025-01-12', extension: '.html' },
      ],
    },
    {
      name: 'Models',
      type: 'folder',
      modified: '2025-01-10',
      children: [
        { name: 'llama3.2', type: 'folder', modified: '2025-01-10' },
        { name: 'phi-2', type: 'folder', modified: '2025-01-08' },
        { name: 'mistral-7b', type: 'folder', modified: '2025-01-05' },
      ],
    },
    {
      name: 'Assets',
      type: 'folder',
      modified: '2025-01-14',
      children: [
        { name: 'logo.png', type: 'file', size: '245 KB', modified: '2025-01-01', extension: '.png' },
        { name: 'banner.jpg', type: 'file', size: '1.2 MB', modified: '2025-01-14', extension: '.jpg' },
        { name: 'chart_q1.png', type: 'file', size: '380 KB', modified: '2025-01-12', extension: '.png' },
      ],
    },
    {
      name: 'Logs',
      type: 'folder',
      modified: '2025-01-15',
      children: [
        { name: 'server.log', type: 'file', size: '156 KB', modified: '2025-01-15', extension: '.log' },
        { name: 'automation.log', type: 'file', size: '89 KB', modified: '2025-01-15', extension: '.log' },
        { name: 'pipeline_20250112.log', type: 'file', size: '34 KB', modified: '2025-01-12', extension: '.log' },
      ],
    },
    {
      name: 'BrowserData',
      type: 'folder',
      modified: '2025-01-15',
      children: [],
    },
    {
      name: 'Screenshots',
      type: 'folder',
      modified: '2025-01-14',
      children: [
        { name: 'screen_20250114_093000.png', type: 'file', size: '2.1 MB', modified: '2025-01-14', extension: '.png' },
        { name: 'screen_20250112_090015.png', type: 'file', size: '1.9 MB', modified: '2025-01-12', extension: '.png' },
      ],
    },
  ],
};

function getFileIcon(extension?: string) {
  switch (extension) {
    case '.csv':
    case '.xlsx':
      return <FileSpreadsheet size={16} className="text-green-400" />;
    case '.png':
    case '.jpg':
    case '.jpeg':
      return <FileImage size={16} className="text-blue-400" />;
    case '.log':
      return <FileText size={16} className="text-yellow-400" />;
    case '.html':
      return <FileText size={16} className="text-orange-400" />;
    case '.json':
      return <FileText size={16} className="text-purple-400" />;
    default:
      return <File size={16} className="text-gray-400" />;
  }
}

export default function FileManager() {
  const [currentPath, setCurrentPath] = useState<string[]>(['C:/AI_Automation']);
  const [currentItems, setCurrentItems] = useState<FileItem[]>(mockFileSystem.children || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [pathHistory, setPathHistory] = useState<FileItem[][]>([mockFileSystem.children || []]);

  const navigateToFolder = (folder: FileItem) => {
    setCurrentPath(prev => [...prev, folder.name]);
    const newItems = folder.children || [];
    setCurrentItems(newItems);
    setPathHistory(prev => [...prev, newItems]);
  };

  const navigateUp = () => {
    if (currentPath.length > 1) {
      const newPath = currentPath.slice(0, -1);
      setCurrentPath(newPath);
      const newHistory = pathHistory.slice(0, -1);
      setCurrentItems(newHistory[newHistory.length - 1] || []);
      setPathHistory(newHistory);
    }
  };

  const filteredItems = currentItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">File Manager</h1>
        <p className="text-gray-400 mt-1">
          Browse and manage files in the local Windows filesystem
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <button
          onClick={navigateUp}
          disabled={currentPath.length <= 1}
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-xs text-gray-300 transition-colors"
        >
          <ArrowUp size={14} />
          Up
        </button>
        <div className="flex-1 flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
          <HardDrive size={14} className="text-gray-500" />
          <span className="text-xs text-gray-400 font-mono">
            {currentPath.join(' / ')}
          </span>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-xs text-gray-300 placeholder-gray-600 w-48 focus:outline-none focus:border-gray-600"
          />
        </div>
        <button className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs text-white transition-colors">
          <Upload size={14} />
          Upload
        </button>
      </div>

      {/* Disk Usage */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Space', value: '500 GB', color: 'text-blue-400' },
          { label: 'Used', value: '127 GB', color: 'text-amber-400' },
          { label: 'Free', value: '373 GB', color: 'text-emerald-400' },
          { label: 'Usage', value: '25.4%', color: 'text-purple-400' },
        ].map((stat) => (
          <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-lg p-3">
            <p className="text-[10px] text-gray-500 uppercase">{stat.label}</p>
            <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* File List */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-4 py-2.5 bg-gray-800/50 border-b border-gray-800 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
          <div className="col-span-6">Name</div>
          <div className="col-span-2">Size</div>
          <div className="col-span-2">Modified</div>
          <div className="col-span-2">Actions</div>
        </div>

        {/* Files */}
        <div className="divide-y divide-gray-800/50">
          {filteredItems.map((item, i) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.02 }}
              className="grid grid-cols-12 gap-4 px-4 py-2.5 hover:bg-gray-800/30 transition-colors items-center"
            >
              <div className="col-span-6 flex items-center gap-2.5 min-w-0">
                {item.type === 'folder' ? (
                  <Folder size={16} className="text-amber-400 flex-shrink-0" />
                ) : (
                  getFileIcon(item.extension)
                )}
                <button
                  onClick={() => item.type === 'folder' && navigateToFolder(item)}
                  className={`text-sm truncate ${
                    item.type === 'folder'
                      ? 'text-white hover:text-emerald-400 cursor-pointer'
                      : 'text-gray-300'
                  }`}
                >
                  {item.name}
                </button>
                {item.type === 'folder' && <ChevronRight size={12} className="text-gray-600 flex-shrink-0" />}
              </div>
              <div className="col-span-2 text-xs text-gray-500">{item.size || '--'}</div>
              <div className="col-span-2 text-xs text-gray-500">{item.modified}</div>
              <div className="col-span-2 flex items-center gap-2">
                <button className="p-1 hover:bg-gray-700 rounded text-gray-500 hover:text-white transition-colors">
                  <Download size={12} />
                </button>
                <button className="p-1 hover:bg-gray-700 rounded text-gray-500 hover:text-red-400 transition-colors">
                  <Trash2 size={12} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {filteredItems.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-gray-500">No files found</p>
          </div>
        )}
      </div>

      {/* API Endpoints Info */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-3">File Manager API Endpoints</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {[
            { method: 'GET', path: '/api/files/list?directory=', desc: 'List files in directory' },
            { method: 'POST', path: '/api/files/upload', desc: 'Upload file to directory' },
            { method: 'GET', path: '/api/files/download/{filename}', desc: 'Download a file' },
            { method: 'DELETE', path: '/api/files/delete?filepath=', desc: 'Delete file/folder' },
          ].map((ep) => (
            <div key={ep.path} className="flex items-center gap-2 bg-gray-800/50 rounded-lg px-3 py-2">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                ep.method === 'GET' ? 'bg-blue-500/20 text-blue-400' :
                ep.method === 'POST' ? 'bg-green-500/20 text-green-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {ep.method}
              </span>
              <code className="text-[10px] text-gray-300 font-mono flex-1 truncate">{ep.path}</code>
              <span className="text-[10px] text-gray-500">{ep.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
