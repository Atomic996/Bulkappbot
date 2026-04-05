import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const OrderBook: React.FC = () => {
  const orders = [
    { type: 'Buy', price: 67340.01, size: 0.420, time: '18:50:30', isBulk: true },
    { type: 'Sell', price: 67345.50, size: 1.246, time: '18:50:28', isBulk: true },
    { type: 'Sell', price: 67338.20, size: 0.826, time: '18:50:25', isBulk: false },
    { type: 'Buy', price: 67342.15, size: 2.120, time: '18:50:22', isBulk: true },
    { type: 'Sell', price: 67339.00, size: 0.126, time: '18:50:18', isBulk: false },
    { type: 'Buy', price: 67341.50, size: 0.950, time: '18:50:15', isBulk: true },
  ];

  return (
    <div className="glass-card rounded-xl overflow-hidden flex flex-col h-full border border-white/5">
      <div className="p-3 border-b border-white/10 bg-white/[0.02] flex justify-between items-center">
        <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Order Book (All Users)</h3>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[8px] font-mono text-primary uppercase font-bold">Bulk Active</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <table className="w-full text-left text-[10px] font-mono">
          <thead className="sticky top-0 bg-zinc-950/90 backdrop-blur-sm text-zinc-500 uppercase tracking-widest border-b border-white/5">
            <tr>
              <th className="px-4 py-2 font-bold">Typs</th>
              <th className="px-4 py-2 font-bold">Price (USD)</th>
              <th className="px-4 py-2 font-bold">Size (BTC)</th>
              <th className="px-4 py-2 font-bold">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {orders.map((order, i) => (
              <tr key={i} className={cn(
                "hover:bg-white/[0.03] transition-colors group",
                order.isBulk && "bg-primary/[0.02]"
              )}>
                <td className={cn(
                  "px-4 py-2 font-black flex items-center gap-2",
                  order.type === 'Buy' ? "text-emerald-500" : "text-rose-500"
                )}>
                  {order.type}
                  {order.isBulk && <span className="text-[7px] px-1 bg-primary/20 text-primary rounded-[2px] font-black">BULK</span>}
                </td>
                <td className="px-4 py-2 text-zinc-300">{order.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-2 text-zinc-300">{order.size.toFixed(3)}</td>
                <td className="px-4 py-2 text-zinc-500">{order.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
