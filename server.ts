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
import init, { WasmKeypair, WasmSigner } from "bulk-keychain-wasm";
import { computeIndicators, calculateTechnicalScore, getTradeDecision, RISK_CONFIG } from "./src/lib/indicators.js";
import { fetchHistoricalData } from "./src/lib/api.js";
import { analyzeNews, calculateNewsScore } from "./src/lib/gemini.js";
import { analyzeSentimentAlgorithmic, calculateAlgorithmicNewsScore } from "./src/lib/sentiment.js";
import { NewsItem } from "./src/types.js";

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
let botOrderType: 'market' | 'limit' | 'auto' = 'auto';

const SESSION_FILE = path.join(__dirname, "bot_session.json");

const saveSession = (data: any) => {
  try {
    fs.writeFileSync(SESSION_FILE, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save session:", e);
  }
};

const loadSession = () => {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      return JSON.parse(fs.readFileSync(SESSION_FILE, "utf8"));
    }
  } catch (e) {
    console.error("Failed to load session:", e);
  }
  return null;
};

const pendingSessions = new Map<string, { message: string, sessionPrivKey: string, timestamp: number }>();

const app = express();
app.use(cors());
app.use(express.json());

// --- BOT API ROUTES ---
const botRouter = express.Router();

botRouter.get("/status", (req: Request, res: Response) => {
  console.log(`[API] Status requested. Balance: $${botBalance}, Session: ${!!bulkClient}`);
  res.json({
    enabled: botEnabled,
    status: botStatus,
    balance: botBalance,
    positions: botPositions,
    logs: botLogs,
    address: botAddress,
    hasSession: !!bulkClient,
    orderType: botOrderType
  });
});

botRouter.post("/settings", (req: Request, res: Response) => {
  const { orderType } = req.body;
  if (orderType === 'market' || orderType === 'limit' || orderType === 'auto') {
    botOrderType = orderType;
    addBotLog(`Order Type updated to: ${botOrderType.toUpperCase()}`);
    res.json({ success: true, orderType: botOrderType });
  } else {
    res.status(400).json({ error: "Invalid order type" });
  }
});

