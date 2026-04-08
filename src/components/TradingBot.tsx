import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import bs58 from 'bs58';
import axios from 'axios';
import { 
  Play, 
  Square, 
  Activity, 
  Terminal, 
  Wallet, 
  TrendingUp, 
  TrendingDown,
  AlertCircle,
  ShieldCheck,
  Cpu,
  Key
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface BotStatus {
  enabled: boolean;
  status: string;
  balance: number;
  positions: any[];
  logs: string[];
  hasSession: boolean;
  address: string | null;
  orderType?: 'market' | 'limit' | 'auto';
}

const BACKEND_URL = typeof window !== 'undefined' ? window.location.origin : "";

export const TradingBot: React.FC = () => {
  const { publicKey, signMessage, connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [status, setStatus] = useState<BotStatus>({
    enabled: false,
    status: "Initializing...",
    balance: 0,
    positions: [],
    logs: [],
    hasSession: false,
    address: null
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const wsUrl = (BACKEND_URL || window.location.origin).replace('http', 'ws') + '/ws/bulk';
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => console.log("[WS] Connected to backend");
    ws.onerror = (err) => console.error("[WS] Connection error:", err);
    
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'bot_update') {
          setStatus(prev => ({ ...prev, ...msg.data }));
        } else if (msg.type === 'bot_log') {
          setStatus(prev => ({ ...prev, logs: [msg.data, ...prev.logs].slice(0, 50) }));
        }
      } catch (e) {}
    };

    return () => ws.close();
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      // Debug log for fetch
      if (typeof window !== 'undefined') {
        const f = window.fetch;
        if (!f || f.toString().includes('native code') === false) {
          console.warn("Fetch might be polyfilled or modified:", f?.toString());
        }
      }

      const res = await axios.get(`${BACKEND_URL}/api/bot/status`);
      if (res.data && typeof res.data === 'object') {
        setStatus(prev => ({
          ...prev,
          ...res.data,
          positions: res.data.positions || [],
          logs: res.data.logs || []
        }));
      }
    } catch (err: any) {
      if (axios.isAxiosError(err)) {
        const data = err.response?.data;
        if (typeof data === 'string' && data.startsWith("<!doctype")) {
          console.error("Bot status fetch hit SPA fallback (HTML returned instead of JSON)");
        } else {
          console.error("Failed to fetch bot status (Axios):", err.message);
        }
      } else {
        console.error("Failed to fetch bot status:", err?.message || String(err));
      }
      // Don't set error state for periodic background fetches to avoid flickering UI
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const resetSession = () => {
    disconnect();
    setStatus(prev => ({ ...prev, enabled: false, status: "Reset" }));
    setError(null);
    setIsLoading(false);
    // Clear any local storage that might cause auto-connect issues
    if (typeof window !== 'undefined') {
      localStorage.removeItem('walletName');
    }
  };

  const startBotWithWallet = async () => {
    if (!connected) {
      setIsAuthorizing(true);
      setVisible(true);
      return;
    }
    if (!signMessage) {
      setError("Your wallet does not support message signing. Please use Phantom or Solflare.");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // 1. Get SIWS message from server
      const siwsRes = await axios.post(`${BACKEND_URL}/api/bot/auth/init`, { address: publicKey?.toBase58() });
      const { message } = siwsRes.data;

      // 2. Sign the message
      const encodedMessage = new TextEncoder().encode(message);
      const signed = await signMessage(encodedMessage);
      
      // Convert signature to base58 (Solana standard)
      const signature = bs58.encode(signed);

      // 3. Send signature back to server
      await axios.post(`${BACKEND_URL}/api/bot/auth/start`, {
        address: publicKey?.toBase58(),
        message,
        signature: signature
      });
      
      fetchStatus();
    } catch (err: any) {
      console.error("[Bot] Start Error:", err);
      setError(err.response?.data?.error || err.message || "Authorization failed");
    } finally {
      setIsLoading(false);
      setIsAuthorizing(false);
    }
  };

  useEffect(() => {
    if (connected && isAuthorizing && !isLoading) {
      startBotWithWallet();
    }
  }, [connected, isAuthorizing, isLoading]);

  const stopBot = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/bot/toggle`);
      if (res.data.error) {
        setError(res.data.error);
      } else {
        fetchStatus();
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || "Failed to toggle bot";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleOrderType = async () => {
    try {
      const types: ('market' | 'limit' | 'auto')[] = ['market', 'limit', 'auto'];
      const currentIndex = types.indexOf(status.orderType || 'auto');
      const nextType = types[(currentIndex + 1) % types.length];
      
      const r = await axios.post(`${BACKEND_URL}/api/bot/settings`, { orderType: nextType });
      if (r.data.success) {
        setStatus(prev => ({ ...prev, orderType: r.data.orderType }));
      }
    } catch (e) {
      console.error("Settings update error:", e);
    }
  };

  const closeSession = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // We don't have a direct "close" API, but we can call toggle if it's enabled, 
      // or we can just disconnect locally. 
      // Actually, let's add a proper close endpoint in server.ts if needed, 
      // but for now, let's just disconnect the wallet.
      disconnect();
      setStatus(prev => ({ ...prev, enabled: false, hasSession: false, status: "Disconnected" }));
    } catch (err) {
      setError("Failed to close session");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-6 p-4 md:p-8 overflow-hidden h-full">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/10 pb-6">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <Cpu size={14} className="text-blue-500" />
            <span className="text-[10px] font-serif italic text-zinc-500 uppercase tracking-widest">Autonomous Agent</span>
          </div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Sentinel Auto-Trader</h2>
          <p className="text-[10px] font-mono text-zinc-500 mt-1 uppercase tracking-widest">Powered by Bulk.trade & AI Analysis</p>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={startBotWithWallet}
            disabled={isLoading || status.enabled}
            className={cn(
              "px-8 py-3 rounded-sm font-black uppercase tracking-[0.2em] text-xs transition-all flex items-center gap-3 shadow-2xl",
              status.enabled 
                ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 cursor-default" 
                : "bg-white text-black hover:bg-zinc-200 shadow-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {isLoading ? (
              <Activity size={16} className="animate-spin" />
            ) : status.enabled ? (
              <ShieldCheck size={16} />
            ) : (
              <Play size={16} fill="currentColor" />
            )}
            {status.enabled ? "Auto-Trading Active" : (connected ? "Authorize & Start" : "Connect & Start")}
          </button>
          
          {status.hasSession && (
            <div className="flex items-center gap-2">
              <button
                onClick={toggleOrderType}
                className={cn(
                  "px-4 py-3 rounded-sm font-black uppercase tracking-widest text-[10px] transition-all border",
                  status.orderType === 'auto' 
                    ? "bg-purple-500/10 border-purple-500/30 text-purple-500 hover:bg-purple-500/20"
                    : status.orderType === 'limit'
                    ? "bg-blue-500/10 border-blue-500/30 text-blue-500 hover:bg-blue-500/20" 
                    : "bg-zinc-900 border-white/10 text-zinc-500 hover:text-white"
                )}
              >
                Type: {status.orderType?.toUpperCase() || 'AUTO'}
              </button>
              <button
                onClick={stopBot}
                className={cn(
                  "px-6 py-3 rounded-sm font-black uppercase tracking-widest text-[10px] transition-all border",
                  status.enabled 
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-500 hover:bg-rose-500/20" 
                    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20"
                )}
              >
                {status.enabled ? "Disable Auto-Trade" : "Enable Auto-Trade"}
              </button>
            </div>
          )}

          {connected && (
            <button
              onClick={closeSession}
              className="p-3 bg-zinc-900 border border-white/10 rounded-sm hover:bg-zinc-800 transition-all text-zinc-500 hover:text-white"
              title="Close Session"
            >
              <Square size={16} />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-sm flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle size={16} className="text-rose-500" />
              <p className="text-xs font-bold text-rose-200 uppercase tracking-widest">
                {typeof error === 'string' ? error : 'An unexpected error occurred'}
              </p>
            </div>
            <button 
              onClick={resetSession}
              className="text-[8px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-400 underline"
            >
              Reset Session
            </button>
          </div>
          {error.toString().includes('500') && (
            <p className="text-[10px] text-rose-400 font-mono italic">
              Server Error (500): The backend is failing to initialize the session. Check server logs.
            </p>
          )}
        </div>
      )}

      {!status.hasSession && !isLoading && (
        <div className="p-12 bg-zinc-900/40 border border-white/5 rounded-sm flex flex-col items-center justify-center text-center gap-6">
          <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center">
            <Key size={32} className="text-blue-500" />
          </div>
          <div className="flex flex-col gap-2 max-w-md">
            <h3 className="text-lg font-black uppercase tracking-widest text-white">
              {connected ? "Authorization Required" : "Wallet Connection Required"}
            </h3>
            <p className="text-zinc-500 text-sm font-mono leading-relaxed">
              {connected 
                ? "Your wallet is connected. Now authorize the bot session to start trading autonomously."
                : "Connect your Solana wallet to authorize the bot session. The bot will use a temporary session key to execute trades on your behalf."}
            </p>
          </div>
          <button 
            onClick={startBotWithWallet}
            className="px-10 py-4 bg-white text-black text-xs font-black uppercase tracking-[0.2em] rounded-sm hover:bg-zinc-200 transition-all shadow-xl"
          >
            {connected ? "Sign & Start Bot" : "Connect Wallet & Start"}
          </button>
        </div>
      )}

      {status.hasSession && (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8 overflow-hidden">
          {/* Left: Bot Status & Positions */}
          <div className="flex flex-col gap-8 overflow-hidden">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-6 bg-zinc-900/40 border border-white/5 rounded-sm flex flex-col gap-2">
                <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Bot Status</span>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    status.enabled ? "bg-emerald-500 animate-pulse" : "bg-zinc-700"
                  )} />
                  <span className={cn(
                    "text-lg font-mono font-black uppercase tracking-tighter",
                    status.enabled ? "text-emerald-500" : "text-zinc-500"
                  )}>{status.status}</span>
                </div>
              </div>
              <div className="p-6 bg-zinc-900/40 border border-white/5 rounded-sm flex flex-col gap-2">
                <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Available Balance</span>
                <div className="flex items-center gap-2">
                  <Wallet size={16} className="text-blue-500" />
                  <span className="text-lg font-mono font-black text-white uppercase tracking-tighter">
                    ${(status.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              <div className="hidden md:flex p-6 bg-zinc-900/40 border border-white/5 rounded-sm flex-col gap-2">
                <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Active Positions</span>
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-purple-500" />
                  <span className="text-lg font-mono font-black text-white uppercase tracking-tighter">
                    {status.positions.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Positions Table */}
            <div className="flex-1 flex flex-col gap-4 overflow-hidden">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Active Bot Positions</h3>
                <span className="text-[8px] font-mono text-zinc-500 uppercase">Live from Bulk.trade</span>
              </div>
              <div className="flex-1 bg-zinc-900/20 border border-white/5 rounded-sm overflow-hidden flex flex-col">
                <div className="grid grid-cols-5 p-4 border-b border-white/10 text-[8px] font-black uppercase tracking-widest text-zinc-500">
                  <span>Asset</span>
                  <span>Side</span>
                  <span>Size</span>
                  <span>Entry</span>
                  <span className="text-right">PnL</span>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {status.positions.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-2">
                      <Activity size={24} className="opacity-20" />
                      <span className="text-[10px] font-black uppercase tracking-widest">No active positions</span>
                    </div>
                  ) : (
                    status.positions.map((pos, i) => {
                      const size = parseFloat(pos.size);
                      const pnl = parseFloat(pos.unrealizedPnl || '0');
                      return (
                        <div key={i} className="grid grid-cols-5 p-4 border-b border-white/5 items-center hover:bg-white/[0.02] transition-colors">
                          <span className="text-xs font-mono font-bold text-white">{pos.symbol}</span>
                          <div className="flex items-center gap-1">
                            {size > 0 ? (
                              <TrendingUp size={12} className="text-emerald-500" />
                            ) : (
                              <TrendingDown size={12} className="text-rose-500" />
                            )}
                            <span className={cn(
                              "text-[10px] font-black uppercase tracking-tighter",
                              size > 0 ? "text-emerald-500" : "text-rose-500"
                            )}>
                              {size > 0 ? "LONG" : "SHORT"}
                            </span>
                          </div>
                          <span className="text-xs font-mono text-zinc-400">{Math.abs(size).toFixed(4)}</span>
                          <span className="text-xs font-mono text-zinc-400">${parseFloat(pos.price || '0').toLocaleString()}</span>
                          <span className={cn(
                            "text-xs font-mono font-bold text-right",
                            pnl >= 0 ? "text-emerald-500" : "text-rose-500"
                          )}>
                            {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Bot Logs */}
          <div className="flex flex-col gap-4 overflow-hidden">
            <div className="flex items-center gap-2 px-2">
              <Terminal size={16} className="text-zinc-500" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Execution Logs</h3>
            </div>
            <div className="flex-1 bg-black border border-white/10 rounded-sm p-4 font-mono text-[10px] overflow-y-auto custom-scrollbar flex flex-col-reverse gap-2">
              {status.logs.length === 0 ? (
                <span className="text-zinc-700 italic">Waiting for execution...</span>
              ) : (
                status.logs.map((log, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-zinc-600 shrink-0">{log.split(']')[0]}]</span>
                    <span className={cn(
                      "leading-relaxed",
                      log.includes('Placed') ? "text-blue-400" :
                      log.includes('Closing') ? "text-purple-400" :
                      log.includes('Failed') ? "text-rose-400" : "text-zinc-400"
                    )}>
                      {log.split(']')[1]}
                    </span>
                  </div>
                ))
              )}
            </div>
            
            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-sm flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-emerald-500" />
                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Risk Management</span>
              </div>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                The bot uses a strict Trend-Following algorithm. Positions are opened when Technical Score &gt; 85 and closed when momentum reverses.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
