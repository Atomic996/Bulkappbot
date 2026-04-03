import React, { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { motion } from 'motion/react';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  History, 
  ShieldCheck, 
  ExternalLink,
  Copy,
  CheckCircle2,
  RefreshCw,
  Coins,
  ChevronLeft
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface WalletViewProps {
  onBack?: () => void;
}

export const WalletView: React.FC<WalletViewProps> = ({ onBack }) => {
  const { publicKey, connected, wallet, select } = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchBalance = async () => {
    if (!publicKey) return;
    setIsLoading(true);
    try {
      const bal = await connection.getBalance(publicKey);
      setBalance(bal / LAMPORTS_PER_SOL);
    } catch (err) {
      console.error("Failed to fetch balance:", err instanceof Error ? err.message : err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (connected && publicKey) {
      fetchBalance();
    }
  }, [connected, publicKey, connection]);

  const copyAddress = () => {
    if (!publicKey) return;
    navigator.clipboard.writeText(publicKey.toBase58());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!connected) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
        <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center">
          <Wallet size={40} className="text-blue-500" />
        </div>
        <div className="flex flex-col items-center text-center gap-2 max-w-sm">
          <h2 className="text-2xl font-black uppercase tracking-tighter text-white">Connect Wallet</h2>
          <p className="text-zinc-500 text-sm font-mono leading-relaxed">
            Connect your Solana wallet to view your assets, transaction history, and manage your bot session.
          </p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <WalletMultiButton className="!bg-white !text-black !font-black !uppercase !tracking-widest !rounded-sm hover:!bg-zinc-200 transition-all !h-12 !px-8" />
          {wallet && !connected && (
            <button 
              onClick={() => select(null)}
              className="text-[10px] font-black text-zinc-500 uppercase tracking-widest hover:text-white transition-colors underline underline-offset-4"
            >
              Change Wallet
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-8 p-4 md:p-8 overflow-y-auto custom-scrollbar">
      {/* Back Button for Mobile UX */}
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="p-2 bg-white/5 border border-white/10 rounded-sm hover:bg-white/10 transition-all text-zinc-400 hover:text-white"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex flex-col">
          <h2 className="text-sm font-black text-white uppercase tracking-tighter">Wallet Hub</h2>
          <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest">Manage your assets</span>
        </div>
      </div>

      {/* Wallet Header Card */}
      <div className="relative p-8 bg-zinc-900/40 border border-white/10 rounded-sm overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Wallet size={120} />
        </div>
        
        <div className="relative z-10 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center font-black text-black">
                {publicKey?.toBase58().slice(0, 1)}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Connected Wallet</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-bold text-white">
                    {publicKey?.toBase58().slice(0, 6)}...{publicKey?.toBase58().slice(-6)}
                  </span>
                  <button onClick={copyAddress} className="text-zinc-500 hover:text-white transition-colors">
                    {copied ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>
            <button 
              onClick={fetchBalance}
              disabled={isLoading}
              className="p-2 hover:bg-white/5 rounded-full transition-colors text-zinc-500"
            >
              <RefreshCw size={18} className={cn(isLoading && "animate-spin")} />
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Total Balance</span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-mono font-black text-white tracking-tighter">
                {balance !== null ? balance.toFixed(4) : '0.0000'}
              </span>
              <span className="text-lg font-black text-blue-500 uppercase tracking-widest">SOL</span>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-4 border-t border-white/5">
            <button className="flex-1 py-3 bg-white text-black font-black uppercase tracking-widest text-[10px] rounded-sm flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all">
              <ArrowUpRight size={14} /> Send
            </button>
            <button className="flex-1 py-3 bg-zinc-800 text-white font-black uppercase tracking-widest text-[10px] rounded-sm flex items-center justify-center gap-2 hover:bg-zinc-700 transition-all">
              <ArrowDownLeft size={14} /> Receive
            </button>
          </div>
        </div>
      </div>

      {/* Assets Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <Coins size={16} className="text-zinc-500" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Your Assets</h3>
          </div>
          <span className="text-[8px] font-mono text-zinc-500 uppercase">Mainnet-Beta</span>
        </div>
        
        <div className="grid gap-2">
          <div className="p-4 bg-zinc-900/20 border border-white/5 rounded-sm flex items-center justify-between hover:bg-white/[0.02] transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500/10 rounded-full flex items-center justify-center">
                <div className="w-4 h-4 bg-blue-500 rounded-full" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white">Solana</span>
                <span className="text-[9px] font-mono text-zinc-500 uppercase">SOL</span>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs font-mono font-bold text-white">{balance?.toFixed(4) || '0.0000'}</span>
              <span className="text-[9px] font-mono text-zinc-500 uppercase">≈ ${( (balance || 0) * 150 ).toLocaleString()}</span>
            </div>
          </div>
          
          <div className="p-8 border border-dashed border-white/5 rounded-sm flex flex-col items-center justify-center text-center gap-2 opacity-40">
            <History size={20} className="text-zinc-600" />
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600">No other tokens found</span>
          </div>
        </div>
      </div>

      {/* Security Info */}
      <div className="p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-sm flex items-start gap-4">
        <ShieldCheck size={20} className="text-emerald-500 shrink-0" />
        <div className="flex flex-col gap-1">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Security Verified</h4>
          <p className="text-[10px] text-zinc-500 leading-relaxed">
            Your wallet is connected via a secure provider. All transactions require your explicit approval within your wallet application.
          </p>
        </div>
      </div>

      {/* Footer Links */}
      <div className="flex items-center justify-center gap-6 pt-4">
        <a 
          href={`https://solscan.io/account/${publicKey?.toBase58()}`} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-[9px] font-black text-zinc-500 uppercase tracking-widest hover:text-white transition-colors"
        >
          View on Solscan <ExternalLink size={10} />
        </a>
      </div>
    </div>
  );
};
