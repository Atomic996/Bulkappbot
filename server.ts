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
import { calculateIndicators, calculateTechnicalScore } from "./src/lib/indicators.js";
import { fetchHistoricalData } from "./src/lib/api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BULK_WS_URL = "wss://exchange-ws1.bulk.trade";
const ORIGIN_URL = "https://early.bulk.trade";
const PRIVY_APP_ID = "cmbuls93q01jol20lf0ak0plb";
const PRIVY_URL = "https://auth.privy.io/api/v1";
const SERVER_KEY = "bulk_flow_server_auth_key_2026_03_31";

// --- BOT STATE ---
let botEnabled = false;
let botStatus = "Idle";
let botBalance = 0;
let botAddress: string | null = null;
let botPositions: any[] = [];
let botLogs: string[] = [];

const pendingSessions = new Map<string, { message: string, sessionPrivKey: string, timestamp: number }>();

const app = express();
app.use(cors());
app.use(express.json());

// --- BOT API ROUTES ---
const botRouter = express.Router();

botRouter.get("/status", (req: Request, res: Response) => {
  res.json({
    enabled: botEnabled,
    status: botStatus,
    balance: botBalance,
    positions: botPositions,
    logs: botLogs,
    address: botAddress,
    hasSession: !!bulkClient
  });
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
        "Origin": "https://early.bulk.trade",
        "Referer": "https://early.bulk.trade/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json"
      },
      body: JSON.stringify({ address })
    });
    
    const r_init_data = await r_init_res.json() as any;
    const nonce = r_init_data.nonce;
    const ts = new Date().toISOString().replace(".000Z", "Z");
    
    // 2. Generate a temporary session key for the bot
    const sessionKeyPair = nacl.sign.keyPair();
    const sessionPubKey = bs58.encode(sessionKeyPair.publicKey);
    const sessionPrivKey = bs58.encode(sessionKeyPair.secretKey);

    // 3. Build the SIWS message (Exact format required by Privy)
    const message = 
      `early.bulk.trade wants you to sign in with your Solana account:\n${address}\n\n` +
      `You are proving you own ${address}.\n\n` +
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
  
  // 1. Retrieve session from memory
  const sessionData = pendingSessions.get(address);

  if (!sessionData || sessionData.message !== message) {
    return res.status(400).json({ error: "Invalid or expired session request. Please refresh and try again." });
  }

  if (botEnabled) {
    bulkClient?.stop();
  }

  const sessionKeyPair = nacl.sign.keyPair.fromSecretKey(bs58.decode(sessionData.sessionPrivKey));
  bulkClient = new BulkClient(sessionKeyPair);
  const ok = await bulkClient.authenticate(address, message, signature);
  
  if (ok) {
    // Cleanup
    pendingSessions.delete(address);

    bulkClient.connect();
    botEnabled = true;
    botStatus = "Monitoring";
    addBotLog("Bot Authorized & Started.");
    res.json({ success: true, enabled: true });
  } else {
    res.status(500).json({ error: "Authentication failed with Privy. Check server logs." });
  }
});

