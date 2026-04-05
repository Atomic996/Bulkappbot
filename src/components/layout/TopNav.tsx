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
  User,
  Link as LinkIcon
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
  const { connected, publicKey } = useWallet();

  return (
    <header className="h-20 flex items-center justify-between px-4 lg:px-8 bg-transparent z-40">
      <div className="flex items-center gap-4 lg:gap-8">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowAssetDrawer(true)}
            className="flex items-center gap-3 px-4 py-2 bg-purple-500/5 hover:bg-purple-500/10 border border-purple-500/20 rounded-xl transition-all group"
          >
            <div className="w-6 h-6 bg-purple-500/20 rounded-full flex items-center justify-center">
              <Zap size={14} className="text-purple-400 group-hover:scale-110 transition-transform" />
            </div>
            <span className="font-bold text-purple-100 tracking-wider">{selectedSymbol}/USDT</span>
            <ChevronDown size={16} className="text-purple-400 group-hover:translate-y-0.5 transition-transform" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-gray-800/30 rounded-lg border border-purple-500/10 text-xs font-mono text-purple-400/60">
          <Clock size={14} />
          {currentTime}
        </div>
        
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
          <div className="relative flex items-center gap-4 bg-gray-900/80 border border-purple-500/30 rounded-2xl p-1 pr-4">
            <div className="wallet-adapter-wrapper">
              <WalletMultiButton className="!bg-transparent !h-12 !rounded-xl !px-6 !text-xs !font-bold !transition-all !border-none !shadow-none hover:!bg-purple-500/10" />
            </div>
            <div className="flex flex-col items-end border-l border-purple-500/20 pl-4">
              <div className="flex items-center gap-2 text-purple-400">
                <span className="text-[10px] font-bold">0.00 ETH</span>
                <LinkIcon size={12} />
              </div>
            </div>
          </div>
        </div>
        
        <button className="lg:hidden p-2 text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors">
          <Menu size={24} />
        </button>
      </div>
    </header>
  );
};
