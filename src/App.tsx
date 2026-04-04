/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useCallback } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { 
  PhantomWalletAdapter
} from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import { Cpu } from 'lucide-react';
import { Dashboard } from './components/Dashboard.js';

// Default styles that can be overridden by your app
import '@solana/wallet-adapter-react-ui/styles.css';

export default function App() {
  // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'.
  const network = WalletAdapterNetwork.Mainnet;

  // Check if user is on desktop
  const isDesktop = useMemo(() => {
    if (typeof window === 'undefined') return true;
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    const isTablet = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/.test(userAgent);
    return !isMobile && !isTablet;
  }, []);

  // You can also provide a custom RPC endpoint.
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  // Only Phantom wallet, and only if on desktop
  const wallets = useMemo(() => {
    if (!isDesktop) return [];
    return [new PhantomWalletAdapter()];
  }, [isDesktop]);

  const onError = useCallback((error: any) => {
    console.error("Wallet Error:", error instanceof Error ? error.message : String(error));
  }, []);

  if (!isDesktop) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 text-center font-sans relative overflow-hidden">
        {/* Background Grid */}
        <div className="fixed inset-0 pointer-events-none opacity-20 z-0" 
             style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        
        <div className="relative z-10 max-w-md w-full bg-zinc-900/40 backdrop-blur-xl border border-white/10 p-10 rounded-sm shadow-2xl">
          <div className="w-16 h-16 bg-white rounded-sm flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(255,255,255,0.1)]">
            <Cpu className="text-black" size={32} strokeWidth={2.5} />
          </div>
          
          <h1 className="text-2xl font-black tracking-tighter uppercase italic mb-4 text-white">
            Desktop Terminal Only
          </h1>
          
          <div className="h-px w-12 bg-rose-500 mx-auto mb-6" />
          
          <p className="text-zinc-400 text-sm leading-relaxed mb-8 font-mono uppercase tracking-tight">
            The Sentinel.AI high-frequency trading terminal and Phantom Wallet integration are strictly optimized for desktop environments.
          </p>
          
          <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-sm mb-8">
            <p className="text-rose-400 text-[10px] font-black uppercase tracking-widest">
              Access Restricted: Mobile/Tablet Device Detected
            </p>
          </div>
          
          <p className="text-zinc-500 text-[10px] uppercase tracking-[0.2em] font-black">
            Please connect via PC or Laptop
          </p>
        </div>
        
        <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-1 opacity-30">
          <span className="text-[10px] font-black tracking-tighter uppercase italic">Sentinel.AI</span>
          <span className="text-[8px] font-mono uppercase tracking-widest">v2.4.0 Secure Node</span>
        </div>
      </div>
    );
  }

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={true} onError={onError}>
        <WalletModalProvider>
          <div className="min-h-screen bg-black">
            <Dashboard />
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
