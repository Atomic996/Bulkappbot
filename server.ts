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
import { NativeKeypair, NativeSigner } from "bulk-keychain";
import { getTradeDecision } from "./src/lib/indicators.js";
import { fetchHistoricalData, fetchCurrentPrice } from "./src/lib/api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const BULK_WS_URL  = "wss://exchange-ws1.bulk.trade";
const BULK_API_URL = "https://api.bulk.exchange/api/v1";
const ORIGIN_URL   = "https://early.bulk.trade";
const PRIVY_APP_ID = "cmbuls93q01jol20lf0ak0plb";
const PRIVY_URL    = "https://auth.privy.io/api/v1";
const SERVER_KEY   = "bulk_flow_server_auth_key_2026_03_31";
const STATE_FILE   = path.join(process.cwd(), ".bot_state.json");

// ══════════════════════════════════════════
//   ⚙️ إعدادات المخاطر — قابلة للتعديل
// ══════════════════════════════════════════
const RISK = {
  maxOpenPositions:  1,     // صفقة واحدة في كل وقت للبداية
  maxRiskPerTrade:   0.02,  // 2% من الرصيد كحد أقصى للخسارة
  minBalanceToTrade: 10,    // أدنى رصيد مطلوب بالدولار
  cooldownMs:        10 * 60 * 1000, // 10 دقائق بين كل صفقتين
};

// ══════════════════════════════════════════
//   BOT STATE
// ══════════════════════════════════════════
let botEnabled   = false;
let botStatus    = "Idle";
let botBalance   = 0;
let botAddress: string | null = null;
let botPositions: any[]       = [];
let botOpenOrders: any[]      = [];
let botLogs: string[]         = [];
let lastTradeTime             = 0;

// State الصفقات المفتوحة — يُحفظ على القرص
interface PositionState {
  symbol:        string;
  side:          "long" | "short";
  size:          number;
  entryPrice:    number;
  initialSL:     number;
  trailingStop:  number;
  takeProfit:    number;
  highWatermark: number;
  openTime:      number;
}
let positionStates: Record<string, PositionState> = {};

// ══════════════════════════════════════════
//   💾 حفظ وتحميل State من القرص
// ══════════════════════════════════════════
function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ positionStates, lastTradeTime }, null, 2));
  } catch {}
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const saved = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
      positionStates = saved.positionStates || {};
      lastTradeTime  = saved.lastTradeTime  || 0;
      console.log(`[State] Loaded ${Object.keys(positionStates).length} positions from disk`);
    }
  } catch {}
}
loadState();

const pendingSessions = new Map<string, {
  message:        string;
  sessionPrivKey: string;
  timestamp:      number;
}>();

const app = express();
app.use(cors());
app.use(express.json());

// ══════════════════════════════════════════
//   BOT API ROUTES
// ══════════════════════════════════════════
const botRouter = express.Router();

botRouter.get("/status", (_req: Request, res: Response) => {
  res.json({
    enabled:        botEnabled,
    status:         botStatus,
    balance:        botBalance,
    positions:      botPositions,
    openOrders:     botOpenOrders,
    positionStates: Object.values(positionStates),
    logs:           botLogs,
    address:        botAddress,
    hasSession:     !!bulkClient,
    risk:           RISK,
    lastTradeTime,
    cooldownLeft:   Math.max(0, RISK.cooldownMs - (Date.now() - lastTradeTime)),
  });
});

