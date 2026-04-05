import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bot, 
  MessageSquare, 
  Send, 
  Sparkles, 
  Zap, 
  Activity, 
  TrendingUp, 
  TrendingDown,
  BarChart3,
  History,
  Info
} from 'lucide-react';
import { Chart } from '../Chart.js';
import { OrderBook } from '../OrderBook.js';
import { RecentTrades } from '../RecentTrades.js';

interface AnalysisViewProps {
  selectedSymbol: string;
  chartData: any[];
  indicators: any;
  timeframe: string;
  setTimeframe: (tf: any) => void;
  botEnabled: boolean;
  botStatus: string;
  botLogs: string[];
  botMessage: string;
  setBotMessage: (msg: string) => void;
  onSendBotMessage: () => void;
  showBotPanel: boolean;
  setShowBotPanel: (show: boolean) => void;
  trades?: any[];
}

export const AnalysisView: React.FC<AnalysisViewProps> = ({
  selectedSymbol,
  chartData,
  indicators,
  timeframe,
  setTimeframe,
  botEnabled,
  botStatus,
  botLogs,
  botMessage,
  setBotMessage,
  onSendBotMessage,
  showBotPanel,
  setShowBotPanel,
  trades = []
}) => {
  return (
    <div className="grid grid-cols-12 gap-6 h-[calc(100vh-12rem)]">
      {/* Main Chart Area */}
      <div className="col-span-12 lg:col-span-8 xl:col-span-9 flex flex-col gap-6 overflow-hidden">
        <div className="flex-1 bg-gray-900/40 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-purple-500/10 rounded-xl border border-purple-500/20">
                <BarChart3 size={20} className="text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">{selectedSymbol} Market Chart</h3>
                <p className="text-xs text-gray-400 flex items-center gap-1.5">
                  <Activity size={10} className="text-emerald-400" />
                  Live Trading Data
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-1 bg-gray-800/50 p-1 rounded-xl border border-purple-500/10">
              {['1M', '5M', '15M', '1H', '4H', '1D', '1W'].map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                    timeframe === tf 
                      ? 'bg-purple-500/20 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.2)]' 
                      : 'text-gray-500 hover:text-purple-300 hover:bg-purple-500/5'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
          
          <div className="h-[calc(100%-4rem)] w-full">
            <Chart 
              data={chartData} 
              symbol={selectedSymbol} 
              indicators={indicators || {}} 
              timeframe={timeframe as any} 
              onTimeframeChange={setTimeframe} 
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-80">
          <OrderBook trades={trades} />
          <RecentTrades trades={trades} />
        </div>
      </div>

      {/* Right Sidebar - Bot & AI */}
      <div className="hidden lg:flex lg:col-span-4 xl:col-span-3 flex-col gap-6 overflow-hidden">
        {/* Bot Status Card */}
        <div className="bg-gray-900/40 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-6 relative group">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl border transition-all ${
                botEnabled 
                  ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]' 
                  : 'bg-rose-500/10 border-rose-500/30'
              }`}>
                <Bot size={20} className={botEnabled ? 'text-emerald-400' : 'text-rose-400'} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Trading Bot</h3>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${botEnabled ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${botEnabled ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {botStatus}
                  </span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setShowBotPanel(!showBotPanel)}
              className="p-2 hover:bg-purple-500/10 rounded-xl transition-colors text-gray-400 hover:text-purple-400"
            >
              <Info size={18} />
            </button>
          </div>

          <div className="space-y-4">
            <div className="bg-black/40 rounded-2xl p-4 border border-white/5 h-48 overflow-y-auto font-mono text-[10px] custom-scrollbar">
              {botLogs.length === 0 ? (
                <div className="text-gray-600 italic">Waiting for logs...</div>
              ) : (
                botLogs.map((log, i) => (
                  <div key={i} className="mb-1.5 flex gap-2">
                    <span className="text-purple-500/50 shrink-0">[{i}]</span>
                    <span className={log.includes('❌') ? 'text-rose-400' : log.includes('✅') ? 'text-emerald-400' : 'text-gray-400'}>
                      {log}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* AI Assistant Card */}
        <div className="flex-1 bg-gray-900/40 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-6 flex flex-col relative group overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Sparkles size={80} className="text-purple-500" />
          </div>
          
          <div className="flex items-center gap-3 mb-6 relative">
            <div className="p-2 bg-purple-500/10 rounded-xl border border-purple-500/20">
              <Sparkles size={20} className="text-purple-400" />
            </div>
            <h3 className="text-sm font-bold text-white">AI Market Assistant</h3>
          </div>

          <div className="flex-1 bg-black/20 rounded-2xl p-4 border border-white/5 mb-4 overflow-y-auto custom-scrollbar relative">
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0 border border-purple-500/30">
                  <Bot size={16} className="text-purple-400" />
                </div>
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl rounded-tl-none p-3 text-xs text-purple-100 leading-relaxed">
                  Hello! I'm your AI trading assistant. How can I help you analyze the {selectedSymbol} market today?
                </div>
              </div>
            </div>
          </div>

          <div className="relative">
            <input
              type="text"
              value={botMessage}
              onChange={(e) => setBotMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && onSendBotMessage()}
              placeholder="Ask about market trends..."
              className="w-full bg-black/40 border border-purple-500/20 rounded-2xl py-3 pl-4 pr-12 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
            />
            <button 
              onClick={onSendBotMessage}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition-all shadow-[0_0_15px_rgba(168,85,247,0.4)]"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
