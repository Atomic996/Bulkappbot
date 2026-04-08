export type Timeframe = '1M' | '5M' | '15M' | '30M' | '1H' | '4H' | '1D' | '1W';

export interface PriceData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorData {
  ema9?: number;
  ema21?: number;
  ema50?: number;
  ema200?: number;
  rsi?: number;
  macd?: {
    macd: number;
    signal: number;
    histogram: number;
  };
  stochastic?: {
    k: number;
    d: number;
  };
  bollinger?: {
    upper: number;
    middle: number;
    lower: number;
  };
  atr?: number;
  obv?: number;
  vwap?: number;
  slopes?: {
    ema9: number;
    ema21: number;
    ema50: number;
    ema200: number;
  };
}

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  published_at: string;
  source: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  is_political?: boolean;
  impact_score?: number;
}

export interface FusionV3Analysis {
  market_score: number;
  trade_score: number;
  trade_type: 'SHORT' | 'MEDIUM' | 'LONG';
  decision: 'ENTRY' | 'WAIT' | 'REJECT';
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
  entry_percentage: 25 | 50 | 100;
  technical_breakdown: {
    market_structure: number;
    rsi_score: number;
    ema_score: number;
    volume_score: number;
  };
  behavioral_breakdown: {
    whale_activity: number;
    order_flow: number;
    fear_greed: number;
  };
  news_breakdown: {
    macro: number;
    regulatory: number;
    specific: number;
  };
  trade_layer: {
    signal_strength: number;
    entry_quality: number;
    whale_alignment: number;
    risk_assessment: number;
  };
}

export interface AssetSignal {
  symbol: string;
  price: number;
  change24h: number;
  technical_score: number; // 0-100
  news_score: number; // -100 to 100
  final_score: number; // 0-100
  recommendation: string;
  indicators: IndicatorData;
  performance?: {
    wins: number;
    losses: number;
    win_rate: number;
  };
  fusion_v3?: FusionV3Analysis;
}