botRouter.post("/auth/init", async (req: Request, res: Response) => {
  const { address } = req.body;
  if (!address) return res.status(400).json({ error: "Address is required" });

  try {
    console.log(`[Auth] Initializing SIWS for: ${address}`);

    const r = await fetch(`${PRIVY_URL}/siws/init`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Privy-App-Id": PRIVY_APP_ID,
        "Origin":       "https://early.bulk.trade",
        "Referer":      "https://early.bulk.trade/",
        "User-Agent":   "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept":       "application/json"
      },
      body: JSON.stringify({ address })
    });

    const data    = await r.json() as any;
    const nonce   = data.nonce;
    const ts      = new Date().toISOString().replace(".000Z", "Z");
    const kp      = nacl.sign.keyPair();
    const privKey = bs58.encode(kp.secretKey);

    const message =
      `early.bulk.trade wants you to sign in with your Solana account:\n${address}\n\n` +
      `You are proving you own ${address}.\n\n` +
      `URI: https://early.bulk.trade\n` +
      `Version: 1\nChain ID: mainnet\nNonce: ${nonce}\nIssued At: ${ts}\n` +
      `Resources:\n- https://privy.io`;

    pendingSessions.set(address, { message, sessionPrivKey: privKey, timestamp: Date.now() });
    console.log(`[Auth] Message generated for ${address}`);
    res.json({ nonce, message });
  } catch (err: any) {
    console.error("[Auth] Init Error:", err.message);
    res.status(500).json({ error: "SIWS Init Failed", message: err.message });
  }
});

botRouter.post("/auth/start", async (req: Request, res: Response) => {
  const { address, message, signature } = req.body;
  const session = pendingSessions.get(address);

  if (!session || session.message !== message) {
    return res.status(400).json({ error: "Invalid or expired session. Please refresh." });
  }

  if (botEnabled) bulkClient?.stop();

  const kp = nacl.sign.keyPair.fromSecretKey(bs58.decode(session.sessionPrivKey));
  bulkClient = new BulkClient(kp);
  const ok   = await bulkClient.authenticate(address, message, signature);

  if (ok) {
    pendingSessions.delete(address);
    bulkClient.connect();
    botEnabled = true;
    botStatus  = "Monitoring";
    addBotLog("✅ Bot Authorized & Started.");
    res.json({ success: true, enabled: true });
  } else {
    res.status(500).json({ error: "Authentication failed. Check server logs." });
  }
});

botRouter.post("/toggle", (_req: Request, res: Response) => {
  if (!bulkClient) return res.status(400).json({ error: "No active session." });
  botEnabled = !botEnabled;
  botStatus  = botEnabled ? "Monitoring" : "Paused";
  addBotLog(botEnabled ? "▶️ Auto-Trader Enabled." : "⏸️ Auto-Trader Paused.");
  res.json({ success: true, enabled: botEnabled, status: botStatus });
});

// تحديث إعدادات المخاطر في runtime
botRouter.post("/risk", (req: Request, res: Response) => {
  const { maxOpenPositions, maxRiskPerTrade, minBalanceToTrade, cooldownMs } = req.body;
  if (maxOpenPositions  !== undefined) RISK.maxOpenPositions  = maxOpenPositions;
  if (maxRiskPerTrade   !== undefined) RISK.maxRiskPerTrade   = maxRiskPerTrade;
  if (minBalanceToTrade !== undefined) RISK.minBalanceToTrade = minBalanceToTrade;
  if (cooldownMs        !== undefined) RISK.cooldownMs        = cooldownMs;
  addBotLog(`⚙️ Risk settings updated`);
  res.json({ success: true, risk: RISK });
});

app.use("/api/bot", botRouter);

// ══════════════════════════════════════════
//   NEWS API
// ══════════════════════════════════════════
const newsCache: Record<string, { data: any; timestamp: number }> = {};
const NEWS_TTL = 15 * 60 * 1000;

app.get("/api/news", async (req: Request, res: Response) => {
  const symbol   = (req.query.symbol as string) || "BTC";
  const cacheKey = symbol.toUpperCase();

  if (newsCache[cacheKey] && Date.now() - newsCache[cacheKey].timestamp < NEWS_TTL) {
    return res.json(newsCache[cacheKey].data);
  }

  const apiKey = process.env.NEWSDATA_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "NEWSDATA_API_KEY missing" });

  try {
    const r = await axios.get("https://newsdata.io/api/1/news", {
      params: { apikey: apiKey, q: symbol, language: "en", category: "business,technology" },
      timeout: 5000,
    });
    if (r.data?.status === "success" && Array.isArray(r.data.results)) {
      const news = r.data.results.map((n: any) => ({
        id: n.article_id || Math.random().toString(36).substr(2, 9),
        title: n.title, url: n.link,
        published_at: n.pubDate, source: n.source_id || "NewsData.io",
      }));
      newsCache[cacheKey] = { data: news, timestamp: Date.now() };
      return res.json(news);
    }
  } catch {}

  if (newsCache[cacheKey]) return res.json(newsCache[cacheKey].data);
  res.status(503).json({ error: "News unavailable" });
});