botRouter.post("/toggle", async (req: Request, res: Response) => {
  if (botEnabled) {
    bulkClient?.stop();
    res.json({ success: true, enabled: false });
  } else {
    res.status(400).json({ error: "Bot is not running" });
  }
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
    return res.status(500).json({ error: "NEWSDATA_API_KEY is missing in environment variables" });
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
  botLogs = [log, ...botLogs].slice(0, 50);
  broadcast({ type: "bot_log", data: log });
};

// --- BULK CLIENT CLASS ---
class BulkClient {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private address: string | null = null;
  private sessionKeyPair: nacl.SignKeyPair;

  constructor(sessionKeyPair: nacl.SignKeyPair) {
    this.sessionKeyPair = sessionKeyPair;
  }

  async authenticate(address: string, message: string, signature: string) {
    const headers = { 
      "Origin": "https://early.bulk.trade", 
      "Referer": "https://early.bulk.trade/", 
      "Privy-App-Id": PRIVY_APP_ID, 
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "application/json"
    };

    console.log("[Auth] Authenticating with Privy:", {
      address,
      message_preview: message.slice(0, 50) + "...",
      signature_preview: signature.slice(0, 20) + "..."
    });

    try {
      const r_auth_res = await fetch(`${PRIVY_URL}/siws/authenticate`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          connectorType: "solana_adapter",
          message: message,
          signature: signature,
          message_type: "plain",
          mode: "login-or-sign-up",
          walletClientType: "Phantom"
        })
      });

      const r_auth_data = await r_auth_res.json() as any;
      console.log("[Auth] Privy Response Success:", r_auth_data.token ? "Token Received" : "No Token");

      if (!r_auth_data.token) {
        console.error("[Auth] Privy Error Details:", r_auth_data);
        return false;
      }

      this.token = r_auth_data.token;
      this.address = address;
      botAddress = address;
      addBotLog(`Authenticated ${address.slice(0, 6)}...`);
      return true;
    } catch (err: any) {
      console.error("Bulk Auth Error:", err.message);
      return false;
    }
  }

  connect() {
    if (!this.token) return;
    this.ws = new WebSocket(BULK_WS_URL, { 
      headers: { 
        "Authorization": `Bearer ${this.token}`, 
        "Origin": ORIGIN_URL 
      } 
    });
    this.ws.on("open", () => {
      this.ws?.send(JSON.stringify({ method: "subscribe", id: 1, subscription: [{ type: "account", user: this.address }] }));
      addBotLog("Bot Session Connected.");
    });
    this.ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "account" && msg.data?.type === "accountSnapshot") {
          botBalance = parseFloat(msg.data.margin?.availableBalance || "0");
          botPositions = msg.data.positions || [];
          broadcast({ type: "bot_update", data: { balance: botBalance, positions: botPositions } });
        }
      } catch (e) {}
    });
    this.ws.on("close", () => { if (botEnabled) setTimeout(() => this.connect(), 5000); });
  }

  async sendAction(method: string, params: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const ts = Date.now();
    
    const action = { [method]: params };

    // ترتيب المفاتيح مهم — مثل Python OrderedDict
    const payload = {
      account: this.address,
      actions: [action],
      nonce: ts,
      type: "action"
    };

    // ← مهم جداً: بدون مسافات مثل Python separators=(',', ':')
    const payloadJson = JSON.stringify(payload, null, 0)
      .replace(/\s/g, '');

    const signatureBytes = nacl.sign.detached(
      Buffer.from(payloadJson),
      this.sessionKeyPair.secretKey
    );
    const signature = bs58.encode(signatureBytes);
    const signer = bs58.encode(this.sessionKeyPair.publicKey);

    const msg = {
      method: "post",
      id: ts,
      request: {
        type: "action",
        payload: {
          ...payload,
          signature,
          signer
        }
      }
    };
    
    this.ws.send(JSON.stringify(msg));
  }

  async setLeverage(symbol: string, leverage: number) {
    // Correct format from Python: {"updateUserSettings": {"m": {symbol: int(leverage)}}}
    await this.sendAction("updateUserSettings", { m: { [symbol]: leverage } });
    addBotLog(`Updated Leverage for ${symbol} to ${leverage}x`);
  }

  async placeOrder(symbol: string, side: 'buy' | 'sell', size: number) {
    // Formatting size based on asset (from Python logic)
    const formattedSize = symbol.startsWith("BTC") ? size.toFixed(4) : size.toFixed(2);
    
    // Python order structure: {"m": {"b": is_buy, "c": symbol, "r": False, "sz": size}}
    const params = {
      b: side === 'buy',
      c: symbol,
      r: false,
      sz: formattedSize
    };
    
    await this.sendAction("m", params);
    addBotLog(`Placed ${side.toUpperCase()} order for ${symbol} | Size: ${formattedSize}`);
  }

  async closePosition(symbol: string, size: number, side: string) {
    const formattedSize = symbol.startsWith("BTC") ? Math.abs(size).toFixed(4) : Math.abs(size).toFixed(2);
    const params = {
      b: side === 'short', // if closing short, we need to buy
      c: symbol,
      r: true, // reduceOnly
      sz: formattedSize,
      p: "0", // market
      tif: "ioc"
    };
    await this.sendAction("m", params);
    addBotLog(`Closing ${side.toUpperCase()} position for ${symbol}`);
  }

  stop() {
    this.ws?.close();
    botEnabled = false;
    botStatus = "Stopped";
    botAddress = null;
    addBotLog("Bot Stopped.");
  }
}

