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
    whileHover={{ scale: 1.05, x: 2 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className={`relative group flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-all duration-300 ${
      active 
        ? 'bg-purple-500/20 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)] border border-purple-500/30' 
        : 'text-gray-500 hover:text-purple-400 hover:bg-purple-500/10'
    }`}
  >
    <Icon size={20} strokeWidth={active ? 2.5 : 2} />
    <span className={`text-[8px] mt-1 font-black uppercase tracking-wider ${active ? 'text-purple-400' : 'text-gray-600'}`}>
      {label}
    </span>
    
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
    <aside className="hidden lg:flex flex-col items-center py-8 w-24 bg-gray-900/50 border-r border-purple-500/20 backdrop-blur-xl z-30">
      <div className="mb-10">
        <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center border border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.2)]">
          <div className="w-6 h-6 rounded-full border-4 border-purple-500 border-t-transparent animate-[spin_3s_linear_infinite]" />
        </div>
      </div>
      
      <nav className="flex-1 flex flex-col gap-6">
        <SidebarIcon 
          icon={LayoutDashboard} 
          label="Dashboard" 
          active={activeTab === 'assets'} 
          onClick={() => setActiveTab('assets')} 
        />
        <SidebarIcon 
          icon={BarChart3} 
          label="Trading" 
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
          label="Technical" 
          active={activeTab === 'technical'} 
          onClick={() => setActiveTab('technical')} 
        />
        <SidebarIcon 
          icon={User} 
          label="Profile" 
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