app.get("/api/health", (_req, res) => res.json({ status: "ok", uptime: process.uptime() }));

// ══════════════════════════════════════════
//   HELPERS
// ══════════════════════════════════════════
const addBotLog = (msg: string) => {
  const log = `[${new Date().toLocaleTimeString()}] ${msg}`;
  botLogs   = [log, ...botLogs].slice(0, 100);
  broadcast({ type: "bot_log", data: log });
  console.log(log);
};

// ══════════════════════════════════════════
//   BULK CLIENT
// ══════════════════════════════════════════
class BulkClient {
  private ws:             WebSocket | null    = null;
  private token:          string | null       = null;
  private address:        string | null       = null;
  private signer:         NativeSigner | null = null;
  private sessionKP:      nacl.SignKeyPair;

  constructor(kp: nacl.SignKeyPair) {
    this.sessionKP = kp;
    try {
      const nkp    = NativeKeypair.fromBase58(bs58.encode(kp.secretKey));
      this.signer  = new NativeSigner(nkp);
    } catch {
      console.warn("[BulkClient] bulk-keychain init failed, using WS fallback");
    }
  }

  async authenticate(address: string, message: string, signature: string): Promise<boolean> {
    try {
      const r = await fetch(`${PRIVY_URL}/siws/authenticate`, {
        method: "POST",
        headers: {
          "Origin": "https://early.bulk.trade", "Referer": "https://early.bulk.trade/",
          "Privy-App-Id": PRIVY_APP_ID, "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          connectorType: "solana_adapter", message, signature,
          message_type: "plain", mode: "login-or-sign-up", walletClientType: "Phantom"
        })
      });
      const data = await r.json() as any;
      if (!data.token) { console.error("[Auth] No token:", data); return false; }
      this.token   = data.token;
      this.address = address;
      botAddress   = address;
      addBotLog(`🔑 Authenticated ${address.slice(0, 6)}...`);
      return true;
    } catch (err: any) {
      console.error("Auth Error:", err.message);
      return false;
    }
  }

  connect() {
    if (!this.token) return;
    this.ws = new WebSocket(BULK_WS_URL, {
      headers: { "Authorization": `Bearer ${this.token}`, "Origin": ORIGIN_URL }
    });
    this.ws.on("open", () => {
      this.ws?.send(JSON.stringify({
        method: "subscribe", id: 1,
        subscription: [{ type: "account", user: this.address }]
      }));
      addBotLog("🔌 Bot Session Connected.");
    });
    this.ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "account") {
          const d = msg.data;
          if (d?.type === "accountSnapshot" || d?.type === "accountUpdate") {
            const m    = d.margin || {};
            const bal  = parseFloat(m.availableBalance || m.totalMarginBalance || "0");
            if (!isNaN(bal) && bal > 0) botBalance = bal;
            if (d.positions)   botPositions  = d.positions;
            if (d.openOrders)  botOpenOrders = d.openOrders;
            broadcast({ type: "bot_update", data: { balance: botBalance, positions: botPositions, openOrders: botOpenOrders } });
          }
        } else if (msg.type === "error") {
          addBotLog(`❌ Exchange: ${msg.message}`);
        }
      } catch {}
    });
    this.ws.on("close", () => { if (botEnabled) setTimeout(() => this.connect(), 5000); });
  }

  // ── إرسال أمر عبر HTTP API ──
  private async _submitOrder(signed: any): Promise<any> {
    const r = await fetch(`${BULK_API_URL}/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${this.token}` },
      body: JSON.stringify({
        actions:   JSON.parse(signed.actions),
        nonce:     signed.nonce,
        account:   signed.account,
        signer:    signed.signer,
        signature: signed.signature,
      })
    });
    return r.json();
  }

  // ── Bracket Order — Entry + SL + TP في معاملة واحدة ──
  async placeBracketOrder(
    symbol: string, side: "buy" | "sell", size: number,
    stopLoss: number, takeProfit: number
  ): Promise<boolean> {
    const sz    = symbol.startsWith("BTC") ? size.toFixed(4) : size.toFixed(2);
    const isBuy = side === "buy";

    try {
      if (this.signer) {
        const entry = {
          type: "order" as const, symbol, isBuy,
          price: 0, size: parseFloat(sz),
          orderType: { type: "market" as const, isMarket: true, triggerPx: 0 }
        };
        const sl = {
          type: "order" as const, symbol, isBuy: !isBuy,
          price: stopLoss, size: parseFloat(sz),
          orderType: { type: "limit" as const, tif: "GTC" as const }
        };
        const tp = {
          type: "order" as const, symbol, isBuy: !isBuy,
          price: takeProfit, size: parseFloat(sz),
          orderType: { type: "limit" as const, tif: "GTC" as const }
        };

        const signed = this.signer.signGroup([entry, sl, tp]);
        const result = await this._submitOrder(signed) as any;

        if (result?.status === "ok" || result?.orderIds || result?.orderId) {
          addBotLog(`✅ Bracket ${side.toUpperCase()} ${sz} ${symbol} | SL:${stopLoss.toFixed(2)} TP:${takeProfit.toFixed(2)}`);
          return true;
        }
        addBotLog(`❌ Bracket failed: ${JSON.stringify(result)}`);
        return false;
      } else {
        return this.placeOrder(symbol, side, size);
      }
    } catch (err: any) {
      addBotLog(`❌ Bracket Error: ${err.message}`);
      return false;
    }
  }

  // ── صفقة عادية ──
  async placeOrder(symbol: string, side: "buy" | "sell", size: number): Promise<boolean> {
    const sz    = symbol.startsWith("BTC") ? size.toFixed(4) : size.toFixed(2);
    const isBuy = side === "buy";
    try {
      if (this.signer) {
        const order = {
          type: "order" as const, symbol, isBuy,
          price: 0, size: parseFloat(sz),
          orderType: { type: "market" as const, isMarket: true, triggerPx: 0 }
        };
        const signed = this.signer.sign(order);
        const result = await this._submitOrder(signed) as any;
        if (result?.orderId || result?.status === "ok") {
          addBotLog(`✅ ${side.toUpperCase()} ${sz} ${symbol}`);
          return true;
        }
        addBotLog(`❌ Order failed: ${JSON.stringify(result)}`);
        return false;
      } else {
        await this._sendWS("m", { b: isBuy, c: symbol, r: false, sz });
        addBotLog(`📡 ${side.toUpperCase()} ${sz} ${symbol} (WS)`);
        return true;
      }
    } catch (err: any) {
      addBotLog(`❌ Order Error: ${err.message}`); return false;
    }
  }

  // ── إغلاق صفقة ──
  async closePosition(symbol: string, size: number, side: string): Promise<boolean> {
    const sz    = symbol.startsWith("BTC") ? Math.abs(size).toFixed(4) : Math.abs(size).toFixed(2);
    const isBuy = side === "short";
    try {
      if (this.signer) {
        const order = {
          type: "order" as const, symbol, isBuy,
          price: 0, size: parseFloat(sz),
          orderType: { type: "market" as const, isMarket: true, triggerPx: 0 }
        };
        const signed = this.signer.sign(order);
        await this._submitOrder(signed);
        addBotLog(`🔴 Closed ${side.toUpperCase()} ${sz} ${symbol}`);
        return true;
      } else {
        await this._sendWS("m", { b: isBuy, c: symbol, r: true, sz, p: "0", tif: "ioc" });
        addBotLog(`🔴 Close ${side.toUpperCase()} ${sz} ${symbol} (WS)`);
        return true;
      }
    } catch (err: any) {
      addBotLog(`❌ Close Error: ${err.message}`); return false;
    }
  }

  // ── WebSocket fallback ──
  private async _sendWS(method: string, params: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const ts      = Date.now();
    const payload = { account: this.address, actions: [{ [method]: params }], nonce: ts, type: "action" };
    const sig     = bs58.encode(nacl.sign.detached(Buffer.from(JSON.stringify(payload)), this.sessionKP.secretKey));
    const signer  = bs58.encode(this.sessionKP.publicKey);
    this.ws.send(JSON.stringify({ method: "post", id: ts, request: { type: "action", payload: { ...payload, signature: sig, signer } } }));
  }

  stop() {
    this.ws?.close(); this.ws = null; this.signer = null;
    botEnabled = false; botStatus = "Disconnected"; botAddress = null;
    addBotLog("🔴 Session Closed.");
  }
}

