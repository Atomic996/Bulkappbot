import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, 
  RefreshCw, 
  AlertCircle, 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  Settings, 
  Bell,
  Search,
  ChevronRight,
  ShieldCheck,
  Cpu,
  Info,
  LayoutGrid,
  List,
  MessageSquare,
  Newspaper,
  BarChart3,
  Clock,
  Wallet
} from 'lucide-react';
import { AssetSignal, PriceData, NewsItem, Timeframe } from '../types';
import { fetchHistoricalData, fetchNews } from '../lib/api';
import { calculateIndicators, calculateTechnicalScore, backtestStrategy, calculateFinalScore, getRecommendation } from '../lib/indicators';
import { analyzeNews, calculateNewsScore } from '../lib/gemini';
import { analyzeSentimentAlgorithmic, calculateAlgorithmicNewsScore } from '../lib/sentiment';
import { AssetCard } from './AssetCard';
import { NewsFeed } from './NewsFeed';
import { Chart } from './Chart';
import { ChatAdvisor } from './ChatAdvisor';
import { BulkAnalysis } from './BulkAnalysis';
import { TradingBot } from './TradingBot';
import { WalletView } from './WalletView';
import TradingViewWidget from './TradingViewWidget';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SYMBOLS = ['BTC', 'ETH', 'SOL'];

// Memoized components for performance
const MemoizedAssetCard = React.memo(AssetCard);
const MemoizedNewsFeed = React.memo(NewsFeed);
const MemoizedChart = React.memo(Chart);

