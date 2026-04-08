import { EMA, MACD, RSI, Stochastic, BollingerBands, ATR, OBV, ADX } from 'technicalindicators';
import { PriceData } from '../types.js';

// ══════════════════════════════════════════
//   ⚙️ Risk Management Settings
// ══════════════════════════════════════════
export const RISK_CONFIG = {
  maxRiskPerTrade:    0.02,   // Max loss per trade = 2% of balance
  maxTotalExposure:   0.06,   // Max total exposure = 6% of balance (3 trades)
  maxOpenPositions:   3,      // Max open positions at the same time
  minScoreToTrade:    72,     // New threshold: score > 72 for BUY
  highConfScore:      82,     // High score = larger size
  trailingATRMult:    1.2,    // ATR multiplier for Trailing Stop
  initialSLATRMult:   1.5,    // ATR multiplier for initial Stop Loss
  tpRRRatio:          2.5,    // TP/SL ratio (Risk:Reward = 1:2.5)
};

// ══════════════════════════════════════════
//   📊 Calculate all indicators
// ══════════════════════════════════════════
export function computeIndicators(data: PriceData[]) {
  const closes  = data.map(d => d.close);
  const highs   = data.map(d => d.high);
  const lows    = data.map(d => d.low);
  const volumes = data.map(d => d.volume);
  const n = closes.length;

  const ema9   = EMA.calculate({ period: 9,   values: closes });
  const ema21  = EMA.calculate({ period: 21,  values: closes });
  const ema50  = EMA.calculate({ period: 50,  values: closes });
  const ema200 = EMA.calculate({ period: 200, values: closes });
  const rsi14  = RSI.calculate({ period: 14,  values: closes });

  const macd = MACD.calculate({
    fastPeriod: 12, slowPeriod: 26, signalPeriod: 9,
    values: closes, SimpleMAOscillator: false, SimpleMASignal: false,
  });

  const stoch = Stochastic.calculate({
    period: 14, signalPeriod: 3,
    high: highs, low: lows, close: closes,
  });

  const bb = BollingerBands.calculate({ period: 20, stdDev: 2, values: closes });

  const atr14 = ATR.calculate({ period: 14, high: highs, low: lows, close: closes });

  const obv = OBV.calculate({ close: closes, volume: volumes });

  const adx = ADX.calculate({ period: 14, high: highs, low: lows, close: closes });

  const vwap = data.reduce((a, d) => a + (d.high + d.low + d.close) / 3 * d.volume, 0)
             / data.reduce((a, d) => a + d.volume, 0);

  const recent20 = closes.slice(-20);
  const avg20 = recent20.reduce((a, b) => a + b, 0) / 20;
  const volatility = Math.sqrt(recent20.reduce((a, b) => a + Math.pow(b - avg20, 2), 0) / 20) / avg20 * 100;

  const slope = (arr: number[], period = 3) =>
    arr.length >= period ? (arr[arr.length-1] - arr[arr.length-period]) / arr[arr.length-period] * 100 : 0;

  const recentHigh = Math.max(...highs.slice(-20));
  const recentLow  = Math.min(...lows.slice(-20));

  return {
    price:    closes[n-1],
    ema9:     ema9[ema9.length-1],
    ema21:    ema21[ema21.length-1],
    ema50:    ema50[ema50.length-1],
    ema200:   ema200[ema200.length-1],
    rsi:      rsi14[rsi14.length-1],
    macd:     macd[macd.length-1] as any,
    stoch:    stoch[stoch.length-1],
    bb:       bb[bb.length-1],
    atr:      atr14[atr14.length-1],
    adx:      adx[adx.length-1] as any,
    obv:      obv[obv.length-1],
    obvSlope: slope([...obv], 5),
    vwap,
    volatility,
    recentHigh,
    recentLow,
    ema9Slope:  slope([...ema9]),
    ema21Slope: slope([...ema21]),
    ema50Slope: slope([...ema50]),
  };
}

export type MarketRegime = 'TRENDING' | 'RANGING' | 'BREAKOUT' | 'UNCERTAIN';

export function detectMarketRegime(ind: any): MarketRegime {
  const adxVal = ind.adx?.adx ?? 0;
  const bbWidth = ind.bb ? (ind.bb.upper - ind.bb.lower) / ind.bb.middle * 100 : 5;
  const bullStack = ind.ema9 > ind.ema21 && ind.ema21 > ind.ema50;
  const bearStack = ind.ema9 < ind.ema21 && ind.ema21 < ind.ema50;

  // 1. Breakout: BB Expansion + Volume
  if (bbWidth > 6 && Math.abs(ind.obvSlope) > 0.8) {
    return 'BREAKOUT';
  }
  // 2. Trending: ADX > 25 + EMA Stack
  if (adxVal > 25 && (bullStack || bearStack)) {
    return 'TRENDING';
  }
  // 3. Ranging: ADX < 20 + Narrow BB
  if (adxVal < 20 && bbWidth < 3) {
    return 'RANGING';
  }
  
  return 'UNCERTAIN';
}