let bulkClient: BulkClient | null = null;

// ══════════════════════════════════════════
//   WEBSOCKET SERVER
// ══════════════════════════════════════════
const wss     = new WebSocketServer({ noServer: true });
const clients = new Set<WebSocket>();

wss.on("connection", (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: "init_wallets", data: Object.values(walletsLocal).sort((a, b) => Math.abs(b.totalPnL) - Math.abs(a.totalPnL)).slice(0, 50) }));
  ws.send(JSON.stringify({ type: "bot_update", data: { balance: botBalance, positions: botPositions, enabled: botEnabled, status: botStatus } }));
  ws.on("close", () => clients.delete(ws));
});

function broadcast(msg: any) {
  const p = JSON.stringify(msg);
  clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(p); });
}

// ══════════════════════════════════════════
//   BACKGROUND WORKER
// ══════════════════════════════════════════
let ws: WebSocket | null = null;
const walletsLocal: Record<string, any> = {};
let lastUIBroadcast = Date.now();

function connectBulkWS() {
  ws = new WebSocket(BULK_WS_URL);
  ws.on("open", () => {
    ws?.send(JSON.stringify({ method: "subscribe", subscription: [
      { type: "trades", symbol: "BTC-USD" },
      { type: "trades", symbol: "ETH-USD" },
      { type: "trades", symbol: "SOL-USD" },
    ]}));
  });
  ws.on("message", async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type !== "trades" || !Array.isArray(msg.data?.trades)) return;
      for (const t of msg.data.trades) {
        const { s: symbol, px, sz, side, taker: walletId } = t;
        const price = parseFloat(px), size = parseFloat(sz);
        const trSide = side ? "buy" : "sell";
        const timestamp = Date.now();
        broadcast({ type: "trade", data: { symbol, price, size, side: trSide, walletId, timestamp, serverKey: SERVER_KEY } });
        if (!walletsLocal[walletId]) {
          walletsLocal[walletId] = { id: walletId, position: "flat", entryPrice: null, entrySize: 0, totalPnL: 0, winCount: 0, tradeCount: 0, lastUpdate: timestamp };
        }
        const w = walletsLocal[walletId];
        w.lastUpdate = timestamp;
        if (w.position === "flat") {
          w.position = trSide === "buy" ? "long" : "short"; w.entryPrice = price; w.entrySize = size; w.tradeCount++;
        } else if ((w.position === "long" && trSide === "sell") || (w.position === "short" && trSide === "buy")) {
          const pnl = w.position === "long" ? (price - w.entryPrice) * w.entrySize : (w.entryPrice - price) * w.entrySize;
          w.totalPnL += pnl; if (pnl > 0) w.winCount++; w.position = "flat"; w.entryPrice = null; w.entrySize = 0;
        }
      }
      if (Date.now() - lastUIBroadcast > 3000) {
        lastUIBroadcast = Date.now();
        const top = Object.values(walletsLocal).sort((a, b) => Math.abs(b.totalPnL) - Math.abs(a.totalPnL)).slice(0, 50);
        broadcast({ type: "wallets_update", data: top, stats: { activeWallets: Object.values(walletsLocal).filter(w => w.position !== "flat").length, totalWallets: Object.keys(walletsLocal).length } });
      }
    } catch {}
  });
  ws.on("close", () => setTimeout(connectBulkWS, 5000));
}
connectBulkWS();