export const Dashboard: React.FC = () => {
  const [selectedSymbol, setSelectedSymbol] = useState('BTC');
  const [timeframe, setTimeframe] = useState<Timeframe>('1D');
  const [signals, setSignals] = useState<Record<string, AssetSignal>>({});
  const [historicalData, setHistoricalData] = useState<Record<string, PriceData[]>>({});
  const [news, setNews] = useState<Record<string, NewsItem[]>>({});
  const [newsError, setNewsError] = useState<Record<string, string | null>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'assets' | 'analysis' | 'technical' | 'bulk' | 'news' | 'bot' | 'wallet'>('analysis');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [alerts, setAlerts] = useState<{ id: string; message: string; type: 'info' | 'warning' | 'success' }[]>([]);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<Record<string, number>>({});

  const wsRef = useRef<WebSocket | null>(null);
  const priceUpdateBuffer = useRef<Record<string, number>>({});

  const addAlert = useCallback((message: string, type: 'info' | 'warning' | 'success' = 'info') => {
    const id = Math.random().toString(36).substring(7);
    setAlerts(prev => [{ id, message, type }, ...prev].slice(0, 3));
    setTimeout(() => {
      setAlerts(prev => prev.filter(a => a.id !== id));
    }, 4000);
  }, []);

  const updateAssetData = useCallback(async (symbol: string, currentTf: Timeframe) => {
    try {
      // 1. Fetch history and news in parallel
      setNewsError(prev => ({ ...prev, [symbol]: null }));
      const [history, rawNews] = await Promise.all([
        fetchHistoricalData(symbol, currentTf, 500),
        fetchNews(symbol).catch(err => {
          setNewsError(prev => ({ ...prev, [symbol]: "فشل جلب الأخبار من المصدر" }));
          return [];
        })
      ]);

      // 2. Immediately update historical data for the chart
      setHistoricalData(prev => ({ ...prev, [symbol]: history }));

      // 3. Calculate technical indicators immediately
      const indicators = calculateIndicators(history);
      const lastPrice = history[history.length - 1]?.close || 0;
      const prevPrice = history[history.length - 2]?.close || 0;
      const change24h = ((lastPrice - prevPrice) / prevPrice) * 100;
      const technicalScore = calculateTechnicalScore(indicators, lastPrice);

      // 4. Update signals with technical data first (Fast path)
      const performance = backtestStrategy(history);
      const newsScore = calculateAlgorithmicNewsScore(analyzeSentimentAlgorithmic(rawNews));
      const finalScore = calculateFinalScore(technicalScore, newsScore, indicators);
      const recommendation = getRecommendation(finalScore, technicalScore, newsScore);

      setSignals(prev => ({
        ...prev,
        [symbol]: {
          ...(prev[symbol] || {}),
          symbol,
          price: lastPrice,
          change24h,
          technical_score: technicalScore,
          news_score: newsScore,
          final_score: finalScore,
          recommendation,
          indicators,
          performance: {
            wins: performance.wins,
            losses: performance.losses,
            win_rate: performance.winRate
          }
        }
      }));

      // 5. Background News Analysis (Still use AI for the feed, but not for the score)
      if (rawNews.length > 0) {
        const algorithmicAnalyzed = analyzeSentimentAlgorithmic(rawNews);
        setNews(prev => ({ ...prev, [symbol]: algorithmicAnalyzed }));
        
        if (symbol === selectedSymbol) {
          // AI analysis for the news feed descriptions/tags only
          analyzeNews(rawNews).then(analyzedNews => {
            setNews(prev => ({ ...prev, [symbol]: analyzedNews }));
          }).catch(err => {
            console.error("Gemini analysis failed:", err?.message || err);
          });
        }
      }

      if (Math.abs(change24h) > 5) {
        addAlert(`تقلبات قوية لـ ${symbol}: ${change24h.toFixed(2)}%`, 'warning');
      }

    } catch (error) {
      console.error(`Error updating data for ${symbol}:`, error instanceof Error ? error.message : error);
    }
  }, [addAlert]);

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    
    try {
      // 1. Prioritize selected symbol for immediate display
      await updateAssetData(selectedSymbol, timeframe);
      setIsLoading(false); // Clear loading as soon as the main asset is ready
      
      // 2. Load the rest in background
      const otherSymbols = SYMBOLS.filter(s => s !== selectedSymbol);
      await Promise.all(otherSymbols.map(s => updateAssetData(s, timeframe).catch(err => {
        console.error(`Background update failed for ${s}:`, err instanceof Error ? err.message : String(err));
      })));
    } catch (error) {
      console.error("Error in refreshAll:", error instanceof Error ? error.message : String(error));
    } finally {
      setIsRefreshing(false);
    }
  }, [updateAssetData, selectedSymbol, timeframe]);

  useEffect(() => {
    refreshAll().catch(err => console.error("Initial refresh failed:", err instanceof Error ? err.message : String(err)));
    const interval = setInterval(() => {
      refreshAll().catch(err => console.error("Interval refresh failed:", err instanceof Error ? err.message : String(err)));
    }, 120000); // 2 mins refresh
    return () => clearInterval(interval);
  }, [refreshAll]);

  // WebSocket with Throttled Updates
  useEffect(() => {
    const ws = new WebSocket('wss://ws-feed.exchange.coinbase.com');
    wsRef.current = ws;

    const processBuffer = () => {
      const updates = { ...priceUpdateBuffer.current };
      if (Object.keys(updates).length === 0) return;
      
      setHistoricalData(prev => {
        const next = { ...prev };
        let historyChanged = false;
        
        Object.entries(updates).forEach(([symbol, price]) => {
          if (next[symbol] && next[symbol].length > 0) {
            const history = next[symbol];
            const lastIndex = history.length - 1;
            const lastCandle = history[lastIndex];
            
            if (lastCandle.close !== price) {
              const updatedCandle = {
                ...lastCandle,
                close: price,
                high: Math.max(lastCandle.high as number, price as number),
                low: Math.min(lastCandle.low as number, price as number)
              };
              const newHistory = [...history];
              newHistory[lastIndex] = updatedCandle;
              next[symbol] = newHistory;
              historyChanged = true;
            }
          }
        });
        
        if (historyChanged) {
          // Recalculate signals for updated assets
          setSignals(prevSignals => {
            const nextSignals = { ...prevSignals };
            Object.entries(updates).forEach(([symbol, priceVal]) => {
              const price = priceVal as number;
              if (nextSignals[symbol] && next[symbol]) {
                const history = next[symbol];
                const indicators = calculateIndicators(history);
                const technicalScore = calculateTechnicalScore(indicators, price);
                const newsScore = nextSignals[symbol].news_score;
                const finalScore = calculateFinalScore(technicalScore, newsScore, indicators);
                const recommendation = getRecommendation(finalScore, technicalScore, newsScore);

                nextSignals[symbol] = {
                  ...nextSignals[symbol],
                  price,
                  indicators,
                  technical_score: technicalScore,
                  final_score: finalScore,
                  recommendation
                };
              }
            });
            return nextSignals;
          });
        }
        
        return historyChanged ? next : prev;
      });

      priceUpdateBuffer.current = {};
    };

    const bufferInterval = setInterval(processBuffer, 1000); // Batch updates every second

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'subscribe',
        product_ids: SYMBOLS.map(s => `${s}-USD`),
        channels: ['ticker']
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'ticker' && data.product_id && data.price) {
          const symbol = data.product_id.split('-')[0];
          const price = parseFloat(data.price);
          if (!isNaN(price)) {
            priceUpdateBuffer.current[symbol] = price;
          }
        }
      } catch (e) {
        console.error("Error parsing WebSocket message:", e instanceof Error ? e.message : String(e));
      }
    };

    return () => {
      ws.close();
      clearInterval(bufferInterval);
    };
  }, []);

  const currentSignal = useMemo(() => signals[selectedSymbol], [signals, selectedSymbol]);
  const currentHistory = useMemo(() => historicalData[selectedSymbol] || [], [historicalData, selectedSymbol]);
  const currentNews = useMemo(() => news[selectedSymbol] || [], [news, selectedSymbol]);

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 font-sans selection:bg-blue-500/30 flex flex-col overflow-hidden">
      {/* Structural Grid Background */}
      <div className="fixed inset-0 pointer-events-none opacity-20 z-0" 
           style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '32px 32px' }} />

      {/* Top Navigation - Command Center Style */}
      <nav className="h-14 border-b border-white/10 bg-black/60 backdrop-blur-md flex items-center justify-between px-4 md:px-6 z-50 shrink-0">
        <div className="flex items-center gap-4 md:gap-8">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-7 h-7 md:w-8 md:h-8 bg-zinc-100 rounded-sm flex items-center justify-center">
              <Zap className="text-black" size={16} strokeWidth={2.5} />
            </div>
            <div className="flex flex-col -space-y-1">
              <span className="text-[10px] md:text-xs font-black tracking-tighter uppercase italic text-white">Sentinel.AI</span>
              <span className="text-[8px] md:text-[9px] font-mono text-zinc-500 uppercase tracking-widest">v2.4.0</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 md:gap-6">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
            <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">{selectedSymbol}</span>
          </div>

          <div className="hidden lg:flex items-center gap-4 px-4 py-1.5 border-x border-white/10">
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-serif italic text-zinc-500">Market Status</span>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <span className="text-[10px] font-mono text-emerald-500 uppercase font-bold">Operational</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="w-8 h-8 md:w-9 md:h-9 rounded-sm bg-white flex flex-col items-center justify-center gap-[3px] hover:bg-zinc-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.15)] group"
            >
              <div className="w-4 h-[1.5px] bg-black group-hover:w-5 transition-all" />
              <div className="w-4 h-[1.5px] bg-black" />
              <div className="w-4 h-[1.5px] bg-black group-hover:w-5 transition-all" />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Grid - Full Width */}
      <main className="flex-1 flex flex-col overflow-hidden z-10 relative">
        {/* Center: Main Analysis View */}
        <section className="flex flex-col flex-1 overflow-hidden bg-black/40">
          {/* Performance Optimized Stats Header */}
          <div className="grid grid-cols-2 md:grid-cols-5 border-b border-white/10 bg-white/[0.02]">
            <StatBox label="Current Price" value={`$${currentSignal?.price.toLocaleString() || '0'}`} subValue={`${currentSignal?.change24h.toFixed(2)}%`} color={currentSignal?.change24h && currentSignal.change24h >= 0 ? 'emerald' : 'rose'} />
            <StatBox label="Technical Analysis" value={`${currentSignal?.technical_score.toFixed(0)}%`} subValue="Pure Math" color="white" />
            <StatBox label="Market Sentiment" value={currentSignal?.news_score !== undefined ? `${((currentSignal.news_score + 100) / 2).toFixed(0)}%` : '0%'} subValue="Algorithmic" color="blue" />
            <StatBox label="Volatility (VIX)" value={currentSignal?.indicators.atr ? (currentSignal.indicators.atr / currentSignal.price * 100).toFixed(2) + '%' : '-'} subValue="Risk Index" color="zinc" />
            <StatBox label="Action" value={currentSignal?.recommendation || 'HOLD'} subValue="Strategy" color={currentSignal?.recommendation?.includes('BUY') ? 'emerald' : currentSignal?.recommendation?.includes('SELL') ? 'rose' : 'zinc'} />
          </div>

          {/* Viewport Tabs */}
          <div className="flex items-center justify-between px-4 md:px-6 bg-zinc-900/40 border-b border-white/10">
            <div className="flex overflow-x-auto custom-scrollbar no-scrollbar">
              {(['analysis', 'technical', 'bulk', 'news', 'bot'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "relative px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all shrink-0 border-r border-white/5",
                    activeTab === tab 
                      ? "text-white bg-white/[0.03]" 
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.01]"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {tab === 'analysis' && <Activity size={12} className={activeTab === tab ? "text-white" : ""} />}
                    {tab === 'technical' && <BarChart3 size={12} className={activeTab === tab ? "text-white" : ""} />}
                    {tab === 'bulk' && <RefreshCw size={12} className={activeTab === tab ? "text-white" : ""} />}
                    {tab === 'news' && <Newspaper size={12} className={activeTab === tab ? "text-white" : ""} />}
                    {tab === 'bot' && <Cpu size={12} className={activeTab === tab ? "text-white" : ""} />}
                    <span>{tab === 'bulk' ? 'Bulk Flow' : tab === 'bot' ? 'Auto-Bot' : tab}</span>
                  </div>
                  {activeTab === tab && (
                    <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
                  )}
                </button>
              ))}
            </div>
            <div className="hidden sm:flex items-center gap-4 px-6">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-mono text-zinc-500 uppercase">Live Feed</span>
              </div>
              <div className="h-4 w-px bg-white/10" />
              <div className="flex items-center gap-2">
                <Clock size={12} className="text-zinc-600" />
                <span className="text-[10px] font-mono text-zinc-500 uppercase">{new Date().toLocaleTimeString()}</span>
              </div>
            </div>
          </div>

          {/* Main Viewport Content */}
          <div className="flex-1 overflow-y-auto lg:overflow-hidden relative flex flex-col">
            <AnimatePresence mode="popLayout">
              {activeTab === 'assets' && (
                <motion.div
                  key="assets-view"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8"
                >
                  <div className="max-w-4xl mx-auto space-y-8">
                    <div className="flex items-center justify-between border-b border-white/10 pb-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-serif italic text-zinc-500 uppercase tracking-widest">Market Overview</span>
                        <h2 className="text-xl font-black text-white uppercase tracking-tighter">Asset Index</h2>
                      </div>
                      <div className="flex items-center gap-4 text-zinc-500">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-[10px] font-mono uppercase">Live Feed</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {SYMBOLS.map(symbol => (
                        <MemoizedAssetCard 
                          key={symbol}
                          signal={signals[symbol] || {
                            symbol,
                            price: 0,
                            change24h: 0,
                            technical_score: 0,
                            news_score: 0,
                            final_score: 0,
                            recommendation: 'HOLD',
                            indicators: {},
                            performance: { wins: 0, losses: 0, win_rate: 0 }
                          }}
                          isSelected={selectedSymbol === symbol}
                          onClick={() => {
                            setSelectedSymbol(symbol);
                            setActiveTab('analysis');
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
              {activeTab === 'analysis' && (
                <motion.div 
                  key={`analysis-${selectedSymbol}-${timeframe}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col min-h-[500px] p-4 md:p-6"
                >
                  <MemoizedChart 
                    data={currentHistory} 
                    indicators={currentSignal?.indicators || {}} 
                    symbol={selectedSymbol}
                    timeframe={timeframe}
                    onTimeframeChange={setTimeframe}
                  />
                </motion.div>
              )}
              {activeTab === 'bulk' && (
                <motion.div 
                  key="bulk-analysis"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col h-full"
                >
                  <BulkAnalysis />
                </motion.div>
              )}
              {activeTab === 'news' && (
                <motion.div 
                  key={`news-${selectedSymbol}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full overflow-y-auto custom-scrollbar p-4 md:p-6"
                >
                  <MemoizedNewsFeed 
                    news={currentNews} 
                    isLoading={isLoading} 
                    error={newsError[selectedSymbol]} 
                  />
                </motion.div>
              )}
              {activeTab === 'bot' && (
                <motion.div 
                  key="bot-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col h-full"
                >
                  <TradingBot />
                </motion.div>
              )}
              {activeTab === 'wallet' && (
                <motion.div 
                  key="wallet-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col h-full"
                >
                  <WalletView onBack={() => setActiveTab('assets')} />
                </motion.div>
              )}
              {activeTab === 'technical' && (
                <motion.div 
                  key={`technical-${selectedSymbol}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full overflow-y-auto custom-scrollbar"
                >
                  <div className="grid lg:grid-cols-[320px_1fr] h-full">
                    <div className="border-r border-white/10 bg-black/20 flex flex-col">
                      <div className="p-6 border-b border-white/10">
                        <div className="p-6 bg-white/[0.02] border border-white/5 rounded-sm flex flex-col items-center gap-3">
                          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Technical Score</span>
                          <div className="relative w-32 h-32 flex items-center justify-center">
                            <svg className="w-full h-full -rotate-90">
                              <circle cx="64" cy="64" r="56" fill="none" stroke="currentColor" strokeWidth="6" className="text-white/5" />
                              <circle
                                cx="64"
                                cy="64"
                                r="56"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="6"
                                strokeDasharray={351.8}
                                strokeDashoffset={351.8 - (351.8 * (currentSignal?.technical_score || 0)) / 100}
                                className={cn(
                                  "transition-all duration-1000 ease-out",
                                  (currentSignal?.technical_score || 0) > 70 ? "text-emerald-500" :
                                  (currentSignal?.technical_score || 0) < 30 ? "text-rose-500" : "text-blue-500"
                                )}
                              />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className="text-3xl font-mono font-black tracking-tighter">
                                {currentSignal?.technical_score.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-6 space-y-6">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-white">Strategy Engine</h3>
                          </div>
                        </div>
                        <div className="relative p-5 bg-zinc-900/60 border border-white/5 rounded-sm overflow-hidden">
                          <p className="text-[11px] text-zinc-400 leading-relaxed font-serif italic relative z-10">
                            {currentSignal?.recommendation?.includes('BUY') ? 
                              "بناءً على زخم MACD الحالي وقوة RSI، نلاحظ تشكل نموذج استمراري صعودي. ننصح بمراقبة مستوى الدعم القادم لتعزيز المراكز." :
                              currentSignal?.recommendation?.includes('SELL') ?
                              "تظهر المؤشرات ضعفاً في الزخم مع انحراف سلبي في RSI. يفضل تقليل التعرض للمخاطر وانتظار تأكيد الكسر للأسفل." :
                              "السوق حالياً في مرحلة تجميع عرضية. مؤشر Bollinger Bands يضيق مما يشير إلى انفجار سعري قريب. يفضل الانتظار خارج السوق."
                            }
                          </p>
                          <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
                            <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-widest">Confidence: {currentSignal?.final_score.toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-8 grid md:grid-cols-2 gap-8 content-start">
                      <div className="space-y-6">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 border-b border-white/10 pb-2">Momentum Matrix</h3>
                        <IndicatorMetric label="Relative Strength (14)" value={currentSignal?.indicators.rsi?.toFixed(2) || '-'} status={(currentSignal?.indicators.rsi || 50) > 70 ? 'Overbought' : (currentSignal?.indicators.rsi || 50) < 30 ? 'Oversold' : 'Neutral'} />
                        <IndicatorMetric label="MACD Histogram" value={currentSignal?.indicators.macd?.histogram.toFixed(4) || '-'} status={(currentSignal?.indicators.macd?.histogram || 0) > 0 ? 'Bullish' : 'Bearish'} />
                        <IndicatorMetric label="Stochastic (14,3)" value={currentSignal?.indicators.stochastic?.k.toFixed(2) || '-'} status={(currentSignal?.indicators.stochastic?.k || 50) > 80 ? 'Overbought' : (currentSignal?.indicators.stochastic?.k || 50) < 20 ? 'Oversold' : 'Neutral'} />
                      </div>
                      
                      <div className="space-y-6">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 border-b border-white/10 pb-2">Volatility & Volume</h3>
                        <IndicatorMetric label="Bollinger Bands" value={currentSignal?.indicators.bollinger ? `${((currentSignal.indicators.bollinger.upper - currentSignal.indicators.bollinger.lower) / currentSignal.indicators.bollinger.middle * 100).toFixed(2)}%` : '-'} status={currentSignal?.indicators.bollinger && currentSignal.price > currentSignal.indicators.bollinger.upper ? 'Above Upper' : currentSignal?.indicators.bollinger && currentSignal.price < currentSignal.indicators.bollinger.lower ? 'Below Lower' : 'Inside'} />
                        <div className="grid grid-cols-2 gap-6 pt-2">
                          <IndicatorRow label="Volatility (ATR)" value={currentSignal?.indicators.atr?.toFixed(2) || '-'} trend="neutral" />
                          <IndicatorRow label="Volume (OBV)" value={currentSignal?.indicators.obv ? (currentSignal.indicators.obv / 1000000).toFixed(2) + 'M' : '-'} trend={(currentSignal?.indicators.obv || 0) > 0 ? 'up' : 'down'} />
                        </div>
                        <div className="pt-4 space-y-3">
                          <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-widest">Key Levels (Pivot)</span>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-sm">
                              <p className="text-[8px] text-emerald-500/70 uppercase font-bold mb-1">Support</p>
                              <p className="text-sm font-mono font-bold text-emerald-500">${(currentSignal?.price ? currentSignal.price * 0.985 : 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                            </div>
                            <div className="p-3 bg-rose-500/5 border border-rose-500/10 rounded-sm">
                              <p className="text-[8px] text-rose-500/70 uppercase font-bold mb-1">Resistance</p>
                              <p className="text-sm font-mono font-bold text-rose-500">${(currentSignal?.price ? currentSignal.price * 1.015 : 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </main>

      {/* Bottom Navigation (Visible on all screens as requested) */}
      <div className="h-16 border-t border-white/10 bg-black/80 backdrop-blur-xl flex items-center justify-around px-4 shrink-0 z-50">
        <button 
          onClick={() => setActiveTab('assets')}
          className={cn(
            "flex flex-col items-center gap-1 transition-all",
            activeTab === 'assets' ? "text-white" : "text-zinc-600"
          )}
        >
          <LayoutGrid size={20} />
          <span className="text-[8px] font-black uppercase tracking-widest">Assets</span>
        </button>
        <button 
          onClick={() => setActiveTab('analysis')}
          className={cn(
            "flex flex-col items-center gap-1 transition-all",
            activeTab === 'analysis' || activeTab === 'technical' || activeTab === 'bulk' || activeTab === 'news' ? "text-white" : "text-zinc-600"
          )}
        >
          <BarChart3 size={20} />
          <span className="text-[8px] font-black uppercase tracking-widest">Analysis</span>
        </button>
        <button 
          onClick={() => setActiveTab('bot')}
          className={cn(
            "flex flex-col items-center gap-1 transition-all",
            activeTab === 'bot' ? "text-white" : "text-zinc-600"
          )}
        >
          <Cpu size={20} />
          <span className="text-[8px] font-black uppercase tracking-widest">Bot</span>
        </button>
        <button 
          onClick={() => setActiveTab('wallet')}
          className={cn(
            "flex flex-col items-center gap-1 transition-all",
            activeTab === 'wallet' ? "text-white" : "text-zinc-600"
          )}
        >
          <Wallet size={20} />
          <span className="text-[8px] font-black uppercase tracking-widest">Wallet</span>
        </button>
      </div>

      {/* Right Sidebar Drawer */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-[280px] sm:w-[320px] bg-zinc-950 border-l border-white/10 z-[70] flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                <div className="flex flex-col">
                  <span className="text-[10px] font-serif italic text-zinc-500 uppercase tracking-widest">Navigation</span>
                  <h2 className="text-sm font-black text-white uppercase tracking-tighter">Market Hub</h2>
                </div>
                <button 
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors"
                >
                  <AlertCircle size={18} className="text-zinc-500 rotate-45" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                {/* Compact Market Selection */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-2">
                    <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em]">Market Selection</span>
                    <div className="h-px flex-1 mx-4 bg-white/5" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {SYMBOLS.map(symbol => (
                      <button
                        key={symbol}
                        onClick={() => {
                          setSelectedSymbol(symbol);
                          setIsSidebarOpen(false);
                          setActiveTab('analysis');
                        }}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-sm border transition-all",
                          selectedSymbol === symbol 
                            ? "bg-white border-white text-black shadow-lg shadow-white/10" 
                            : "bg-white/[0.02] border-white/5 text-zinc-400 hover:border-white/20 hover:bg-white/[0.04]"
                        )}
                      >
                        <div className={cn(
                          "w-5 h-5 rounded-full flex items-center justify-center font-black text-[8px]",
                          selectedSymbol === symbol ? "bg-black text-white" : "bg-white/5 text-zinc-500"
                        )}>
                          {symbol.slice(0, 1)}
                        </div>
                        <span className="text-[10px] font-black tracking-tight">{symbol}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* AI Chatbot Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-2">
                    <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em]">AI Assistant</span>
                    <div className="h-px flex-1 mx-4 bg-white/5" />
                  </div>
                  <button 
                    onClick={() => {
                      // Trigger chat advisor
                      setIsSidebarOpen(false);
                      const chatBtn = document.querySelector('[data-chat-trigger]');
                      if (chatBtn instanceof HTMLElement) chatBtn.click();
                    }}
                    className="w-full p-4 rounded-sm bg-white/5 border border-white/10 flex flex-col gap-2 hover:bg-white/10 transition-all group text-left"
                  >
                    <div className="flex items-center gap-2 text-white">
                      <MessageSquare size={16} />
                      <span className="text-xs font-black uppercase tracking-tight">Sentinel Advisor</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-relaxed">
                      احصل على تحليلات فورية وتوصيات ذكية من خلال المحادثة المباشرة مع البوت.
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-[9px] font-black text-white uppercase tracking-widest group-hover:gap-3 transition-all">
                      Open Chat <ChevronRight size={10} />
                    </div>
                  </button>
                </div>
              </div>

              <div className="p-6 bg-white/[0.02] border-t border-white/10">
                <div className="flex items-center gap-3 text-zinc-500">
                  <ShieldCheck size={14} />
                  <span className="text-[9px] font-mono uppercase tracking-widest">Secure Environment</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Alerts Overlay - Minimalist */}
      <div className="fixed bottom-6 left-6 z-[100] space-y-2 pointer-events-none">
        <AnimatePresence>
          {alerts.map(alert => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className={cn(
                "pointer-events-auto px-4 py-3 rounded-sm border shadow-2xl flex items-center gap-3 min-w-[240px] backdrop-blur-xl",
                alert.type === 'warning' ? "bg-rose-950/80 border-rose-500/30 text-rose-200" : 
                alert.type === 'success' ? "bg-emerald-950/80 border-emerald-500/30 text-emerald-200" :
                "bg-zinc-900/80 border-white/10 text-zinc-200"
              )}
            >
              <AlertCircle size={14} />
              <p className="text-[10px] font-bold uppercase tracking-widest">{alert.message}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {currentSignal && (
        <ChatAdvisor 
          signal={currentSignal} 
          news={currentNews} 
        />
      )}
    </div>
  );
};

const StatBox: React.FC<{ label: string; value: string; subValue: string; color: 'emerald' | 'rose' | 'blue' | 'purple' | 'zinc' | 'white' }> = ({ label, value, subValue, color }) => (
  <div className="p-3 md:p-5 flex flex-col gap-1 border-r border-white/10 last:border-r-0">
    <span className="text-[8px] md:text-[9px] font-serif italic text-zinc-500 uppercase tracking-widest">{label}</span>
    <p className={cn(
      "text-sm md:text-xl font-mono font-black tracking-tighter",
      color === 'emerald' ? "text-emerald-500" : 
      color === 'rose' ? "text-rose-500" : 
      color === 'blue' ? "text-blue-500" : 
      color === 'purple' ? "text-purple-500" : 
      color === 'white' ? "text-white" : "text-zinc-100"
    )}>{value}</p>
    <div className="flex items-center gap-1 md:gap-2">
      <div className={cn("w-1 h-1 rounded-full", 
        color === 'emerald' ? "bg-emerald-500" : 
        color === 'rose' ? "bg-rose-500" : 
        color === 'white' ? "bg-white shadow-[0_0_5px_rgba(255,255,255,0.5)]" : "bg-zinc-600"
      )} />
      <span className="text-[8px] md:text-[9px] font-mono text-zinc-500 uppercase tracking-widest">{subValue}</span>
    </div>
  </div>
);

const IndicatorMetric: React.FC<{ label: string; value: string; status: string }> = ({ label, value, status }) => (
  <div className="group flex flex-col gap-2 p-3 rounded-sm hover:bg-white/[0.02] transition-colors border border-transparent hover:border-white/5">
    <div className="flex justify-between items-end">
      <div className="flex flex-col">
        <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-widest mb-0.5">Indicator</span>
        <span className="text-[10px] font-serif italic text-zinc-400 uppercase tracking-widest">{label}</span>
      </div>
      <span className="text-xs font-mono font-black text-zinc-100">{value}</span>
    </div>
    <div className="flex items-center gap-3">
      <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden relative">
        <div className={cn(
          "h-full transition-all duration-1000 ease-out",
          status.includes('Bullish') || status.includes('Oversold') || status.includes('Below Lower') ? "bg-emerald-500 w-[75%]" : 
          status.includes('Bearish') || status.includes('Overbought') || status.includes('Above Upper') ? "bg-rose-500 w-[35%]" : "bg-white w-[55%]"
        )} />
        {/* Animated pulse for active indicators */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
      </div>
      <div className={cn(
        "px-2 py-0.5 rounded-[2px] text-[8px] font-black uppercase tracking-widest min-w-[75px] text-center border",
        status.includes('Bullish') || status.includes('Oversold') || status.includes('Below Lower') ? "text-emerald-500 border-emerald-500/20 bg-emerald-500/5" : 
        status.includes('Bearish') || status.includes('Overbought') || status.includes('Above Upper') ? "text-rose-500 border-rose-500/20 bg-rose-500/5" : "text-white border-white/20 bg-white/5"
      )}>{status}</div>
    </div>
  </div>
);

const IndicatorRow: React.FC<{ label: string; value: string; trend: 'up' | 'down' | 'neutral' }> = ({ label, value, trend }) => (
  <div className="space-y-1">
    <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">{label}</p>
    <div className="flex items-center gap-2">
      <span className="text-sm font-mono font-bold text-zinc-200">{value}</span>
      {trend === 'up' && <TrendingUp size={12} className="text-emerald-500" />}
      {trend === 'down' && <TrendingDown size={12} className="text-rose-500" />}
    </div>
  </div>
);