function scoreTrendLayer(ind: any): number {
  let score = 50;
  // EMA Stack (40% of this layer)
  if (ind.ema9 > ind.ema21 && ind.ema21 > ind.ema50 && ind.ema50 > ind.ema200) score += 25;
  else if (ind.ema9 < ind.ema21 && ind.ema21 < ind.ema50 && ind.ema50 < ind.ema200) score -= 25;
  
  // Position relative to EMA200 (30%)
  if (ind.price > ind.ema200) score += 15;
  else if (ind.price < ind.ema200) score -= 15;
  
  // ADX Strength (30%) - Fix: Only trust ADX if it exists and is not zero
  if (ind.adx && ind.adx.adx > 25) {
    if (ind.ema9Slope > 0) score += 10;
    else if (ind.ema9Slope < 0) score -= 10;
  }
  
  return Math.max(0, Math.min(100, score));
}

function scoreMomentumLayer(ind: any): number {
  let score = 50;
  // MACD (40%)
  if (ind.macd?.MACD > ind.macd?.signal && ind.macd?.histogram > 0) score += 20;
  else if (ind.macd?.MACD < ind.macd?.signal && ind.macd?.histogram < 0) score -= 20;
  
  // RSI (30%)
  if (ind.rsi > 50 && ind.rsi < 70) score += 15;
  else if (ind.rsi < 50 && ind.rsi > 30) score -= 15;
  
  // OBV Volume (30%)
  if (ind.obvSlope > 0.5) score += 15;
  else if (ind.obvSlope < -0.5) score -= 15;
  
  return Math.max(0, Math.min(100, score));
}

function scoreEntryLayer(ind: any): number {
  let score = 50;
  // Stochastic (40%)
  if (ind.stoch && ind.stoch.k > ind.stoch.d && ind.stoch.k < 30) score += 20;
  else if (ind.stoch && ind.stoch.k < ind.stoch.d && ind.stoch.k > 70) score -= 20;
  
  // Bollinger & VWAP (60%)
  if (ind.bb) {
    const pos = (ind.price - ind.bb.lower) / (ind.bb.upper - ind.bb.lower);
    if (pos < 0.2 && ind.price > ind.vwap) score += 15;
    else if (pos > 0.8 && ind.price < ind.vwap) score -= 15;
  }
  
  return Math.max(0, Math.min(100, score));
}

function scoreRangingLayer(ind: any): number {
  let score = 50;
  // Mean Reversion: BB + RSI + Stoch (Fix: Add confirmations)
  if (ind.bb) {
    const pos = (ind.price - ind.bb.lower) / (ind.bb.upper - ind.bb.lower);
    if (pos < 0.15 && ind.rsi < 35 && ind.stoch?.k < 25) score += 30;
    if (pos > 0.85 && ind.rsi > 65 && ind.stoch?.k > 75) score -= 30;
  }
  return Math.max(0, Math.min(100, score));
}

export function calculateTechnicalScore(indicators: any, lastPrice: number): number {
  const regime = detectMarketRegime(indicators);
  
  if (regime === 'RANGING') {
    return scoreRangingLayer(indicators);
  }
  
  const trend = scoreTrendLayer(indicators);
  const momentum = scoreMomentumLayer(indicators);
  const entry = scoreEntryLayer(indicators);
  
  // Weighted Average: 40% Trend, 35% Momentum, 25% Entry
  return (trend * 0.4) + (momentum * 0.35) + (entry * 0.25);
}

export function calculatePositionSize(balance: number, price: number, atr: number, score: number, symbol: string): number {
  const maxLoss = balance * RISK_CONFIG.maxRiskPerTrade;
  const slDistance = atr * RISK_CONFIG.initialSLATRMult;
  
  // Dynamic Sizing: (Balance * 2%) / SL Distance
  let size = maxLoss / slDistance;
  
  // Multiplier: Increase up to 50% for strong signals (>85 or <15), decrease for weak ones
  const signalStrength = Math.abs(score - 50) / 50; // 0 to 1
  if (score > 85 || score < 15) {
    size *= 1.5; // +50% for very strong signals
  } else if (score > 75 || score < 25) {
    size *= 1.2; // +20% for strong signals
  } else {
    size *= (0.7 + signalStrength); // Reduce for weaker signals
  }
  
  if (symbol.startsWith('BTC')) return Math.max(0.001, Math.min(0.2, parseFloat(size.toFixed(4))));
  if (symbol.startsWith('ETH')) return Math.max(0.01, Math.min(2.0, parseFloat(size.toFixed(3))));
  return Math.max(0.1, Math.min(200.0, parseFloat(size.toFixed(2))));
}

export interface TradeDecision {
  action: 'BUY' | 'SELL' | 'CLOSE_LONG' | 'CLOSE_SHORT' | 'HOLD';
  size: number;
  score: number;
  strategy: string;
  regime: MarketRegime;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  orderType: 'market' | 'limit';
}

