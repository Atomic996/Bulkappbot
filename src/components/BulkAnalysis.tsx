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

const BACKEND_URL = typeof window !== 'undefined' ? window.location.origin : "";
const BACKEND_WS_URL = typeof window !== 'undefined' ? window.location.origin.replace('http', 'ws') : "";

export const BulkAnalysis: React.FC = () => {
  const [trades, setTrades] = useState<BulkTrade[]>([]);
  const [wallets, setWallets] = useState<Record<string, WalletState>>({});
  const [isConnected, setIsConnected] = useState(true); // Server is handling connection
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'stable' | 'error'>('connecting');

  // 1. Internal WebSocket for Real-time Updates
  useEffect(() => {
    const wsUrl = `${BACKEND_WS_URL}/ws/bulk`;
    let socket: WebSocket;

    function connect() {
      socket = new WebSocket(wsUrl);
      setWsStatus('connecting');

      socket.onopen = () => {
        console.log("Internal Bulk WS Connected");
        setWsStatus('stable');
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'trade' && message.data) {
            setTrades(prev => [message.data, ...prev].slice(0, 50));
            setLastSync(Date.now());
          } else if ((message.type === 'wallets_update' || message.type === 'init_wallets') && Array.isArray(message.data)) {
            const walletMap: Record<string, WalletState> = {};
            message.data.forEach((w: WalletState) => {
              if (w && w.id) {
                walletMap[w.id] = w;
              }
            });
            setWallets(prev => ({ ...prev, ...walletMap }));
            setLastSync(Date.now());
          }
        } catch (e) {
          console.error("Error parsing internal WS message:", e);
        }
      };

      socket.onclose = () => {
        setWsStatus('error');
        setTimeout(connect, 3000);
      };

      socket.onerror = () => {
        setWsStatus('error');
      };
    }

    connect();
    return () => socket?.close();
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
    <div className="flex-1 flex flex-col gap-6 p-4 md:p-6 overflow-hidden h-full relative">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900/40 border border-white/5 p-4 rounded-xl flex flex-col gap-1">
          <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-serif italic uppercase tracking-widest">
            <Activity size={12} className="text-blue-500" />
            Bulk Market Sentiment
          </div>
          <div className="flex items-end gap-3 mt-2">
            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden flex">
              <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${marketStats.longRatio}%` }} />
              <div className="h-full bg-rose-500 transition-all duration-500" style={{ width: `${marketStats.shortRatio}%` }} />
            </div>
          </div>
          <div className="flex justify-between text-[9px] font-mono mt-1">
            <span className="text-emerald-500">LONG {marketStats.longRatio.toFixed(1)}%</span>
            <span className="text-rose-500">SHORT {marketStats.shortRatio.toFixed(1)}%</span>
          </div>
        </div>

        <div className="bg-zinc-900/40 border border-white/5 p-4 rounded-xl flex flex-col gap-1">
          <span className="text-zinc-500 text-[10px] font-serif italic uppercase tracking-widest">Active Bulk Wallets</span>
          <p className="text-xl font-mono font-black text-white">{marketStats.activeWallets.toLocaleString()}</p>
          <span className="text-[8px] font-mono text-zinc-600 uppercase">Tracking Live Flow</span>
        </div>

        <div className="bg-zinc-900/40 border border-white/5 p-4 rounded-xl flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500 text-[10px] font-serif italic uppercase tracking-widest">Bulk Connection</span>
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-[8px] font-mono uppercase",
                wsStatus === 'stable' ? "text-emerald-500" : "text-rose-500"
              )}>
                {wsStatus === 'stable' ? "Direct WS" : "Connecting..."}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className={cn(
              "w-2 h-2 rounded-full animate-pulse", 
              wsStatus === 'stable' ? "bg-emerald-500" : "bg-rose-500"
            )} />
            <p className="text-sm font-mono font-bold text-white">
              {wsStatus === 'stable' ? "STABLE (DIRECT)" : "DISCONNECTED"}
            </p>
          </div>
          <span className="text-[8px] font-mono text-zinc-600 uppercase">
            {lastSync ? `Last Sync: ${new Date(lastSync).toLocaleTimeString()}` : BULK_WS_URL}
          </span>
        </div>

        <div className="bg-zinc-900/40 border border-white/5 p-4 rounded-xl flex flex-col gap-1">
          <span className="text-zinc-500 text-[10px] font-serif italic uppercase tracking-widest">Whale Activity</span>
          <p className="text-xl font-mono font-black text-blue-500">
            {trades.filter(t => t.price * t.size > 50000).length}
          </p>
          <span className="text-[8px] font-mono text-zinc-600 uppercase">Large Orders (&gt; $50k)</span>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
        {/* Left: Top 10 Traders Leaderboard */}
        <div className="lg:col-span-1 flex flex-col gap-4 overflow-hidden">
          <div className="flex items-center gap-2 px-2">
            <Trophy size={16} className="text-yellow-500" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Top 10 Bulk Traders</h3>
          </div>
          <div className="flex-1 bg-zinc-900/20 border border-white/5 rounded-xl overflow-y-auto custom-scrollbar">
            <div className="divide-y divide-white/5">
              {topTraders.map((trader, index) => (
                <div key={trader.id} className="p-3 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
                  <div className="w-6 h-6 flex items-center justify-center text-[10px] font-mono font-bold text-zinc-500 border border-white/10 rounded">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-mono text-zinc-300 truncate">
                      {trader.id.slice(0, 6)}...{trader.id.slice(-4)}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <div className="flex items-center gap-1">
                        <span className="text-[7px] text-zinc-600 uppercase">W:</span>
                        <span className="text-[8px] font-mono text-emerald-500">{trader.winCount}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[7px] text-zinc-600 uppercase">L:</span>
                        <span className="text-[8px] font-mono text-rose-500">{trader.tradeCount - trader.winCount}</span>
                      </div>
                      <div className="flex items-center gap-1 ml-auto">
                        <span className="text-[7px] text-zinc-600 uppercase">Rate:</span>
                        <span className="text-[8px] font-mono text-blue-400">
                          {trader.tradeCount > 0 ? ((trader.winCount / trader.tradeCount) * 100).toFixed(0) : 0}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      "text-xs font-mono font-bold",
                      trader.totalPnL >= 0 ? "text-emerald-500" : "text-rose-500"
                    )}>
                      {trader.totalPnL >= 0 ? '+' : ''}{trader.totalPnL.toFixed(2)}
                    </p>
                    <p className="text-[8px] font-mono text-zinc-600 uppercase">Total PnL</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Live Bulk Trade Feed */}
        <div className="lg:col-span-2 flex flex-col gap-4 overflow-hidden">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-blue-500" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Live Bulk Flow</h3>
            </div>
            <span className="text-[8px] font-mono text-zinc-500 uppercase">Real-time Execution</span>
          </div>
          <div className="flex-1 bg-zinc-900/20 border border-white/5 rounded-xl overflow-hidden flex flex-col">
            <div className="grid grid-cols-5 p-3 border-b border-white/10 text-[8px] font-black uppercase tracking-widest text-zinc-500">
              <span>Symbol</span>
              <span>Side</span>
              <span>Price</span>
              <span>Size</span>
              <span className="text-right">Wallet</span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <AnimatePresence initial={false}>
                {trades.map((trade, i) => (
                  <motion.div
                    key={`${trade.walletId}-${trade.timestamp}-${i}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="grid grid-cols-5 p-3 border-b border-white/5 items-center hover:bg-white/[0.01]"
                  >
                    <span className="text-[10px] font-mono font-bold text-zinc-300">{trade.symbol}</span>
                    <div className="flex items-center gap-1">
                      {trade.side === 'buy' ? (
                        <ArrowUpRight size={10} className="text-emerald-500" />
                      ) : (
                        <ArrowDownRight size={10} className="text-rose-500" />
                      )}
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-tighter",
                        trade.side === 'buy' ? "text-emerald-500" : "text-rose-500"
                      )}>
                        {trade.side}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-400">${(trade.price || 0).toLocaleString()}</span>
                    <span className="text-[10px] font-mono text-zinc-400">{trade.size.toFixed(4)}</span>
                    <span className="text-[9px] font-mono text-zinc-600 text-right truncate">
                      {trade.walletId.slice(0, 8)}...
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Footer: Smart Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
        <InsightCard 
          icon={<Shield size={14} className="text-emerald-500" />}
          title="Smart Money Accumulation"
          desc="Top 5 traders are currently increasing LONG exposure on BTC."
        />
        <InsightCard 
          icon={<Target size={14} className="text-blue-500" />}
          title="Liquidation Risk"
          desc="High concentration of SHORT positions near $68,400 level."
        />
        <InsightCard 
          icon={<Zap size={14} className="text-yellow-500" />}
          title="Volatility Alert"
          desc="Bulk volume spike detected in the last 5 minutes (+240%)."
        />
      </div>
    </div>
  );
};

const InsightCard: React.FC<{ icon: React.ReactNode; title: string; desc: string }> = ({ icon, title, desc }) => (
  <div className="bg-white/[0.02] border border-white/5 p-3 rounded-lg flex gap-3 items-start">
    <div className="mt-0.5">{icon}</div>
    <div className="flex flex-col gap-0.5">
      <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-200">{title}</h4>
      <p className="text-[10px] text-zinc-500 leading-tight">{desc}</p>
    </div>
  </div>
);
