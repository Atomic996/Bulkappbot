import { NewsItem } from "../types.js";

const BULLISH_KEYWORDS = [
  'etf', 'approval', 'bullish', 'surge', 'gains', 'adoption', 'partnership', 
  'institutional', 'buy', 'support', 'breakout', 'rally', 'upgrade', 'mainnet', 
  'listing', 'investment', 'growth', 'positive', 'green', 'pumping', 'ath', 'high',
  'moon', 'pump', 'long', 'buy', 'accumulate', 'whale buy', 'inflow', 'positive',
  'optimistic', 'success', 'win', 'gain', 'profit', 'up', 'rise', 'soar',
  'halving', 'staking', 'yield', 'defi', 'web3', 'metaverse', 'nft', 'dao',
  'layer2', 'scaling', 'efficiency', 'security', 'privacy', 'decentralization'
];

const BEARISH_KEYWORDS = [
  'hack', 'scam', 'fraud', 'regulation', 'ban', 'sec', 'lawsuit', 'crash', 
  'dump', 'bearish', 'drop', 'plunge', 'liquidation', 'whale sell', 'fud', 
  'inflation', 'rate hike', 'negative', 'red', 'dumping', 'low', 'warning',
  'sell', 'short', 'outflow', 'panic', 'fear', 'scary', 'danger', 'risk',
  'down', 'fall', 'sink', 'bleed', 'rejection', 'resistance',
  'exploit', 'vulnerability', 'rugpull', 'ponzi', 'centralization', 'congestion',
  'fee hike', 'regulatory crackdown', 'enforcement', 'investigation'
];

export function analyzeSentimentAlgorithmic(newsItems: NewsItem[]): NewsItem[] {
  return newsItems.map(item => {
    const text = (item.title || "").toLowerCase();
    let score = 0;

    BULLISH_KEYWORDS.forEach(word => {
      if (text.includes(word)) score += 35; // Increased weight
    });

    BEARISH_KEYWORDS.forEach(word => {
      if (text.includes(word)) score -= 35; // Increased weight
    });

    // Normalize score between -100 and 100
    const impactScore = Math.max(-100, Math.min(100, score));
    
    return {
      ...item,
      sentiment: impactScore > 15 ? 'positive' : impactScore < -15 ? 'negative' : 'neutral',
      impact_score: impactScore,
      is_political: text.includes('sec') || text.includes('regulation') || text.includes('fed') || text.includes('government')
    };
  });
}

export function calculateAlgorithmicNewsScore(analyzedNews: NewsItem[]): number {
  if (analyzedNews.length === 0) {
    return 0;
  }
  
  // Take top 15 news items for a balanced score
  const topItems = analyzedNews.slice(0, 15);
  
  // Weight by recency: newer items have more impact
  let weightedScore = 0;
  let totalWeight = 0;

  topItems.forEach((item, index) => {
    // Weight decreases as index increases (assuming news is sorted by date desc)
    const weight = Math.max(1, 15 - index); 
    weightedScore += (item.impact_score || 0) * weight;
    totalWeight += weight;
  });
  
  const finalScore = weightedScore / totalWeight;
  
  return Math.max(-100, Math.min(100, finalScore));
}
