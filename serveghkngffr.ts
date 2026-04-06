import express, { Request, Response } from "express";
import cors from "cors";
import WebSocket, { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import axios from "axios";
import fetch from "node-fetch";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { computeIndicators, calculateTechnicalScore, getTradeDecision, RISK_CONFIG, TradeDecision } from "./src/lib/indicators.js";
import { fetchHistoricalData } from "./src/lib/api.js";
// @ts-ignore
import { NativeKeypair, NativeSigner } from 'bulk-keychain';
import { BulkClient, BotUpdateData } from './src/lib/BulkClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BULK_WS_URL = "wss://exchange-ws1.bulk.trade";
const ORIGIN_URL = "https://early.bulk.trade";
const PRIVY_APP_ID = "cmbuls93q01jol20lf0ak0plb";
const PRIVY_URL = "https://auth.privy.io/api/v1";
const SERVER_KEY = "bulk_flow_server_auth_key_2026_03_31";

// ══════════════════════════════════════════
//   🤖 Bot State Management
// ══════════════════════════════════════════
interface BotState extends BotUpdateData {
  logs: string[];
  client: BulkClient | null;
  address: string | null;
  orderType: 'market' | 'limit' | 'auto';
}

const botState: BotState = {
  balance: 0,
  positions: [],
  enabled: false,
  status: "Idle",
  logs: ["Bot initialized. Waiting for connection..."],
  client: null,
  address: null,
  orderType: 'auto',
};

const pendingSessions = new Map<string, { message: string, sessionPrivKey: string, timestamp: number }>();

const app = express();
app.use(cors());
app.use(express.json());

// ══════════════════════════════════════════
//   🤖 Bot API Routes
// ══════════════════════════════════════════
const botRouter = express.Router();

botRouter.get("/status", (req: Request, res: Response) => {
  console.log(`[API] Status requested. Balance: $${botState.balance}, Session: ${!!botState.client}`);
  res.json({
    enabled: botState.enabled,
    status: botState.status,
    balance: botState.balance,
    positions: botState.positions,
    logs: botState.logs,
    address: botState.address,
    hasSession: !!botState.client,
    orderType: botState.orderType
  });
});

botRouter.post("/settings", (req: Request, res: Response) => {
  const { orderType } = req.body;
  if (orderType === 'market' || orderType === 'limit' || orderType === 'auto') {
    botState.orderType = orderType;
    addBotLog(`Order Type updated to: ${botState.orderType.toUpperCase()}`);
    res.json({ success: true, orderType: botState.orderType });
  } else {
    res.status(400).json({ error: "Invalid order type" });
  }
});

botRouter.post("/auth/init", async (req: Request, res: Response) => {
  const { address } = req.body;
  if (!address) return res.status(400).json({ error: "Address is required" });

  try {
    console.log(`[Auth] Initializing SIWS for: ${address}`);
    
    // 1. Get nonce from Privy
    const r_init_res = await fetch(`${PRIVY_URL}/siws/init`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Privy-App-Id": PRIVY_APP_ID,
        "Origin": ORIGIN_URL,
        "Referer": `${ORIGIN_URL}/`,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json"
      },
      body: JSON.stringify({ address })
    });
    
    if (!r_init_res.ok) {
      const errorText = await r_init_res.text();
      console.error(`[Auth] Privy Init Failed: ${r_init_res.status}`, errorText);
      throw new Error(`Privy SIWS Init Failed: ${r_init_res.status}`);
    }

    const r_init_data = await r_init_res.json() as any;
    const nonce = r_init_data.nonce;
    const ts = new Date().toISOString().replace(".000Z", "Z");
    
    // 2. Generate a temporary session key for the bot using bulk-keychain
    const keypair = new NativeKeypair();
    const sessionPubKey = keypair.address();
    const sessionPrivKey = keypair.toBase58();

    // 3. Build the SIWS message (Explicitly include the session key for stability)
    const message = 
      `early.bulk.trade wants you to sign in with your Solana account:\n${address}\n\n` +
      `Authorize session key ${sessionPubKey} to trade on your behalf.\n\n` +
      `URI: https://early.bulk.trade\n` +
      `Version: 1\n` +
      `Chain ID: mainnet\n` +
      `Nonce: ${nonce}\n` +
      `Issued At: ${ts}\n` +
      `Resources:\n- https://privy.io`;

    // 4. Store session data in memory (Railway is persistent)
    pendingSessions.set(address, {
      message,
      sessionPrivKey,
      timestamp: Date.now()
    });
    
    console.log(`[Auth] Message generated and stored for ${address}`);
    res.json({ nonce, message });
  } catch (err: any) {
    const errorData = err.response?.data;
    console.error("[Auth] SIWS Init Error:", errorData || err.message);
    res.status(500).json({ 
      error: "SIWS Initialization Failed", 
      message: err.message,
      details: errorData 
    });
  }
});

