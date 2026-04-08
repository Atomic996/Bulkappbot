import React from 'react';
import { motion } from 'motion/react';
import { AssetCard } from '../AssetCard.js';
import { AssetSignal } from '../../types.js';

interface AssetsViewProps {
  symbols: string[];
  signals: Record<string, AssetSignal>;
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
}

export const AssetsView: React.FC<AssetsViewProps> = ({ symbols, signals, selectedSymbol, onSelectSymbol }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {symbols.map((symbol) => (
        <AssetCard
          key={symbol}
          signal={signals[symbol] || {
            symbol,
            price: 0,
            change24h: 0,
            technical_score: 50,
            news_score: 50,
            final_score: 50,
            recommendation: 'NEUTRAL',
            indicators: {},
            performance: { wins: 0, losses: 0, win_rate: 0 }
          }}
          isSelected={selectedSymbol === symbol}
          onClick={() => onSelectSymbol(symbol)}
        />
      ))}
    </div>
  );
};
