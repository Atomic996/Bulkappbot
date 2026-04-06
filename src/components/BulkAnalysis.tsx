import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trophy, Activity, ArrowUpRight, ArrowDownRight,
  TrendingUp, TrendingDown, Zap, Shield, Target, RefreshCw
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

// ── SVG Status Indicators (no emoji) ──
const DotLive = () => (
  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
    <circle cx="4" cy="4" r="4" fill="#22c55e" opacity="0.3"/>
    <circle cx="4" cy="4" r="2.5" fill="#22c55e"/>
  </svg>
);
const DotConnecting = () => (
  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
    <circle cx="4" cy="4" r="4" fill="#eab308" opacity="0.3"/>
    <circle cx="4" cy="4" r="2.5" fill="#eab308"/>
  </svg>
);
const DotDisconnected = () => (
  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
    <circle cx="4" cy="4" r="4" fill="#ef4444" opacity="0.3"/>
    <circle cx="4" cy="4" r="2.5" fill="#ef4444"/>
  </svg>
);
const ArrowUp = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
    <path d="M5 1L9 5H6.5V9H3.5V5H1L5 1Z" fill="#22c55e"/>
  </svg>
);
const ArrowDown = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
    <path d="M5 9L1 5H3.5V1H6.5V5H9L5 9Z" fill="#ef4444"/>
  </svg>
);
const IconWhale = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M22 12C22 12 18 6 12 6C6 6 2 12 2 12"/>
    <path d="M2 12C2 12 6 18 12 18C15 18 17.5 16.5 19 15"/>
    <path d="M19 15L22 18M19 15L22 12"/>
    <circle cx="8" cy="11" r="1" fill="currentColor"/>
  </svg>
);
const IconChart = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);
const IconUsers = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IconBook = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
  </svg>
);
const IconTrophy = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
    <path d="M4 22h16M8 22v-3M16 22v-3"/>
    <path d="M6 2v7a6 6 0 0 0 12 0V2"/>
  </svg>
);

const BACKEND_WS_URL = "wss://bulkappbot-production.up.railway.app";

interface BulkTrade {
  symbol: string; price: number; size: number;
  side: 'buy' | 'sell'; walletId: string; timestamp: number;
}
interface WalletState {
  id: string; position: 'flat' | 'long' | 'short';
  entryPrice: number | null; entrySize: number;
  totalPnL: number; winCount: number; tradeCount: number;
  lastUpdate: number;
}