botRouter.post("/auth/start", async (req: Request, res: Response) => {
  const { address, message, signature } = req.body;
  
  const sessionData = pendingSessions.get(address);

  if (!sessionData || sessionData.message !== message) {
    return res.status(400).json({ error: "Invalid or expired session request. Please refresh and try again." });
  }

  if (botState.enabled) {
    botState.client?.stop();
  }

  const keypair = NativeKeypair.fromBase58(sessionData.sessionPrivKey);
  botState.client = new BulkClient(
    keypair,
    (update) => {
      Object.assign(botState, update);
      broadcast({ type: "bot_update", data: botState });
    },
    (msg) => addBotLog(msg)
  );

  const ok = await botState.client.authenticate(address, message, signature);
  
  if (ok) {
    pendingSessions.delete(address);
    botState.client.connect();
    botState.enabled = true;
    botState.status = "Monitoring";
    botState.address = address;
    addBotLog("Bot Authorized & Started.");
    res.json({ success: true, enabled: true });
  } else {
    res.status(500).json({ error: "Authentication failed with Privy. Check server logs." });
  }
});

botRouter.post("/toggle", async (req: Request, res: Response) => {
  if (!botState.client) return res.status(400).json({ error: "No active session. Please authorize first." });
  
  botState.enabled = !botState.enabled;
  botState.status = botState.enabled ? "Monitoring" : "Idle";
  addBotLog(botState.enabled ? "Auto-Trader Enabled." : "Auto-Trader Disabled.");
  
  res.json({ success: true, enabled: botState.enabled, status: botState.status });
});

app.use("/api/bot", botRouter);

// News Cache
const newsCache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_TTL = 15 * 60 * 1000;

app.get("/api/news", async (req: Request, res: Response) => {
  const symbol = (req.query.symbol as string) || "BTC";
  const cacheKey = symbol.toUpperCase();
  
  if (newsCache[cacheKey] && Date.now() - newsCache[cacheKey].timestamp < CACHE_TTL) {
    return res.json(newsCache[cacheKey].data);
  }

  const newsDataApiKey = process.env.NEWSDATA_API_KEY;
  if (!newsDataApiKey || newsDataApiKey === "") {
    console.warn("[News] NEWSDATA_API_KEY is missing. Returning empty news list.");
    return res.json([]);
  }

  try {
    const response = await axios.get('https://newsdata.io/api/1/news', {
      params: { apikey: newsDataApiKey, q: symbol.toUpperCase(), language: 'en', category: 'business,technology' },
      timeout: 5000
    });

    if (response.data?.status === 'success' && Array.isArray(response.data.results)) {
      const unifiedNews = response.data.results.map((n: any) => ({
        id: n.article_id || Math.random().toString(36).substr(2, 9),
        title: n.title,
        url: n.link,
        published_at: n.pubDate,
        source: n.source_id || 'NewsData.io',
      }));
      newsCache[cacheKey] = { data: unifiedNews, timestamp: Date.now() };
      return res.json(unifiedNews);
    }
  } catch (error) {}
  if (newsCache[cacheKey]) return res.json(newsCache[cacheKey].data);
  res.status(503).json({ error: "News service unavailable" });
});

app.get("/api/health", (req: Request, res: Response) => res.json({ status: "ok" }));

// --- HELPER FUNCTIONS ---
const addBotLog = (msg: string) => {
  const log = `[${new Date().toLocaleTimeString()}] ${msg}`;
  botState.logs = [log, ...botState.logs].slice(0, 50);
  broadcast({ type: "bot_log", data: log });
};

// --- REMOVED OLD BULK CLIENT CLASS ---

// --- WEBSOCKET SERVER ---
const wss = new WebSocketServer({ noServer: true });
const clients = new Set<WebSocket>();

wss.on("connection", (ws) => {
  clients.add(ws);
  const topWallets = Object.values(walletsLocal).sort((a, b) => Math.abs(b.totalPnL) - Math.abs(a.totalPnL)).slice(0, 50);
  ws.send(JSON.stringify({ type: "init_wallets", data: topWallets }));
  
  // Send current bot status to the new client
  ws.send(JSON.stringify({ 
    type: "bot_update", 
    data: botState
  }));

  ws.on("close", () => clients.delete(ws));
});

function broadcast(message: any) {
  const payload = JSON.stringify(message);
  clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(payload); });
}

// --- BACKGROUND WORKER ---
let ws: WebSocket | null = null;
const walletsLocal: Record<string, any> = {};
let lastWalletSync = Date.now();
let lastUIBroadcast = Date.now();

