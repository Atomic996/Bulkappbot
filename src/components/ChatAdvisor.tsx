import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Send, X, Bot, User, Sparkles } from 'lucide-react';
import { getChatResponse } from '../lib/gemini.js';
import { AssetSignal, NewsItem } from '../types.js';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ChatAdvisorProps {
  signal: AssetSignal;
  news: NewsItem[];
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
}

export const ChatAdvisor: React.FC<ChatAdvisorProps> = ({ signal, news }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', text: `Hello! I'm your AI Trading Advisor. How can I assist you with ${signal.symbol} analysis today?`, sender: 'bot' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = { id: Date.now().toString(), text: input, sender: 'user' };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await getChatResponse(input, {
        symbol: signal.symbol,
        price: signal.price,
        indicators: signal.indicators,
        news: news,
        technicalScore: signal.technical_score,
        newsScore: signal.news_score
      });

      const botMsg: Message = { id: (Date.now() + 1).toString(), text: response, sender: 'bot' };
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      console.error("Chat error:", error instanceof Error ? error.message : String(error));
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[200]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="mb-4 w-[380px] h-[500px] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Bot size={18} className="text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">AI Trading Advisor</h3>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Online & Ready</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-zinc-300"
              >
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-zinc-800">
              {messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={cn(
                    "flex gap-3 max-w-[85%]",
                    msg.sender === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                  )}
                >
                  <div className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-1",
                    msg.sender === 'user' ? "bg-zinc-800" : "bg-blue-600/20"
                  )}>
                    {msg.sender === 'user' ? <User size={14} className="text-zinc-400" /> : <Bot size={14} className="text-blue-400" />}
                  </div>
                  <div className={cn(
                    "p-3 rounded-2xl text-sm leading-relaxed",
                    msg.sender === 'user' 
                      ? "bg-zinc-900 text-zinc-200 rounded-tr-none" 
                      : "bg-blue-600/10 text-zinc-100 border border-blue-500/10 rounded-tl-none"
                  )}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex gap-3 max-w-[85%] mr-auto">
                  <div className="w-7 h-7 rounded-lg bg-blue-600/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot size={14} className="text-blue-400" />
                  </div>
                  <div className="p-3 bg-blue-600/10 border border-blue-500/10 rounded-2xl rounded-tl-none flex items-center gap-1">
                    <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" />
                    <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 bg-zinc-900/50 border-t border-zinc-800">
              <div className="relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask about market trends, signals, or strategy..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 pl-4 pr-12 text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
                />
                <button 
                  onClick={handleSend}
                  disabled={!input.trim() || isTyping}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 rounded-lg transition-colors text-white"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        data-chat-trigger
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-300",
          isOpen ? "bg-zinc-900 text-zinc-400" : "bg-white text-black shadow-white/20"
        )}
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
        {!isOpen && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 border-2 border-black rounded-full" />
        )}
      </motion.button>
    </div>
  );
};
