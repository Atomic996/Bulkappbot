import React from 'react';
import { motion } from 'motion/react';
import { 
  Terminal, 
  Activity, 
  Server, 
  Cpu, 
  Database, 
  ShieldCheck, 
  AlertCircle, 
  Info, 
  CheckCircle2, 
  Search, 
  Trash2, 
  Download, 
  RefreshCcw 
} from 'lucide-react';

interface LogsViewProps {
  botLogs: string[];
}

export const LogsView: React.FC<LogsViewProps> = ({ botLogs }) => {
  return (
    <div className="grid grid-cols-12 gap-6 h-[calc(100vh-12rem)]">
      {/* Sidebar - Log Stats */}
      <div className="col-span-12 lg:col-span-3 flex flex-col gap-6">
        <div className="bg-gray-900/40 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-6 relative group overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Activity size={80} className="text-purple-500" />
          </div>
          
          <div className="flex items-center gap-3 mb-6 relative">
            <div className="p-2 bg-purple-500/10 rounded-xl border border-purple-500/20">
              <Activity size={20} className="text-purple-400" />
            </div>
            <h3 className="text-sm font-bold text-white">System Health</h3>
          </div>

          <div className="space-y-4 relative">
            {[
              { label: 'Vercel Edge', status: 'Operational', icon: Server, color: 'emerald' },
              { label: 'Railway DB', status: 'Healthy', icon: Database, color: 'emerald' },
              { label: 'Bot Engine', status: 'Active', icon: Cpu, color: 'purple' },
              { label: 'Security', status: 'Shielded', icon: ShieldCheck, color: 'blue' }
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-black/20 rounded-2xl border border-white/5 hover:border-purple-500/20 transition-all group/item">
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 bg-${item.color}-500/10 rounded-lg border border-${item.color}-500/20 group-hover/item:scale-110 transition-transform`}>
                    <item.icon size={14} className={`text-${item.color}-400`} />
                  </div>
                  <span className="text-xs font-medium text-gray-300">{item.label}</span>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider text-${item.color}-400`}>{item.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-900/40 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-6">
          <h3 className="text-sm font-bold text-white mb-4">Log Filters</h3>
          <div className="space-y-2">
            {[
              { label: 'All Logs', count: botLogs.length, icon: Terminal, active: true },
              { label: 'Errors', count: botLogs.filter(l => l.includes('❌')).length, icon: AlertCircle, active: false },
              { label: 'Success', count: botLogs.filter(l => l.includes('✅')).length, icon: CheckCircle2, active: false },
              { label: 'System', count: 12, icon: Info, active: false }
            ].map((filter, i) => (
              <button
                key={i}
                className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all ${
                  filter.active 
                    ? 'bg-purple-500/20 border-purple-500/30 text-purple-400' 
                    : 'bg-black/20 border-white/5 text-gray-400 hover:border-purple-500/20 hover:text-purple-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <filter.icon size={14} />
                  <span className="text-xs font-medium">{filter.label}</span>
                </div>
                <span className="text-[10px] font-bold bg-black/40 px-2 py-0.5 rounded-full border border-white/5">{filter.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Terminal Area */}
      <div className="col-span-12 lg:col-span-9 flex flex-col gap-6 overflow-hidden">
        <div className="flex-1 bg-black/60 backdrop-blur-2xl border border-purple-500/20 rounded-3xl flex flex-col overflow-hidden shadow-2xl relative group">
          {/* Terminal Header */}
          <div className="h-12 bg-gray-900/80 border-b border-purple-500/20 px-6 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-rose-500/50 border border-rose-500/30" />
                <div className="w-3 h-3 rounded-full bg-amber-500/50 border border-amber-500/30" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/50 border border-emerald-500/30" />
              </div>
              <div className="h-4 w-px bg-purple-500/20 mx-2" />
              <div className="flex items-center gap-2 text-xs font-mono text-purple-400/70">
                <Terminal size={14} />
                <span>system_logs_v2.log</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input 
                  type="text" 
                  placeholder="Search logs..." 
                  className="bg-black/40 border border-purple-500/20 rounded-lg py-1.5 pl-9 pr-4 text-[10px] text-white focus:outline-none focus:border-purple-500/50 transition-all w-48"
                />
              </div>
              <button className="p-2 hover:bg-purple-500/10 rounded-lg transition-colors text-gray-400 hover:text-purple-400">
                <Download size={14} />
              </button>
              <button className="p-2 hover:bg-purple-500/10 rounded-lg transition-colors text-gray-400 hover:text-purple-400">
                <RefreshCcw size={14} />
              </button>
              <button className="p-2 hover:bg-rose-500/10 rounded-lg transition-colors text-gray-400 hover:text-rose-400">
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* Terminal Content */}
          <div className="flex-1 p-6 font-mono text-xs overflow-y-auto custom-scrollbar bg-gradient-to-b from-black/20 to-transparent">
            {botLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-4">
                <Terminal size={48} className="opacity-20 animate-pulse" />
                <p className="text-sm tracking-widest uppercase font-bold opacity-40">Initializing Terminal Stream...</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {botLogs.map((log, i) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.01 }}
                    key={i} 
                    className="group/line flex gap-4 hover:bg-purple-500/5 py-0.5 px-2 rounded transition-colors"
                  >
                    <span className="text-purple-500/30 select-none w-8 text-right">{i + 1}</span>
                    <span className="text-gray-400 group-hover/line:text-purple-300 transition-colors">
                      {log}
                    </span>
                  </motion.div>
                ))}
                <div className="flex gap-4 py-0.5 px-2">
                  <span className="text-purple-500/30 select-none w-8 text-right">{botLogs.length + 1}</span>
                  <span className="text-purple-400 animate-pulse">_</span>
                </div>
              </div>
            )}
          </div>

          {/* Terminal Footer */}
          <div className="h-8 bg-gray-900/80 border-t border-purple-500/20 px-6 flex items-center justify-between text-[10px] font-mono text-gray-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                LIVE STREAMING
              </span>
              <span>UTF-8</span>
              <span>LF</span>
            </div>
            <div className="flex items-center gap-4">
              <span>Ln {botLogs.length + 1}, Col 1</span>
              <span>100%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
