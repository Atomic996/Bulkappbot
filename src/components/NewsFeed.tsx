import React from 'react';
import { motion } from 'motion/react';
import { ExternalLink, Info, AlertTriangle, Globe, Landmark } from 'lucide-react';
import { NewsItem } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface NewsFeedProps {
  news: NewsItem[];
  isLoading: boolean;
  error?: string | null;
}

export const NewsFeed: React.FC<NewsFeedProps> = ({ news, isLoading, error }) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 w-full bg-white/[0.02] animate-pulse rounded-sm border border-white/5" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border border-rose-500/10 bg-rose-500/5 rounded-sm">
        <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center mb-4 border border-rose-500/20">
          <AlertTriangle size={20} className="text-rose-500" />
        </div>
        <h3 className="text-xs font-black text-zinc-200 mb-1 uppercase tracking-[0.2em]">Data Stream Interrupted</h3>
        <p className="text-[9px] font-mono text-rose-500/70 max-w-[240px] leading-relaxed uppercase">{error}</p>
      </div>
    );
  }

  if (news.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border border-white/5 bg-white/[0.02] rounded-sm">
        <div className="w-12 h-12 rounded-full bg-zinc-500/10 flex items-center justify-center mb-4 border border-zinc-500/20">
          <Info size={20} className="text-zinc-500" />
        </div>
        <h3 className="text-xs font-black text-zinc-200 mb-1 uppercase tracking-[0.2em]">No Intelligence Found</h3>
        <p className="text-[9px] font-mono text-zinc-500 max-w-[240px] leading-relaxed uppercase">No recent market events detected for this asset.</p>
      </div>
    );
  }

  const politicalNews = news.filter(n => n.is_political);
  const otherNews = news.filter(n => !n.is_political);

  return (
    <div className="space-y-12">
      {politicalNews.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-amber-500/10 border border-amber-500/20 rounded-sm">
                <Landmark size={14} className="text-amber-500" />
              </div>
              <h3 className="text-xs font-serif italic text-amber-500 tracking-wide">Political & Macro Impact</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">High Priority</span>
            </div>
          </div>
          <div className="grid gap-4">
            {politicalNews.map((item) => (
              <NewsCard key={item.id} item={item} isPriority />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-blue-500/10 border border-blue-500/20 rounded-sm">
              <Globe size={14} className="text-blue-500" />
            </div>
            <h3 className="text-xs font-serif italic text-zinc-400 tracking-wide">Market Intelligence</h3>
          </div>
          <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">Live Feed</span>
        </div>
        <div className="grid gap-3">
          {otherNews.map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
};

const NewsCard: React.FC<{ item: NewsItem; isPriority?: boolean }> = ({ item, isPriority }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.005 }}
      className={cn(
        "group relative p-4 bg-white/[0.01] border border-white/5 rounded-sm transition-all duration-300",
        "hover:bg-white/[0.03] hover:border-white/10",
        isPriority && "border-l-2 border-l-amber-500/40 bg-amber-500/[0.01]"
      )}
    >
      {/* Decorative Corner */}
      <div className="absolute top-0 right-0 w-8 h-8 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-px h-2 bg-white/10 group-hover:bg-blue-500/40 transition-colors" />
        <div className="absolute top-0 right-0 w-2 h-px bg-white/10 group-hover:bg-blue-500/40 transition-colors" />
      </div>

      <div className="flex justify-between items-start gap-4 mb-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-[0.2em]">Source: {item.source}</span>
            <div className="w-1 h-px bg-white/10" />
            <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-[0.2em]">{formatDistanceToNow(new Date(item.published_at))} ago</span>
          </div>
          <a 
            href={item.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="block text-sm font-bold text-zinc-200 group-hover:text-blue-400 transition-colors leading-relaxed tracking-tight"
          >
            {item.title}
          </a>
        </div>
        <div className="p-2 bg-black/40 rounded-sm border border-white/5 group-hover:border-blue-500/30 transition-all shrink-0">
          <ExternalLink size={12} className="text-zinc-600 group-hover:text-blue-400" />
        </div>
      </div>
      
      <div className="flex items-center justify-between pt-3 border-t border-white/[0.03]">
        <div className="flex items-center gap-4">
          {item.sentiment && (
            <div className={cn(
              "flex items-center gap-2 px-2 py-0.5 rounded-sm text-[8px] font-black uppercase tracking-widest border",
              item.sentiment === 'positive' ? "bg-emerald-500/5 text-emerald-500 border-emerald-500/20" : 
              item.sentiment === 'negative' ? "bg-rose-500/5 text-rose-500 border-rose-500/20" : "bg-zinc-500/5 text-zinc-500 border-zinc-500/20"
            )}>
              <div className={cn(
                "w-1 h-1 rounded-full",
                item.sentiment === 'positive' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : 
                item.sentiment === 'negative' ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" : "bg-zinc-500"
              )} />
              {item.sentiment}
            </div>
          )}
          
          {item.is_political && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/5 border border-amber-500/20 rounded-sm text-[8px] font-black uppercase tracking-widest text-amber-500">
              <Landmark size={8} />
              Macro Event
            </div>
          )}
        </div>

        {item.impact_score !== undefined && (
          <div className="flex items-center gap-3">
            <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-widest">Impact Factor</span>
            <div className="w-24 h-1 bg-white/5 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.abs(item.impact_score)}%` }}
                className={cn(
                  "h-full",
                  item.impact_score > 0 ? "bg-emerald-500" : "bg-rose-500"
                )} 
              />
            </div>
            <span className={cn(
              "text-[9px] font-mono font-bold",
              item.impact_score > 0 ? "text-emerald-500" : "text-rose-500"
            )}>
              {item.impact_score > 0 ? '+' : ''}{item.impact_score}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
};
