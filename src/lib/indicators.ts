import {
  EMA,
  MACD,
  RSI,
  Stochastic,
  BollingerBands,
  ATR,
  OBV,
} from 'technicalindicators';
import { PriceData, IndicatorData } from '../types';

export function calculateIndicators(data: PriceData[]): IndicatorData {
  if (data.length < 200) return {};

  const closes = data.map((d) => d.close);
  const highs = data.map((d) => d.high);
  const lows = data.map((d) => d.low);
  const volumes = data.map((d) => d.volume);

  const ema9 = EMA.calculate({ period: 9, values: closes });
  const ema21 = EMA.calculate({ period: 21, values: closes });
  const ema50 = EMA.calculate({ period: 50, values: closes });
  const ema200 = EMA.calculate({ period: 200, values: closes });

  const rsi = RSI.calculate({ period: 14, values: closes });
  
  // Calculate EMA Slopes (last 3 candles)
  const getSlope = (ema: number[]) => {
    if (ema.length < 2) return 0;
    return (ema[ema.length - 1] - ema[ema.length - 2]) / ema[ema.length - 2] * 100;
  };

  const macd = MACD.calculate({
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    values: closes,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });

  const stochastic = Stochastic.calculate({
    period: 14,
    signalPeriod: 3,
    high: highs,
    low: lows,
    close: closes,
  });

  const bollinger = BollingerBands.calculate({
    period: 20,
    stdDev: 2,
    values: closes,
  });

  const atr = ATR.calculate({
    period: 14,
    high: highs,
    low: lows,
    close: closes,
  });

  const obv = OBV.calculate({
    close: closes,
    volume: volumes,
  });

  // Simple VWAP calculation (simplified for frontend)
  const vwap = data.reduce((acc, d) => acc + (d.high + d.low + d.close) / 3 * d.volume, 0) / data.reduce((acc, d) => acc + d.volume, 0);

  return {
    ema9: ema9[ema9.length - 1],
    ema21: ema21[ema21.length - 1],
    ema50: ema50[ema50.length - 1],
    ema200: ema200[ema200.length - 1],
    rsi: rsi[rsi.length - 1],
    macd: macd[macd.length - 1] ? {
      macd: (macd[macd.length - 1] as any).MACD,
      signal: (macd[macd.length - 1] as any).signal,
      histogram: (macd[macd.length - 1] as any).histogram
    } : undefined,
    stochastic: stochastic[stochastic.length - 1],
    bollinger: bollinger[bollinger.length - 1],
    atr: atr[atr.length - 1],
    obv: obv[obv.length - 1],
    vwap,
    slopes: {
      ema9: getSlope(ema9),
      ema21: getSlope(ema21),
      ema50: getSlope(ema50),
      ema200: getSlope(ema200)
    }
  };
}

