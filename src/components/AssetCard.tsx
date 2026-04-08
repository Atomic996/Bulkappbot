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
        "p-4 border cursor-pointer transition-all duration-300 relative overflow-hidden group rounded-xl glass-card",
        isSelected 
          ? "border-primary/50 bg-primary/10 glow-purple" 
          : "border-white/5 hover:border-primary/20 hover:bg-white/[0.05]"
      )}
    >
      {isSelected && (
        <div className="absolute top-0 left-0 w-1 h-full bg-primary shadow-[0_0_15px_rgba(168,85,247,0.8)]" />
      )}
      
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black",
              isSelected ? "bg-primary text-white" : "bg-white/10 text-zinc-400"
            )}>
              {signal.symbol.slice(0, 1)}
            </div>
            <h3 className="text-xs font-black text-zinc-100 uppercase tracking-widest">{signal.symbol}</h3>
          </div>
          <p className="text-xl font-mono font-black text-white tracking-tighter">
            ${(signal.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className={cn(
          "px-2 py-1 rounded-md font-mono text-[10px] font-bold border",
          isPositive 
            ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/10" 
            : "text-rose-400 border-rose-500/20 bg-rose-500/10"
        )}>
          {isPositive ? '▲' : '▼'} {Math.abs(signal.change24h || 0).toFixed(2)}%
        </div>
      </div>

      <div className="space-y-4 mb-4">
        <div className="space-y-1.5">
          <div className="flex justify-between text-[9px] uppercase tracking-widest text-zinc-500 font-bold">
            <span>Technical Score</span>
            <span className="text-zinc-300">{(signal.technical_score || 0).toFixed(0)}%</span>
          </div>
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${signal.technical_score}%` }}
              className="h-full bg-gradient-to-r from-primary to-accent" 
            />
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center pt-3 border-t border-white/5">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-2 h-2 rounded-full animate-pulse",
            signal.recommendation?.includes('BUY') ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]" : 
            signal.recommendation?.includes('SELL') ? "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]" : "bg-zinc-600",
          )} />
          <span className={cn(
            "text-[10px] font-black tracking-widest uppercase",
            signal.recommendation?.includes('BUY') ? "text-emerald-400" : 
            signal.recommendation?.includes('SELL') ? "text-rose-400" : "text-zinc-500"
          )}>
            {signal.recommendation}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-tighter">Confidence</span>
          <span className="text-[10px] font-mono font-bold text-zinc-400">{(signal.final_score || 0).toFixed(0)}%</span>
        </div>
      </div>
    </motion.div>
  );
};
