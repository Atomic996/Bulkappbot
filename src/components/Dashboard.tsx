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
  Wallet,
  User,
  Terminal
} from 'lucide-react';
import { AssetSignal, PriceData, NewsItem, Timeframe } from '../types.js';
import { fetchHistoricalData, fetchNews } from '../lib/api.js';
import { computeIndicators, calculateTechnicalScore, backtestStrategy, calculateFinalScore, getRecommendation } from '../lib/indicators.js';
import { analyzeNews, calculateNewsScore } from '../lib/gemini.js';
import { analyzeSentimentAlgorithmic, calculateAlgorithmicNewsScore } from '../lib/sentiment.js';
import { TopNav } from './layout/TopNav.js';
import { Sidebar } from './layout/Sidebar.js';
import { StatsHeader } from './layout/StatsHeader.js';
import { AssetsView } from './views/AssetsView.js';
import { AnalysisView } from './views/AnalysisView.js';
import { NewsView } from './views/NewsView.js';
import { BotView } from './views/BotView.js';
import { TechnicalView } from './views/TechnicalView.js';
import { LogsView } from './views/LogsView.js';
import { UserView } from './views/UserView.js';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SYMBOLS = ['BTC', 'ETH', 'SOL'];


export const Dashboard: React.FC = () => {
  const [selectedSymbol, setSelectedSymbol] = useState('BTC');
  const [timeframe, setTimeframe] = useState<Timeframe>('1D');
  const [signals, setSignals] = useState<Record<string, AssetSignal>>({});
  const [historicalData, setHistoricalData] = useState<Record<string, PriceData[]>>({});
  const [news, setNews] = useState<Record<string, NewsItem[]>>({});
  const [newsError, setNewsError] = useState<Record<string, string | null>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'assets' | 'analysis' | 'news' | 'bot' | 'technical' | 'logs' | 'user'>('analysis');
  const [isAssetDrawerOpen, setIsAssetDrawerOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [trades, setTrades] = useState<any[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [botStatus, setBotStatus] = useState({
    enabled: false,
    status: 'Idle',
    balance: 0,
    positions: [],
    logs: [],
    address: null,
    hasSession: false,
    orderType: 'auto'
  });
  const [botMessage, setBotMessage] = useState('');
  const [showBotPanel, setShowBotPanel] = useState(false);

  const handleSendBotMessage = () => {
    if (!botMessage.trim()) return;
    setBotStatus(prev => ({
      ...prev,
      logs: [`[USER] ${botMessage}`, ...prev.logs].slice(0, 50)
    }));
    setBotMessage('');
  };

  const wsRef = useRef<WebSocket | null>(null);
  const priceUpdateBuffer = useRef<Record<string, number>>({});
  const lastSignalUpdate = useRef<Record<string, number>>({});

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    window.location.reload();
  };

  const [alerts, setAlerts] = useState<{ id: string; message: string; type: 'info' | 'success' | 'warning' | 'error' }[]>([]);

  const addAlert = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setAlerts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setAlerts(prev => prev.filter(a => a.id !== id));
    }, 5000);
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
      const indicators = computeIndicators(history);
      const lastPrice = history[history.length - 1]?.close || 0;
      const prevPrice = history[history.length - 2]?.close || 0;
      const change24h = ((lastPrice - prevPrice) / prevPrice) * 100;
      const technicalScore = calculateTechnicalScore(indicators, lastPrice);

      // 4. Update signals with technical data first (Fast path)
      const performance = backtestStrategy(history);
      const newsScore = calculateAlgorithmicNewsScore(analyzeSentimentAlgorithmic(rawNews));
      const finalScore = calculateFinalScore(technicalScore, newsScore);
      const recommendation = getRecommendation(finalScore, technicalScore);

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
            console.error("Gemini analysis failed:", err?.message || String(err));
          });
        }
      }

      if (Math.abs(change24h) > 5) {
        addAlert(`تقلبات قوية لـ ${symbol}: ${change24h.toFixed(2)}%`, 'warning');
      }

    } catch (error) {
      console.error(`Error updating data for ${symbol}:`, error instanceof Error ? error.message : String(error));
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

  // WebSocket for Server Data (Bot, Wallets, Trades)
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/bulk`;
    const ws = new WebSocket(wsUrl);
    
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'bot_update':
            setBotStatus(msg.data);
            break;
          case 'bot_log':
            setBotStatus(prev => ({
              ...prev,
              logs: [msg.data, ...prev.logs].slice(0, 50)
            }));
            break;
          case 'trade':
            setTrades(prev => [msg.data, ...prev].slice(0, 50));
            break;
          case 'wallets_update':
            setWallets(msg.data);
            break;
          case 'init_wallets':
            setWallets(msg.data);
            break;
        }
      } catch (e) {
        console.error("Error parsing server WS message:", e);
      }
    };

    return () => ws.close();
  }, []);

  // WebSocket with Throttled Updates (Coinbase for Price)
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
          // Recalculate signals for updated assets, but throttle it
          setSignals(prevSignals => {
            const nextSignals = { ...prevSignals };
            let signalsChanged = false;
            const now = Date.now();

            Object.entries(updates).forEach(([symbol, priceVal]) => {
              const price = priceVal as number;
              const lastUpdate = lastSignalUpdate.current[symbol] || 0;
              
              // Update signals only if it's the selected symbol OR it's been 5 seconds
              if (nextSignals[symbol] && next[symbol] && (symbol === selectedSymbol || now - lastUpdate > 5000)) {
                const history = next[symbol];
                const indicators = computeIndicators(history);
                const technicalScore = calculateTechnicalScore(indicators, price);
                const newsScore = nextSignals[symbol].news_score;
                const finalScore = calculateFinalScore(technicalScore, newsScore);
                const recommendation = getRecommendation(finalScore, technicalScore);

                nextSignals[symbol] = {
                  ...nextSignals[symbol],
                  price,
                  indicators,
                  technical_score: technicalScore,
                  final_score: finalScore,
                  recommendation
                };
                lastSignalUpdate.current[symbol] = now;
                signalsChanged = true;
              } else if (nextSignals[symbol]) {
                // Just update the price without recalculating indicators
                nextSignals[symbol] = {
                  ...nextSignals[symbol],
                  price
                };
                signalsChanged = true;
              }
            });
            return signalsChanged ? nextSignals : prevSignals;
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

  const handleToggleBot = async () => {
    try {
      const res = await fetch('/api/bot/toggle', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setBotStatus(prev => ({ ...prev, enabled: data.enabled, status: data.status }));
        addAlert(data.enabled ? "Bot started successfully" : "Bot stopped successfully", 'success');
      } else {
        addAlert(data.error || "Failed to toggle bot", 'error');
      }
    } catch (err) {
      addAlert("Network error toggling bot", 'error');
    }
  };

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden font-sans relative">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-purple-900/10 blur-[100px] rounded-full pointer-events-none" />
      
      {/* Alerts Overlay */}
      <div className="fixed top-20 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {alerts.map(alert => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.9 }}
              className={cn(
                "p-4 rounded-2xl border backdrop-blur-xl shadow-2xl flex items-center gap-3 min-w-[300px] pointer-events-auto",
                alert.type === 'success' && "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
                alert.type === 'warning' && "bg-amber-500/10 border-amber-500/20 text-amber-400",
                alert.type === 'error' && "bg-rose-500/10 border-rose-500/20 text-rose-400",
                alert.type === 'info' && "bg-blue-500/10 border-blue-500/20 text-blue-400"
              )}
            >
              {alert.type === 'error' ? <AlertCircle size={18} /> : <Info size={18} />}
              <span className="text-xs font-bold">{alert.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Sidebar Navigation */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={handleLogout} 
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <TopNav 
          selectedSymbol={selectedSymbol}
          setShowAssetDrawer={setIsAssetDrawerOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          currentTime={currentTime}
        />

        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'assets' && (
              <AssetsView 
                symbols={SYMBOLS}
                signals={signals}
                selectedSymbol={selectedSymbol}
                onSelectSymbol={(s) => {
                  setSelectedSymbol(s);
                  setActiveTab('analysis');
                }}
              />
            )}
            {activeTab === 'analysis' && (
              <AnalysisView 
                selectedSymbol={selectedSymbol}
                chartData={currentHistory}
                indicators={currentSignal?.indicators || {}}
                timeframe={timeframe}
                setTimeframe={setTimeframe}
                botEnabled={botStatus.enabled}
                botStatus={botStatus.status}
                botLogs={botStatus.logs}
                botMessage={botMessage}
                setBotMessage={setBotMessage}
                onSendBotMessage={handleSendBotMessage}
                showBotPanel={showBotPanel}
                setShowBotPanel={setShowBotPanel}
                trades={trades.filter(t => t.symbol.startsWith(selectedSymbol))}
              />
            )}
            {activeTab === 'news' && (
              <NewsView 
                selectedSymbol={selectedSymbol}
                news={currentNews}
                isLoading={isLoading}
                error={newsError[selectedSymbol]}
              />
            )}
            {activeTab === 'bot' && (
              <BotView 
                botEnabled={botStatus.enabled}
                botStatus={botStatus.status}
                botLogs={botStatus.logs}
                onToggleBot={handleToggleBot}
              />
            )}
            {activeTab === 'technical' && (
              <TechnicalView 
                selectedSymbol={selectedSymbol}
                technicalScore={currentSignal?.technical_score || 50}
                signal={currentSignal || {
                  symbol: selectedSymbol,
                  price: 0,
                  change24h: 0,
                  technical_score: 50,
                  news_score: 50,
                  final_score: 50,
                  recommendation: 'NEUTRAL',
                  indicators: {},
                  performance: { wins: 0, losses: 0, win_rate: 0 }
                }}
              />
            )}
            {activeTab === 'logs' && (
              <LogsView botLogs={botStatus.logs} />
            )}
            {activeTab === 'user' && (
              <UserView 
                onLogout={handleLogout}
              />
            )}
          </AnimatePresence>
        </main>

        {/* Mobile Menu Drawer */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileMenuOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 lg:hidden"
              />
              <motion.div 
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                className="fixed left-0 top-0 bottom-0 w-64 bg-gray-900 border-r border-purple-500/20 z-50 p-6 shadow-2xl lg:hidden flex flex-col"
              >
                <div className="flex items-center justify-between mb-10">
                  <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center border border-purple-500/30">
                    <div className="w-5 h-5 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
                  </div>
                  <button onClick={() => setIsMobileMenuOpen(false)} className="text-gray-500 hover:text-white">
                    <RefreshCw size={20} />
                  </button>
                </div>
                
                <nav className="flex-1 flex flex-col gap-4">
                  {[
                    { id: 'assets', label: 'Dashboard', icon: LayoutGrid },
                    { id: 'analysis', label: 'Trading', icon: BarChart3 },
                    { id: 'news', label: 'News', icon: Newspaper },
                    { id: 'bot', label: 'Bot', icon: Cpu },
                    { id: 'technical', label: 'Technical', icon: TrendingUp },
                    { id: 'user', label: 'Profile', icon: User },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id as any);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                        activeTab === item.id 
                          ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' 
                          : 'text-gray-400 hover:bg-gray-800'
                      }`}
                    >
                      <item.icon size={20} />
                      <span className="font-bold text-sm">{item.label}</span>
                    </button>
                  ))}
                </nav>
                
                <button 
                  onClick={handleLogout}
                  className="mt-auto flex items-center gap-4 p-4 text-gray-500 hover:text-rose-400 transition-colors"
                >
                  <RefreshCw size={20} className="rotate-180" />
                  <span className="font-bold text-sm">Logout</span>
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Asset Selection Drawer (Mobile/TopNav) */}
        <AnimatePresence>
          {isAssetDrawerOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsAssetDrawerOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              />
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                className="fixed right-0 top-0 bottom-0 w-80 bg-gray-900 border-l border-purple-500/20 z-50 p-6 shadow-2xl"
              >
                <h3 className="text-lg font-bold mb-6 text-white">Select Asset</h3>
                <div className="space-y-3">
                  {SYMBOLS.map(s => (
                    <button
                      key={s}
                      onClick={() => {
                        setSelectedSymbol(s);
                        setIsAssetDrawerOpen(false);
                      }}
                      className={`w-full p-4 rounded-2xl border transition-all flex items-center justify-between ${
                        selectedSymbol === s 
                          ? 'bg-purple-500/20 border-purple-500/50 text-purple-400' 
                          : 'bg-gray-800/50 border-white/5 text-gray-400 hover:bg-gray-800'
                      }`}
                    >
                      <span className="font-bold">{s} / USD</span>
                      {selectedSymbol === s && <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_10px_#a855f7]" />}
                    </button>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