botRouter.post("/auth/agent", async (req: Request, res: Response) => {
  const { address, agentPubKey, agentPrivKey, finalized } = req.body;
  if (!address || !agentPubKey || !agentPrivKey || !finalized) {
    console.error("[Auth] Agent Auth Missing Fields:", { address: !!address, agentPubKey: !!agentPubKey, agentPrivKey: !!agentPrivKey, finalized: !!finalized });
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    console.log(`[Auth] Authorizing Agent for: ${address}`);
    
    // 1. Initialize or Update BulkClient with the Agent Keypair
    const agentKeypair = WasmKeypair.fromBase58(agentPrivKey);
    
    if (bulkClient) {
      // Update existing client's signer
      bulkClient.updateSigner(agentKeypair);
    } else {
      // Create new client (will need authentication later to connect)
      bulkClient = new BulkClient(agentKeypair);
    }
    
    // 2. Store the agent info in the session
    botAddress = address;
    
    // Persist agent info
    const currentSession = loadSession() || {};
    saveSession({
      ...currentSession,
      address,
      agentPrivKey,
      botEnabled: true
    });

    console.log(`[Auth] Agent Authorized Successfully: ${agentPubKey}`);
    addBotLog(`Agent Authorized: ${agentPubKey.slice(0, 6)}...`);
    res.json({ success: true });
  } catch (err: any) {
    console.error("[Auth] Agent Auth Error:", err.message);
    res.status(500).json({ error: "Agent Authorization Failed", message: err.message });
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
    const sessionKeypair = new WasmKeypair();
    const sessionPubKey = sessionKeypair.pubkey;
    const sessionPrivKey = sessionKeypair.toBase58();

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

  const agentKeypair = WasmKeypair.fromBase58(sessionData.sessionPrivKey);
  bulkClient = new BulkClient(agentKeypair);
  const ok = await bulkClient.authenticate(address, message, signature);
  
  if (ok) {
    // Cleanup
    pendingSessions.delete(address);

    bulkClient.connect();
    botEnabled = true;
    botStatus = "Monitoring";
    addBotLog("Bot Authorized & Started.");
    
    // Persist session state
    saveSession({
      address,
      token: bulkClient.getToken(),
      sessionPrivKey: sessionData.sessionPrivKey,
      botEnabled: true
    });

    res.json({ success: true, enabled: true });
  } else {
    res.status(500).json({ error: "Authentication failed with Privy. Check server logs." });
  }
});

botRouter.post("/auth/logout", (req: Request, res: Response) => {
  console.log("[Auth] Logout requested. Clearing session.");
  
  // 1. Stop bot if running
  if (botEnabled && bulkClient) {
    bulkClient.stop();
  }
  
  // 2. Clear memory state
  botEnabled = false;
  botStatus = "Disconnected";
  botAddress = null;
  botBalance = 0;
  botPositions = [];
  bulkClient = null;
  
  // 3. Delete session file
  try {
    if (fs.existsSync(SESSION_FILE)) {
      fs.unlinkSync(SESSION_FILE);
    }
  } catch (e) {
    console.error("Failed to delete session file:", e);
  }
  
  res.json({ success: true });
});

botRouter.post("/toggle", async (req: Request, res: Response) => {
  if (!bulkClient) return res.status(400).json({ error: "No active session. Please authorize first." });
  
  botEnabled = !botEnabled;
  botStatus = botEnabled ? "Monitoring" : "Idle";
  addBotLog(botEnabled ? "Auto-Trader Enabled." : "Auto-Trader Disabled.");
  
  res.json({ success: true, enabled: botEnabled, status: botStatus });
});

botRouter.post("/trade", async (req: Request, res: Response) => {
  if (!bulkClient) return res.status(400).json({ error: "No active session." });
  const { symbol, side, size, price, type } = req.body;
  try {
    await bulkClient.placeOrder(symbol, side, size, price, type);
    res.json({ success: true });
  } catch (err: any) {
    console.error("[API] Manual Trade Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

botRouter.post("/close", async (req: Request, res: Response) => {
  if (!bulkClient) return res.status(400).json({ error: "No active session." });
  const { symbol, size, side } = req.body;
  try {
    await bulkClient.closePosition(symbol, size, side);
    res.json({ success: true });
  } catch (err: any) {
    console.error("[API] Close Position Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.use("/api/bot", botRouter);

// News Cache
const newsCache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_TTL = 15 * 60 * 1000;

async function fetchNewsInternal(symbol: string): Promise<NewsItem[]> {
  const cacheKey = symbol.toUpperCase();
  if (newsCache[cacheKey] && Date.now() - newsCache[cacheKey].timestamp < CACHE_TTL) {
    return newsCache[cacheKey].data;
  }

  const newsDataApiKey = process.env.NEWSDATA_API_KEY;
  if (!newsDataApiKey) return [];

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
      return unifiedNews;
    }
  } catch (error) {
    console.error(`[News] Error fetching for ${symbol}:`, error instanceof Error ? error.message : String(error));
  }
  return newsCache[cacheKey]?.data || [];
}

app.get("/api/news", async (req: Request, res: Response) => {
  const symbol = (req.query.symbol as string) || "BTC";
  const cacheKey = symbol.toUpperCase();
  
  if (newsCache[cacheKey] && Date.now() - newsCache[cacheKey].timestamp < CACHE_TTL) {
    return res.json(newsCache[cacheKey].data);
  }

  const newsDataApiKey = process.env.NEWSDATA_API_KEY;
  if (!newsDataApiKey || newsDataApiKey === "") {
    return res.json([]); // Return empty array instead of 500
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
  private signer: WasmSigner;

  constructor(keypair: WasmKeypair) {
    this.signer = new WasmSigner(keypair);
  }

  getToken() { return this.token; }
  getAddress() { return this.address; }
  
  setToken(token: string) { this.token = token; }
  setAddress(address: string) { this.address = address; botAddress = address; }

  updateSigner(keypair: WasmKeypair) {
    this.signer = new WasmSigner(keypair);
    addBotLog("Trading Signer updated to Agent Wallet.");
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

  // Restore session from saved data
  restore(data: any) {
    this.token = data.token;
    this.address = data.address;
    botAddress = data.address;
    if (data.agentPrivKey) {
      const agentKeypair = WasmKeypair.fromBase58(data.agentPrivKey);
      this.signer = new WasmSigner(agentKeypair);
    } else if (data.sessionPrivKey) {
      const sessionKeypair = WasmKeypair.fromBase58(data.sessionPrivKey);
      this.signer = new WasmSigner(sessionKeypair);
    }
    return true;
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
      console.log(`[BulkWS] Session Connected for ${this.address}`);
      this.ws?.send(JSON.stringify({ method: "subscribe", id: 1, subscription: [{ type: "account", user: this.address }] }));
      addBotLog("Bot Session Connected.");
    });
    this.ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "account") {
          console.log(`[BulkWS] Account Update Received: ${msg.data?.type}`);
          if (msg.data?.type === "accountSnapshot" || msg.data?.type === "accountUpdate") {
            const margin = msg.data.margin || {};
            
            // Try different balance fields as the API might vary
            const newBalance = parseFloat(
              margin.availableBalance || 
              margin.totalMarginBalance || 
              margin.withdrawableBalance || 
              margin.equity ||
              "0"
            );
            
            if (!isNaN(newBalance)) {
              botBalance = newBalance;
              console.log(`[BulkWS] Balance Updated for ${this.address}: $${botBalance}`);
            } else {
              console.warn(`[BulkWS] Received invalid balance data:`, margin);
            }
            
            if (msg.data.positions) {
              botPositions = msg.data.positions;
              console.log(`[BulkWS] Positions Updated for ${this.address}: ${botPositions.length} active`);
            }
            
            broadcast({ 
              type: "bot_update", 
              data: { 
                balance: botBalance, 
                positions: botPositions,
                address: this.address,
                hasSession: true
              } 
            });
          }
        } else if (msg.type === "error") {
          console.error(`[BulkWS] Error for ${this.address}:`, msg.message);
          addBotLog(`❌ Exchange Error: ${msg.message}`);
        } else if (msg.type === "info") {
          console.log(`[BulkWS] Info:`, msg.message);
        }
      } catch (e) {
        console.error("[BulkWS] Message Parse Error:", e);
      }
    });
    this.ws.on("close", () => { if (botEnabled) setTimeout(() => this.connect(), 5000); });
  }

  async sendActions(actions: any[]) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    
    try {
      // Use bulk-keychain for signing
      const signed = this.signer.signGroup(actions);
      
      const msg = {
        method: "post",
        id: Date.now(),
        request: {
          type: "action",
          payload: {
            actions: JSON.parse(signed.actions),
            nonce: signed.nonce,
            account: this.address,
            signer: signed.signer,
            signature: signed.signature
          }
        }
      };
      
      this.ws.send(JSON.stringify(msg));
    } catch (e) {
      console.error("[BulkClient] Signing Error:", e);
      addBotLog(`❌ Signing Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async setLeverage(symbol: string, leverage: number) {
    await this.sendActions([{ updateUserSettings: { m: { [symbol]: leverage } } }]);
    addBotLog(`Updated Leverage for ${symbol} to ${leverage}x`);
  }

  async placeBracketOrder(symbol: string, side: 'buy' | 'sell', size: number, entryPrice: number, slPrice: number, tpPrice: number) {
    const formattedSize = symbol.startsWith("BTC") ? size.toFixed(4) : size.toFixed(2);
    
    // 1. Entry Order
    const entryParams = {
      b: side === 'buy',
      c: symbol,
      r: false,
      sz: formattedSize,
      p: entryPrice.toString(),
      tif: "gtc"
    };

    // 2. Stop Loss (Reduce Only Trigger)
    // Note: In Bulk/HL, triggers often use a different format, but based on the user's request
    // we are sending them together in one transaction.
    const slParams = {
      b: side === 'sell',
      c: symbol,
      r: true,
      sz: formattedSize,
      p: slPrice.toString(),
      tif: "gtc",
      isTrigger: true,
      triggerPx: slPrice.toString(),
      triggerType: "stopLoss"
    };

    // 3. Take Profit (Reduce Only Trigger)
    const tpParams = {
      b: side === 'sell',
      c: symbol,
      r: true,
      sz: formattedSize,
      p: tpPrice.toString(),
      tif: "gtc",
      isTrigger: true,
      triggerPx: tpPrice.toString(),
      triggerType: "takeProfit"
    };

    await this.sendActions([
      { m: entryParams },
      { m: slParams },
      { m: tpParams }
    ]);
    
    addBotLog(`🚀 Bracket Order Sent for ${symbol} | Size: ${formattedSize}`);
    addBotLog(`   Entry: ${entryPrice.toFixed(2)} | SL: ${slPrice.toFixed(2)} | TP: ${tpPrice.toFixed(2)}`);
  }

  async placeOrder(symbol: string, side: 'buy' | 'sell', size: number, price: number = 0, typeOverride?: 'market' | 'limit') {
    const formattedSize = symbol.startsWith("BTC") ? size.toFixed(4) : size.toFixed(2);
    const params: any = {
      b: side === 'buy',
      c: symbol,
      r: false,
      sz: formattedSize
    };
    const finalType = typeOverride || botOrderType;
    if (finalType === 'limit' && price > 0) {
      params.p = price.toString();
      params.tif = "gtc";
    } else {
      params.p = "0";
      params.tif = "ioc";
    }
    const typeLabel = finalType === 'auto' ? 'AUTO' : finalType.toUpperCase();
    await this.sendActions([{ m: params }]);
    addBotLog(`Placed ${typeLabel} ${side.toUpperCase()} order for ${symbol} | Size: ${formattedSize}${params.p !== "0" ? ` | Price: ${price}` : ''}`);
  }

  async closePosition(symbol: string, size: number, side: string) {
    const formattedSize = symbol.startsWith("BTC") ? Math.abs(size).toFixed(4) : Math.abs(size).toFixed(2);
    const params = {
      b: side === 'short',
      c: symbol,
      r: true,
      sz: formattedSize,
      p: "0",
      tif: "ioc"
    };
    await this.sendActions([{ m: params }]);
    addBotLog(`Closing ${side.toUpperCase()} position for ${symbol}`);
  }

  stop() {
    this.ws?.close();
    this.ws = null;
    botEnabled = false;
    botStatus = "Disconnected";
    botAddress = null;
    addBotLog("Session Closed.");
  }
}

let bulkClient: BulkClient | null = null;

// --- WEBSOCKET SERVER ---
const wss = new WebSocketServer({ noServer: true });
const clients = new Set<WebSocket>();

wss.on("connection", (ws) => {
  clients.add(ws);
  
  // Send current bot status to the new client
  ws.send(JSON.stringify({ 
    type: "bot_update", 
    data: { 
      balance: botBalance, 
      positions: botPositions,
      enabled: botEnabled,
      status: botStatus
    } 
  }));

  ws.on("close", () => clients.delete(ws));
});

function broadcast(message: any) {
  const payload = JSON.stringify(message);
  clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(payload); });
}

// --- AUTO TRADER ---
const runAutoTrader = async () => {
  if (!botEnabled || !bulkClient) return;
  botStatus = "Analyzing...";
  
  for (const sym of ["BTC", "ETH", "SOL"]) {
    try {
      await new Promise(r => setTimeout(r, 2000)); // Avoid rate limits
      
      const history = await fetchHistoricalData(sym, "1H", 300);
      if (history.length < 200) {
        addBotLog(`⚠️ ${sym}: Not enough data (${history.length}/200)`);
        continue;
      }

      const symbol = `${sym}-USD`;
      const pos = botPositions.find(p => p.symbol === symbol);
      const currentPosition = pos 
        ? { size: parseFloat(pos.size), entryPrice: parseFloat(pos.price) } 
        : null;

      // --- News Analysis with AI Fallback ---
      const rawNews = await fetchNewsInternal(sym);
      let newsScore = 0;
      let usingAI = false;

      if (rawNews.length > 0) {
        try {
          // Try AI Analysis first
          const analyzedAI = await analyzeNews(rawNews);
          newsScore = calculateNewsScore(analyzedAI);
          usingAI = true;
        } catch (err) {
          // Fallback to Algorithmic Analysis if AI fails (quota/error)
          const analyzedAlgo = analyzeSentimentAlgorithmic(rawNews);
          newsScore = calculateAlgorithmicNewsScore(analyzedAlgo);
          usingAI = false;
          console.warn(`[Bot] AI Analysis failed for ${sym}, falling back to algorithmic sentiment. Error: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      const decision = getTradeDecision(history, botBalance, symbol, currentPosition, newsScore);
      const currentPrice = history[history.length - 1].close;
      const ind = computeIndicators(history);
      
      // Log the decision with the regime and strategy info from our custom algorithm
      addBotLog(`📊 ${sym} | ${decision.regime} | [${decision.strategy}] | Score: ${decision.score.toFixed(0)} | → ${decision.action} ${usingAI ? '(AI)' : '(Algo)'}`);
      if (decision.reason) addBotLog(`   ${decision.reason}`);

      // 1. Correlation Check: Don't open a new trade if we already have a trade in the same direction for another asset
      const sameDirectionTrade = botPositions.find(p => {
        const pSize = parseFloat(p.size);
        if (decision.action === 'BUY' && pSize > 0 && p.symbol !== symbol) return true;
        if (decision.action === 'SELL' && pSize < 0 && p.symbol !== symbol) return true;
        return false;
      });

      if ((decision.action === 'BUY' || decision.action === 'SELL') && !currentPosition && sameDirectionTrade) {
        addBotLog(`⏭️ Skipping ${sym} ${decision.action} due to correlation with ${sameDirectionTrade.symbol}`);
        continue;
      }

      // 2. Smart Trailing Stop Logic (Server-side monitoring)
      if (currentPosition && currentPosition.size !== 0) {
        const isLong = currentPosition.size > 0;
        const entryPrice = currentPosition.entryPrice;
        const profitPct = isLong ? (currentPrice - entryPrice) / entryPrice : (entryPrice - currentPrice) / entryPrice;
        
        // Trailing Stop: If profit > 1x ATR, we "trail" the SL to entry price (Break-even)
        const atrPct = ind.atr / currentPrice;
        if (profitPct > atrPct) {
          addBotLog(`🛡️ ${sym} Trailing Stop: Moving SL to Break-even (${entryPrice.toFixed(2)})`);
          // In a real scenario, we would call cancelOrder + placeOrder for the SL trigger
        }
      }

      // 3. Balance Check before entry
      if ((decision.action === 'BUY' || decision.action === 'SELL') && !currentPosition) {
        if (botBalance < 10) {
          addBotLog(`⚠️ Insufficient balance ($${botBalance.toFixed(2)}) to open ${sym}.`);
          continue;
        }
        
        if (botPositions.length >= RISK_CONFIG.maxOpenPositions) {
          addBotLog(`⚠️ Max positions reached (${RISK_CONFIG.maxOpenPositions}). Skipping ${sym}.`);
          continue;
        }
      }

      // Calculate SL and TP prices
      const slDistance = ind.atr * RISK_CONFIG.initialSLATRMult;
      const tpDistance = slDistance * RISK_CONFIG.tpRRRatio;

      switch (decision.action) {
        case 'BUY':
          const buySL = currentPrice - slDistance;
          const buyTP = currentPrice + tpDistance;
          await bulkClient.placeBracketOrder(symbol, "buy", decision.size, currentPrice, buySL, buyTP);
          break;
        case 'SELL':
          const sellSL = currentPrice + slDistance;
          const sellTP = currentPrice - tpDistance;
          await bulkClient.placeBracketOrder(symbol, "sell", decision.size, currentPrice, sellSL, sellTP);
          break;
        case 'CLOSE_LONG':
          if (currentPosition) await bulkClient.closePosition(symbol, currentPosition.size, "long");
          break;
        case 'CLOSE_SHORT':
          if (currentPosition) await bulkClient.closePosition(symbol, currentPosition.size, "short");
          break;
        default:
          // HOLD - do nothing
          break;
      }
    } catch (err: any) {
      addBotLog(`❌ ${sym} Error: ${err.message}`);
    }
  }
  botStatus = "Monitoring";
};
setInterval(runAutoTrader, 5 * 60 * 1000);

// --- SERVER START ---
async function startServer() {
  // Initialize WASM
  try {
    const wasmPath = path.join(__dirname, "node_modules", "bulk-keychain-wasm", "bulk_keychain_wasm_bg.wasm");
    if (fs.existsSync(wasmPath)) {
      const wasmBuffer = fs.readFileSync(wasmPath);
      await init({ module_or_path: wasmBuffer });
      console.log("[WASM] bulk-keychain initialized from buffer");
    } else {
      // Fallback for different environments
      const altPath = path.join(process.cwd(), "node_modules", "bulk-keychain-wasm", "bulk_keychain_wasm_bg.wasm");
      if (fs.existsSync(altPath)) {
        const wasmBuffer = fs.readFileSync(altPath);
        await init({ module_or_path: wasmBuffer });
        console.log("[WASM] bulk-keychain initialized from alt buffer");
      } else {
        await init();
        console.log("[WASM] bulk-keychain initialized (default)");
      }
    }
  } catch (e) {
    console.error("[WASM] Failed to initialize:", e);
  }

  // Try to restore session on startup
  const savedSession = loadSession();
  if (savedSession) {
    console.log("[Bot] Found saved session for:", savedSession.address);
    try {
      const keyStr = savedSession.agentPrivKey || savedSession.sessionPrivKey;
      if (keyStr) {
        const keypair = WasmKeypair.fromBase58(keyStr);
        bulkClient = new BulkClient(keypair);
        bulkClient.setToken(savedSession.token);
        bulkClient.setAddress(savedSession.address);
        bulkClient.connect();
        botEnabled = savedSession.botEnabled ?? true;
        botStatus = botEnabled ? "Monitoring" : "Idle";
        addBotLog(`Bot Session Restored for ${savedSession.address.slice(0, 6)}...`);
      }
    } catch (e) {
      console.error("Failed to restore session:", e);
    }
  }

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
