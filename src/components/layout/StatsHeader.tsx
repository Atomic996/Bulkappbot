import React from 'react';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  BarChart3, 
  Zap, 
  DollarSign 
} from 'lucide-react';

interface StatBoxProps {
  label: string;
  value: string;
  subValue: string;
  icon: any;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
}

const StatBox: React.FC<StatBoxProps> = ({ label, value, subValue, icon: Icon, trend, color = "purple" }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ y: -4, scale: 1.02 }}
    className="relative group overflow-hidden"
  >
    {/* Gradient Border Effect */}
    <div className={`absolute inset-0 bg-gradient-to-br from-${color}-500/20 to-transparent rounded-2xl opacity-50 group-hover:opacity-100 transition-opacity`} />
    
    <div className="relative p-5 bg-gray-900/40 backdrop-blur-xl border border-white/5 rounded-2xl shadow-xl group-hover:shadow-purple-500/10 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 bg-${color}-500/10 rounded-xl border border-${color}-500/20 group-hover:scale-110 transition-transform`}>
          <Icon size={20} className={`text-${color}-400`} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
            trend === 'up' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
          }`}>
            {trend === 'up' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {trend === 'up' ? '+2.4%' : '-1.2%'}
          </div>
        )}
      </div>
      
      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">{label}</p>
        <h3 className="text-2xl font-bold text-white tracking-tight group-hover:text-purple-400 transition-colors">
          {value}
        </h3>
        <p className="text-[10px] text-gray-500 font-mono mt-1 flex items-center gap-1.5">
          <Activity size={10} className="text-purple-500/50" />
          {subValue}
        </p>
      </div>

      {/* Animated Shimmer */}
      <div className="absolute -inset-x-full top-0 h-full w-1/2 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12 group-hover:animate-shimmer" />
    </div>
  </motion.div>
);

interface StatsHeaderProps {
  balance: number;
  activePositions: number;
  volume: number;
  marketCap: number;
}

export const StatsHeader: React.FC<StatsHeaderProps> = ({ 
  balance, 
  activePositions, 
  volume, 
  marketCap 
}) => {
  const formatCurrency = (val: number) => {
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    return `$${val.toLocaleString()}`;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatBox 
        label="Available Balance" 
        value={`$${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
        subValue="USDC Mainnet"
        icon={DollarSign}
        trend="up"
        color="purple"
      />
      <StatBox 
        label="Active Positions" 
        value={activePositions.toString()} 
        subValue="Open Trades"
        icon={Activity}
        color="blue"
      />
      <StatBox 
        label="24h Volume" 
        value={formatCurrency(volume)} 
        subValue="Global Market"
        icon={BarChart3}
        trend="up"
        color="indigo"
      />
      <StatBox 
        label="Market Cap" 
        value={formatCurrency(marketCap)} 
        subValue="Total Crypto"
        icon={Zap}
        trend="down"
        color="violet"
      />
    </div>
  );
};
