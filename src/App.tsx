/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
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

  // You can also provide a custom RPC endpoint.
  const endpoint = React.useMemo(() => clusterApiUrl(network), [network]);

  // Provide Phantom wallet for all devices
  const wallets = React.useMemo(() => [
    new PhantomWalletAdapter()
  ], []);

  const onError = React.useCallback((error: any) => {
    console.error("Wallet Error:", error instanceof Error ? error.message : String(error));
  }, []);

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
