import WebSocket from "ws";
import nacl from "tweetnacl";
import bs58 from "bs58";
import fetch from "node-fetch";
// @ts-ignore
import { NativeKeypair, NativeSigner } from 'bulk-keychain';

const BULK_WS_URL = "wss://exchange-ws1.bulk.trade";
const ORIGIN_URL = "https://early.bulk.trade";
const PRIVY_APP_ID = "cmbuls93q01jol20lf0ak0plb";
const PRIVY_URL = "https://auth.privy.io/api/v1";

export interface BotUpdateData {
  balance: number;
  positions: any[];
  enabled: boolean;
  status: string;
}

export class BulkClient {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private address: string | null = null;
  private signer: NativeSigner;
  private keypair: NativeKeypair;
  private onUpdate: (data: Partial<BotUpdateData>) => void;
  private onLog: (msg: string) => void;

  constructor(keypair: NativeKeypair, onUpdate: (data: Partial<BotUpdateData>) => void, onLog: (msg: string) => void) {
    this.keypair = keypair;
    this.signer = new NativeSigner(keypair);
    this.signer.setComputeBatchOrderIds(true);
    this.onUpdate = onUpdate;
    this.onLog = onLog;
  }

  async authenticate(address: string, message: string, signature: string): Promise<boolean> {
    const headers = { 
      "Origin": ORIGIN_URL, 
      "Referer": `${ORIGIN_URL}/`, 
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
      
      if (!r_auth_data.token) {
        console.error("[Auth] Privy Error Details:", r_auth_data);
        return false;
      }

      this.token = r_auth_data.token;
      this.address = address;
      this.onLog(`Authenticated ${address.slice(0, 6)}...`);
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
      console.log(`[BulkWS] Session Connected for ${this.address}`);
      this.ws?.send(JSON.stringify({ 
        method: "subscribe", 
        id: 1, 
        subscription: [{ type: "account", user: this.address }] 
      }));
      this.onLog("Bot Session Connected.");
    });

    this.ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "account") {
          if (msg.data?.type === "accountSnapshot" || msg.data?.type === "accountUpdate") {
            const margin = msg.data.margin || {};
            const newBalance = parseFloat(margin.availableBalance || margin.totalMarginBalance || margin.withdrawableBalance || "0");
            
            const update: Partial<BotUpdateData> = {};
            if (!isNaN(newBalance)) {
              update.balance = newBalance;
            }
            
            if (msg.data.positions) {
              update.positions = msg.data.positions;
            }
            
            this.onUpdate(update);
          }
        } else if (msg.type === "error") {
          console.error(`[BulkWS] Error:`, msg.message);
          this.onLog(`❌ Exchange Error: ${msg.message}`);
        }
      } catch (e) {
        console.error("[BulkWS] Message Parse Error:", e);
      }
    });

    this.ws.on("close", () => {
      this.onLog("Bot Session Disconnected.");
    });

    this.ws.on("error", (err) => {
      console.error("[BulkWS] Error:", err.message);
      this.onLog(`❌ WebSocket Error: ${err.message}`);
    });
  }

  async sendAction(method: string, params: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    
    const ts = Date.now();
    const action = { [method]: params };
    const payload = {
      account: this.address,
      actions: [action],
      nonce: ts,
      type: "action"
    };

    const payloadJson = JSON.stringify(payload, null, 0).replace(/\s/g, '');
    const signatureBytes = nacl.sign.detached(
      Buffer.from(payloadJson),
      bs58.decode(this.keypair.toBase58())
    );
    const signature = bs58.encode(signatureBytes);
    const signer = this.keypair.address();

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

  async placeOrder(symbol: string, side: 'buy' | 'sell', size: number, price: number = 0, typeOverride?: 'market' | 'limit', stopLossPrice?: number, takeProfitPrice?: number) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const formattedSize = symbol.startsWith("BTC") ? size.toFixed(4) : size.toFixed(2);
    const isBuy = side === 'buy';
    
    const entryOrder: any = {
      type: 'order',
      symbol,
      isBuy,
      price: price || 0,
      size: parseFloat(formattedSize),
      orderType: (typeOverride === 'limit' && price > 0) 
        ? { type: 'limit', tif: 'GTC' } 
        : { type: 'market', isMarket: true, triggerPx: 0 }
    };

    const actions: any[] = [entryOrder];

    if (stopLossPrice) {
      actions.push({
        type: 'stop',
        symbol,
        isBuy: !isBuy,
        size: parseFloat(formattedSize),
        triggerPrice: stopLossPrice,
      });
    }

    if (takeProfitPrice) {
      actions.push({
        type: 'takeProfit',
        symbol,
        isBuy: !isBuy,
        size: parseFloat(formattedSize),
        triggerPrice: takeProfitPrice,
      });
    }

    const signed = actions.length > 1 
      ? this.signer.signGroup(actions) 
      : this.signer.sign(entryOrder);

    const parsedActions = typeof signed.actions === 'string' 
      ? JSON.parse(signed.actions) 
      : signed.actions;

    const msg = {
      method: "post",
      id: signed.nonce,
      request: {
        type: "action",
        payload: {
          actions: parsedActions,
          nonce: signed.nonce,
          account: this.address,
          signer: signed.signer,
          signature: signed.signature
        }
      }
    };
    
    this.ws.send(JSON.stringify(msg));
    
    const orderId = signed.orderId || (signed as any).orderIds?.[0];
    this.onLog(`Placed ${typeOverride?.toUpperCase() || 'AUTO'} ${side.toUpperCase()} order for ${symbol} | Size: ${formattedSize}`);
    if (stopLossPrice) this.onLog(`   └─ SL: ${stopLossPrice}`);
    if (takeProfitPrice) this.onLog(`   └─ TP: ${takeProfitPrice}`);
    if (orderId) this.onLog(`   └─ ID: ${orderId}`);
  }

  async setLeverage(symbol: string, leverage: number) {
    await this.sendAction("updateUserSettings", { m: { [symbol]: leverage } });
    this.onLog(`Updated Leverage for ${symbol} to ${leverage}x`);
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
    await this.sendAction("m", params);
    this.onLog(`Closing ${side.toUpperCase()} position for ${symbol}`);
  }

  stop() {
    this.ws?.close();
    this.ws = null;
    this.onLog("Session Closed.");
  }

  getAddress() {
    return this.address;
  }
}
