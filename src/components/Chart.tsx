import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickData, UTCTimestamp } from 'lightweight-charts';
import { PriceData, Timeframe } from '../types';
import { Loader2, Info, Maximize2 } from 'lucide-react';

interface ChartProps {
  symbol: string;
  data: PriceData[];
  indicators: any;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
}

export const Chart: React.FC<ChartProps> = ({
  symbol,
  data,
  indicators,
  timeframe,
  onTimeframeChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Initialize chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#a1a1aa',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight || 400,
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
    });

    if (!chart) return;

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ 
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight || 400
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      candlestickSeriesRef.current = null;
    };
  }, [symbol]); // Re-init only when symbol changes

  useEffect(() => {
    if (!candlestickSeriesRef.current || data.length === 0) return;

    // Format data for lightweight-charts
    const formattedData: CandlestickData[] = data.map(d => ({
      time: (d.time / 1000) as UTCTimestamp,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    candlestickSeriesRef.current.setData(formattedData);
  }, [data]); // Update data without re-initializing the chart

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const timeframes: Timeframe[] = ['1M', '5M', '15M', '30M', '1H', '4H', '1D', '1W'];

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] bg-black/20 border border-white/5 rounded-xl gap-4">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <div className="text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Initializing Data Stream</p>
          <p className="text-[12px] font-mono text-zinc-400 mt-1">{symbol} / {timeframe}</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full flex flex-col gap-6 min-h-[500px] bg-black group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-1 h-4 bg-blue-500" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Live Market Feed</h3>
          <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[8px] font-mono rounded border border-blue-500/20">
            {symbol}/USD
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-zinc-900/50 p-1 rounded-lg border border-white/5">
            {timeframes.map((tf) => (
              <button
                key={tf}
                onClick={() => onTimeframeChange(tf)}
                className={`px-3 py-1 text-[9px] font-mono rounded transition-all ${
                  timeframe === tf
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
          <button 
            onClick={toggleFullscreen}
            className="p-2 bg-zinc-900/50 border border-white/5 rounded-lg text-zinc-500 hover:text-white transition-all"
            title="Full Screen"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      <div className="relative flex-1 bg-black/20 rounded-xl border border-white/5 overflow-hidden p-4">
        <div ref={chartContainerRef} className="w-full h-full" />
        
        {/* Indicators Overlay */}
        <div className="absolute top-6 left-6 flex flex-col gap-2 pointer-events-none">
          <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded border border-white/10">
            <span className="text-[9px] font-mono text-zinc-500 uppercase">RSI (14):</span>
            <span className={`text-[10px] font-mono font-bold ${
              indicators.rsi > 70 ? 'text-rose-400' : indicators.rsi < 30 ? 'text-emerald-400' : 'text-blue-400'
            }`}>
              {indicators.rsi?.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded border border-white/10">
            <span className="text-[9px] font-mono text-zinc-500 uppercase">MACD:</span>
            <span className={`text-[10px] font-mono font-bold ${
              indicators.macd?.histogram > 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {indicators.macd?.histogram?.toFixed(4)}
            </span>
          </div>
        </div>

        <div className="absolute bottom-6 right-6 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded border border-white/10">
          <Info className="w-3 h-3 text-zinc-500" />
          <span className="text-[9px] font-mono text-zinc-500 uppercase">Auto-Scale Active</span>
        </div>
      </div>
    </div>
  );
};
