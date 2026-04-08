import React from 'react';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  BarChart3, 
  Zap, 
  DollarSign, 
  Info, 
  ArrowUpRight, 
  ArrowDownRight, 
  Target, 
  ShieldCheck, 
  AlertTriangle 
} from 'lucide-react';

import { AssetSignal } from '../../types.js';

interface TechnicalViewProps {
  selectedSymbol: string;
  technicalScore: number;
  signal: AssetSignal;
}

export const TechnicalView: React.FC<TechnicalViewProps> = ({ selectedSymbol, technicalScore, signal }) => {
  const getScoreColor = (score: number) => {
    if (score > 70) return 'emerald';
    if (score < 30) return 'rose';
    return 'amber';
  };

  const scoreColor = getScoreColor(technicalScore);

  return (
    <div className="grid grid-cols-12 gap-6 h-[calc(100vh-12rem)]">
      {/* Left Column - Score & Indicators */}
      <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
        <div className="bg-gray-900/40 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-8 relative group overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp size={120} className="text-purple-500" />
          </div>
          
          <div className="flex items-center justify-between mb-8 relative">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500/10 rounded-2xl border border-purple-500/20">
                <Target size={24} className="text-purple-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight">{selectedSymbol} Technical Analysis</h3>
                <p className="text-xs text-gray-400 flex items-center gap-1.5">
                  <Activity size={12} className="text-purple-500" />
                  Real-time Indicator Aggregation
                </p>
              </div>
            </div>
            
            <div className="flex flex-col items-end">
              <div className={`text-5xl font-black text-${scoreColor}-400 drop-shadow-[0_0_15px_rgba(var(--${scoreColor}-500-rgb),0.3)]`}>
                {technicalScore.toFixed(0)}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mt-1">Aggregated Score</span>
            </div>
          </div>

          {/* Indicators Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 relative">
            {[
              { label: 'RSI (14)', value: '64.2', status: 'Bullish', trend: 'up', color: 'emerald' },
              { label: 'MACD', value: '0.42', status: 'Neutral', trend: 'neutral', color: 'amber' },
              { label: 'EMA (20/50)', value: 'Cross', status: 'Golden Cross', trend: 'up', color: 'emerald' },
              { label: 'Stochastic', value: '82.1', status: 'Overbought', trend: 'down', color: 'rose' },
              { label: 'Bollinger', value: 'Upper', status: 'Resistance', trend: 'down', color: 'rose' },
              { label: 'Volume', value: '+12%', status: 'Increasing', trend: 'up', color: 'emerald' }
            ].map((ind, i) => (
              <div key={i} className="p-4 bg-black/20 rounded-2xl border border-white/5 hover:border-purple-500/20 transition-all group/item">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{ind.label}</span>
                  {ind.trend === 'up' ? <ArrowUpRight size={14} className="text-emerald-400" /> : ind.trend === 'down' ? <ArrowDownRight size={14} className="text-rose-400" /> : <Activity size={14} className="text-amber-400" />}
                </div>
                <div className="flex items-end justify-between">
                  <span className="text-lg font-bold text-white">{ind.value}</span>
                  <span className={`text-[10px] font-bold text-${ind.color}-400 uppercase tracking-widest`}>{ind.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-900/40 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-6">
            <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
              <ShieldCheck size={18} className="text-emerald-400" />
              Support Levels
            </h3>
            <div className="space-y-4">
              {[
                { label: 'S1 (Immediate)', price: '64,200', strength: 'Strong' },
                { label: 'S2 (Major)', price: '63,500', strength: 'Critical' },
                { label: 'S3 (Psychological)', price: '60,000', strength: 'High' }
              ].map((s, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                  <span className="text-xs font-medium text-gray-300">{s.label}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-bold text-white font-mono">${s.price}</span>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">{s.strength}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-900/40 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-6">
            <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
              <AlertTriangle size={18} className="text-rose-400" />
              Resistance Levels
            </h3>
            <div className="space-y-4">
              {[
                { label: 'R1 (Immediate)', price: '65,800', strength: 'Moderate' },
                { label: 'R2 (Major)', price: '67,200', strength: 'Strong' },
                { label: 'R3 (All-Time)', price: '73,800', strength: 'Critical' }
              ].map((r, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-rose-500/5 rounded-xl border border-rose-500/10">
                  <span className="text-xs font-medium text-gray-300">{r.label}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-bold text-white font-mono">${r.price}</span>
                    <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">{r.strength}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right Column - Strategy & Signals */}
      <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
        <div className="bg-gray-900/40 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-6 flex-1">
          <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
            <Zap size={18} className="text-purple-400" />
            Active Signals
          </h3>
          
          <div className="space-y-4">
            {[
              { type: 'BUY', symbol: 'BTC', price: '64,520', time: '2m ago', confidence: '84%' },
              { type: 'SELL', symbol: 'ETH', price: '3,420', time: '15m ago', confidence: '62%' },
              { type: 'BUY', symbol: 'SOL', price: '142.5', time: '42m ago', confidence: '91%' }
            ].map((sig, i) => (
              <div key={i} className="p-4 bg-black/20 rounded-2xl border border-white/5 hover:border-purple-500/20 transition-all group/item">
                <div className="flex items-center justify-between mb-3">
                  <div className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                    sig.type === 'BUY' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {sig.type}
                  </div>
                  <span className="text-[10px] text-gray-500 font-mono">{sig.time}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{sig.symbol}</span>
                    <span className="text-xs text-gray-400 font-mono">${sig.price}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs font-bold text-purple-400">{sig.confidence}</span>
                    <span className="text-[8px] text-gray-500 uppercase tracking-widest">Confidence</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Zap size={60} className="text-white" />
          </div>
          <h3 className="text-sm font-bold text-white mb-2 relative">Pro Strategy Insight</h3>
          <p className="text-xs text-purple-200/70 leading-relaxed relative">
            Market regime is currently <span className="text-white font-bold">TRENDING BULLISH</span>. 
            Indicators suggest accumulation near 64k support. Recommended strategy: 
            <span className="text-emerald-400 font-bold"> Long on retest of EMA-20</span>.
          </p>
          <button className="mt-4 w-full py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-[10px] font-bold uppercase tracking-widest text-white transition-all">
            View Full Strategy
          </button>
        </div>
      </div>
    </div>
  );
};
