import axios from 'axios';
import { PriceData, NewsItem, Timeframe } from '../types.js';

// ══════════════════════════════════════════
//   📊 مصادر البيانات — Binance أولاً (مجاني + فوري)
//   CryptoCompare كـ fallback
// ══════════════════════════════════════════
const BINANCE_API      = 'https://api.binance.com/api/v3';
const CRYPTOCOMPARE_API = 'https://min-api.cryptocompare.com/data';
const BACKEND_URL      = "https://bulkappbot-production.up.railway.app";

// ── Cache لتجنب طلبات متكررة ──
const dataCache: Record<string, { data: PriceData[]; timestamp: number }> = {};
const CACHE_TTL = 60 * 1000; // دقيقة واحدة

// ── Binance interval map ──
const BINANCE_INTERVAL: Record<Timeframe, string> = {
  '1M':  '1m',
  '5M':  '5m',
  '15M': '15m',
  '30M': '30m',
  '1H':  '1h',
  '4H':  '4h',
  '1D':  '1d',
  '1W':  '1w',
};

// ══════════════════════════════════════════
//   🔄 Retry مع exponential backoff
// ══════════════════════════════════════════
async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000
): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isRateLimit =
        error?.response?.status === 429 ||
        error?.message?.toLowerCase().includes('rate limit');

      if (isRateLimit && i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        console.warn(`Rate limit hit. Retrying in ${delay}ms... (${i + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

// ══════════════════════════════════════════
//   📈 Binance — مصدر أول (مجاني + بدون rate limit تقريباً)
// ══════════════════════════════════════════
async function fetchFromBinance(
  symbol: string,
  timeframe: Timeframe,
  limit: number
): Promise<PriceData[]> {
  const pair     = `${symbol}USDT`;
  const interval = BINANCE_INTERVAL[timeframe] || '1h';

  const response = await axios.get(`${BINANCE_API}/klines`, {
    params: { symbol: pair, interval, limit },
    timeout: 8000,
  });

  if (!Array.isArray(response.data)) return [];

  return response.data.map((d: any) => ({
    time:   d[0],
    open:   parseFloat(d[1]),
    high:   parseFloat(d[2]),
    low:    parseFloat(d[3]),
    close:  parseFloat(d[4]),
    volume: parseFloat(d[5]),
  }));
}

// ══════════════════════════════════════════
//   📈 CryptoCompare — مصدر ثانٍ (fallback)
// ══════════════════════════════════════════
async function fetchFromCryptoCompare(
  symbol: string,
  timeframe: Timeframe,
  limit: number
): Promise<PriceData[]> {
  let endpoint  = 'histohour';
  let aggregate = 1;

  if      (timeframe === '1M')  { endpoint = 'histominute'; }
  else if (timeframe === '5M')  { endpoint = 'histominute'; aggregate = 5; }
  else if (timeframe === '15M') { endpoint = 'histominute'; aggregate = 15; }
  else if (timeframe === '30M') { endpoint = 'histominute'; aggregate = 30; }
  else if (timeframe === '1H')  { endpoint = 'histohour'; }
  else if (timeframe === '4H')  { endpoint = 'histohour';  aggregate = 4; }
  else if (timeframe === '1D')  { endpoint = 'histoday'; }
  else if (timeframe === '1W')  { endpoint = 'histoday';   aggregate = 7; }

  const response = await axios.get(`${CRYPTOCOMPARE_API}/v2/${endpoint}`, {
    params: { fsym: symbol, tsym: 'USD', limit, aggregate },
    timeout: 8000,
  });

  if (
    response.data.Response === 'Success' &&
    Array.isArray(response.data.Data?.Data)
  ) {
    return response.data.Data.Data.map((d: any) => ({
      time:   d.time * 1000,
      open:   d.open,
      high:   d.high,
      low:    d.low,
      close:  d.close,
      volume: d.volumeto,
    }));
  }

  return [];
}

// ══════════════════════════════════════════
//   🚀 fetchHistoricalData — مع cache + fallback
// ══════════════════════════════════════════
export async function fetchHistoricalData(
  symbol: string,
  timeframe: Timeframe = '1H',
  limit: number = 300
): Promise<PriceData[]> {
  const cacheKey = `${symbol}-${timeframe}-${limit}`;

  // تحقق من الـ cache أولاً
  if (dataCache[cacheKey] && Date.now() - dataCache[cacheKey].timestamp < CACHE_TTL) {
    return dataCache[cacheKey].data;
  }

  try {
    // المصدر الأول: Binance
    const data = await fetchWithRetry(() => fetchFromBinance(symbol, timeframe, limit));

    if (data.length >= 50) {
      dataCache[cacheKey] = { data, timestamp: Date.now() };
      return data;
    }
  } catch (err) {
    console.warn(`[API] Binance failed for ${symbol}, trying CryptoCompare...`);
  }

  try {
    // المصدر الثاني: CryptoCompare
    const data = await fetchWithRetry(() => fetchFromCryptoCompare(symbol, timeframe, limit));

    if (data.length > 0) {
      dataCache[cacheKey] = { data, timestamp: Date.now() };
      return data;
    }
  } catch (err) {
    console.error(`[API] Both sources failed for ${symbol}:`, err);
  }

  // إرجاع الـ cache القديم إن وجد
  if (dataCache[cacheKey]) {
    console.warn(`[API] Returning stale cache for ${symbol}`);
    return dataCache[cacheKey].data;
  }

  return [];
}

// ══════════════════════════════════════════
//   💰 سعر لحظي من Binance
// ══════════════════════════════════════════
export async function fetchCurrentPrice(symbol: string): Promise<number> {
  try {
    const res = await axios.get(`${BINANCE_API}/ticker/price`, {
      params: { symbol: `${symbol}USDT` },
      timeout: 3000,
    });
    return parseFloat(res.data.price) || 0;
  } catch {
    return 0;
  }
}

// ══════════════════════════════════════════
//   📰 News
// ══════════════════════════════════════════
export async function fetchNews(symbol: string): Promise<NewsItem[]> {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/news`, {
      params: { symbol },
      timeout: 5000,
    });
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    console.error(`Error fetching news for ${symbol}:`, error instanceof Error ? error.message : String(error));
    return [];
  }
}
