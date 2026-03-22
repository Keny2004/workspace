import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ExternalLink, Sparkles, AlertCircle, ShoppingCart, ArrowUpRight, Trash2, TrendingUp, Zap } from 'lucide-react';

const RecommendationCard = ({ product, onDelete }) => {
  const metadata = product.metadata ? JSON.parse(product.metadata) : {};

  return (
    <div className="bg-slate-900/40 rounded-3xl border border-slate-800 overflow-hidden hover:border-cyan-500/50 transition-all duration-500 group cyber-border relative flex flex-col h-full">
      <div className="p-8 pb-4 space-y-6 relative z-10 flex-1">
        <div className="flex justify-between items-start">
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1 bg-cyan-500/10 text-cyan-400 text-[9px] font-black rounded-lg border border-cyan-500/20 uppercase tracking-widest">
              {product.platform}
            </span>
            {product.is_ai_validated && (
              <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-[9px] font-black rounded-lg border border-emerald-500/20 uppercase tracking-widest flex items-center gap-1">
                <Sparkles size={10} className="animate-pulse" />
                Spec Verified
              </span>
            )}

            {product.tags && product.tags.split(',').map((tag, idx) => {
              const isFaulty = tag.includes('故障') || tag.includes('損壞');
              return (
                <span key={idx} className={`px-3 py-1 text-[9px] font-black rounded-lg border uppercase tracking-widest flex items-center gap-1 ${
                  isFaulty 
                  ? 'bg-red-500/10 text-red-500 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-pulse' 
                  : 'bg-slate-800/80 text-gray-400 border-white/5'
                }`}>
                  {isFaulty && <AlertCircle size={10} />}
                  {tag}
                </span>
              );
            })}
          </div>
          <button 
            onClick={() => onDelete(product.id)}
            className="p-2 bg-slate-950/50 border border-white/5 rounded-xl text-gray-500 hover:text-magenta-500 transition-all"
          >
            <Trash2 size={14} />
          </button>
        </div>
        
        <div className="flex justify-between items-end">
          <div className="flex-1">
            <div className="text-[10px] font-black text-cyan-400 mb-1 tracking-widest uppercase">
              {product.model} - {product.specification}
            </div>
            <h3 className="text-xl font-black tracking-tight line-clamp-1 bg-gradient-to-br from-white to-gray-400 bg-clip-text text-transparent group-hover:from-cyan-400 group-hover:to-cyan-600 transition-all duration-500 uppercase">{product.title}</h3>
            <p className="text-3xl font-black mt-3 flex items-baseline gap-2">
                <span className="text-xs text-gray-500 font-bold tracking-widest">NT$</span>
                <span className="cyber-text-glow">{product.price?.toLocaleString() || '0'}</span>
            </p>
          </div>
          <div className="text-right flex flex-col items-end gap-1">
              <div className="text-[11px] font-black text-emerald-500 cyber-text-glow tracking-tighter">
                  ROI: +{product.profit_margin_percent?.toFixed(1) || '0'}%
              </div>
              <div className="text-[8px] text-gray-500 uppercase font-black tracking-widest opacity-60 text-right">
                  Goal: NT$ {product.market_price?.toLocaleString() || '---'}
              </div>
          </div>
        </div>

        {/* Metadata Tags */}
        {(metadata.posted_at || metadata.location || metadata.transaction) && (
          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2 py-3 border-t border-white/5">
            {metadata.posted_at && (
              <div className="flex items-center gap-1.5 text-gray-500 text-[9px] font-bold uppercase tracking-widest">
                <Zap size={10} className="text-amber-500" />
                {metadata.posted_at}
              </div>
            )}
            {metadata.location && (
              <div className="flex items-center gap-1.5 text-gray-500 text-[9px] font-bold uppercase tracking-widest">
                <TrendingUp size={10} className="text-cyan-500 rotate-45" />
                {metadata.location}
              </div>
            )}
            {metadata.transaction && (
              <div className="flex items-center gap-1.5 text-magenta-500/70 text-[9px] font-black uppercase tracking-widest">
                <ShoppingCart size={10} />
                {metadata.transaction}
              </div>
            )}
          </div>
        )}

        <div className="bg-slate-950/80 p-5 rounded-2xl border border-white/5 space-y-3 relative overflow-hidden group/ai shadow-inner mt-4 min-h-[100px]">
          <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/50 group-hover/ai:w-2 transition-all"></div>
          <div className="flex items-center gap-2 text-cyan-400 text-[10px] font-black uppercase tracking-[0.2em]">
            <Sparkles size={14} className="animate-pulse" />
            AI Insight // 智慧總結
          </div>
          {product.ai_summary ? (
            <div className="space-y-4">
              <p className="text-[12px] font-black text-white leading-relaxed tracking-tight italic bg-gradient-to-r from-cyan-400/20 to-transparent p-3 rounded-xl border-l-2 border-cyan-500">
                "{product.ai_summary}"
              </p>
              <details className="group/desc">
                <summary className="text-[9px] text-gray-600 font-black uppercase tracking-[0.2em] cursor-pointer hover:text-cyan-400/60 transition-colors list-none flex items-center gap-2">
                  <div className="w-1 h-3 bg-gray-800 rounded-full group-hover/desc:bg-cyan-900 transition-colors"></div>
                  Seller Raw Description // 賣家原文
                </summary>
                <p className="mt-3 text-[10px] text-gray-500 leading-relaxed font-medium whitespace-pre-wrap break-all border-t border-white/5 pt-3">
                  {product.description}
                </p>
              </details>
            </div>
          ) : (
            <p className="text-[11px] font-medium text-gray-400 leading-relaxed tracking-tight line-clamp-4 overflow-hidden whitespace-pre-wrap break-all">
              {product.description || "尚無詳細描述，請點擊連結查看原始頁面。"}
            </p>
          )}
        </div>
      </div>

      <div className="px-8 pb-8 pt-4">
        <a 
          href={product.url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-lg shadow-cyan-600/20 active:scale-95 cyber-button"
        >
          查看原始連結
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
};

const Recommendations = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState(null); // stores product id to delete

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = () => {
    setLoading(true);
    axios.get('/api/products')
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : [];
        setProducts(data.filter(p => (p.estimated_profit || 0) > 0));
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;
    try {
        await axios.delete(`/api/products/${deleteModal}`);
        setProducts(products.filter(p => p.id !== deleteModal));
        setDeleteModal(null);
    } catch (e) {
        console.error(e);
    }
  };

  return (
    <div className="p-8 w-full space-y-8 relative cyber-grid min-h-screen">
      <div className="scanline"></div>
      
      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-slate-900 border border-magenta-500/20 p-10 rounded-[2.5rem] shadow-[0_0_50px_rgba(255,0,255,0.1)] w-full max-w-lg space-y-8 relative overflow-hidden cyber-border">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-magenta-500 to-transparent opacity-50"></div>
                <h3 className="text-2xl font-black tracking-tighter text-white uppercase italic">Confirm Neural_Wipe</h3>
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest leading-relaxed">執行此操作將從推薦清單中永久移除此項目。確認執行刪除指令？</p>
                <div className="flex justify-end gap-6 pt-4">
                    <button onClick={() => setDeleteModal(null)} className="px-8 py-3 text-gray-500 font-black text-[10px] uppercase tracking-widest hover:text-white transition-colors">Abort</button>
                    <button 
                        onClick={confirmDelete} 
                        className="px-8 py-3 bg-red-600 hover:bg-red-500 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-red-600/30 text-white cyber-button"
                    >
                        Confirm_Delete
                    </button>
                </div>
            </div>
        </div>
      )}

      <header className="relative z-10 flex justify-between items-center">
        <div>
            <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-white via-cyan-400 to-magenta-500 bg-clip-text text-transparent cyber-text-glow uppercase italic">獲利推薦區</h1>
            <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2 opacity-70">Delta Arbitrage Analysis // Neuro-Search</p>
        </div>
        <div className="p-4 bg-slate-900/40 rounded-2xl border border-slate-800 cyber-border">
            <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Active Opportunities</div>
            <div className="text-xl font-black text-cyan-400 cyber-text-glow tracking-tighter">{products.length} NODES</div>
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10">
          {[1,2,3].map(i => (
            <div key={i} className="bg-slate-900/40 h-96 rounded-3xl border border-slate-800 animate-pulse-slow cyber-border" />
          ))}
        </div>
      ) : products.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
          {products.map(p => (
            <RecommendationCard key={p.id} product={p} onDelete={setDeleteModal} />
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
