import { type Page } from '../App';
import {
  LayoutDashboard,
  Network,
  Code2,
  Settings,
  FolderTree,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Bot,
} from 'lucide-react';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const navItems: { page: Page; label: string; icon: React.ReactNode }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  { page: 'architecture', label: 'Architecture', icon: <Network size={20} /> },
  { page: 'code', label: 'Source Code', icon: <Code2 size={20} /> },
  { page: 'setup', label: 'Setup Guide', icon: <Settings size={20} /> },
  { page: 'files', label: 'File Manager', icon: <FolderTree size={20} /> },
  { page: 'scheduler', label: 'Scheduler', icon: <CalendarClock size={20} /> },
];

export default function Sidebar({ currentPage, onNavigate, isOpen, onToggle }: SidebarProps) {
  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-gray-900 border-r border-gray-800 transition-all duration-300 z-50 flex flex-col ${
        isOpen ? 'w-64' : 'w-16'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-800">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
          <Bot size={18} className="text-gray-900" />
        </div>
        {isOpen && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold text-white whitespace-nowrap">AI Automation Hub</h1>
            <p className="text-[10px] text-gray-400 whitespace-nowrap">Chrome Agent Controller</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {navItems.map(({ page, label, icon }) => (
          <button
            key={page}
            onClick={() => onNavigate(page)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
              currentPage === page
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
            title={label}
          >
            <span className="flex-shrink-0">{icon}</span>
            {isOpen && <span className="whitespace-nowrap">{label}</span>}
          </button>
        ))}
      </nav>

      {/* Status indicator */}
      {isOpen && (
        <div className="px-4 py-3 border-t border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-gray-400">System Active</span>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-7 w-6 h-6 bg-gray-800 border border-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
      >
        {isOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
      </button>
    </aside>
  );
}