function connectBulkWS() {
  ws = new WebSocket(BULK_WS_URL);
  ws.on("open", () => {
    ws?.send(JSON.stringify({ method: "subscribe", subscription: [{ type: "trades", symbol: "BTC-USD" }, { type: "trades", symbol: "ETH-USD" }, { type: "trades", symbol: "SOL-USD" }] }));
  });
  ws.on("message", async (data) => {
    try {
      const message = JSON.parse(data.toString());
      if (message.type !== "trades" || !Array.isArray(message.data?.trades)) return;
      
      for (const t of message.data.trades) {
        const symbol = t.s;
        const price = parseFloat(t.px);
        const size = parseFloat(t.sz);
        const side = t.side ? 'buy' : 'sell';
        const walletId = t.taker;
        const timestamp = Date.now();
        
        if (isNaN(price) || isNaN(size)) continue;

        const tradeData = { symbol, price, size, side, walletId, timestamp, serverKey: SERVER_KEY };
        broadcast({ type: "trade", data: tradeData });

        if (!walletsLocal[walletId]) {
          walletsLocal[walletId] = { 
            id: walletId, 
            position: 'flat', 
            entryPrice: null, 
            entrySize: 0, 
            totalPnL: 0, 
            winCount: 0, 
            tradeCount: 0, 
            lastUpdate: timestamp 
          };
        }
        
        const w = walletsLocal[walletId];
        w.lastUpdate = timestamp;
        
        if (w.position === 'flat') {
          w.position = side === 'buy' ? 'long' : 'short'; 
          w.entryPrice = price; 
          w.entrySize = size; 
          w.tradeCount += 1;
        } else if ((w.position === 'long' && side === 'sell') || (w.position === 'short' && side === 'buy')) {
          const pnl = w.position === 'long' ? (price - w.entryPrice) * w.entrySize : (w.entryPrice - price) * w.entrySize;
          w.totalPnL += pnl; 
          if (pnl > 0) w.winCount += 1; 
          w.position = 'flat'; 
          w.entryPrice = null; 
          w.entrySize = 0;
        }
      }
      
      const now = Date.now();
      if (now - lastUIBroadcast > 3000) {
        lastUIBroadcast = now;
        const top = Object.values(walletsLocal)
          .sort((a, b) => Math.abs(b.totalPnL) - Math.abs(a.totalPnL))
          .slice(0, 50);
        broadcast({ 
          type: "wallets_update", 
          data: top, 
          stats: { 
            activeWallets: Object.values(walletsLocal).filter(w => w.position !== 'flat').length, 
            totalWallets: Object.keys(walletsLocal).length 
          } 
        });
      }
    } catch (e) {
      console.error("[BulkWS] Error processing message:", e);
    }
  });
  ws.on("close", () => setTimeout(connectBulkWS, 5000));
}
connectBulkWS();

// --- AUTO TRADER ---
const runAutoTrader = async () => {
  if (!botState.enabled || !botState.client) return;
  botState.status = "Analyzing...";
  
  for (const sym of ["BTC", "ETH", "SOL"]) {
    try {
      await new Promise(r => setTimeout(r, 2000)); // Avoid rate limits
      
      const history = await fetchHistoricalData(sym, "1H", 300);
      if (history.length < 200) {
        addBotLog(`⚠️ ${sym}: Not enough data (${history.length}/200)`);
        continue;
      }

      const symbol = `${sym}-USD`;
      const pos = botState.positions.find(p => p.symbol === symbol);
      const currentPosition = pos 
        ? { size: parseFloat(pos.size), entryPrice: parseFloat(pos.price) } 
        : null;

      const decision = getTradeDecision(history, botState.balance, symbol, currentPosition);
      const currentPrice = history[history.length - 1].close;
      
      addBotLog(`📊 ${sym} | ${decision.regime} | [${decision.strategy}] | Score: ${decision.score.toFixed(0)} | → ${decision.action}`);
      if (decision.reason) addBotLog(`   ${decision.reason}`);

      // Check for over-trading
      if ((decision.action === 'BUY' || decision.action === 'SELL') && !currentPosition) {
        if (botState.positions.length >= RISK_CONFIG.maxOpenPositions) {
          addBotLog(`⚠️ Max positions reached (${RISK_CONFIG.maxOpenPositions}). Skipping ${sym}.`);
          continue;
        }
      }

      switch (decision.action) {
        case 'BUY':
          const buyType = botState.orderType === 'auto' ? decision.orderType : botState.orderType;
          await botState.client.placeOrder(symbol, "buy", decision.size, currentPrice, buyType, decision.stopLossPrice, decision.takeProfitPrice);
          break;
        case 'SELL':
          const sellType = botState.orderType === 'auto' ? decision.orderType : botState.orderType;
          await botState.client.placeOrder(symbol, "sell", decision.size, currentPrice, sellType, decision.stopLossPrice, decision.takeProfitPrice);
          break;
        case 'CLOSE_LONG':
          if (currentPosition) await botState.client.closePosition(symbol, currentPosition.size, "long");
          break;
        case 'CLOSE_SHORT':
          if (currentPosition) await botState.client.closePosition(symbol, currentPosition.size, "short");
          break;
        default:
          // HOLD - do nothing
          break;
      }
    } catch (err: any) {
      addBotLog(`❌ ${sym} Error: ${err.message}`);
    }
  }
  botState.status = "Monitoring";
};
setInterval(runAutoTrader, 5 * 60 * 1000);

// --- SERVER START ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  const PORT = Number(process.env.PORT) || 3000;
  const server = app.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));
  server.on("upgrade", (request, socket, head) => {
    if (request.url === "/ws/bulk") wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, request));
  });
}

startServer().catch(err => { console.error("FATAL:", err); process.exit(1); });

export default app;
