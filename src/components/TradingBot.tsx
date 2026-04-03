import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
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
import bs58 from 'bs58';

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
}

export const TradingBot: React.FC = () => {
  const { publicKey, signMessage, connected, wallet, disconnect } = useWallet();
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
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      // Debug log for fetch
      if (typeof window !== 'undefined') {
        const f = window.fetch;
        if (!f || f.toString().includes('native code') === false) {
          console.warn("Fetch might be polyfilled or modified:", f?.toString());
        }
      }

      const res = await axios.get('/api/bot/status');
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

  const startBotWithWallet = async () => {
    if (!publicKey) {
      setError("Please connect your wallet first");
      return;
    }
    if (!signMessage) {
      setError("Your wallet does not support message signing. Please try Phantom or Solflare.");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log("Starting bot with address:", publicKey.toBase58());
      
      // 1. Get nonce and message from server
      const siwsRes = await axios.post('/api/bot/auth/init', { address: publicKey.toBase58() });
      
      if (!siwsRes.data || !siwsRes.data.message) {
        throw new Error("Server failed to generate SIWS message");
      }
      
      const { message } = siwsRes.data;
      console.log("SIWS Message received, requesting signature...");

      // 2. Sign message with wallet
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = await signMessage(messageBytes);
      
      // Privy SIWS expects base64 for Solana signatures
      const signatureBase64 = btoa(String.fromCharCode.apply(null, Array.from(signatureBytes)));
      console.log("Signature obtained, authenticating on server...");

      // 3. Authenticate and start bot on server
      const authRes = await axios.post('/api/bot/auth/start', {
        address: publicKey.toBase58(),
        message,
        signature: signatureBase64
      });
      
      if (authRes.data.error) {
        throw new Error(authRes.data.error);
      } else {
        console.log("Bot started successfully!");
        fetchStatus();
      }
    } catch (err: any) {
      console.error("Bot start failed:", err);
      const msg = err.response?.data?.error || err.message || "Failed to start bot with wallet";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const stopBot = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await axios.post('/api/bot/toggle');
      if (res.data.error) {
        setError(res.data.error);
      } else {
        fetchStatus();
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || "Failed to stop bot";
      setError(msg);
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
          <div className="flex flex-col items-end gap-1">
            <WalletMultiButton className="!bg-zinc-900 !border !border-white/10 !rounded-sm !text-[10px] !font-black !uppercase !tracking-widest !h-10 hover:!bg-zinc-800 transition-all" />
            {connected && (
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Wallet Linked</span>
              </div>
            )}
          </div>
          
          <button
            onClick={status.enabled ? stopBot : startBotWithWallet}
            disabled={isLoading || (!connected && !status.enabled)}
            className={cn(
              "px-8 py-3 rounded-sm font-black uppercase tracking-[0.2em] text-xs transition-all flex items-center gap-3 shadow-2xl",
              status.enabled 
                ? "bg-rose-500 text-white hover:bg-rose-600 shadow-rose-500/20" 
                : "bg-white text-black hover:bg-zinc-200 shadow-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {isLoading ? (
              <Activity size={16} className="animate-spin" />
            ) : status.enabled ? (
              <Square size={16} fill="currentColor" />
            ) : (
              <Play size={16} fill="currentColor" />
            )}
            {status.enabled ? "Stop Bot" : "Start Bot"}
          </button>
          
          {connected && !status.enabled && (
            <button
              onClick={() => disconnect()}
              className="p-3 bg-zinc-900 border border-white/10 rounded-sm hover:bg-zinc-800 transition-all text-zinc-500 hover:text-white"
              title="Disconnect Wallet"
            >
              <Square size={16} />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-sm flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <AlertCircle size={16} className="text-rose-500" />
            <p className="text-xs font-bold text-rose-200 uppercase tracking-widest">{error}</p>
          </div>
          {error.includes('405') && (
            <p className="text-[10px] text-rose-400 font-mono italic">
              Note: 405 error usually means the API route is not correctly configured on the server.
            </p>
          )}
        </div>
      )}

      {!connected && !status.enabled && (
        <div className="p-12 bg-zinc-900/40 border border-white/5 rounded-sm flex flex-col items-center justify-center text-center gap-6">
          <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center">
            <Key size={32} className="text-blue-500" />
          </div>
          <div className="flex flex-col gap-2 max-w-md">
            <h3 className="text-lg font-black uppercase tracking-widest text-white">Wallet Connection Required</h3>
            <p className="text-zinc-500 text-sm font-mono leading-relaxed">
              Connect your Solana wallet to authorize the bot session. The bot will use a temporary session key to execute trades on your behalf.
            </p>
          </div>
          <WalletMultiButton className="!bg-white !text-black !font-black !uppercase !tracking-widest !rounded-sm hover:!bg-zinc-200 transition-all" />
        </div>
      )}

      {connected && !status.enabled && !isLoading && (
        <div className="p-8 bg-blue-500/5 border border-blue-500/20 rounded-sm flex flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            <ShieldCheck size={20} className="text-blue-500" />
            <span className="text-xs font-black text-white uppercase tracking-widest">Step 2: Authorize Bot Session</span>
          </div>
          <p className="text-[10px] text-zinc-500 font-mono text-center max-w-sm">
            Wallet connected. Now you need to sign a one-time message to authorize the bot to trade on your behalf.
          </p>
          <button 
            onClick={startBotWithWallet}
            className="px-6 py-2 bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-sm hover:bg-blue-600 transition-all"
          >
            Sign & Authorize
          </button>
        </div>
      )}

      {(connected || status.enabled) && (
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
