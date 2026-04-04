import axios from 'axios';
import { PriceData, NewsItem, Timeframe } from '../types.js';

// CryptoCompare API for historical data (free tier)
const CRYPTOCOMPARE_API = 'https://min-api.cryptocompare.com/data';
// CryptoPanic API for news (requires API key)
const CRYPTOPANIC_API = 'https://cryptopanic.com/api/v1/posts/';

async function fetchWithRetry<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 1000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isRateLimit = error?.response?.status === 429 || 
                         (error?.message && error.message.includes('rate limit'));
      
      if (isRateLimit && i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        console.warn(`Rate limit hit. Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export async function fetchHistoricalData(symbol: string, timeframe: Timeframe = '1D', limit: number = 200): Promise<PriceData[]> {
  try {
    return await fetchWithRetry(async () => {
      let endpoint = 'histoday';
      let aggregate = 1;

      if (timeframe === '1M') {
        endpoint = 'histominute';
      } else if (timeframe === '5M') {
        endpoint = 'histominute';
        aggregate = 5;
      } else if (timeframe === '15M') {
        endpoint = 'histominute';
        aggregate = 15;
      } else if (timeframe === '30M') {
        endpoint = 'histominute';
        aggregate = 30;
      } else if (timeframe === '1H') {
        endpoint = 'histohour';
      } else if (timeframe === '4H') {
        endpoint = 'histohour';
        aggregate = 4;
      } else if (timeframe === '1W') {
        endpoint = 'histoday';
        aggregate = 7;
      }

      const response = await axios.get(`${CRYPTOCOMPARE_API}/v2/${endpoint}`, {
        params: {
          fsym: symbol,
          tsym: 'USD',
          limit: limit,
          aggregate: aggregate,
        },
      });

      if (response.data.Response === 'Success' && response.data.Data && Array.isArray(response.data.Data.Data)) {
        return response.data.Data.Data.map((d: any) => ({
          time: d.time * 1000,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
          volume: d.volumeto,
        }));
      } else if (response.data.Response === 'Error') {
        const msg = response.data.Message || 'Unknown CryptoCompare error';
        // If it's a rate limit error in the response body
        if (msg.toLowerCase().includes('rate limit')) {
          throw new Error(msg);
        }
        console.error(`CryptoCompare Error for ${symbol}: ${msg}`);
        return []; // Don't retry for other errors
      }
      return [];
    });
  } catch (error) {
    console.error(`Error fetching historical data for ${symbol}:`, error instanceof Error ? error.message : String(error));
    return [];
  }
}

const BACKEND_URL = "https://bulkappbot-production.up.railway.app";

export async function fetchNews(symbol: string): Promise<NewsItem[]> {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/news`, {
      params: { symbol },
    });

    if (Array.isArray(response.data)) {
      return response.data;
    }

    return [];
  } catch (error) {
    console.error(`Error fetching news for ${symbol}:`, error instanceof Error ? error.message : String(error));
    throw error;
  }
}