export function getTradeDecision(
  data: PriceData[],
  balance: number,
  symbol: string,
  currentPosition: any,
  newsScore?: number
): TradeDecision {
  if (data.length < 200) return { action: 'HOLD', size: 0, score: 50, strategy: '-', regime: 'UNCERTAIN', confidence: 'LOW', reason: 'Insufficient data', orderType: 'market' };

  const ind = computeIndicators(data);
  const regime = detectMarketRegime(ind);
  const techScore = calculateTechnicalScore(ind, ind.price);
  
  // Combine technical and news scores if newsScore is provided
  const score = newsScore !== undefined ? calculateFinalScore(techScore, newsScore) : techScore;
  
  // --- Volatility Filter (Fix: Skip if spread/volatility too low) ---
  const bbWidth = ind.bb ? (ind.bb.upper - ind.bb.lower) / ind.bb.middle * 100 : 5;
  if (bbWidth < 0.5) {
    return { action: 'HOLD', size: 0, score, strategy: '-', regime, confidence: 'LOW', reason: 'Market too quiet (Low Volatility)', orderType: 'market' };
  }

  const confidence = score > 82 || score < 18 ? 'HIGH' : score > 72 || score < 28 ? 'MEDIUM' : 'LOW';

  // --- Smart Order Type Selection Algorithm ---
  const volatility = ind.atr / ind.price;
  const isHighUrgency = score > 85 || score < 15;
  const isHighVolatility = volatility > 0.003; // Volatility higher than 0.3%
  
  const getOrderType = (action: string): 'market' | 'limit' => {
    if (action.startsWith('CLOSE_')) return 'market'; // Fast exit is always market
    if (isHighUrgency || isHighVolatility) return 'market'; // In high volatility or very strong signals
    return 'limit'; // In normal cases, we use limit to save fees
  };

  if (currentPosition && currentPosition.size !== 0) {
    const isLong = currentPosition.size > 0;
    if (isLong && score < 40) {
      const action = 'CLOSE_LONG';
      return { action, size: Math.abs(currentPosition.size), score, strategy: 'Exit', regime, confidence, reason: 'Signal reversal', orderType: getOrderType(action) };
    }
    if (!isLong && score > 60) {
      const action = 'CLOSE_SHORT';
      return { action, size: Math.abs(currentPosition.size), score, strategy: 'Exit', regime, confidence, reason: 'Signal reversal', orderType: getOrderType(action) };
    }
    return { action: 'HOLD', size: 0, score, strategy: 'Manage', regime, confidence, reason: 'Position continuation', orderType: 'market' };
  }

  if (score > RISK_CONFIG.minScoreToTrade) {
    const action = 'BUY';
    const size = calculatePositionSize(balance, ind.price, ind.atr, score, symbol);
    return { action, size, score, strategy: regime, regime, confidence, reason: `Strong buy signal [${regime}]`, orderType: getOrderType(action) };
  }
  if (score < (100 - RISK_CONFIG.minScoreToTrade)) {
    const action = 'SELL';
    const size = calculatePositionSize(balance, ind.price, ind.atr, score, symbol);
    return { action, size, score, strategy: regime, regime, confidence, reason: `Strong sell signal [${regime}]`, orderType: getOrderType(action) };
  }

  return { action: 'HOLD', size: 0, score, strategy: '-', regime, confidence: 'LOW', reason: 'Neutral zone', orderType: 'market' };
}

export function calculateFinalScore(technicalScore: number, newsScore: number): number {
  const normalizedSent = (newsScore + 100) / 2;
  return (technicalScore * 0.9) + (normalizedSent * 0.1);
}

export function getRecommendation(finalScore: number, techScore: number): string {
  if (techScore > 85) return "STRONG BUY (CONFLUENCE)";
  if (techScore > 72) return "BUY (CONFLUENCE)";
  if (techScore < 15) return "STRONG SELL (CONFLUENCE)";
  if (techScore < 28) return "SELL (CONFLUENCE)";
  return "NEUTRAL / CONSOLIDATION";
}

export function backtestStrategy(data: PriceData[]): { wins: number; losses: number; winRate: number } {
  if (data.length < 50) return { wins: 0, losses: 0, winRate: 0 };
  let wins = 0, losses = 0;
  const closes = data.map(d => d.close);
  const ema9 = EMA.calculate({ period: 9, values: closes });
  const ema21 = EMA.calculate({ period: 21, values: closes });
  const period = Math.min(ema9.length - 21, 100);
  const offset = data.length - ema9.length;
  for (let i = ema9.length - period; i < ema9.length - 5; i++) {
    const c9 = ema9[i], c21 = ema21[i], p9 = ema9[i-1], p21 = ema21[i-1];
    if (p9 <= p21 && c9 > c21) {
      data[i + offset + 5].close > data[i + offset].close ? wins++ : losses++;
    } else if (p9 >= p21 && c9 < c21) {
      data[i + offset + 5].close < data[i + offset].close ? wins++ : losses++;
    }
  }
  const total = wins + losses;
  return { wins, losses, winRate: total > 0 ? (wins / total) * 100 : 0 };
}

