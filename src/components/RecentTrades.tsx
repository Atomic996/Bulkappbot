import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface RecentTradesProps {
  trades?: any[];
}

export const RecentTrades: React.FC<RecentTradesProps> = React.memo(({ trades = [] }) => {
  const displayTrades = trades.length > 0 ? trades.map(t => ({
    type: t.side === 'buy' ? 'Buy' : 'Sell',
    price: t.price,
    size: t.size,
    time: new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  })) : [
    { type: 'Buy', price: 177.500, size: 0.77, time: '168.03' },
    { type: 'Buy', price: 177.500, size: 0.72, time: '156.03' },
    { type: 'Sell', price: 177.500, size: 0.003, time: '156.03' },
    { type: 'Buy', price: 177.500, size: 0.72, time: '156.02' },
    { type: 'Sell', price: 177.500, size: 0.703, time: '153.02' },
  ];

  return (
    <div className="bg-gray-900/40 backdrop-blur-xl rounded-3xl overflow-hidden flex flex-col h-full border border-purple-500/20">
      <div className="p-4 border-b border-purple-500/10 bg-purple-500/5">
        <h3 className="text-xs font-bold text-white uppercase tracking-widest">Recent Trades (Market)</h3>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <table className="w-full text-left text-[10px] font-mono">
          <thead className="sticky top-0 bg-gray-900/90 backdrop-blur-sm text-gray-500 uppercase tracking-widest border-b border-purple-500/10">
            <tr>
              <th className="px-4 py-3 font-bold">TYPS</th>
              <th className="px-4 py-3 font-bold">PRICE (SINGT)</th>
              <th className="px-4 py-3 font-bold">AVERAGE (STM)</th>
              <th className="px-4 py-3 font-bold">TIME</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-purple-500/5">
            {displayTrades.map((trade, i) => (
              <tr key={i} className={cn(
                "hover:bg-purple-500/5 transition-colors group",
                trade.type === 'Buy' ? "bg-emerald-500/5" : "bg-rose-500/5"
              )}>
                <td className={cn(
                  "px-4 py-3 font-bold",
                  trade.type === 'Buy' ? "text-emerald-400" : "text-rose-400"
                )}>{trade.type}</td>
                <td className="px-4 py-3 text-purple-100/80">{trade.price.toFixed(3)}</td>
                <td className="px-4 py-3 text-purple-100/80">{trade.size.toFixed(3)}</td>
                <td className="px-4 py-3 text-gray-500">{trade.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});
