import express from "express";
import { createServer as createViteServer } from "vite";
import WebSocket, { WebSocketServer } from "ws";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, addDoc } from "firebase/firestore";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import axios from "axios";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { calculateIndicators, calculateTechnicalScore } from "./src/lib/indicators";
import { fetchHistoricalData } from "./src/lib/api";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Firebase Config
const configPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

// Initialize Firebase Client SDK (Uses API Key, subject to Security Rules)
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

const BULK_WS_URL = "wss://exchange-ws1.bulk.trade";
const SERVER_KEY = "bulk_flow_server_auth_key_2026_03_31";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // --- BOT STATE ---
  let botEnabled = false;
  let botStatus = "Idle";
  let botBalance = 0;
  let botAddress: string | null = null;
  let botPositions: any[] = [];
  let botLogs: string[] = [];

  app.use(express.json());

  // --- BOT API ROUTES ---
  app.get("/api/bot/status", (req, res) => {
    console.log("GET /api/bot/status hit");
    res.json({
      enabled: botEnabled,
      status: botStatus,
      balance: botBalance,
      positions: botPositions,
      logs: botLogs,
      address: botAddress,
      hasKey: true
    });
  });

  app.post("/api/bot/auth/init", async (req, res) => {
    console.log("POST /api/bot/auth/init hit");
    const { address } = req.body;
    if (!address) return res.status(400).json({ error: "Address is required" });

    const PRIVY_APP_ID = "cmbuls93q01jol20lf0ak0plb";
    const PRIVY_URL = "https://auth.privy.io/api/v1";
    const ORIGIN_URL = "https://early.bulk.trade";

    try {
      const r_init = await axios.post(`${PRIVY_URL}/siws/init`, { address }, {
        headers: {
          "Origin": ORIGIN_URL,
          "Privy-App-Id": PRIVY_APP_ID,
          "Content-Type": "application/json"
        }
      });
      
      const nonce = r_init.data.nonce;
      const ts = new Date().toISOString();
      const message = `early.bulk.trade wants you to sign in with your Solana account:\n${address}\n\n` +
                      `You are proving you own ${address}.\n\nURI: https://early.bulk.trade\n` +
                      `Version: 1\nChain ID: mainnet\nNonce: ${nonce}\nIssued At: ${ts}\nResources:\n- https://privy.io`;

      res.json({ nonce, message });
    } catch (err) {
      console.error("SIWS Init Error:", err);
      res.status(500).json({ error: "Failed to init auth" });
    }
  });

  app.post("/api/bot/auth/start", async (req, res) => {
    console.log("POST /api/bot/auth/start hit");
    const { address, message, signature } = req.body;
    
    if (botEnabled) {
      bulkClient?.stop();
    }

    bulkClient = new BulkClient();
    const ok = await bulkClient.authenticate(address, message, signature);
    if (ok) {
      bulkClient.connect();
      botEnabled = true;
      botStatus = "Monitoring";
      addBotLog("Bot Started with Wallet.");
      res.json({ success: true, enabled: true });
    } else {
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  app.post("/api/bot/toggle", async (req, res) => {
    console.log("POST /api/bot/toggle hit");
    if (botEnabled) {
      bulkClient?.stop();
      res.json({ success: true, enabled: false });
    } else {
      res.status(400).json({ error: "Bot is not running" });
    }
  });

  // API Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // News Cache and Backoff
  const newsCache: Record<string, { data: any; timestamp: number }> = {};
  const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
  let cryptoPanicBackoffUntil = 0;

  // News Proxy to avoid CORS and Rate Limiting
  app.get("/api/news", async (req, res) => {
    const symbol = (req.query.symbol as string) || "BTC";
    const cacheKey = symbol.toUpperCase();
    
    // Check cache
    if (newsCache[cacheKey] && Date.now() - newsCache[cacheKey].timestamp < CACHE_TTL) {
      return res.json(newsCache[cacheKey].data);
    }

    const newsDataApiKey = process.env.NEWSDATA_API_KEY;
    
    if (!newsDataApiKey) {
      console.error("NEWSDATA_API_KEY is missing in environment variables.");
      return res.status(500).json({ error: "News service configuration error" });
    }

    try {
      const response = await axios.get('https://newsdata.io/api/1/news', {
        params: {
          apikey: newsDataApiKey,
          q: symbol.toUpperCase(),
          language: 'en',
          category: 'business,technology'
        },
        timeout: 5000
      });

      if (response.data && response.data.status === 'success' && Array.isArray(response.data.results)) {
        const unifiedNews = response.data.results.map((n: any) => ({
          id: n.article_id || Math.random().toString(36).substr(2, 9),
          title: n.title,
          url: n.link,
          published_at: n.pubDate,
          source: n.source_id || 'NewsData.io',
        }));

        newsCache[cacheKey] = { data: unifiedNews, timestamp: Date.now() };
        return res.json(unifiedNews);
      } else {
        console.warn(`NewsData.io returned unexpected format for ${symbol}:`, response.data);
      }
    } catch (error) {
      console.error(`NewsData.io failed for ${symbol}:`, axios.isAxiosError(error) ? error.message : error);
    }

    // Final fallback: stale cache
    if (newsCache[cacheKey]) {
      return res.json(newsCache[cacheKey].data);
    }

    res.status(503).json({ error: "News service unavailable" });
  });

  // Background Worker: Bulk WebSocket to Firestore
  let ws: WebSocket | null = null;
  const walletsLocal: Record<string, any> = {};
  const tradeBuffer: any[] = [];
  let lastWalletSync = Date.now();
  let lastUIBroadcast = Date.now();
  const SYNC_INTERVAL = 60 * 1000; // Sync wallets to DB every 60 seconds
  const UI_BROADCAST_INTERVAL = 3000; // Broadcast to UI every 3 seconds for "Live" feel
  const WHALE_THRESHOLD = 50000; // Only save trades > $50k to Firestore

  function connectBulkWS() {
    console.log("Connecting to Bulk WebSocket...");
    ws = new WebSocket(BULK_WS_URL);

    ws.on("open", () => {
      console.log("Bulk WebSocket connected");
      ws?.send(JSON.stringify({
        method: "subscribe",
        subscription: [
          { type: "trades", symbol: "BTC-USD" },
          { type: "trades", symbol: "ETH-USD" },
          { type: "trades", symbol: "SOL-USD" }
        ]
      }));
    });

    const seenInBatch = new Set<string>();

    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type !== "trades" || !message.data || !message.data.trades) return;

        const rawTrades = message.data.trades;
        if (!Array.isArray(rawTrades)) return;

        for (const t of rawTrades) {
          const symbol = t.s;
          const price = parseFloat(t.px);
          const size = parseFloat(t.sz);
          if (isNaN(price) || isNaN(size)) continue;

          const side = t.side ? 'buy' : 'sell';
          const walletId = t.taker;
          const timestamp = Date.now();

          const tradeKey = `${symbol}-${price}-${size}-${side}-${walletId}`;
          if (seenInBatch.has(tradeKey)) continue;
          seenInBatch.add(tradeKey);
          if (seenInBatch.size > 1000) seenInBatch.clear();

          const tradeValue = price * size;
          const tradeData = { 
            symbol, 
            price, 
            size, 
            side, 
            walletId, 
            timestamp,
            serverKey: SERVER_KEY 
          };

          // Broadcast to all connected clients immediately (Bypasses Firestore)
          broadcast({ type: "trade", data: tradeData });

          // 1. Save Trade ONLY if it's a Whale trade to save quota
          if (tradeValue >= WHALE_THRESHOLD) {
            try {
              await addDoc(collection(db, "trades"), tradeData);
            } catch (err: any) {
              if (err?.message?.includes('RESOURCE_EXHAUSTED')) {
                console.error("Firestore Quota Exceeded for trades. Skipping write.");
              } else {
                console.error(`Error saving trade to Firestore: ${err instanceof Error ? err.message : String(err)}`);
              }
            }
          }

          // 2. Update Wallet State (In-memory)
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

          const wallet = walletsLocal[walletId];
          wallet.lastUpdate = timestamp;
          wallet.serverKey = SERVER_KEY;

          if (wallet.position === 'flat') {
            wallet.position = side === 'buy' ? 'long' : 'short';
            wallet.entryPrice = price;
            wallet.entrySize = size;
            wallet.tradeCount += 1;
          } else if (wallet.position === 'long' && side === 'sell') {
            const pnl = (price - (wallet.entryPrice || 0)) * wallet.entrySize;
            wallet.totalPnL += pnl;
            if (pnl > 0) wallet.winCount += 1;
            wallet.position = 'flat';
            wallet.entryPrice = null;
            wallet.entrySize = 0;
          } else if (wallet.position === 'short' && side === 'buy') {
            const pnl = ((wallet.entryPrice || 0) - price) * wallet.entrySize;
            wallet.totalPnL += pnl;
            if (pnl > 0) wallet.winCount += 1;
            wallet.position = 'flat';
            wallet.entryPrice = null;
            wallet.entrySize = 0;
          }
        }

        // 3. Periodic Broadcast to UI (Bypasses Firestore Quota)
        const now = Date.now();
        if (now - lastUIBroadcast > UI_BROADCAST_INTERVAL) {
          lastUIBroadcast = now;
          const topWallets = Object.values(walletsLocal)
            .sort((a, b) => Math.abs(b.totalPnL) - Math.abs(a.totalPnL))
            .slice(0, 50);
          
          broadcast({ 
            type: "wallets_update", 
            data: topWallets,
            stats: {
              activeWallets: Object.values(walletsLocal).filter(w => w.position !== 'flat').length,
              totalWallets: Object.keys(walletsLocal).length
            }
          });
        }

        // 4. Periodic Sync of Top Wallets to Firestore (Less frequent)
        if (now - lastWalletSync > SYNC_INTERVAL) {
          lastWalletSync = now;
          console.log("Syncing top wallets to Firestore...");
          
          const topWalletsToSync = Object.values(walletsLocal)
            .sort((a, b) => Math.abs(b.totalPnL) - Math.abs(a.totalPnL))
            .slice(0, 50);

          for (const wallet of topWalletsToSync) {
            try {
              await setDoc(doc(db, "wallets", wallet.id), wallet);
            } catch (err: any) {
              if (err?.message?.includes('RESOURCE_EXHAUSTED')) {
                console.error("Firestore Quota Exceeded for wallets. Skipping sync.");
                break; 
              }
              console.error(`Error syncing wallet ${wallet.id}:`, err);
            }
          }
        }
      } catch (e) {
        console.error("Error processing Bulk message on server:", e);
      }
    });

    ws.on("error", (err) => console.error("Bulk WS Error:", err));
    ws.on("close", () => {
      console.log("Bulk WS closed, reconnecting...");
      setTimeout(connectBulkWS, 5000);
    });
  }

  connectBulkWS();

  // 4. Internal WebSocket Server for Real-time Client Updates (Bypasses Firestore Quota)
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Set<WebSocket>();

  wss.on("connection", (ws) => {
    clients.add(ws);
    // Send current top wallets on connection
    const topWallets = Object.values(walletsLocal)
      .sort((a, b) => Math.abs(b.totalPnL) - Math.abs(a.totalPnL))
      .slice(0, 50);
    ws.send(JSON.stringify({ type: "init_wallets", data: topWallets }));

    ws.on("close", () => clients.delete(ws));
  });

  function broadcast(message: any) {
    const payload = JSON.stringify(message);
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  // --- AUTOMATIC TRADING BOT LOGIC ---
  const addBotLog = (msg: string) => {
    const log = `[${new Date().toLocaleTimeString()}] ${msg}`;
    botLogs = [log, ...botLogs].slice(0, 50);
    broadcast({ type: "bot_log", data: log });
  };

  class BulkClient {
    private ws: WebSocket | null = null;
    private token: string | null = null;
    private address: string | null = null;
    private sessionKeyPair: nacl.SignKeyPair;

    private secretKey: Uint8Array | null = null;

    constructor(privateKeyBase58: string | null = null) {
      if (privateKeyBase58) {
        this.secretKey = bs58.decode(privateKeyBase58);
      }
      this.sessionKeyPair = nacl.sign.keyPair();
    }

    getAddress() {
      return this.address;
    }

    async authenticate(address?: string, message?: string, signature?: string, token?: string) {
      const PRIVY_APP_ID = "cmbuls93q01jol20lf0ak0plb";
      const PRIVY_URL = "https://auth.privy.io/api/v1";
      const ORIGIN_URL = "https://early.bulk.trade";

      const headers = {
        "Origin": ORIGIN_URL,
        "Referer": ORIGIN_URL + "/",
        "Privy-App-Id": PRIVY_APP_ID,
        "Content-Type": "application/json"
      };

      if (token && address) {
        this.token = token;
        this.address = address;
        botAddress = address;
        return true;
      }

      try {
        let authAddress = address;
        let authMessage = message;
        let authSignature = signature;

        if (this.secretKey && !authAddress) {
          const keyPair = nacl.sign.keyPair.fromSecretKey(this.secretKey);
          authAddress = bs58.encode(keyPair.publicKey);

          const r_init = await axios.post(`${PRIVY_URL}/siws/init`, { address: authAddress }, { headers });
          const nonce = r_init.data.nonce;
          const ts = new Date().toISOString();
          authMessage = `early.bulk.trade wants you to sign in with your Solana account:\n${authAddress}\n\n` +
                        `You are proving you own ${authAddress}.\n\nURI: https://early.bulk.trade\n` +
                        `Version: 1\nChain ID: mainnet\nNonce: ${nonce}\nIssued At: ${ts}\nResources:\n- https://privy.io`;

          const signatureBytes = nacl.sign.detached(Buffer.from(authMessage), this.secretKey);
          authSignature = Buffer.from(signatureBytes).toString("base64");
        }

        if (!authAddress || !authMessage || !authSignature) return false;

        const r_auth = await axios.post(`${PRIVY_URL}/siws/authenticate`, {
          connectorType: "solana_adapter",
          message: authMessage,
          signature: authSignature,
          message_type: "plain",
          mode: "login-or-sign-up",
          walletClientType: "Phantom"
        }, { headers });

        this.token = r_auth.data.token;
        this.address = authAddress;
        botAddress = authAddress;
        addBotLog(`Authenticated ${authAddress.slice(0, 6)}...`);
        return true;
      } catch (err) {
        console.error("Bulk Auth Error:", err);
        addBotLog("Bulk Auth Failed.");
        return false;
      }
    }

    connect() {
      if (!this.token) return;
      this.ws = new WebSocket(BULK_WS_URL, {
        headers: {
          "Authorization": `Bearer ${this.token}`,
          "Origin": "https://early.bulk.trade"
        }
      });

      this.ws.on("open", () => {
        this.ws?.send(JSON.stringify({
          method: "subscribe",
          id: 1,
          subscription: [{ type: "account", user: this.address }]
        }));
        addBotLog("Bot Session Connected.");
      });

      this.ws.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === "account" && msg.data) {
            if (msg.data.type === "accountSnapshot") {
              botBalance = parseFloat(msg.data.margin?.availableBalance || "0");
              botPositions = msg.data.positions || [];
              broadcast({ type: "bot_update", data: { balance: botBalance, positions: botPositions } });
            }
          }
        } catch (e) {}
      });

      this.ws.on("close", () => {
        if (botEnabled) setTimeout(() => this.connect(), 5000);
      });
    }

    async sendAction(action: any) {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

      const nonce = Date.now();
      const payload = {
        account: this.address,
        actions: [action],
        nonce,
        type: "action"
      };

      const payloadJson = JSON.stringify(payload);
      const signature = bs58.encode(nacl.sign.detached(Buffer.from(payloadJson), this.sessionKeyPair.secretKey));
      const signer = bs58.encode(this.sessionKeyPair.publicKey);

      const msg = {
        method: "post",
        id: 10001,
        request: {
          type: "action",
          payload: { ...payload, signature, signer }
        }
      };

      this.ws.send(JSON.stringify(msg));
    }

    async placeOrder(symbol: string, side: 'buy' | 'sell', size: number) {
      const action = {
        m: {
          b: side === 'buy',
          c: symbol,
          r: false,
          sz: size.toFixed(4),
          tif: "ioc"
        }
      };
      await this.sendAction(action);
      addBotLog(`Placed ${side.toUpperCase()} order for ${symbol} | Size: ${size}`);
    }

    async closePosition(symbol: string, size: number, side: string) {
      const action = {
        m: {
          b: side === 'short', 
          c: symbol,
          r: true,
          sz: Math.abs(size).toFixed(4),
          tif: "ioc"
        }
      };
      await this.sendAction(action);
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

  const runAutoTrader = async () => {
    if (!botEnabled || !bulkClient) return;

    botStatus = "Analyzing...";
    const symbols = ["BTC", "ETH", "SOL"];
    
    for (const sym of symbols) {
      try {
        const history = await fetchHistoricalData(sym, "1H", 300);
        if (history.length < 200) continue;

        const indicators = calculateIndicators(history);
        const lastPrice = history[history.length - 1].close;
        const techScore = calculateTechnicalScore(indicators, lastPrice);

        const symbol = `${sym}-USD`;
        const position = botPositions.find(p => p.symbol === symbol);
        const currentSize = position ? parseFloat(position.size) : 0;

        // Trading Logic
        if (techScore > 85 && currentSize <= 0) {
          // Strong Bullish - Open Long or Close Short
          if (currentSize < 0) await bulkClient.closePosition(symbol, currentSize, "short");
          await bulkClient.placeOrder(symbol, "buy", 0.01); // Small size for demo
        } else if (techScore < 15 && currentSize >= 0) {
          // Strong Bearish - Open Short or Close Long
          if (currentSize > 0) await bulkClient.closePosition(symbol, currentSize, "long");
          await bulkClient.placeOrder(symbol, "sell", 0.01);
        } else if (currentSize > 0 && techScore < 50) {
          // Exit Long
          await bulkClient.closePosition(symbol, currentSize, "long");
        } else if (currentSize < 0 && techScore > 50) {
          // Exit Short
          await bulkClient.closePosition(symbol, currentSize, "short");
        }
      } catch (err) {
        console.error(`Bot analysis failed for ${sym}:`, err);
      }
    }
    botStatus = "Monitoring";
  };

  setInterval(runAutoTrader, 60000); // Run every minute

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  server.on("upgrade", (request, socket, head) => {
    if (request.url === "/ws/bulk") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });
}

startServer().catch(err => {
  console.error("FATAL: Failed to start server:", err);
  process.exit(1);
});
