# Sentinel Auto-Trader 🚀

Sentinel is a high-performance, autonomous trading agent built on top of the **Bulk.trade** exchange. It combines technical analysis, algorithmic strategies, and a polished user interface to provide a seamless trading experience.

## 🏗 Architecture

The application is a full-stack TypeScript project:
- **Frontend**: React 19, Tailwind CSS, Framer Motion, and Lucide Icons.
- **Backend**: Node.js with Express, handling WebSocket connections and trade execution.
- **Core Engine**: Powered by `bulk-keychain-wasm` for high-performance transaction signing.

## ✨ Key Features

### 1. Autonomous Trading Agent
- **Algorithmic Analysis**: Uses RSI, MACD, Bollinger Bands, and ATR to make data-driven decisions.
- **Risk Management**: Implements automatic Stop-Loss (SL) and Take-Profit (TP) using ATR-based distancing.
- **Correlation Filter**: Prevents over-exposure by checking existing positions before opening new ones in the same direction.

### 2. Manual Trading Interface
- **Quick Execution**: Place Market or Limit orders directly from the UI.
- **Position Management**: View and close active positions with a single click.

### 3. Real-Time Data Stream
- **WebSocket Integration**: Direct connection to `api.early.bulk.trade` for account snapshots and order confirmations.
- **Live Logs**: Real-time feedback on bot actions and exchange responses.

### 4. Secure Authentication
- **SIWS (Sign-In With Solana)**: Secure login using Privy and Solana wallets.
- **Agent Delegation**: Authorize a temporary "Agent Wallet" to sign trades on your behalf without exposing your main private key.

## 🛠 How It Works

### The Connection Flow
1. **Authentication**: The user signs a SIWS message via their Solana wallet.
2. **Session Creation**: The backend receives a JWT from Privy and initializes a `BulkClient`.
3. **Agent Authorization**: The user authorizes an "Agent" (a generated keypair) to sign trades. This authorization is synced with the Bulk exchange.
4. **WebSocket Link**: The bot opens a persistent WebSocket connection to the exchange using the session token.
5. **Auto-Trading**: Every 5 minutes, the bot analyzes BTC, ETH, and SOL markets and executes trades based on the configured strategy.

### Technical Stack
- **`server.ts`**: Manages the `BulkClient` lifecycle, WebSocket auto-reconnection, and the auto-trading loop.
- **`src/lib/indicators.ts`**: Contains the mathematical logic for technical indicators and trade scoring.
- **`bulk-keychain-wasm`**: Handles the complex Ed25519 signing required by the Bulk protocol.

## 🚀 Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Set Environment Variables**:
   Create a `.env` file based on `.env.example`.
3. **Run Development Server**:
   ```bash
   npm run dev
   ```

## ⚠️ Disclaimer
This is an experimental trading bot. Cryptocurrency trading involves significant risk. Always test with small amounts and never trade money you cannot afford to lose.

---
*Built for the Bulk.trade Ecosystem.*
