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
    <div className="flex flex-col gap-6 h-full">
      {/* Top Row: Chart and Bot Panel */}
      <div className="grid grid-cols-12 gap-6 h-[55%]">
        {/* Main Chart Area */}
        <div className="col-span-12 lg:col-span-8 xl:col-span-9 bg-gray-900/40 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-6 relative overflow-hidden group flex flex-col">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-purple-500/10 rounded-xl border border-purple-500/20">
                <BarChart3 size={20} className="text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">{selectedSymbol}/USDT</h3>
                <p className="text-xs text-gray-400 flex items-center gap-1.5">
                  <Activity size={10} className="text-emerald-400" />
                  Live Trading Data
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-1 bg-gray-800/50 p-1 rounded-xl border border-purple-500/10">
              {['1m', '5m', '15m', '1h', '4h', '1d'].map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all uppercase ${
                    timeframe.toLowerCase() === tf.toLowerCase()
                      ? 'bg-purple-500/20 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.2)]' 
                      : 'text-gray-500 hover:text-purple-300 hover:bg-purple-500/5'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex-1 w-full min-h-0">
            <Chart 
              data={chartData} 
              symbol={selectedSymbol} 
              indicators={indicators || {}} 
              timeframe={timeframe as any} 
              onTimeframeChange={setTimeframe} 
            />
          </div>
        </div>

        {/* Bot Panel (Top Right) */}
        <div className="hidden lg:flex lg:col-span-4 xl:col-span-3 flex-col bg-gray-900/40 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-6 relative group overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Bot size={80} className="text-purple-500" />
          </div>

          <div className="relative z-10 flex flex-col h-full">
            <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-widest text-gray-400">Automated Trading Bot</h3>
            
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
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 font-bold">STATUS:</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${botEnabled ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {botEnabled ? 'ACTIVE' : 'IDLE'}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-600 font-mono">BOT 1.7.65 % GY</div>
                </div>
              </div>
            </div>

            <div className="bg-black/20 rounded-2xl p-4 border border-white/5 mb-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                  <span className="text-xs font-bold text-white">{selectedSymbol} Ø</span>
                </div>
                <span className="text-xs font-bold text-emerald-400">+3.2% Profit</span>
              </div>
              {/* Sparkline Placeholder */}
              <div className="h-12 w-full bg-gradient-to-t from-emerald-500/5 to-transparent border-b border-emerald-500/20 rounded-b-lg" />
            </div>

            <div className="mt-auto">
              <button className="w-full py-3 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-2xl text-xs font-bold text-purple-400 transition-all uppercase tracking-widest">
                Bow Pot
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Order Book, Recent Trades, AI Chat */}
      <div className="grid grid-cols-12 gap-6 h-[40%]">
        <div className="col-span-12 md:col-span-4 h-full">
          <OrderBook trades={trades} />
        </div>
        <div className="col-span-12 md:col-span-4 h-full">
          <RecentTrades trades={trades} />
        </div>
        <div className="col-span-12 md:col-span-4 h-full flex flex-col gap-4">
          <div className="flex justify-end">
            <button className="flex items-center gap-2 px-6 py-2 bg-purple-500/20 border border-purple-500/30 rounded-2xl text-xs font-bold text-purple-400 hover:bg-purple-500/30 transition-all shadow-[0_0_15px_rgba(168,85,247,0.2)]">
              <MessageSquare size={14} />
              BOT CHAT
            </button>
          </div>
          
          {/* AI Chat Panel */}
          <div className="flex-1 bg-gray-900/40 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-6 flex flex-col relative group overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-xl border border-purple-500/20">
                  <Sparkles size={18} className="text-purple-400" />
                </div>
                <h3 className="text-xs font-bold text-white">AI Chat - Trading Assistant</h3>
              </div>
              <button className="text-gray-500 hover:text-white transition-colors">
                <Info size={14} />
              </button>
            </div>

            <div className="flex-1 bg-black/20 rounded-2xl p-4 border border-white/5 mb-4 overflow-y-auto custom-scrollbar">
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0 border border-purple-500/30">
                    <Bot size={16} className="text-purple-400" />
                  </div>
                  <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl rounded-tl-none p-3 text-[10px] text-purple-100 leading-relaxed">
                    Inflection for heads you with our trading today!
                  </div>
                </div>
                
                <div className="flex flex-col gap-2 items-end">
                  {['RANNIET SUMMARY', 'PLALY OILD VERICH', 'PERFORMANCY THREUT'].map((btn) => (
                    <button key={btn} className="px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-xl text-[9px] font-bold text-purple-400 transition-all">
                      {btn}
                    </button>
                  ))}
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
                className="w-full bg-black/40 border border-purple-500/20 rounded-2xl py-3 pl-4 pr-12 text-[10px] text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50 transition-all"
              />
              <button 
                onClick={onSendBotMessage}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition-all"
              >
                <Send size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