export const BulkAnalysis: React.FC = () => {
  const [trades, setTrades]       = useState<BulkTrade[]>([]);
  const [wallets, setWallets]     = useState<Record<string, WalletState>>({});
  const [lastSync, setLastSync]   = useState<number | null>(null);
  const [wsStatus, setWsStatus]   = useState<'connecting' | 'stable' | 'error'>('connecting');
  const socketRef                 = useRef<WebSocket | null>(null);
  const retryRef                  = useRef<ReturnType<typeof setTimeout>>();
  const retryDelay                = useRef(2000);
  const alive                     = useRef(true);

  const connect = useCallback(() => {
    if (!alive.current) return;
    setWsStatus('connecting');
    try {
      const ws = new WebSocket(`${BACKEND_WS_URL}/ws/bulk`);
      socketRef.current = ws;

      ws.onopen = () => {
        setWsStatus('stable');
        retryDelay.current = 2000;
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'trade' && msg.data) {
            setTrades(p => [msg.data, ...p].slice(0, 120));
            setLastSync(Date.now());
          } else if ((msg.type === 'wallets_update' || msg.type === 'init_wallets') && Array.isArray(msg.data)) {
            const m: Record<string, WalletState> = {};
            msg.data.forEach((w: WalletState) => { if (w?.id) m[w.id] = w; });
            setWallets(p => ({ ...p, ...m }));
            setLastSync(Date.now());
          }
        } catch {}
      };
      ws.onclose = () => {
        setWsStatus('error');
        if (alive.current) {
          retryDelay.current = Math.min(retryDelay.current * 1.5, 15000);
          retryRef.current = setTimeout(connect, retryDelay.current);
        }
      };
      ws.onerror = () => { ws.close(); };
    } catch {
      setWsStatus('error');
      retryRef.current = setTimeout(connect, retryDelay.current);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    connect();
    return () => {
      alive.current = false;
      clearTimeout(retryRef.current);
      socketRef.current?.close();
    };
  }, [connect]);

  const topTraders = useMemo(() =>
    (Object.values(wallets) as WalletState[])
      .sort((a, b) => b.totalPnL - a.totalPnL).slice(0, 10),
    [wallets]
  );

  const stats = useMemo(() => {
    const active = (Object.values(wallets) as WalletState[]).filter(w => w.position !== 'flat');
    const longs  = active.filter(w => w.position === 'long').length;
    const shorts = active.filter(w => w.position === 'short').length;
    const total  = active.length || 1;
    const whales = trades.filter(t => t.price * t.size > 50000).length;
    const vol    = trades.reduce((a, t) => a + t.price * t.size, 0);
    return {
      longRatio:  (longs / total) * 100,
      shortRatio: (shorts / total) * 100,
      active:     active.length,
      whales,
      volume:     vol,
    };
  }, [wallets, trades]);

  const StatusDot = wsStatus === 'stable' ? DotLive : wsStatus === 'connecting' ? DotConnecting : DotDisconnected;
  const statusText = wsStatus === 'stable' ? 'LIVE' : wsStatus === 'connecting' ? 'CONNECTING' : 'RECONNECTING';
  const statusColor = wsStatus === 'stable' ? 'text-emerald-400' : wsStatus === 'connecting' ? 'text-amber-400' : 'text-rose-400';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0a0a0f]">

      {/* ── Top Bar ── */}
      <div className="shrink-0 border-b border-white/[0.06] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-px h-5 bg-blue-500/60" />
          <span className="text-[11px] font-mono font-bold text-white/80 uppercase tracking-[0.2em]">Order Book</span>
          <span className="text-[9px] font-mono text-white/20 uppercase tracking-widest">/ Bulk Exchange</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={cn("animate-pulse", wsStatus !== 'stable' && "opacity-50")}>
              <StatusDot />
            </div>
            <span className={cn("text-[9px] font-mono font-bold tracking-widest", statusColor)}>
              {statusText}
            </span>
          </div>
          {lastSync && (
            <span className="text-[8px] font-mono text-white/20">
              {new Date(lastSync).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => { socketRef.current?.close(); }}
            className="p-1.5 rounded border border-white/[0.06] text-white/30 hover:text-white/60 hover:border-white/20 transition-all"
          >
            <RefreshCw size={10} />
          </button>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="shrink-0 grid grid-cols-2 md:grid-cols-4 border-b border-white/[0.06]">
        {/* Sentiment */}
        <div className="p-4 border-r border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <IconChart />
            <span className="text-[9px] font-mono text-white/30 uppercase tracking-widest">Sentiment</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden flex">
              <div className="h-full bg-emerald-500/80 transition-all duration-700" style={{ width: `${stats.longRatio}%` }} />
              <div className="h-full bg-rose-500/80 transition-all duration-700" style={{ width: `${stats.shortRatio}%` }} />
            </div>
          </div>
          <div className="flex justify-between">
            <span className="text-[9px] font-mono text-emerald-400">L {stats.longRatio.toFixed(0)}%</span>
            <span className="text-[9px] font-mono text-rose-400">S {stats.shortRatio.toFixed(0)}%</span>
          </div>
        </div>

        {/* Active Wallets */}
        <div className="p-4 border-r border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <IconUsers />
            <span className="text-[9px] font-mono text-white/30 uppercase tracking-widest">Active</span>
          </div>
          <p className="text-2xl font-mono font-black text-white tabular-nums">{stats.active.toLocaleString()}</p>
          <p className="text-[8px] font-mono text-white/20 mt-1 uppercase">Wallets in position</p>
        </div>

        {/* Whale Activity */}
        <div className="p-4 border-r border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <IconWhale />
            <span className="text-[9px] font-mono text-white/30 uppercase tracking-widest">Whales</span>
          </div>
          <p className="text-2xl font-mono font-black text-blue-400 tabular-nums">{stats.whales}</p>
          <p className="text-[8px] font-mono text-white/20 mt-1 uppercase">Orders &gt; $50k</p>
        </div>

        {/* Volume */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={12} className="text-white/30" />
            <span className="text-[9px] font-mono text-white/30 uppercase tracking-widest">Volume</span>
          </div>
          <p className="text-2xl font-mono font-black text-white tabular-nums">
            ${stats.volume >= 1_000_000
              ? `${(stats.volume / 1_000_000).toFixed(1)}M`
              : stats.volume >= 1000
              ? `${(stats.volume / 1000).toFixed(0)}K`
              : stats.volume.toFixed(0)}
          </p>
          <p className="text-[8px] font-mono text-white/20 mt-1 uppercase">Last {trades.length} trades</p>
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[280px_1fr] overflow-hidden min-h-0">

        {/* Left — Leaderboard */}
        <div className="border-r border-white/[0.06] flex flex-col overflow-hidden">
          <div className="shrink-0 px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
            <IconTrophy />
            <span className="text-[9px] font-mono font-bold text-white/60 uppercase tracking-[0.2em]">Top Traders</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {topTraders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 opacity-30 p-8">
                <IconUsers />
                <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest text-center">
                  {wsStatus === 'connecting' ? 'Connecting...' : wsStatus === 'error' ? 'Connection failed' : 'No data yet'}
                </span>
              </div>
            ) : (
              topTraders.map((trader, i) => {
                const wr = trader.tradeCount > 0 ? (trader.winCount / trader.tradeCount) * 100 : 0;
                const isPos = trader.totalPnL >= 0;
                return (
                  <div key={trader.id} className="px-4 py-3 border-b border-white/[0.04] flex items-center gap-3 hover:bg-white/[0.02] transition-colors group">
                    <span className="text-[9px] font-mono text-white/20 w-4 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-mono text-white/70 truncate">
                        {trader.id.slice(0, 6)}
                        <span className="text-white/20">...</span>
                        {trader.id.slice(-4)}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-px bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500/40" style={{ width: `${wr}%` }} />
                        </div>
                        <span className="text-[8px] font-mono text-white/30">{wr.toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-[11px] font-mono font-bold tabular-nums", isPos ? "text-emerald-400" : "text-rose-400")}>
                        {isPos ? '+' : ''}{trader.totalPnL.toFixed(1)}
                      </p>
                      <p className="text-[8px] font-mono text-white/20">{trader.tradeCount}T</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right — Order Book Feed */}
        <div className="flex flex-col overflow-hidden min-h-0">
          {/* Column Headers */}
          <div className="shrink-0 grid grid-cols-[1fr_60px_100px_80px_100px] px-4 py-2.5 border-b border-white/[0.06]">
            {['Symbol', 'Side', 'Price', 'Size', 'Wallet'].map((h, i) => (
              <span key={h} className={cn("text-[8px] font-mono font-bold text-white/20 uppercase tracking-widest", i > 0 && "text-right")}>
                {h}
              </span>
            ))}
          </div>

          {/* Trades List */}
          <div className="flex-1 overflow-y-auto">
            {trades.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 opacity-30 p-8">
                <IconBook />
                <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest text-center">
                  {wsStatus === 'connecting'
                    ? 'Connecting to exchange...'
                    : wsStatus === 'error'
                    ? 'Failed to connect — retrying...'
                    : 'Waiting for trades...'}
                </span>
                {wsStatus === 'error' && (
                  <span className="text-[8px] font-mono text-rose-400/50 text-center">
                    Verify Railway server is running
                  </span>
                )}
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {trades.map((trade, i) => {
                  const isBuy    = trade.side === 'buy';
                  const isWhale  = trade.price * trade.size > 50000;
                  const val      = trade.price * trade.size;
                  return (
                    <motion.div
                      key={`${trade.walletId}-${trade.timestamp}-${i}`}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.15 }}
                      className={cn(
                        "grid grid-cols-[1fr_60px_100px_80px_100px] px-4 py-2.5 border-b border-white/[0.03]",
                        "hover:bg-white/[0.015] transition-colors",
                        isWhale && "bg-blue-500/[0.04]"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-white/70">{trade.symbol}</span>
                        {isWhale && (
                          <span className="text-[7px] font-mono text-blue-400/70 border border-blue-500/20 px-1 py-px rounded">WHALE</span>
                        )}
                      </div>

                      <div className="flex items-center justify-end gap-1">
                        {isBuy ? <ArrowUp /> : <ArrowDown />}
                        <span className={cn("text-[9px] font-mono font-bold", isBuy ? "text-emerald-400" : "text-rose-400")}>
                          {isBuy ? 'BUY' : 'SELL'}
                        </span>
                      </div>

                      <span className="text-[10px] font-mono text-white/60 text-right tabular-nums">
                        ${trade.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>

                      <span className="text-[10px] font-mono text-white/40 text-right tabular-nums">
                        {trade.size.toFixed(4)}
                      </span>

                      <div className="text-right">
                        <span className="text-[9px] font-mono text-white/30">
                          {trade.walletId.slice(0, 6)}..{trade.walletId.slice(-3)}
                        </span>
                        <p className="text-[8px] font-mono text-white/15">
                          ${val >= 1000 ? `${(val / 1000).toFixed(0)}K` : val.toFixed(0)}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>

      {/* ── Insights Footer ── */}
      <div className="shrink-0 border-t border-white/[0.06] grid grid-cols-1 md:grid-cols-3">
        <InsightCard
          icon={<Shield size={12} className="text-emerald-500/70" />}
          title="Smart Money"
          desc="Top 5 traders increasing LONG exposure on BTC."
          color="emerald"
        />
        <InsightCard
          icon={<Target size={12} className="text-blue-500/70" />}
          title="Liquidation Zone"
          desc="Short cluster detected near $68,400 resistance."
          color="blue"
          border
        />
        <InsightCard
          icon={<Zap size={12} className="text-amber-500/70" />}
          title="Volume Spike"
          desc="Bulk flow +240% above 5-min average."
          color="amber"
          border
        />
      </div>
    </div>
  );
};

const InsightCard: React.FC<{
  icon: React.ReactNode; title: string; desc: string;
  color: 'emerald' | 'blue' | 'amber'; border?: boolean;
}> = ({ icon, title, desc, color, border }) => {
  const accent = { emerald: 'text-emerald-400', blue: 'text-blue-400', amber: 'text-amber-400' }[color];
  return (
    <div className={cn("p-4 flex items-start gap-3 hover:bg-white/[0.015] transition-colors", border && "border-l border-white/[0.06]")}>
      <div className="mt-0.5 opacity-70">{icon}</div>
      <div>
        <h4 className={cn("text-[9px] font-mono font-bold uppercase tracking-widest", accent)}>{title}</h4>
        <p className="text-[9px] font-mono text-white/30 mt-1 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
};
