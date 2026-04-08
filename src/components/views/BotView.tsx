import React from 'react';
import { motion } from 'motion/react';
import { 
  Bot, 
  Settings, 
  Play, 
  Square, 
  Activity, 
  Zap, 
  Shield, 
  TrendingUp, 
  BarChart3, 
  History,
  ChevronRight,
  Cpu
} from 'lucide-react';

interface BotViewProps {
  botEnabled: boolean;
  botStatus: string;
  botLogs: string[];
  onToggleBot: (enabled: boolean) => void;
}

export const BotView: React.FC<BotViewProps> = ({ 
  botEnabled, 
  botStatus, 
  botLogs, 
  onToggleBot 
}) => {
  return (
    <div className="grid grid-cols-12 gap-6 h-[calc(100vh-12rem)]">
      {/* Bot Controls & Stats */}
      <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
        <div className="bg-gray-900/40 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-8 relative group overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <Bot size={120} className="text-purple-500" />
          </div>
          
          <div className="flex items-center gap-4 mb-8 relative">
            <div className={`p-3 rounded-2xl border transition-all ${
              botEnabled 
                ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.3)]' 
                : 'bg-rose-500/10 border-rose-500/30'
            }`}>
              <Bot size={24} className={botEnabled ? 'text-emerald-400' : 'text-rose-400'} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white tracking-tight">Trading Engine</h3>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full animate-pulse ${botEnabled ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                <span className={`text-[10px] font-bold uppercase tracking-widest ${botEnabled ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {botStatus}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4 relative">
            <button 
              onClick={() => onToggleBot(!botEnabled)}
              className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-bold text-sm transition-all group ${
                botEnabled 
                  ? 'bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400' 
                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400'
              }`}
            >
              {botEnabled ? (
                <>
                  <Square size={18} className="group-hover:scale-110 transition-transform" />
                  Stop Trading Engine
                </>
              ) : (
                <>
                  <Play size={18} className="group-hover:scale-110 transition-transform" />
                  Start Trading Engine
                </>
              )}
            </button>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-black/20 rounded-2xl border border-white/5">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Win Rate</p>
                <p className="text-lg font-bold text-emerald-400">68.4%</p>
              </div>
              <div className="p-4 bg-black/20 rounded-2xl border border-white/5">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Total Trades</p>
                <p className="text-lg font-bold text-purple-400">142</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-900/40 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-6">
          <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
            <Settings size={18} className="text-purple-400" />
            Strategy Settings
          </h3>
          <div className="space-y-4">
            {[
              { label: 'Risk Per Trade', value: '2.0%', icon: Shield },
              { label: 'Max Positions', value: '3', icon: BarChart3 },
              { label: 'TP/SL Ratio', value: '2.5', icon: Zap },
              { label: 'Min Confidence', value: '68%', icon: Activity }
            ].map((setting, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-black/20 rounded-2xl border border-white/5 group/item">
                <div className="flex items-center gap-3">
                  <setting.icon size={14} className="text-gray-500 group-hover/item:text-purple-400 transition-colors" />
                  <span className="text-xs font-medium text-gray-300">{setting.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">{setting.value}</span>
                  <ChevronRight size={12} className="text-gray-600" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bot Logs & Performance */}
      <div className="col-span-12 lg:col-span-8 flex flex-col gap-6 overflow-hidden">
        <div className="flex-1 bg-gray-900/40 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-6 flex flex-col overflow-hidden group">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-purple-500/10 rounded-xl border border-purple-500/20">
                <History size={20} className="text-purple-400" />
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">Execution Logs</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Live Stream</span>
            </div>
          </div>
          
          <div className="flex-1 bg-black/40 rounded-2xl p-6 border border-white/5 overflow-y-auto custom-scrollbar font-mono text-xs">
            {botLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-4">
                <Cpu size={48} className="opacity-20 animate-pulse" />
                <p className="text-sm tracking-widest uppercase font-bold opacity-40">Initializing Bot Stream...</p>
              </div>
            ) : (
              <div className="space-y-2">
                {botLogs.map((log, i) => (
                  <div key={i} className="flex gap-4 group/line">
                    <span className="text-purple-500/30 select-none w-8 text-right">{i + 1}</span>
                    <span className={log.includes('❌') ? 'text-rose-400' : log.includes('✅') ? 'text-emerald-400' : 'text-gray-400'}>
                      {log}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-gray-900/40 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-6 h-48 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp size={80} className="text-purple-500" />
          </div>
          <h3 className="text-sm font-bold text-white mb-4">Performance Insights</h3>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Total PnL</p>
              <p className="text-xl font-bold text-emerald-400">+$1,240.42</p>
              <p className="text-[10px] text-emerald-500/50 mt-1">+12.4% this month</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Avg. Trade</p>
              <p className="text-xl font-bold text-white">+$42.50</p>
              <p className="text-[10px] text-gray-500 mt-1">Based on 142 trades</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Drawdown</p>
              <p className="text-xl font-bold text-rose-400">-4.2%</p>
              <p className="text-[10px] text-rose-500/50 mt-1">Max historical</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
