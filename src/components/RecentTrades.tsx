import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const RecentTrades: React.FC = () => {
  const trades = [
    { type: 'Buy', price: 177.500, size: 0.77, time: '168.03' },
    { type: 'Buy', price: 177.500, size: 0.72, time: '156.03' },
    { type: 'Sell', price: 177.500, size: 0.003, time: '156.03' },
    { type: 'Buy', price: 177.500, size: 0.72, time: '156.02' },
    { type: 'Sell', price: 177.500, size: 0.703, time: '153.02' },
  ];

  return (
    <div className="glass-card rounded-xl overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-white/10 bg-white/[0.02]">
        <h3 className="text-sm font-black text-white uppercase tracking-tighter">Recent Trades (Market)</h3>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <table className="w-full text-left text-[10px] font-mono">
          <thead className="sticky top-0 bg-zinc-950 text-zinc-500 uppercase tracking-widest border-b border-white/5">
            <tr>
              <th className="px-4 py-2 font-bold">Typs</th>
              <th className="px-4 py-2 font-bold">Price (SINGT)</th>
              <th className="px-4 py-2 font-bold">Average (STM)</th>
              <th className="px-4 py-2 font-bold">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {trades.map((trade, i) => (
              <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                <td className={cn(
                  "px-4 py-2 font-black",
                  trade.type === 'Buy' ? "text-emerald-500" : "text-rose-500"
                )}>{trade.type}</td>
                <td className="px-4 py-2 text-zinc-300">{trade.price.toFixed(3)}</td>
                <td className="px-4 py-2 text-zinc-300">{trade.size.toFixed(3)}</td>
                <td className="px-4 py-2 text-zinc-500">{trade.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
