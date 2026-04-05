import React from 'react';
import { motion } from 'motion/react';
import { 
  ChevronDown, 
  Wallet, 
  Menu, 
  Clock, 
  Zap,
  TrendingUp,
  LayoutDashboard,
  BarChart3,
  Newspaper,
  Bot,
  Terminal,
  User
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

interface TopNavProps {
  selectedSymbol: string;
  setShowAssetDrawer: (show: boolean) => void;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  currentTime: string;
}

export const TopNav: React.FC<TopNavProps> = ({ 
  selectedSymbol, 
  setShowAssetDrawer, 
  activeTab, 
  setActiveTab, 
  currentTime 
}) => {
  const { connected } = useWallet();

  return (
    <header className="h-16 flex items-center justify-between px-4 lg:px-8 border-b border-purple-500/20 bg-gray-900/50 backdrop-blur-xl sticky top-0 z-40">
      <div className="flex items-center gap-4 lg:gap-8">
        <div className="lg:hidden w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.5)]">
          <TrendingUp className="text-white" size={18} />
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowAssetDrawer(true)}
            className="flex items-center gap-3 px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-xl transition-all group"
          >
            <div className="w-6 h-6 bg-purple-500/20 rounded-full flex items-center justify-center">
              <Zap size={14} className="text-purple-400 group-hover:scale-110 transition-transform" />
            </div>
            <span className="font-bold text-purple-100 tracking-wider">{selectedSymbol} / USD</span>
            <ChevronDown size={16} className="text-purple-400 group-hover:translate-y-0.5 transition-transform" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-gray-800/50 rounded-lg border border-purple-500/10 text-xs font-mono text-purple-400">
          <Clock size={14} />
          {currentTime}
        </div>
        
        <div className="wallet-adapter-wrapper">
          <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700 !h-10 !rounded-xl !px-6 !text-sm !font-bold !transition-all !shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:!shadow-[0_0_30px_rgba(168,85,247,0.5)] !border-none" />
        </div>
        
        <button className="lg:hidden p-2 text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors">
          <Menu size={24} />
        </button>
      </div>
    </header>
  );
};
