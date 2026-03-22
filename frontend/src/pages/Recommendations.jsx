import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ExternalLink, Sparkles, AlertCircle, ShoppingCart, ArrowUpRight } from 'lucide-react';

const RecommendationCard = ({ product }) => (
  <div className="bg-slate-900/40 rounded-3xl border border-slate-800 overflow-hidden hover:border-cyan-500/50 transition-all duration-500 group cyber-border relative">
    <div className="p-8 space-y-6 relative z-10">
      <div className="flex justify-between items-start">
        <span className="px-3 py-1 bg-cyan-500/10 text-cyan-400 text-[10px] font-black rounded-lg border border-cyan-500/20 uppercase tracking-widest">
          {product.platform} // NODE_{product.id}
        </span>
        <div className="text-magenta-400 flex items-center gap-1.5 font-black text-xs cyber-text-glow">
          <ArrowUpRight size={14} />
          EST_PROFIT: NT$ {product.potential_profit || '???'}
        </div>
      </div>
      
      <div>
        <h3 className="text-xl font-black tracking-tight line-clamp-2 bg-gradient-to-br from-white to-gray-400 bg-clip-text text-transparent group-hover:from-cyan-400 group-hover:to-cyan-600 transition-all duration-500">{product.title}</h3>
        <p className="text-3xl font-black mt-3 flex items-baseline gap-2">
            <span className="text-xs text-gray-500 font-bold tracking-widest">NT$</span>
            <span className="cyber-text-glow">{product.price.toLocaleString()}</span>
        </p>
      </div>

      <div className="bg-slate-950/80 p-5 rounded-2xl border border-white/5 space-y-3 relative overflow-hidden group/ai shadow-inner">
        <div className="absolute top-0 left-0 w-1 h-full bg-magenta-500/50 group-hover/ai:w-2 transition-all"></div>
        <div className="flex items-center gap-2 text-magenta-400 text-[10px] font-black uppercase tracking-[0.2em]">
          <Sparkles size={14} className="animate-pulse" />
          Neural Analysis // 机况總結
        </div>
        <p className="text-[11px] font-bold text-gray-400 leading-relaxed uppercase tracking-tight">
          {product.ai_summary || "AI 正在分析機況中，請稍候..."}
        </p>
      </div>

      <div className="flex gap-3 pt-4">
        <a 
          href={product.url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-lg shadow-cyan-600/20 active:scale-95 cyber-button"
        >
          查看原始連結
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  </div>
);

const Recommendations = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/products?is_potential=true')
      .then(res => setProducts(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 w-full space-y-8 relative cyber-grid min-h-screen">
      <div className="scanline"></div>
      
      <header className="relative z-10">
        <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-white via-cyan-400 to-magenta-500 bg-clip-text text-transparent cyber-text-glow">獲利推薦區</h1>
        <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2 opacity-70">Delta Arbitrage Analysis // Neuro-Search</p>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10">
          {[1,2,3].map(i => (
            <div key={i} className="bg-slate-900/40 h-96 rounded-3xl border border-slate-800 animate-pulse-slow cyber-border" />
          ))}
        </div>
      ) : products.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10">
          {products.map(p => (
            <RecommendationCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-40 text-gray-700 relative z-10">
          <div className="p-8 bg-slate-900/20 rounded-full border border-white/5 mb-8">
              <ShoppingCart size={80} className="opacity-20 animate-float" />
          </div>
          <p className="text-xs font-black uppercase tracking-[0.5em] text-gray-600 px-8 py-3 bg-slate-950 border border-white/5 rounded-full">No Potential ROI Detected</p>
        </div>
      )}
    </div>
  );
};

export default Recommendations;
