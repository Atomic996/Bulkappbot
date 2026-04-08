import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
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
  Key,
  ChevronRight,
  Lock,
  Zap,
  Info,
  UserCheck
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import bs58 from 'bs58';
import init, { WasmKeypair, prepareAgentWallet } from 'bulk-keychain-wasm';

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
  exchangeConnected: boolean;
  address: string | null;
  orderType?: 'market' | 'limit' | 'auto';
}

const RAILWAY_BACKEND_URL = "https://bulkappbot-production.up.railway.app";

export const TradingBot: React.FC = () => {
  const { publicKey, signMessage, connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [status, setStatus] = React.useState<BotStatus>(() => {
    // Initial state from localStorage to prevent flicker
    const saved = typeof window !== 'undefined' ? localStorage.getItem('bot_has_session') : null;
    return {
      enabled: false,
      status: saved ? "Resuming..." : "Initializing...",
      balance: 0,
      positions: [],
      logs: [],
      hasSession: saved === 'true',
      exchangeConnected: false,
      address: typeof window !== 'undefined' ? localStorage.getItem('bot_address') : null
    };
  });
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isWasmReady, setIsWasmReady] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'auto' | 'manual'>('auto');
  const [manualTrade, setManualTrade] = React.useState({
    symbol: 'BTC-USD',
    side: 'buy' as 'buy' | 'sell',
    size: '0.01',
    price: '0',
    type: 'market' as 'market' | 'limit'
  });

  React.useEffect(() => {
    const initWasm = async () => {
      try {
        await init();
        setIsWasmReady(true);
      } catch (e) {
        console.error("Failed to initialize bulk-keychain WASM:", e);
      }
    };
    initWasm();
  }, []);

  React.useEffect(() => {
    const wsUrl = RAILWAY_BACKEND_URL.replace('http', 'ws') + '/ws/bulk';
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

  const fetchStatus = React.useCallback(async () => {
    try {
      // Debug log for fetch
      if (typeof window !== 'undefined') {
        const f = window.fetch;
        if (!f || f.toString().includes('native code') === false) {
          console.warn("Fetch might be polyfilled or modified:", f?.toString());
        }
      }

      const res = await axios.get(`${RAILWAY_BACKEND_URL}/api/bot/status`);
      if (res.data && typeof res.data === 'object') {
        setStatus(prev => ({
          ...prev,
          ...res.data,
          positions: res.data.positions || [],
          logs: res.data.logs || []
        }));
        
        // Persist session state in frontend to prevent flicker on reload
        if (typeof window !== 'undefined') {
          if (res.data.hasSession) {
            localStorage.setItem('bot_has_session', 'true');
            if (res.data.address) localStorage.setItem('bot_address', res.data.address);
          } else {
            localStorage.removeItem('bot_has_session');
            localStorage.removeItem('bot_address');
          }
        }
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

  React.useEffect(() => {
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

  const stopBot = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await axios.post(`${RAILWAY_BACKEND_URL}/api/bot/toggle`);
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
      
      const r = await axios.post(`${RAILWAY_BACKEND_URL}/api/bot/settings`, { orderType: nextType });
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
      // 1. Tell backend to clear session
      await axios.post(`${RAILWAY_BACKEND_URL}/api/bot/auth/logout`);
      
      // 2. Disconnect wallet locally
      disconnect();
      
      // 3. Reset local state
      setStatus(prev => ({ 
        ...prev, 
        enabled: false, 
        hasSession: false, 
        status: "Disconnected",
        address: null,
        balance: 0,
        positions: []
      }));
      
      // 4. Clear local storage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('walletName');
        localStorage.removeItem('bot_has_session');
        localStorage.removeItem('bot_address');
        localStorage.removeItem('bot_agent_privkey');
      }
    } catch (err) {
      console.error("Logout error:", err);
      // Fallback: still disconnect locally
      disconnect();
      setStatus(prev => ({ ...prev, hasSession: false }));
    } finally {
      setIsLoading(false);
    }
  };

  const authorizeAgent = async () => {
    if (!connected || !publicKey || !signMessage || !isWasmReady) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // 1. Generate a new Agent Keypair
      const agentKeypair = new WasmKeypair();
      const agentPubKey = agentKeypair.pubkey;
      const agentPrivKey = agentKeypair.toBase58();
      
      // 2. Prepare the Agent Authorization message
      const prepared = prepareAgentWallet(agentPubKey, false, {
        account: publicKey.toBase58(),
        signer: publicKey.toBase58(),
        nonce: Date.now()
      });
      
      // 3. Request signature from user's wallet
      const signatureBytes = await signMessage(prepared.messageBytes);
      
      let finalSignature: Uint8Array;
      if (signatureBytes instanceof Uint8Array) {
        finalSignature = signatureBytes;
      } else if ((signatureBytes as any).signature instanceof Uint8Array) {
        finalSignature = (signatureBytes as any).signature;
      } else {
        finalSignature = new Uint8Array(Object.values(signatureBytes as any));
      }
      
      const signature = bs58.encode(finalSignature);
      
      // 4. Finalize the authorization
      const finalized = prepared.finalize(signature);
      
      // 5. Submit to backend
      await axios.post(`${RAILWAY_BACKEND_URL}/api/bot/auth/agent`, {
        address: publicKey.toBase58(),
        agentPubKey,
        agentPrivKey,
        finalized
      });
      
      localStorage.setItem('bot_agent_privkey', agentPrivKey);
      
      // 6. Wait a bit before SIWS to ensure agent is saved on server
      await new Promise(r => setTimeout(r, 500));
      
      // 7. Now start SIWS independently
      await startSIWS();
      
    } catch (err: any) {
      console.error("Agent Authorization Error:", err);
      setError(err.message || "Failed to authorize agent");
      setIsLoading(false);
    }
  };

  const startSIWS = async () => {
    if (!connected || !publicKey || !signMessage) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const address = publicKey.toBase58();
      
      // 1. Init SIWS
      const initRes = await axios.post(`${RAILWAY_BACKEND_URL}/api/bot/auth/init`, { address });
      const { message } = initRes.data;
      
      // 2. Sign Message
      const encodedMessage = new TextEncoder().encode(message);
      const signatureBytes = await signMessage(encodedMessage);
      
      let finalSignature: Uint8Array;
      if (signatureBytes instanceof Uint8Array) {
        finalSignature = signatureBytes;
      } else if ((signatureBytes as any).signature instanceof Uint8Array) {
        finalSignature = (signatureBytes as any).signature;
      } else {
        finalSignature = new Uint8Array(Object.values(signatureBytes as any));
      }
      
      const signature = bs58.encode(finalSignature);
      
      // 3. Start Session
      const startRes = await axios.post(`${RAILWAY_BACKEND_URL}/api/bot/auth/start`, {
        address,
        message,
        signature
      });
      
      if (startRes.data.success) {
        fetchStatus();
      } else {
        setError("SIWS failed");
      }
    } catch (err: any) {
      console.error("SIWS Error:", err);
      setError(err.response?.data?.error || "Failed to sign in");
    } finally {
      setIsLoading(false);
    }
  };

  const executeManualTrade = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await axios.post(`${RAILWAY_BACKEND_URL}/api/bot/trade`, {
        ...manualTrade,
        size: parseFloat(manualTrade.size),
        price: parseFloat(manualTrade.price)
      });
      fetchStatus();
    } catch (err: any) {
      setError(err.response?.data?.error || "Trade failed");
    } finally {
      setIsLoading(false);
    }
  };

  const closePosition = async (symbol: string, size: number, side: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await axios.post(`${RAILWAY_BACKEND_URL}/api/bot/close`, { symbol, size, side });
      fetchStatus();
    } catch (err: any) {
      setError(err.response?.data?.error || "Close failed");
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
          {status.hasSession && (
            <div className="flex items-center gap-2">
              <div className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[8px] font-black uppercase tracking-widest",
                status.exchangeConnected 
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" 
                  : "bg-rose-500/10 border-rose-500/30 text-rose-500"
              )}>
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  status.exchangeConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                )} />
                {status.exchangeConnected ? "Exchange Connected" : "Exchange Disconnected"}
              </div>
              <button
                onClick={fetchStatus}
                disabled={isLoading}
                className="p-3 rounded-full bg-zinc-900 border border-white/10 text-zinc-500 hover:text-white transition-all"
                title="Refresh Data"
              >
                <Activity size={14} className={isLoading ? "animate-spin" : ""} />
              </button>
              <button
                onClick={toggleOrderType}
                className={cn(
                  "px-4 py-3 rounded-full font-black uppercase tracking-widest text-[9px] transition-all border",
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
                  "px-6 py-3 rounded-full font-black uppercase tracking-widest text-[9px] transition-all border",
                  status.enabled 
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-500 hover:bg-rose-500/20" 
                    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20"
                )}
              >
                {status.enabled ? "Stop Agent" : "Resume Agent"}
              </button>
            </div>
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
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-12 max-w-2xl mx-auto">
          <div className="relative">
            <div className="w-28 h-28 bg-blue-500/10 rounded-full flex items-center justify-center animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(59,130,246,0.4)]">
                <Lock size={36} className="text-white" />
              </div>
            </div>
            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-zinc-900 border border-white/10 rounded-full flex items-center justify-center shadow-xl">
              <Cpu size={18} className="text-blue-400" />
            </div>
          </div>
          
          <div className="flex flex-col items-center text-center gap-4">
            <div className="flex flex-col items-center">
              <h3 className="text-3xl font-black uppercase tracking-tighter text-white">
                {connected ? "Authorize Agent" : "Authorization Required"}
              </h3>
              <div className="h-1 w-12 bg-blue-500 rounded-full mt-2" />
            </div>
            
            <p className="text-zinc-400 text-sm font-mono leading-relaxed max-w-md">
              {connected 
                ? "Your wallet is connected. Now authorize the Sentinel AI Agent to execute trades on your behalf without requiring a signature for every transaction."
                : "To activate the Sentinel AI trading engine, please use the Connect Wallet button in the top navigation bar. Once connected, you will be prompted to authorize a secure session to begin high-speed market operations."
              }
            </p>

            {connected && (
              <div className="flex flex-col gap-3 w-full max-w-xs">
                <button
                  onClick={authorizeAgent}
                  disabled={isLoading || !isWasmReady}
                  className="px-8 py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 text-white font-black uppercase tracking-widest text-xs rounded-full transition-all shadow-[0_0_30px_rgba(37,99,235,0.3)] flex items-center justify-center gap-3 group"
                >
                  {isLoading ? (
                    <Activity size={16} className="animate-spin" />
                  ) : (
                    <UserCheck size={16} className="group-hover:scale-110 transition-transform" />
                  )}
                  {isLoading ? "Processing..." : "Authorize & Sign In"}
                </button>
                <button
                  onClick={startSIWS}
                  disabled={isLoading}
                  className="px-8 py-3 bg-zinc-900 border border-white/10 hover:border-white/20 text-zinc-400 hover:text-white font-black uppercase tracking-widest text-[10px] rounded-full transition-all flex items-center justify-center gap-3"
                >
                  Just Sign In (No Agent)
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-6 pt-4 opacity-50">
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-emerald-500" />
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Strategic Proxy</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock size={14} className="text-blue-500" />
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Isolated Execution</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mt-4">
            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-sm flex flex-col gap-2">
              <div className="flex items-center gap-2 text-white">
                <Activity size={14} className="text-blue-500" />
                <span className="text-[10px] font-black uppercase tracking-widest">Trend Following</span>
              </div>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                Executes trades based on high-probability technical setups and momentum confirmation.
              </p>
            </div>
            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-sm flex flex-col gap-2">
              <div className="flex items-center gap-2 text-white">
                <Info size={14} className="text-purple-500" />
                <span className="text-[10px] font-black uppercase tracking-widest">Risk Control</span>
              </div>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                Automated stop-loss and take-profit management for every position opened.
              </p>
            </div>
          </div>
        </div>
      )}

      {status.hasSession && (
        <div className="flex-1 flex flex-col gap-8 overflow-hidden">
          {/* Tab Switcher */}
          <div className="flex items-center gap-4 border-b border-white/5 pb-4">
            <button
              onClick={() => setActiveTab('auto')}
              className={cn(
                "px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border",
                activeTab === 'auto' 
                  ? "bg-blue-500/10 border-blue-500/30 text-blue-500" 
                  : "bg-zinc-900 border-white/5 text-zinc-500 hover:text-white"
              )}
            >
              Auto Bot
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              className={cn(
                "px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border",
                activeTab === 'manual' 
                  ? "bg-purple-500/10 border-purple-500/30 text-purple-500" 
                  : "bg-zinc-900 border-white/5 text-zinc-500 hover:text-white"
              )}
            >
              Manual Trade
            </button>
          </div>

          <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8 overflow-hidden">
            {/* Left Column */}
            <div className="flex flex-col gap-8 overflow-hidden">
              {activeTab === 'auto' ? (
                <>
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
                      <div className="grid grid-cols-6 p-4 border-b border-white/10 text-[8px] font-black uppercase tracking-widest text-zinc-500">
                        <span>Asset</span>
                        <span>Side</span>
                        <span>Size</span>
                        <span>Entry</span>
                        <span className="text-right">PnL</span>
                        <span className="text-right">Action</span>
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
                              <div key={i} className="grid grid-cols-6 p-4 border-b border-white/5 items-center hover:bg-white/[0.02] transition-colors">
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
                                <div className="text-right">
                                  <button
                                    onClick={() => closePosition(pos.symbol, size, size > 0 ? 'long' : 'short')}
                                    disabled={isLoading}
                                    className="text-[8px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-400 underline"
                                  >
                                    Close
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col gap-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Manual Trade Form */}
                    <div className="p-8 bg-zinc-900/40 border border-white/5 rounded-sm flex flex-col gap-6">
                      <div className="flex items-center gap-2">
                        <Zap size={16} className="text-purple-500" />
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-white">New Manual Order</h3>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                          <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Asset</label>
                          <select
                            value={manualTrade.symbol}
                            onChange={(e) => setManualTrade(prev => ({ ...prev, symbol: e.target.value }))}
                            className="bg-zinc-950 border border-white/10 rounded-sm p-3 text-xs font-mono text-white outline-none focus:border-purple-500/50 transition-colors"
                          >
                            <option value="BTC-USD">BTC-USD</option>
                            <option value="ETH-USD">ETH-USD</option>
                            <option value="SOL-USD">SOL-USD</option>
                          </select>
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Order Type</label>
                          <select
                            value={manualTrade.type}
                            onChange={(e) => setManualTrade(prev => ({ ...prev, type: e.target.value as any }))}
                            className="bg-zinc-950 border border-white/10 rounded-sm p-3 text-xs font-mono text-white outline-none focus:border-purple-500/50 transition-colors"
                          >
                            <option value="market">Market</option>
                            <option value="limit">Limit</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                          <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Side</label>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setManualTrade(prev => ({ ...prev, side: 'buy' }))}
                              className={cn(
                                "flex-1 py-3 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all border",
                                manualTrade.side === 'buy' 
                                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" 
                                  : "bg-zinc-950 border-white/10 text-zinc-500 hover:text-white"
                              )}
                            >
                              Buy
                            </button>
                            <button
                              onClick={() => setManualTrade(prev => ({ ...prev, side: 'sell' }))}
                              className={cn(
                                "flex-1 py-3 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all border",
                                manualTrade.side === 'sell' 
                                  ? "bg-rose-500/10 border-rose-500/30 text-rose-500" 
                                  : "bg-zinc-950 border-white/10 text-zinc-500 hover:text-white"
                              )}
                            >
                              Sell
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Size</label>
                          <input
                            type="text"
                            value={manualTrade.size}
                            onChange={(e) => setManualTrade(prev => ({ ...prev, size: e.target.value }))}
                            className="bg-zinc-950 border border-white/10 rounded-sm p-3 text-xs font-mono text-white outline-none focus:border-purple-500/50 transition-colors"
                            placeholder="0.01"
                          />
                        </div>
                      </div>

                      {manualTrade.type === 'limit' && (
                        <div className="flex flex-col gap-2">
                          <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Limit Price</label>
                          <input
                            type="text"
                            value={manualTrade.price}
                            onChange={(e) => setManualTrade(prev => ({ ...prev, price: e.target.value }))}
                            className="bg-zinc-950 border border-white/10 rounded-sm p-3 text-xs font-mono text-white outline-none focus:border-purple-500/50 transition-colors"
                            placeholder="0.00"
                          />
                        </div>
                      )}

                      <button
                        onClick={executeManualTrade}
                        disabled={isLoading}
                        className={cn(
                          "w-full py-4 rounded-full font-black uppercase tracking-widest text-xs transition-all shadow-lg flex items-center justify-center gap-3",
                          manualTrade.side === 'buy' 
                            ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20" 
                            : "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-500/20"
                        )}
                      >
                        {isLoading ? (
                          <Activity size={16} className="animate-spin" />
                        ) : (
                          <Zap size={16} />
                        )}
                        {isLoading ? "Executing..." : `Execute ${manualTrade.side.toUpperCase()} Order`}
                      </button>
                    </div>

                    {/* Account Info */}
                    <div className="flex flex-col gap-4">
                      <div className="p-6 bg-zinc-900/40 border border-white/5 rounded-sm flex flex-col gap-4">
                        <div className="flex items-center gap-2">
                          <Wallet size={16} className="text-blue-500" />
                          <h3 className="text-[10px] font-black uppercase tracking-widest text-white">Account Info</h3>
                        </div>
                        <div className="flex flex-col gap-4">
                          <div className="flex flex-col">
                            <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Available Balance</span>
                            <span className="text-2xl font-mono font-black text-white">${(status.balance || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Connected Address</span>
                            <span className="text-[10px] font-mono text-zinc-400 truncate">{status.address}</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-6 bg-purple-500/5 border border-purple-500/10 rounded-sm flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                          <ShieldCheck size={14} className="text-purple-500" />
                          <span className="text-[9px] font-black text-purple-200 uppercase tracking-widest">Agent Execution</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 leading-relaxed">
                          Manual trades are executed via your authorized Sentinel Agent. This ensures high-speed execution without requiring manual signatures for each order.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Logs */}
            <div className="flex flex-col gap-4 overflow-hidden">
              <div className="flex items-center gap-2 px-2">
                <Terminal size={16} className="text-zinc-500" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Execution Logs</h3>
              </div>
              <div className="flex-1 bg-zinc-950 border border-white/10 rounded-sm p-4 font-mono text-[10px] overflow-y-auto custom-scrollbar flex flex-col-reverse gap-2 shadow-inner">
                {status.logs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-800 gap-2">
                    <Terminal size={20} />
                    <span className="italic">Awaiting network activity...</span>
                  </div>
                ) : (
                  status.logs.map((log, i) => (
                    <div key={i} className="flex gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
                      <span className="text-zinc-600 shrink-0 select-none">{log.split(']')[0]}]</span>
                      <span className={cn(
                        "leading-relaxed",
                        log.includes('Placed') ? "text-emerald-400 font-bold" :
                        log.includes('Closing') ? "text-blue-400" :
                        log.includes('Failed') ? "text-rose-400 font-bold" : 
                        log.includes('Analyzing') ? "text-zinc-500 italic" : "text-zinc-400"
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
        </div>
      )}
    </div>
  );
};
