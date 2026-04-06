import React from 'react';
import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, Info, AlertCircle } from 'lucide-react';
import { AssetSignal } from '../types.js';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AssetCardProps {
  signal: AssetSignal;
  isSelected: boolean;
  onClick: () => void;
}

export const AssetCard: React.FC<AssetCardProps> = ({ signal, isSelected, onClick }) => {
  const isPositive = signal.change24h >= 0;

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "p-3 md:p-4 border cursor-pointer transition-all duration-200 relative overflow-hidden group rounded-sm",
        isSelected 
          ? "bg-white/[0.05] border-white/20 shadow-xl" 
          : "bg-transparent border-white/5 hover:border-white/10 hover:bg-white/[0.02]"
      )}
    >
      {isSelected && (
        <div className="absolute top-0 left-0 w-1 h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
      )}
      
      <div className="flex justify-between items-start mb-3 md:mb-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5 md:mb-1">
            <h3 className="text-[9px] md:text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">{signal.symbol}</h3>
            <span className="text-[8px] md:text-[9px] font-mono text-zinc-700">/ USD</span>
          </div>
          <p className="text-lg md:text-xl font-mono font-black text-zinc-100 tracking-tighter">
            ${(signal.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className={cn(
          "flex items-center gap-1 font-mono text-[9px] md:text-[10px] font-bold",
          isPositive ? "text-emerald-500" : "text-rose-500"
        )}>
          {isPositive ? '+' : ''}{(signal.change24h || 0).toFixed(2)}%
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4 mb-3 md:mb-4">
        <div className="space-y-1">
          <p className="text-[8px] md:text-[9px] uppercase tracking-widest text-zinc-600 font-serif italic">Technical</p>
          <div className="flex items-center gap-2">
            <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-white/60" style={{ width: `${signal.technical_score}%` }} />
            </div>
            <span className="text-[8px] md:text-[9px] font-mono text-zinc-400">{(signal.technical_score || 0).toFixed(0)}</span>
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-[8px] md:text-[9px] uppercase tracking-widest text-zinc-600 font-serif italic">Momentum (RSI)</p>
          <div className="flex items-center gap-2">
            <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
              <div className={cn(
                "h-full transition-all duration-500",
                (signal.indicators.rsi || 50) > 70 ? "bg-rose-500" : (signal.indicators.rsi || 50) < 30 ? "bg-emerald-500" : "bg-white/40"
              )} style={{ width: `${signal.indicators.rsi || 50}%` }} />
            </div>
            <span className="text-[8px] md:text-[9px] font-mono text-zinc-400">{(signal.indicators.rsi || 0).toFixed(1)}</span>
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-[8px] md:text-[9px] uppercase tracking-widest text-zinc-600 font-serif italic">Volatility (ATR)</p>
          <div className="flex items-center justify-between bg-white/[0.02] border border-white/5 rounded-sm px-2 py-1 h-[18px]">
            <span className="text-[8px] md:text-[9px] font-mono text-zinc-500 uppercase">Range</span>
            <span className="text-[9px] font-mono font-bold text-zinc-300">
              {signal.indicators.atr ? `$${signal.indicators.atr.toFixed(2)}` : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center pt-2 md:pt-3 border-t border-white/5">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-1 md:w-1.5 h-1 md:h-1.5 rounded-full",
            signal.recommendation?.includes('BUY') ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : 
            signal.recommendation?.includes('SELL') ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" : "bg-zinc-600",
            signal.recommendation?.startsWith('STRONG') && "animate-pulse"
          )} />
          <span className={cn(
            "text-[8px] md:text-[9px] font-black tracking-widest uppercase",
            signal.recommendation?.includes('BUY') ? "text-emerald-500" : 
            signal.recommendation?.includes('SELL') ? "text-rose-500" : "text-zinc-500"
          )}>
            {signal.recommendation}
          </span>
        </div>
        <span className="text-[7px] md:text-[8px] font-mono text-zinc-600 uppercase tracking-tighter">Confidence: {(signal.final_score || 0).toFixed(0)}%</span>
      </div>
    </motion.div>
  );
};