export function calculateTechnicalScore(indicators: IndicatorData, lastPrice: number): number {
  // --- ALGORITHMIC CORE (STRICTLY NON-AI) ---
  // This logic is purely mathematical based on Trend Following principles.
  
  let score = 50; // Base score (neutral)

  if (!indicators.rsi || !indicators.ema9 || !indicators.ema21) return 50;

  // 1. Structural Trend Alignment (The "Stack")
  // Check if EMAs are stacked in a bullish or bearish order
  const isBullishStack = indicators.ema9 > indicators.ema21 && 
                         (indicators.ema50 ? indicators.ema21 > indicators.ema50 : true) &&
                         (indicators.ema200 ? (indicators.ema50 || indicators.ema21) > indicators.ema200 : true);
                         
  const isBearishStack = indicators.ema9 < indicators.ema21 && 
                         (indicators.ema50 ? indicators.ema21 < indicators.ema50 : true) &&
                         (indicators.ema200 ? (indicators.ema50 || indicators.ema21) < indicators.ema200 : true);

  if (isBullishStack) score += 20;
  if (isBearishStack) score -= 20;

  // 2. Price Proximity to Anchor (EMA 200)
  if (indicators.ema200) {
    const distFrom200 = ((lastPrice - indicators.ema200) / indicators.ema200) * 100;
    // If price is above 200, we are in a Bull Market
    if (lastPrice > indicators.ema200) {
      score += 10;
      if (distFrom200 > 5) score += 5; // Strong trend confirmation
    } else {
      score -= 10;
      if (distFrom200 < -5) score -= 5; // Strong downtrend confirmation
    }
  }

  // 3. Momentum Confirmation (MACD)
  if (indicators.macd) {
    const { macd, signal, histogram } = indicators.macd;
    if (macd > signal && histogram > 0) score += 10;
    if (macd < signal && histogram < 0) score -= 10;
  }

  // 4. RSI Trend Filter & Health
  // We use RSI to detect if the trend is "healthy" or "exhausted"
  if (indicators.rsi > 50 && indicators.rsi < 70) score += 5; // Healthy uptrend
  if (indicators.rsi < 50 && indicators.rsi > 30) score -= 5; // Healthy downtrend
  
  // 5. Slope Confirmation (Is the trend actually moving?)
  if (indicators.slopes) {
    const { ema9, ema21 } = indicators.slopes;
    if (isBullishStack && ema9 > 0 && ema21 > 0) score += 10; // Accelerating uptrend
    if (isBearishStack && ema9 < 0 && ema21 < 0) score -= 10; // Accelerating downtrend
  }

  // 6. Bollinger Bands (Volatility & Mean Reversion)
  if (indicators.bollinger) {
    const { upper, lower } = indicators.bollinger;
    if (lastPrice > upper) score -= 10; // Overbought (Mean reversion potential)
    if (lastPrice < lower) score += 10; // Oversold (Mean reversion potential)
  }

  // 7. Stochastic Oscillator (Momentum)
  if (indicators.stochastic) {
    const { k, d } = indicators.stochastic;
    if (k > d && k < 20) score += 10; // Bullish crossover in oversold
    if (k < d && k > 80) score -= 10; // Bearish crossover in overbought
  }

  // 8. VWAP (Institutional Benchmark)
  if (indicators.vwap) {
    if (lastPrice > indicators.vwap) score += 5;
    else score -= 5;
  }

  // Exhaustion penalties
  if (indicators.rsi > 80) score -= 15; // Overextended
  if (indicators.rsi < 20) score += 15; // Oversold bounce potential

  return Math.max(5, Math.min(95, score));
}

export function backtestStrategy(data: PriceData[]): { wins: number; losses: number; winRate: number } {
  if (data.length < 50) return { wins: 0, losses: 0, winRate: 0 };

  let wins = 0;
  let losses = 0;
  const period = Math.min(data.length - 21, 100); // Backtest last 100 candles
  
  // Simple EMA Crossover Strategy Backtest
  const closes = data.map(d => d.close);
  const ema9 = EMA.calculate({ period: 9, values: closes });
  const ema21 = EMA.calculate({ period: 21, values: closes });
  
  // Align indices
  const offset = data.length - ema9.length;
  
  for (let i = ema9.length - period; i < ema9.length - 5; i++) {
    const currentEma9 = ema9[i];
    const currentEma21 = ema21[i];
    const prevEma9 = ema9[i-1];
    const prevEma21 = ema21[i-1];
    
    // Golden Cross (Buy Signal)
    if (prevEma9 <= prevEma21 && currentEma9 > currentEma21) {
      const entryPrice = data[i + offset].close;
      // Look ahead 5 candles for exit
      const exitPrice = data[i + offset + 5].close;
      if (exitPrice > entryPrice) wins++;
      else losses++;
    }
    // Death Cross (Sell Signal)
    else if (prevEma9 >= prevEma21 && currentEma9 < currentEma21) {
      const entryPrice = data[i + offset].close;
      const exitPrice = data[i + offset + 5].close;
      if (exitPrice < entryPrice) wins++; // Profit on short
      else losses++;
    }
  }

  const total = wins + losses;
  return {
    wins,
    losses,
    winRate: total > 0 ? (wins / total) * 100 : 0
  };
}

export function calculateFinalScore(technicalScore: number, newsScore: number, indicators: IndicatorData): number {
  // The Final Score for the UI can still show a blend (90/10) 
  // but the 'Action' will be strictly Trend-Following.
  const normalizedSent = (newsScore + 100) / 2;
  return (technicalScore * 0.9) + (normalizedSent * 0.1);
}

export function getRecommendation(finalScore: number, techScore: number, sentScore: number): string {
  // --- PURE TREND FOLLOWING ALGORITHM ---
  // We ignore 'sentScore' here to ensure the Action is strictly algorithmic trend-based.
  
  // 1. Strong Bullish Trend
  if (techScore > 82) return "STRONG BUY (TREND)";
  if (techScore > 62) return "BUY (TREND)";
  
  // 2. Strong Bearish Trend
  if (techScore < 18) return "STRONG SELL (TREND)";
  if (techScore < 38) return "SELL (TREND)";
  
  // 3. Sideways / No Clear Trend
  return "NEUTRAL / SIDEWAYS";
}