let bulkClient: BulkClient | null = null;

// --- WEBSOCKET SERVER ---
const wss = new WebSocketServer({ noServer: true });
const clients = new Set<WebSocket>();

wss.on("connection", (ws) => {
  clients.add(ws);
  const topWallets = Object.values(walletsLocal).sort((a, b) => Math.abs(b.totalPnL) - Math.abs(a.totalPnL)).slice(0, 50);
  ws.send(JSON.stringify({ type: "init_wallets", data: topWallets }));
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
        const tradeData = { symbol, price, size, side, walletId, timestamp, serverKey: SERVER_KEY };
        broadcast({ type: "trade", data: tradeData });

        if (!walletsLocal[walletId]) {
          walletsLocal[walletId] = { id: walletId, position: 'flat', entryPrice: null, entrySize: 0, totalPnL: 0, winCount: 0, tradeCount: 0, lastUpdate: timestamp };
        }
        const w = walletsLocal[walletId];
        w.lastUpdate = timestamp;
        if (w.position === 'flat') {
          w.position = side === 'buy' ? 'long' : 'short'; w.entryPrice = price; w.entrySize = size; w.tradeCount += 1;
        } else if ((w.position === 'long' && side === 'sell') || (w.position === 'short' && side === 'buy')) {
          const pnl = w.position === 'long' ? (price - w.entryPrice) * w.entrySize : (w.entryPrice - price) * w.entrySize;
          w.totalPnL += pnl; if (pnl > 0) w.winCount += 1; w.position = 'flat'; w.entryPrice = null; w.entrySize = 0;
        }
      }
      const now = Date.now();
      if (now - lastUIBroadcast > 3000) {
        lastUIBroadcast = now;
        const top = Object.values(walletsLocal).sort((a, b) => Math.abs(b.totalPnL) - Math.abs(a.totalPnL)).slice(0, 50);
        broadcast({ type: "wallets_update", data: top, stats: { activeWallets: Object.values(walletsLocal).filter(w => w.position !== 'flat').length, totalWallets: Object.keys(walletsLocal).length } });
      }
    } catch (e) {}
  });
  ws.on("close", () => setTimeout(connectBulkWS, 5000));
}
connectBulkWS();

// --- AUTO TRADER ---
const runAutoTrader = async () => {
  if (!botEnabled || !bulkClient) return;
  botStatus = "Analyzing...";
  for (const sym of ["BTC", "ETH", "SOL"]) {
    try {
      const history = await fetchHistoricalData(sym, "1H", 300);
      if (history.length < 200) continue;
      const indicators = calculateIndicators(history);
      const score = calculateTechnicalScore(indicators, history[history.length - 1].close);
      const symbol = `${sym}-USD`;
      const pos = botPositions.find(p => p.symbol === symbol);
      const size = pos ? parseFloat(pos.size) : 0;
      if (score > 85 && size <= 0) {
        if (size < 0) await bulkClient.closePosition(symbol, size, "short");
        await bulkClient.placeOrder(symbol, "buy", 0.01);
      } else if (score < 15 && size >= 0) {
        if (size > 0) await bulkClient.closePosition(symbol, size, "long");
        await bulkClient.placeOrder(symbol, "sell", 0.01);
      } else if ((size > 0 && score < 50) || (size < 0 && score > 50)) {
        await bulkClient.closePosition(symbol, size, size > 0 ? "long" : "short");
      }
    } catch (err) {}
  }
  botStatus = "Monitoring";
};
setInterval(runAutoTrader, 60000);

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
