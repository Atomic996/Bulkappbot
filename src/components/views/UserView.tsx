import React from 'react';
import { motion } from 'motion/react';
import { 
  User, 
  Settings, 
  Shield, 
  Wallet, 
  History, 
  Bell, 
  Key, 
  LogOut, 
  ChevronRight, 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  Copy, 
  ExternalLink 
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';

interface UserViewProps {
  onLogout: () => void;
}

export const UserView: React.FC<UserViewProps> = ({ onLogout }) => {
  const { publicKey, connected } = useWallet();

  const copyAddress = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toBase58());
    }
  };

  return (
    <div className="grid grid-cols-12 gap-6 h-[calc(100vh-12rem)]">
      {/* Profile Sidebar */}
      <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
        <div className="bg-gray-900/40 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-8 relative group overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <User size={120} className="text-purple-500" />
          </div>
          
          <div className="flex flex-col items-center text-center relative">
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-purple-600 to-blue-600 p-1 shadow-[0_0_30px_rgba(168,85,247,0.4)]">
                <div className="w-full h-full bg-gray-900 rounded-[22px] flex items-center justify-center overflow-hidden">
                  <User size={48} className="text-purple-400" />
                </div>
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-500 border-4 border-gray-900 rounded-full flex items-center justify-center shadow-lg">
                <CheckCircle2 size={14} className="text-white" />
              </div>
            </div>
            
            <h3 className="text-xl font-bold text-white mb-2">Pro Trader</h3>
            <div className="flex items-center gap-2 px-3 py-1 bg-purple-500/10 rounded-full border border-purple-500/20 mb-6">
              <Shield size={12} className="text-purple-400" />
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Verified Account</span>
            </div>

            <div className="w-full space-y-3">
              <div className="p-4 bg-black/20 rounded-2xl border border-white/5 flex items-center justify-between group/item">
                <div className="flex items-center gap-3">
                  <Wallet size={16} className="text-gray-500 group-hover/item:text-purple-400 transition-colors" />
                  <div className="text-left">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Wallet Address</p>
                    <p className="text-xs font-mono text-gray-300">
                      {publicKey ? `${publicKey.toBase58().slice(0, 6)}...${publicKey.toBase58().slice(-6)}` : 'Not Connected'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={copyAddress}
                  className="p-2 hover:bg-purple-500/10 rounded-lg transition-colors text-gray-500 hover:text-purple-400"
                >
                  <Copy size={14} />
                </button>
              </div>

              <div className="p-4 bg-black/20 rounded-2xl border border-white/5 flex items-center justify-between group/item">
                <div className="flex items-center gap-3">
                  <Activity size={16} className="text-gray-500 group-hover/item:text-purple-400 transition-colors" />
                  <div className="text-left">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Network Status</p>
                    <p className="text-xs font-mono text-emerald-400">Mainnet Beta</p>
                  </div>
                </div>
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
              </div>
            </div>
          </div>
        </div>

        <button 
          onClick={onLogout}
          className="w-full p-4 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-2xl flex items-center justify-center gap-3 text-rose-400 font-bold text-sm transition-all group"
        >
          <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
          Sign Out Session
        </button>
      </div>

      {/* Settings & History */}
      <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
        <div className="bg-gray-900/40 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500/10 rounded-2xl border border-purple-500/20">
                <Settings size={24} className="text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">Account Settings</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: 'Security & Privacy', desc: 'Manage 2FA and session keys', icon: Key },
              { label: 'Notifications', desc: 'Configure price alerts and bot logs', icon: Bell },
              { label: 'Trading History', desc: 'View all past orders and PnL', icon: History },
              { label: 'Connected Apps', desc: 'Manage API and wallet permissions', icon: ExternalLink }
            ].map((item, i) => (
              <button key={i} className="p-5 bg-black/20 rounded-2xl border border-white/5 hover:border-purple-500/20 transition-all text-left flex items-start justify-between group/item">
                <div className="flex gap-4">
                  <div className="p-2.5 bg-purple-500/5 rounded-xl border border-purple-500/10 group-hover/item:bg-purple-500/10 transition-colors">
                    <item.icon size={20} className="text-purple-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white mb-1">{item.label}</h4>
                    <p className="text-[10px] text-gray-500 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-600 group-hover/item:text-purple-400 group-hover/item:translate-x-1 transition-all" />
              </button>
            ))}
          </div>
        </div>

        <div className="bg-gray-900/40 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-8 flex-1">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500/10 rounded-2xl border border-purple-500/20">
                <History size={24} className="text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">Recent Activity</h3>
            </div>
            <button className="text-[10px] font-bold text-purple-400 uppercase tracking-widest hover:text-purple-300 transition-colors">View All</button>
          </div>

          <div className="space-y-4">
            {[
              { type: 'Login', desc: 'New session started from Chrome (Windows)', time: '2h ago', icon: Info, color: 'blue' },
              { type: 'Trade', desc: 'Executed BUY order for 0.05 BTC-USD', time: '5h ago', icon: CheckCircle2, color: 'emerald' },
              { type: 'Security', desc: 'Session key authorized for trading', time: '1d ago', icon: Shield, color: 'purple' }
            ].map((act, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5 hover:border-purple-500/20 transition-all group/item">
                <div className="flex items-center gap-4">
                  <div className={`p-2 bg-${act.color}-500/10 rounded-xl border border-${act.color}-500/20`}>
                    <act.icon size={16} className={`text-${act.color}-400`} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white mb-0.5">{act.type}</h4>
                    <p className="text-[10px] text-gray-500">{act.desc}</p>
                  </div>
                </div>
                <span className="text-[10px] text-gray-600 font-mono">{act.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