// ══════════════════════════════════════════
//   🛡️ فحص Trailing Stop — يعمل كل دقيقة
// ══════════════════════════════════════════
const checkTrailingStops = async () => {
  if (!botEnabled || !bulkClient) return;

  for (const [symbol, state] of Object.entries(positionStates)) {
    try {
      const sym          = symbol.split("-")[0];
      const currentPrice = await fetchCurrentPrice(sym);
      if (!currentPrice) continue;

      let shouldClose = false;
      let closeReason = "";

      if (state.side === "long") {
        // رفع الـ trailing stop
        if (currentPrice > state.highWatermark) {
          state.highWatermark = currentPrice;
          state.trailingStop  = currentPrice * (1 - 0.015); // 1.5% trailing
          saveState();
        }
        if (currentPrice <= state.trailingStop)  { shouldClose = true; closeReason = `🛡️ Trailing Stop: ${state.trailingStop.toFixed(2)}`; }
        if (currentPrice <= state.initialSL)     { shouldClose = true; closeReason = `🛑 Stop Loss: ${state.initialSL.toFixed(2)}`; }
        if (currentPrice >= state.takeProfit)    { shouldClose = true; closeReason = `🎯 Take Profit: ${state.takeProfit.toFixed(2)}`; }

      } else if (state.side === "short") {
        if (currentPrice < state.highWatermark) {
          state.highWatermark = currentPrice;
          state.trailingStop  = currentPrice * (1 + 0.015);
          saveState();
        }
        if (currentPrice >= state.trailingStop)  { shouldClose = true; closeReason = `🛡️ Trailing Stop: ${state.trailingStop.toFixed(2)}`; }
        if (currentPrice >= state.initialSL)     { shouldClose = true; closeReason = `🛑 Stop Loss: ${state.initialSL.toFixed(2)}`; }
        if (currentPrice <= state.takeProfit)    { shouldClose = true; closeReason = `🎯 Take Profit: ${state.takeProfit.toFixed(2)}`; }
      }

      if (shouldClose) {
        addBotLog(`${closeReason} | ${symbol} @ ${currentPrice.toFixed(2)}`);
        await bulkClient.closePosition(symbol, state.size, state.side);
        delete positionStates[symbol];
        saveState();
      }
    } catch {}
  }
};
setInterval(checkTrailingStops, 60 * 1000);

