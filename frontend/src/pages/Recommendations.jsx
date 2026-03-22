import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ExternalLink, Sparkles, AlertCircle, ShoppingCart, ArrowUpRight } from 'lucide-react';

const RecommendationCard = ({ product }) => (
  <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden hover:border-blue-500/50 transition duration-300 group">
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-start">
        <span className="px-3 py-1 bg-blue-600/20 text-blue-400 text-xs font-bold rounded-full uppercase tracking-wider">
          {product.platform}
        </span>
        <div className="text-emerald-400 flex items-center gap-1 font-bold">
          <ArrowUpRight size={16} />
          預估獲利 NT$ {product.potential_profit || '???'}
        </div>
      </div>
      
      <div>
        <h3 className="text-xl font-bold line-clamp-2 group-hover:text-blue-400 transition">{product.title}</h3>
        <p className="text-2xl font-black mt-2">NT$ {product.price.toLocaleString()}</p>
      </div>

      <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 space-y-2">
        <div className="flex items-center gap-2 text-yellow-400 text-sm font-bold">
          <Sparkles size={16} />
          AI 機況總結
        </div>
        <p className="text-sm text-gray-300 leading-relaxed">
          {product.ai_summary || "AI 正在分析機況中，請稍候..."}
        </p>
      </div>

      <div className="flex gap-3 pt-2">
        <a 
          href={product.url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 py-3 rounded-xl font-bold transition"
        >
          查看原始連結
          <ExternalLink size={16} />
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
    <div className="p-8 w-full space-y-8">
      <header>
        <h1 className="text-3xl font-bold">獲利推薦區</h1>
        <p className="text-gray-400">根據最新收購價比對，篩選出具有潛在價差空間的商品</p>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => (
            <div key={i} className="bg-slate-800 h-80 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : products.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map(p => (
            <RecommendationCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <ShoppingCart size={64} className="mb-4 opacity-20" />
          <p className="text-xl">目前尚無發現符合獲利條件的推薦商品</p>
          <p className="text-sm mt-2 font-sans">系統會定期掃描 Carousell 平台，請稍後再回來查看</p>
        </div>
      )}
    </div>
  );
};

export default Recommendations;
