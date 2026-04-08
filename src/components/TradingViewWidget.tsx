import * as React from 'react';
import { Maximize2 } from 'lucide-react';

interface TradingViewWidgetProps {
  symbol: string;
}

const TradingViewWidget: React.FC<TradingViewWidgetProps> = ({ symbol }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

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

  const iframeUrl = `https://www.tradingview.com/widgetembed/?symbol=BINANCE:${symbol}USDT&interval=D&hidesidetoolbar=1&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=[]&theme=dark&style=1&timezone=Etc%2FUTC&studies_overrides={}&overrides={}&enabled_features=[]&disabled_features=[]&locale=en&utm_source=localhost&utm_medium=widget&utm_campaign=chart&utm_term=BINANCE%3A${symbol}USDT`;

  return (
    <div ref={containerRef} className="relative h-full w-full bg-black rounded-xl border border-white/5 overflow-hidden group">
      <button 
        onClick={toggleFullscreen}
        className="absolute top-4 right-4 z-10 p-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg text-zinc-400 hover:text-white hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100"
        title="Full Screen"
      >
        <Maximize2 size={16} />
      </button>
      <iframe
        src={iframeUrl}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title={`TradingView Chart for ${symbol}`}
        allowFullScreen
      />
    </div>
  );
};

export default React.memo(TradingViewWidget);
