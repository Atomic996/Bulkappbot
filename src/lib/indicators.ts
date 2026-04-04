import { EMA, MACD, RSI, Stochastic, BollingerBands, ATR, OBV, ADX } from 'technicalindicators';
import { PriceData } from '../types.js';

// ══════════════════════════════════════════
//   ⚙️ إعدادات إدارة المخاطر
// ══════════════════════════════════════════
const RISK_CONFIG = {
  maxRiskPerTrade:    0.02,   // أقصى خسارة لكل صفقة = 2% من الرصيد
  maxTotalExposure:   0.06,   // أقصى تعرض كلي = 6% من الرصيد (3 صفقات)
  minScoreToTrade:    68,     // أدنى score لفتح صفقة
  highConfScore:      80,     // score عالي = حجم أكبر
  trailingATRMult:    1.2,    // مضاعف ATR للـ Trailing Stop
  initialSLATRMult:   1.5,    // مضاعف ATR للـ Stop Loss الأولي
  tpRRRatio:          2.5,    // نسبة TP/SL (Risk:Reward = 1:2.5)
};

// ══════════════════════════════════════════
//   📊 حساب كل المؤشرات
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

  if (bbWidth > 6 && ind.volatility > 3 && Math.abs(ind.obvSlope) > 0.5) {
    return 'BREAKOUT';
  }
  if (adxVal > 25 && (bullStack || bearStack)) {
    return 'TRENDING';
  }
  if (adxVal < 20 && bbWidth < 4) {
    return 'RANGING';
  }
  return 'UNCERTAIN';
}

function scoreTrend(ind: any): number {
  let score = 50;
  if (ind.ema9 > ind.ema21 && ind.ema21 > ind.ema50 && ind.ema50 > ind.ema200) score += 25;
  else if (ind.ema9 < ind.ema21 && ind.ema21 < ind.ema50 && ind.ema50 < ind.ema200) score -= 25;
  if (ind.macd?.MACD > ind.macd?.signal && ind.macd?.histogram > 0) score += 15;
  if (ind.macd?.MACD < ind.macd?.signal && ind.macd?.histogram < 0) score -= 15;
  if (ind.rsi > 55 && ind.rsi < 72) score += 10;
  if (ind.rsi < 45 && ind.rsi > 28) score -= 10;
  if (ind.ema9Slope > 0) score += 10; else score -= 10;
  return Math.max(5, Math.min(95, score));
}

function scoreReversion(ind: any): number {
  let score = 50;
  if (ind.bb) {
    const pos = (ind.price - ind.bb.lower) / (ind.bb.upper - ind.bb.lower);
    if (pos < 0.1) score += 30;
    if (pos > 0.9) score -= 30;
  }
  if (ind.rsi < 25) score += 25;
  if (ind.rsi > 75) score -= 25;
  if (ind.stoch && ind.stoch.k > ind.stoch.d && ind.stoch.k < 25) score += 20;
  if (ind.stoch && ind.stoch.k < ind.stoch.d && ind.stoch.k > 75) score -= 20;
  return Math.max(5, Math.min(95, score));
}

function scoreBreakout(ind: any): number {
  let score = 50;
  if (ind.price >= ind.recentHigh * 0.998) score += 25;
  if (ind.price <= ind.recentLow * 1.002) score -= 25;
  if (ind.obvSlope > 0.5) score += 15;
  if (ind.obvSlope < -0.5) score -= 15;
  return Math.max(5, Math.min(95, score));
}

export function calculateTechnicalScore(indicators: any, lastPrice: number): number {
  const regime = detectMarketRegime(indicators);
  switch (regime) {
    case 'TRENDING': return scoreTrend(indicators);
    case 'RANGING': return scoreReversion(indicators);
    case 'BREAKOUT': return (scoreBreakout(indicators) * 0.6 + scoreTrend(indicators) * 0.4);
    default: return (scoreTrend(indicators) + scoreReversion(indicators) + scoreBreakout(indicators)) / 3;
  }
}

export function calculatePositionSize(balance: number, price: number, atr: number, score: number, symbol: string): number {
  const maxLoss = balance * RISK_CONFIG.maxRiskPerTrade;
  const slDistance = atr * RISK_CONFIG.initialSLATRMult;
  let size = maxLoss / slDistance;
  const signalStrength = Math.abs(score - 50) / 50;
  size *= (0.5 + signalStrength);
  
  if (symbol.startsWith('BTC')) return Math.max(0.001, Math.min(0.1, parseFloat(size.toFixed(4))));
  if (symbol.startsWith('ETH')) return Math.max(0.01, Math.min(1.0, parseFloat(size.toFixed(3))));
  return Math.max(0.1, Math.min(100.0, parseFloat(size.toFixed(2))));
}

export interface TradeDecision {
  action: 'BUY' | 'SELL' | 'CLOSE_LONG' | 'CLOSE_SHORT' | 'HOLD';
  size: number;
  score: number;
  strategy: string;
  regime: MarketRegime;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
}

export function getTradeDecision(
  data: PriceData[],
  balance: number,
  symbol: string,
  currentPosition: any
): TradeDecision {
  if (data.length < 200) return { action: 'HOLD', size: 0, score: 50, strategy: '-', regime: 'UNCERTAIN', confidence: 'LOW', reason: 'بيانات غير كافية' };

  const ind = computeIndicators(data);
  const regime = detectMarketRegime(ind);
  const score = calculateTechnicalScore(ind, ind.price);
  
  const confidence = score > 80 || score < 20 ? 'HIGH' : score > 70 || score < 30 ? 'MEDIUM' : 'LOW';

  if (currentPosition && currentPosition.size !== 0) {
    const isLong = currentPosition.size > 0;
    if (isLong && score < 35) return { action: 'CLOSE_LONG', size: Math.abs(currentPosition.size), score, strategy: 'Exit', regime, confidence, reason: 'انعكاس الإشارة' };
    if (!isLong && score > 65) return { action: 'CLOSE_SHORT', size: Math.abs(currentPosition.size), score, strategy: 'Exit', regime, confidence, reason: 'انعكاس الإشارة' };
    return { action: 'HOLD', size: 0, score, strategy: 'Manage', regime, confidence, reason: 'استمرار المركز' };
  }

  if (score > RISK_CONFIG.minScoreToTrade) {
    const size = calculatePositionSize(balance, ind.price, ind.atr, score, symbol);
    return { action: 'BUY', size, score, strategy: regime, regime, confidence, reason: `إشارة شراء قوية [${regime}]` };
  }
  if (score < (100 - RISK_CONFIG.minScoreToTrade)) {
    const size = calculatePositionSize(balance, ind.price, ind.atr, score, symbol);
    return { action: 'SELL', size, score, strategy: regime, regime, confidence, reason: `إشارة بيع قوية [${regime}]` };
  }

  return { action: 'HOLD', size: 0, score, strategy: '-', regime, confidence: 'LOW', reason: 'منطقة محايدة' };
}

export function calculateFinalScore(technicalScore: number, newsScore: number): number {
  const normalizedSent = (newsScore + 100) / 2;
  return (technicalScore * 0.9) + (normalizedSent * 0.1);
}

export function getRecommendation(finalScore: number, techScore: number): string {
  if (techScore > 82) return "STRONG BUY (TREND)";
  if (techScore > 62) return "BUY (TREND)";
  if (techScore < 18) return "STRONG SELL (TREND)";
  if (techScore < 38) return "SELL (TREND)";
  return "NEUTRAL / SIDEWAYS";
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

