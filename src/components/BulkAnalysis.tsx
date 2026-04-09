import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Activity, 
  ArrowUpRight, 
  ArrowDownRight, 
  Wallet as WalletIcon, 
  History,
  TrendingUp,
  TrendingDown,
  Zap,
  Shield,
  Target,
  AlertCircle
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const BULK_WS_URL = "wss://exchange-ws1.bulk.trade";

interface BulkTrade {
  symbol: string;
  price: number;
  size: number;
  side: 'buy' | 'sell';
  walletId: string;
  timestamp: number;
}

interface WalletState {
  id: string;
  position: 'flat' | 'long' | 'short';
  entryPrice: number | null;
  entrySize: number;
  totalPnL: number;
  winCount: number;
  tradeCount: number;
  history: any[];
  lastUpdate: number;
}

const BACKEND_URL = "https://bulkappbot-production.up.railway.app";
const BACKEND_WS_URL = "wss://bulkappbot-production.up.railway.app";

const STORAGE_KEY_TRADES = 'sentinel_bulk_trades';
const STORAGE_KEY_WALLETS = 'sentinel_bulk_wallets';

export const BulkAnalysis: React.FC = () => {
  const [trades, setTrades] = useState<BulkTrade[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_TRADES);
    return saved ? JSON.parse(saved) : [];
  });
  const [wallets, setWallets] = useState<Record<string, WalletState>>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_WALLETS);
    return saved ? JSON.parse(saved) : {};
  });
  const [isConnected, setIsConnected] = useState(true);
  const [lastSync, setLastSync] = useState<number>(Date.now());

  // 1. Simulation Engine (Directly on Client)
  useEffect(() => {
    const symbols = ['BTC', 'ETH', 'SOL'];
    const interval = setInterval(() => {
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      const side = Math.random() > 0.45 ? 'buy' : 'sell';
      const size = Math.random() * (symbol === 'BTC' ? 0.5 : 5);
      const price = symbol === 'BTC' ? 65000 + Math.random() * 1000 : 
                    symbol === 'ETH' ? 3500 + Math.random() * 100 : 
                    180 + Math.random() * 10;
      
      const walletId = `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`;
      
      const newTrade: BulkTrade = {
        symbol,
        price,
        size,
        side,
        walletId,
        timestamp: Date.now()
      };

      setTrades(prev => {
        const next = [newTrade, ...prev].slice(0, 50);
        localStorage.setItem(STORAGE_KEY_TRADES, JSON.stringify(next));
        return next;
      });

      setWallets(prev => {
        const next = { ...prev };
        if (!next[walletId]) {
          next[walletId] = {
            id: walletId,
            position: 'flat',
            entryPrice: null,
            entrySize: 0,
            totalPnL: (Math.random() - 0.3) * 500, // Start with some random history
            winCount: Math.floor(Math.random() * 5),
            tradeCount: Math.floor(Math.random() * 10) + 1,
            history: [],
            lastUpdate: Date.now()
          };
        }

        const w = next[walletId];
        w.lastUpdate = Date.now();
        
        if (w.position === 'flat') {
          w.position = side === 'buy' ? 'long' : 'short';
          w.entryPrice = price;
          w.entrySize = size;
          w.tradeCount += 1;
        } else if ((w.position === 'long' && side === 'sell') || (w.position === 'short' && side === 'buy')) {
          const pnl = w.position === 'long' ? (price - (w.entryPrice || price)) * w.entrySize : ((w.entryPrice || price) - price) * w.entrySize;
          w.totalPnL += pnl;
          if (pnl > 0) w.winCount += 1;
          w.position = 'flat';
          w.entryPrice = null;
          w.entrySize = 0;
        }

        localStorage.setItem(STORAGE_KEY_WALLETS, JSON.stringify(next));
        return next;
      });

      setLastSync(Date.now());
    }, 2000 + Math.random() * 3000);

    return () => clearInterval(interval);
  }, []);

  const topTraders = useMemo(() => {
    return (Object.values(wallets) as WalletState[])
      .sort((a, b) => b.totalPnL - a.totalPnL)
      .slice(0, 10);
  }, [wallets]);

  const marketStats = useMemo(() => {
    const activePositions = (Object.values(wallets) as WalletState[]).filter(w => w.position !== 'flat');
    const longs = activePositions.filter(w => w.position === 'long').length;
    const shorts = activePositions.filter(w => w.position === 'short').length;
    const total = activePositions.length || 1;
    
    return {
      longRatio: (longs / total) * 100,
      shortRatio: (shorts / total) * 100,
      activeWallets: activePositions.length,
      totalVolume: trades.reduce((acc, t) => acc + (t.price * t.size), 0)
    };
  }, [wallets, trades]);

  return (
    <div className="flex-1 flex flex-col gap-6 p-4 md:p-6 overflow-hidden h-full relative bg-black/40">
      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 blur-[100px] pointer-events-none" />

      {/* Header Stats - Sentinel Style */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900/40 border border-white/10 p-5 rounded-sm relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/50" />
          <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">
            <Activity size={12} className="text-blue-500" />
            Market Sentiment
          </div>
          <div className="flex items-end gap-3 mt-4">
            <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden flex">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${marketStats.longRatio}%` }}
                className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" 
              />
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${marketStats.shortRatio}%` }}
                className="h-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]" 
              />
            </div>
          </div>
          <div className="flex justify-between text-[9px] font-mono mt-2 font-bold">
            <span className="text-emerald-500">LONG {marketStats.longRatio.toFixed(1)}%</span>
            <span className="text-rose-500">SHORT {marketStats.shortRatio.toFixed(1)}%</span>
          </div>
        </div>

        <div className="bg-zinc-900/40 border border-white/10 p-5 rounded-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-white/20" />
          <span className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">Active Nodes</span>
          <div className="flex items-baseline gap-2 mt-2">
            <p className="text-2xl font-mono font-black text-white">{marketStats.activeWallets.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-zinc-900/40 border border-white/10 p-5 rounded-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/50" />
          <div className="flex items-center justify-between">
            <span className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">Data Stream</span>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[8px] font-mono uppercase text-emerald-500 font-bold">Stable</span>
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xs font-mono font-bold text-white uppercase tracking-tighter">Direct Client Feed</p>
          </div>
        </div>

        <div className="bg-zinc-900/40 border border-white/10 p-5 rounded-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-yellow-500/50" />
          <span className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">Whale Alerts</span>
          <div className="flex items-baseline gap-2 mt-2">
            <p className="text-2xl font-mono font-black text-yellow-500">
              {trades.filter(t => t.price * t.size > 10000).length}
            </p>
            <span className="text-[8px] font-mono text-zinc-600 uppercase">Large Flow</span>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
        {/* Left: Top 10 Traders Leaderboard */}
        <div className="lg:col-span-1 flex flex-col gap-4 overflow-hidden">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <Trophy size={14} className="text-yellow-500" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Elite Traders</h3>
            </div>
            <div className="h-px flex-1 mx-4 bg-white/5" />
          </div>
          <div className="flex-1 bg-white/[0.02] border border-white/5 rounded-sm overflow-y-auto custom-scrollbar">
            <div className="divide-y divide-white/5">
              {topTraders.length > 0 ? topTraders.map((trader, index) => (
                <motion.div 
                  key={trader.id} 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 flex items-center gap-4 hover:bg-white/[0.03] transition-colors group"
                >
                  <div className="w-7 h-7 flex items-center justify-center text-[10px] font-mono font-black text-zinc-500 border border-white/10 rounded-sm group-hover:border-white/30 transition-all">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-mono text-white font-bold tracking-tight">
                      {trader.id}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center gap-1">
                        <span className="text-[8px] text-zinc-600 font-black uppercase">Win:</span>
                        <span className="text-[9px] font-mono text-emerald-500 font-bold">{trader.winCount}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[8px] text-zinc-600 font-black uppercase">Loss:</span>
                        <span className="text-[9px] font-mono text-rose-500 font-bold">{trader.tradeCount - trader.winCount}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      "text-xs font-mono font-black tracking-tighter",
                      trader.totalPnL >= 0 ? "text-emerald-500" : "text-rose-500"
                    )}>
                      {trader.totalPnL >= 0 ? '+' : ''}{trader.totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-[8px] font-mono text-zinc-600 uppercase font-bold">PnL (USD)</p>
                  </div>
                </motion.div>
              )) : (
                <div className="p-12 flex flex-col items-center justify-center text-zinc-600 gap-3">
                  <Activity size={24} className="opacity-20 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Initializing Feed...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Live Bulk Trade Feed */}
        <div className="lg:col-span-2 flex flex-col gap-4 overflow-hidden">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-blue-500" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Live Execution Flow</h3>
            </div>
            <div className="h-px flex-1 mx-4 bg-white/5" />
          </div>
          <div className="flex-1 bg-white/[0.02] border border-white/5 rounded-sm overflow-hidden flex flex-col">
            <div className="grid grid-cols-5 p-4 border-b border-white/10 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 bg-white/[0.01]">
              <span>Asset</span>
              <span>Action</span>
              <span>Price</span>
              <span>Volume</span>
              <span className="text-right">Node ID</span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <AnimatePresence initial={false} mode="popLayout">
                {trades.length > 0 ? trades.map((trade, i) => (
                  <motion.div
                    key={`${trade.walletId}-${trade.timestamp}-${i}`}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="grid grid-cols-5 p-4 border-b border-white/5 items-center hover:bg-white/[0.03] transition-all group"
                  >
                    <span className="text-[11px] font-mono font-black text-white">{trade.symbol}</span>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-1 h-3 rounded-full",
                        trade.side === 'buy' ? "bg-emerald-500" : "bg-rose-500"
                      )} />
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-tighter",
                        trade.side === 'buy' ? "text-emerald-500" : "text-rose-500"
                      )}>
                        {trade.side}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-zinc-400 font-bold">${(trade.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className="text-[11px] font-mono text-zinc-400">{trade.size.toFixed(4)}</span>
                    <span className="text-[10px] font-mono text-zinc-600 text-right font-bold group-hover:text-zinc-400 transition-colors">
                      {trade.walletId}
                    </span>
                  </motion.div>
                )) : (
                  <div className="p-24 flex flex-col items-center justify-center text-zinc-600 gap-4">
                    <div className="w-12 h-12 border-2 border-white/5 border-t-white/20 rounded-full animate-spin" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em]">Syncing with Blockchain...</span>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Footer: Smart Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
        <InsightCard 
          icon={<Shield size={16} className="text-emerald-500" />}
          title="Whale Accumulation"
          desc="Multiple high-volume buy orders detected from institutional-grade wallets in the last 15 minutes."
          color="emerald"
        />
        <InsightCard 
          icon={<Target size={16} className="text-blue-500" />}
          title="Liquidity Zones"
          desc="Significant sell-side pressure building up near key resistance levels. Monitor for breakout."
          color="blue"
        />
        <InsightCard 
          icon={<Zap size={16} className="text-yellow-500" />}
          title="Volatility Spike"
          desc="Execution frequency has increased by 180% compared to the previous hour. High risk environment."
          color="yellow"
        />
      </div>
    </div>
  );
};

const InsightCard: React.FC<{ icon: React.ReactNode; title: string; desc: string; color: string }> = ({ icon, title, desc, color }) => (
  <div className="bg-zinc-900/40 border border-white/10 p-4 rounded-sm flex gap-4 items-start group hover:bg-zinc-900/60 transition-all relative overflow-hidden">
    <div className={cn(
      "absolute top-0 left-0 w-0.5 h-0 group-hover:h-full transition-all duration-500",
      color === 'emerald' ? "bg-emerald-500" : color === 'blue' ? "bg-blue-500" : "bg-yellow-500"
    )} />
    <div className="mt-1 p-2 bg-white/[0.03] rounded-sm group-hover:scale-110 transition-transform">{icon}</div>
    <div className="flex flex-col gap-1">
      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">{title}</h4>
      <p className="text-[11px] text-zinc-500 leading-relaxed font-serif italic">{desc}</p>
    </div>
  </div>
);