// ══════════════════════════════════════════
//   🤖 AUTO TRADER — مع كل الحمايات
// ══════════════════════════════════════════
const runAutoTrader = async () => {
  if (!botEnabled || !bulkClient) return;

  // ── فحص الرصيد ──
  if (botBalance < RISK.minBalanceToTrade) {
    addBotLog(`⚠️ Insufficient balance: $${botBalance.toFixed(2)} < $${RISK.minBalanceToTrade}`);
    return;
  }

  // ── فحص الـ cooldown ──
  const timeSinceLast = Date.now() - lastTradeTime;
  if (lastTradeTime > 0 && timeSinceLast < RISK.cooldownMs) {
    const left = Math.ceil((RISK.cooldownMs - timeSinceLast) / 60000);
    addBotLog(`⏳ Cooldown: ${left} min remaining`);
    return;
  }

  // ── فحص عدد الصفقات المفتوحة ──
  const openCount = Object.keys(positionStates).length;
  if (openCount >= RISK.maxOpenPositions) {
    addBotLog(`📊 Max positions reached: ${openCount}/${RISK.maxOpenPositions}`);
    return;
  }

  botStatus = "Analyzing...";
  broadcast({ type: "bot_status", data: botStatus });

  for (const sym of ["BTC", "ETH", "SOL"]) {
    try {
      await new Promise(r => setTimeout(r, 1500));

      const symbol = `${sym}-USD`;

      // تخطي إذا فيه صفقة مفتوحة على هذا الزوج
      if (positionStates[symbol]) {
        addBotLog(`⏭️ ${sym}: Position already open`);
        continue;
      }

      // تخطي إذا وصلنا للحد الأقصى
      if (Object.keys(positionStates).length >= RISK.maxOpenPositions) break;

      const history = await fetchHistoricalData(sym, "1H", 300);
      if (history.length < 200) {
        addBotLog(`⚠️ ${sym}: Not enough data (${history.length}/200)`);
        continue;
      }

      const pos             = botPositions.find(p => p.symbol === symbol);
      const currentPosition = pos
        ? { size: parseFloat(pos.size), entryPrice: parseFloat(pos.price) }
        : null;

      const decision = getTradeDecision(history, botBalance, symbol, currentPosition);

      addBotLog(`📊 ${sym} | ${decision.regime} | [${decision.strategy}] | Score: ${decision.score.toFixed(0)} | ${decision.action}`);
      if (decision.reason) addBotLog(`   ${decision.reason}`);

      let success = false;

      switch (decision.action) {
        case "BUY": {
          if (decision.stopLoss && decision.takeProfit) {
            success = await bulkClient.placeBracketOrder(symbol, "buy", decision.size, decision.stopLoss, decision.takeProfit);
          } else {
            success = await bulkClient.placeOrder(symbol, "buy", decision.size);
          }
          if (success && decision.stopLoss && decision.takeProfit) {
            const currentPrice = history[history.length - 1].close;
            positionStates[symbol] = {
              symbol, side: "long", size: decision.size,
              entryPrice: currentPrice,
              initialSL:     decision.stopLoss,
              trailingStop:  decision.stopLoss,
              takeProfit:    decision.takeProfit,
              highWatermark: currentPrice,
              openTime:      Date.now(),
            };
            lastTradeTime = Date.now();
            saveState();
          }
          break;
        }

        case "SELL": {
          if (decision.stopLoss && decision.takeProfit) {
            success = await bulkClient.placeBracketOrder(symbol, "sell", decision.size, decision.stopLoss, decision.takeProfit);
          } else {
            success = await bulkClient.placeOrder(symbol, "sell", decision.size);
          }
          if (success && decision.stopLoss && decision.takeProfit) {
            const currentPrice = history[history.length - 1].close;
            positionStates[symbol] = {
              symbol, side: "short", size: decision.size,
              entryPrice: currentPrice,
              initialSL:     decision.stopLoss,
              trailingStop:  decision.stopLoss,
              takeProfit:    decision.takeProfit,
              highWatermark: currentPrice,
              openTime:      Date.now(),
            };
            lastTradeTime = Date.now();
            saveState();
          }
          break;
        }

        case "CLOSE_LONG":
          if (currentPosition) {
            success = await bulkClient.closePosition(symbol, currentPosition.size, "long");
            if (success) { delete positionStates[symbol]; saveState(); }
          }
          break;

        case "CLOSE_SHORT":
          if (currentPosition) {
            success = await bulkClient.closePosition(symbol, currentPosition.size, "short");
            if (success) { delete positionStates[symbol]; saveState(); }
          }
          break;
      }

    } catch (err: any) {
      addBotLog(`❌ ${sym} Error: ${err.message}`);
    }
  }

  botStatus = "Monitoring";
  broadcast({ type: "bot_status", data: botStatus });
};

setInterval(runAutoTrader, 5 * 60 * 1000);

// ══════════════════════════════════════════
//   SERVER START
// ══════════════════════════════════════════
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  const PORT   = Number(process.env.PORT) || 3000;
  const server = app.listen(PORT, "0.0.0.0", () => console.log(`✅ Server on port ${PORT}`));
  server.on("upgrade", (req, socket, head) => {
    if (req.url === "/ws/bulk") wss.handleUpgrade(req, socket, head, ws => wss.emit("connection", ws, req));
  });
}

startServer().catch(err => { console.error("FATAL:", err); process.exit(1); });
export default app;
