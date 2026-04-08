import React from 'react';
import { motion } from 'motion/react';
import { NewsFeed } from '../NewsFeed.js';
import { Newspaper, Activity, TrendingUp, Sparkles } from 'lucide-react';

interface NewsViewProps {
  news: any[];
  selectedSymbol: string;
  isLoading: boolean;
  error?: string | null;
}

export const NewsView: React.FC<NewsViewProps> = ({ news, selectedSymbol, isLoading, error }) => {
  return (
    <div className="grid grid-cols-12 gap-6 h-[calc(100vh-12rem)]">
      {/* News Sidebar - Market Sentiment */}
      <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
        <div className="bg-gray-900/40 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-8 relative group overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <Activity size={120} className="text-purple-500" />
          </div>
          
          <div className="flex items-center gap-4 mb-8 relative">
            <div className="p-3 bg-purple-500/10 rounded-2xl border border-purple-500/20">
              <Activity size={24} className="text-purple-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white tracking-tight">Market Sentiment</h3>
              <p className="text-xs text-gray-400">AI-Powered News Analysis</p>
            </div>
          </div>

          <div className="space-y-6 relative">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-300">Overall Sentiment</span>
              <span className="text-sm font-bold text-emerald-400 uppercase tracking-widest">Bullish</span>
            </div>
            
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden flex">
              <div className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{ width: '65%' }} />
              <div className="h-full bg-gray-600" style={{ width: '25%' }} />
              <div className="h-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]" style={{ width: '10%' }} />
            </div>

            <div className="grid grid-cols-3 gap-2 text-[10px] font-bold uppercase tracking-widest text-center">
              <div className="text-emerald-400">65% Positive</div>
              <div className="text-gray-500">25% Neutral</div>
              <div className="text-rose-400">10% Negative</div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Sparkles size={60} className="text-white" />
          </div>
          <h3 className="text-sm font-bold text-white mb-2 relative">Trending Topics</h3>
          <div className="flex flex-wrap gap-2 relative">
            {['#BitcoinETF', '#SolanaSummer', '#FedRates', '#CryptoRegulation', '#Layer2', '#DeFi'].map((tag, i) => (
              <span key={i} className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-[10px] font-bold text-purple-200 transition-all cursor-pointer">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Main News Feed Area */}
      <div className="col-span-12 lg:col-span-8 flex flex-col gap-6 overflow-hidden">
        <div className="flex-1 bg-gray-900/40 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-6 flex flex-col overflow-hidden group">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-purple-500/10 rounded-xl border border-purple-500/20">
                <Newspaper size={20} className="text-purple-400" />
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">{selectedSymbol} Market News</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Auto-refresh every 15m</span>
              <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
            <NewsFeed news={news} isLoading={isLoading} error={error} />
          </div>
        </div>
      </div>
    </div>
  );
};
