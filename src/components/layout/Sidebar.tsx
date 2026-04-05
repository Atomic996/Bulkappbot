import React from 'react';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  LayoutDashboard, 
  Newspaper, 
  Bot, 
  BarChart3, 
  Terminal, 
  User,
  LogOut
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  onLogout: () => void;
}

const SidebarIcon = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => (
  <motion.button
    whileHover={{ scale: 1.1, x: 4 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className={`relative group flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 ${
      active 
        ? 'bg-purple-500/20 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)] border border-purple-500/30' 
        : 'text-gray-500 hover:text-purple-400 hover:bg-purple-500/10'
    }`}
  >
    <Icon size={22} strokeWidth={active ? 2.5 : 2} />
    
    {/* Tooltip */}
    <div className="absolute left-14 px-2 py-1 bg-gray-900 border border-purple-500/30 text-purple-400 text-xs rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
      {label}
    </div>
    
    {active && (
      <motion.div
        layoutId="activeIndicator"
        className="absolute -left-3 w-1 h-8 bg-purple-500 rounded-r-full shadow-[0_0_10px_#a855f7]"
      />
    )}
  </motion.button>
);

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onLogout }) => {
  return (
    <aside className="hidden lg:flex flex-col items-center py-8 w-20 bg-gray-900/50 border-r border-purple-500/20 backdrop-blur-xl z-30">
      <div className="mb-10">
        <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.5)]">
          <TrendingUp className="text-white" size={24} />
        </div>
      </div>
      
      <nav className="flex-1 flex flex-col gap-6">
        <SidebarIcon 
          icon={LayoutDashboard} 
          label="Assets" 
          active={activeTab === 'assets'} 
          onClick={() => setActiveTab('assets')} 
        />
        <SidebarIcon 
          icon={BarChart3} 
          label="Trade" 
          active={activeTab === 'analysis'} 
          onClick={() => setActiveTab('analysis')} 
        />
        <SidebarIcon 
          icon={Newspaper} 
          label="News" 
          active={activeTab === 'news'} 
          onClick={() => setActiveTab('news')} 
        />
        <SidebarIcon 
          icon={Bot} 
          label="Bot" 
          active={activeTab === 'bot'} 
          onClick={() => setActiveTab('bot')} 
        />
        <SidebarIcon 
          icon={TrendingUp} 
          label="Charts" 
          active={activeTab === 'technical'} 
          onClick={() => setActiveTab('technical')} 
        />
        <SidebarIcon 
          icon={Terminal} 
          label="Logs" 
          active={activeTab === 'logs'} 
          onClick={() => setActiveTab('logs')} 
        />
        <SidebarIcon 
          icon={User} 
          label="User" 
          active={activeTab === 'user'} 
          onClick={() => setActiveTab('user')} 
        />
      </nav>
      
      <div className="mt-auto">
        <SidebarIcon 
          icon={LogOut} 
          label="Logout" 
          active={false} 
          onClick={onLogout} 
        />
      </div>
    </aside>
  );
};
