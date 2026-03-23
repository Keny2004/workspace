import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ExternalLink, Sparkles, AlertCircle, ShoppingCart, ArrowUpRight, Trash2, TrendingUp, Zap, Loader2, Brain, Activity } from 'lucide-react';

// Styles for rich-content to prevent layout breaking from Yahoo HTML
const richContentStyles = `
  .rich-content img { max-width: 100% !important; height: auto !important; border-radius: 12px; margin: 10px 0; border: 1px solid rgba(255,255,255,0.05); }
  .rich-content table { width: 100% !important; border-collapse: collapse; margin: 10px 0; font-size: 10px; }
  .rich-content tr, .rich-content td { border: 1px solid rgba(255,255,255,0.05); padding: 4px; }
  .custom-scrollbar::-webkit-scrollbar { width: 4px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,243,255,0.2); border-radius: 10px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0,243,255,0.4); }
`;

const RecommendationCard = ({ product, onDelete, onRefreshAI }) => {
  const [refreshing, setRefreshing] = useState(false);
  const metadata = product.metadata ? JSON.parse(product.metadata) : {};

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefreshAI(product.id);
    setRefreshing(false);
  };

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
          <div className="flex gap-2">
            <button 
              onClick={handleRefresh}
              disabled={refreshing}
              title="重新觸發 AI 判斷與文案生成"
              className="px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded-xl text-[10px] font-black uppercase transition-all border border-cyan-500/30 disabled:opacity-50 flex items-center gap-1.5"
            >
              {refreshing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
              Refresh AI
            </button>
            <button 
              onClick={() => onDelete(product.id)}
              className="p-1.5 bg-slate-950/50 border border-white/5 rounded-xl text-gray-500 hover:text-magenta-500 transition-all"
            >
              <Trash2 size={14} />
            </button>
          </div>
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

        <div className="bg-slate-950/80 p-5 rounded-2xl border border-white/5 space-y-3 relative overflow-hidden group/ai shadow-inner mt-4 flex flex-col min-h-[120px]">
          <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/50 group-hover/ai:w-2 transition-all"></div>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 text-cyan-400 text-[10px] font-black uppercase tracking-[0.2em]">
              <Sparkles size={14} className="animate-pulse" />
              AI Insight // 智慧總結
            </div>
          </div>
          {product.ai_summary ? (
            <div className="space-y-4">
              <div 
                className="text-[12px] font-black text-white leading-relaxed tracking-tight italic bg-gradient-to-r from-cyan-400/20 to-transparent p-3 rounded-xl border-l-2 border-cyan-500 max-h-[180px] overflow-y-auto custom-scrollbar rich-content"
                dangerouslySetInnerHTML={{ __html: product.ai_summary }}
              />
              <details className="group/desc">
                <summary className="text-[9px] text-gray-600 font-black uppercase tracking-[0.2em] cursor-pointer hover:text-cyan-400/60 transition-colors list-none flex items-center gap-2">
                  <div className="w-1 h-3 bg-gray-800 rounded-full group-hover/desc:bg-cyan-900 transition-colors"></div>
                  Seller Raw Description // 賣家原文
                </summary>
                <div 
                  className="mt-3 text-[10px] text-gray-500 leading-relaxed font-medium whitespace-pre-wrap break-all border-t border-white/5 pt-3 max-h-[300px] overflow-y-auto custom-scrollbar rich-content"
                  dangerouslySetInnerHTML={{ __html: product.description }}
                />
              </details>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 opacity-40 space-y-3">
              <div className="p-3 bg-slate-900 rounded-2xl border border-white/5">
                <Brain size={24} className="text-gray-600 animate-pulse" />
              </div>
              <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest text-center">
                等待 AI 鑑定中...<br/>
                <span className="opacity-50 text-[8px]">Pending Neural Analysis</span>
              </p>
              <button 
                onClick={handleRefresh}
                disabled={refreshing}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded-xl text-[9px] font-black uppercase tracking-widest text-cyan-500 transition-all active:scale-95"
              >
                {refreshing ? "分析中..." : "立即啟動鑑定"}
              </button>
            </div>
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
  const [filterMode, setFilterMode] = useState("normal"); // "normal", "faulty", "all"

  const [globalRefreshing, setGlobalRefreshing] = useState(false);

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

  const handleGlobalRefresh = async () => {
    setGlobalRefreshing(true);
    try {
        await axios.post('/api/products/refresh-all-ai');
        alert("已在背景觸發全局 AI 重新評估，這將花費較長時間，請稍後再度重整頁面查看結果");
    } catch (e) {
        alert("全局觸發失敗：" + e.message);
    } finally {
        setGlobalRefreshing(false);
    }
  };

  const handleRefreshAI = async (productId) => {
    try {
        const res = await axios.post(`/api/products/${productId}/refresh-ai`);
        if (res.data.status === "success") {
            setProducts(products.map(p => {
                if(p.id === productId) {
                    return { ...p, ai_summary: res.data.ai_summary, is_potential: res.data.is_potential_profit, is_faulty: res.data.is_faulty };
                }
                return p;
            }));
        } else {
             alert(res.data.message || "Refresh failed");
        }
    } catch (e) {
        alert("Refresh failed");
    }
  };

  const filteredProducts = products.filter(p => {
      // 根據 is_faulty 屬性過濾
      const isFaulty = p.is_faulty === true;
      if (filterMode === "normal") return !isFaulty;
      if (filterMode === "faulty") return isFaulty;
      return true; // "all"
  });

  return (
    <div className="p-8 w-full space-y-12 relative cyber-grid min-h-screen">
      <style>{richContentStyles}</style>
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

      <header className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 border-b border-white/5 pb-10">
        <div className="space-y-4">
            <div>
                <h1 className="text-5xl font-black tracking-tighter bg-gradient-to-r from-white via-cyan-400 to-magenta-500 bg-clip-text text-transparent cyber-text-glow uppercase italic">獲利推薦區</h1>
                <p className="text-gray-500 text-[11px] font-black uppercase tracking-[0.4em] mt-3 opacity-70">Delta Arbitrage Analysis // Neuro-Search // {filteredProducts.length} NODES</p>
            </div>
            
            <button 
                onClick={handleGlobalRefresh}
                disabled={globalRefreshing}
                className="flex items-center gap-3 px-6 py-3 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-2xl transition-all disabled:opacity-50 shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/30 group/btn"
            >
                {globalRefreshing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} className="group-hover/btn:scale-125 transition-transform" />}
                <div className="text-left">
                    <div className="text-[10px] font-black uppercase tracking-widest">全局重新評估</div>
                    <div className="text-[8px] opacity-50 uppercase font-bold tracking-tight">Bulk Neural Recalculation</div>
                </div>
            </button>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-6 w-full lg:w-auto">
            <div className="flex bg-slate-900/80 p-1.5 rounded-2xl border border-white/10 backdrop-blur-xl shadow-2xl">
                <button 
                  onClick={() => setFilterMode("normal")}
                  className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${filterMode === "normal" ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/40" : "text-gray-500 hover:text-white"}`}
                >
                  正常機
                </button>
                <button 
                  onClick={() => setFilterMode("faulty")}
                  className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${filterMode === "faulty" ? "bg-rose-500 text-white shadow-lg shadow-rose-500/40" : "text-gray-500 hover:text-white"}`}
                >
                  故障機
                </button>
                <button 
                  onClick={() => setFilterMode("all")}
                  className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${filterMode === "all" ? "bg-slate-700 text-white shadow-lg shadow-white/10" : "text-gray-500 hover:text-white"}`}
                >
                  全部
                </button>
            </div>
            
            <div className="flex items-center gap-4 bg-slate-900/40 px-6 py-3 rounded-2xl border border-slate-800 cyber-border group">
                <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400">
                    <Activity size={18} />
                </div>
                <div>
                    <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Opportunities</div>
                    <div className="text-xl font-black text-white group-hover:text-cyan-400 transition-colors tracking-tighter">{filteredProducts.length} <span className="text-[10px] text-gray-600">UNITS</span></div>
                </div>
            </div>
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10">
          {[1,2,3].map(i => (
            <div key={i} className="bg-slate-900/40 h-96 rounded-3xl border border-slate-800 animate-pulse-slow cyber-border" />
          ))}
        </div>
      ) : filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
          {filteredProducts.map(p => (
            <RecommendationCard key={p.id} product={p} onDelete={setDeleteModal} onRefreshAI={handleRefreshAI} />
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
