import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Filter, ArrowUpDown, ChevronRight, Monitor, Smartphone, Laptop, Tablet, Hash, Zap, Loader2 } from 'lucide-react';

const MarketPrices = () => {
    const [prices, setPrices] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterCategory, setFilterCategory] = useState("All");
    const [platformFilter, setPlatformFilter] = useState("All");
    const [margins, setMargins] = useState({ "手機": 5, "平板": 10, "筆電": 15 });
    const [filterMonitor, setFilterMonitor] = useState("All"); // All, Monitored, Unmonitored
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        refreshData();
    }, []);

    const refreshData = () => {
        Promise.all([
            axios.get('/api/market-prices/all'),
            axios.get('/api/config')
        ]).then(([pricesRes, configRes]) => {
            setPrices(pricesRes.data);
            
            // Map category margins
            const newMargins = { "手機": 5, "平板": 10, "筆電": 15 };
            configRes.data.forEach(c => {
                if (c.key === "profit_margin_手機") newMargins["手機"] = parseFloat(c.value);
                if (c.key === "profit_margin_平板") newMargins["平板"] = parseFloat(c.value);
                if (c.key === "profit_margin_筆電") newMargins["筆電"] = parseFloat(c.value);
            });
            setMargins(newMargins);
        }).catch(err => console.error("Load failed", err))
          .finally(() => setLoading(false));
    };

    const toggleMonitor = (spec_id) => {
        axios.post(`/api/specifications/${spec_id}/toggle-monitor`).then(res => {
            if (res.data.status === "success") {
                setPrices(prev => prev.map(p => 
                    p.specification_id === spec_id 
                    ? { ...p, is_monitored: res.data.is_monitored } 
                    : p
                ));
            }
        });
    };

    const filteredPrices = prices.filter(p => {
        const matchesSearch = p.model.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             p.specification.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = filterCategory === "All" || p.category === filterCategory;
        const matchesPlatform = platformFilter === "All" || p.source === platformFilter;
        const matchesMonitor = filterMonitor === "All" || 
                              (filterMonitor === "Monitored" && p.is_monitored) ||
                              (filterMonitor === "Unmonitored" && !p.is_monitored);
        return matchesSearch && matchesCategory && matchesPlatform && matchesMonitor;
    });

    const categories = ["All", ...new Set(prices.map(p => p.category))];
    const platforms = ["All", ...new Set(prices.map(p => p.source))];

    const getIcon = (cat) => {
        if (cat === "手機") return <Smartphone size={16} />;
        if (cat === "筆電") return <Laptop size={16} />;
        if (cat === "平板") return <Tablet size={16} />;
        return <Monitor size={16} />;
    };

    return (
        <div className="p-8 min-h-screen w-full space-y-8 relative cyber-grid overflow-x-hidden">
            <div className="scanline"></div>
            
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-white via-cyan-400 to-magenta-500 bg-clip-text text-transparent cyber-text-glow">
                        市場基準行情
                    </h1>
                    <div className="flex items-center gap-4 mt-2">
                        <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em]">
                            Market Database // Monitored_Sync
                        </p>
                        <div className="h-[1px] w-12 bg-white/10"></div>
                        <div className="flex gap-2">
                             <button 
                                onClick={() => setFilterMonitor("All")}
                                className={`px-3 py-1 rounded-full text-[9px] font-black uppercase transition-all ${filterMonitor === 'All' ? 'bg-white/10 text-white' : 'text-gray-600 hover:text-gray-400'}`}
                            >All_Nodes</button>
                            <button 
                                onClick={() => setFilterMonitor("Monitored")}
                                className={`px-3 py-1 rounded-full text-[9px] font-black uppercase transition-all flex items-center gap-1.5 ${filterMonitor === 'Monitored' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-gray-600 hover:text-cyan-400'}`}
                            >
                                <Zap size={10} className={filterMonitor === 'Monitored' ? 'fill-current' : ''} />
                                喜好監控中
                            </button>
                            <button 
                                onClick={() => setFilterMonitor("Unmonitored")}
                                className={`px-3 py-1 rounded-full text-[9px] font-black uppercase transition-all ${filterMonitor === 'Unmonitored' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'text-gray-600 hover:text-red-400'}`}
                            >尚未關注</button>
                        </div>
                    </div>
                </div>
                <div className="flex gap-4">
                    <div className="flex items-center gap-3 bg-slate-900/80 border border-white/5 px-6 py-3 rounded-2xl backdrop-blur-md">
                        <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Node_Platform</span>
                        <div className="flex gap-2">
                            {platforms.map(plat => (
                                <button 
                                    key={plat}
                                    onClick={() => setPlatformFilter(plat)}
                                    className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all ${platformFilter === plat ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20' : 'bg-slate-950 text-gray-500 hover:text-cyan-400'}`}
                                >
                                    {plat === "All" ? "ALL_SOURCE" : plat}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </header>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-40 space-y-6">
                    <Loader2 size={48} className="text-cyan-500 animate-spin" />
                    <p className="text-xs font-black text-cyan-500/50 uppercase tracking-[0.5em] animate-pulse">Loading Neuro-Data...</p>
                </div>
            ) : (
                <>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center bg-slate-900/40 p-6 rounded-[2rem] border border-slate-800 shadow-xl backdrop-blur-md relative z-10">
                <div className="flex-1 relative group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-cyan-500/50 group-focus-within:text-cyan-400 transition-colors" size={18} />
                    <input 
                        type="text" 
                        placeholder="搜尋型號或規格..."
                        className="w-full bg-slate-950 border border-white/10 rounded-2xl pl-14 pr-6 py-4 outline-none focus:border-cyan-500/50 transition-all font-mono text-cyan-400 text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-3 bg-slate-950 border border-white/10 rounded-2xl px-6 py-4">
                    <Filter size={18} className="text-cyan-500/50" />
                    <select 
                        className="bg-transparent outline-none font-black text-[10px] uppercase tracking-widest text-cyan-500/70"
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                    >
                        {categories.map(cat => (
                            <option key={cat} value={cat} className="bg-slate-900">{cat === "All" ? "所有類別" : cat}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Price Cards/Table */}
            <div className="bg-slate-800/30 rounded-3xl border border-slate-700/50 overflow-hidden backdrop-blur-md relative z-10">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-900/80 border-b border-slate-700/50">
                            <th className="px-8 py-5 text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">監控</th>
                            <th className="px-8 py-5 text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">類別</th>
                            <th className="px-8 py-5 text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">型號名稱</th>
                            <th className="px-8 py-5 text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">詳細規格</th>
                            <th className="px-8 py-5 text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">市場報價</th>
                            <th className="px-8 py-5 text-[10px] font-black text-blue-500 uppercase tracking-widest leading-none">預定收購價 (類別加成)</th>
                            <th className="px-8 py-5 text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">來源平台</th>
                            <th className="px-8 py-5 text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none text-right">最後更新</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/30">
                        {filteredPrices.map((p, idx) => (
                            <tr key={`${p.id}-${idx}`} className={`hover:bg-blue-500/5 transition group ${p.is_monitored ? 'bg-cyan-500/5' : ''}`}>
                                <td className="px-8 py-4">
                                    <button 
                                        onClick={() => toggleMonitor(p.specification_id)}
                                        className={`w-6 h-6 rounded flex items-center justify-center border transition-all ${p.is_monitored ? 'bg-cyan-500 border-cyan-400 shadow-[0_0_10px_rgba(0,243,255,0.5)]' : 'bg-slate-900 border-white/10 hover:border-cyan-500/50'}`}
                                    >
                                        {p.is_monitored && <Zap size={12} className="text-white fill-current" />}
                                    </button>
                                </td>
                                <td className="px-8 py-4">
                                    <div className="flex items-center gap-2 text-xs font-bold text-gray-300">
                                        <div className={`p-1.5 bg-slate-800 rounded-lg group-hover:text-blue-400 transition ${p.is_monitored ? 'text-cyan-400 bg-cyan-500/10' : ''}`}>
                                            {getIcon(p.category)}
                                        </div>
                                        {p.category}
                                    </div>
                                </td>
                                <td className="px-8 py-4 font-bold text-sm">
                                    <div className="flex flex-col">
                                        <span>{p.model}</span>
                                        {p.is_monitored && <span className="text-[8px] text-cyan-500 font-black uppercase tracking-widest mt-1 opacity-60">Priority_Monitored</span>}
                                    </div>
                                </td>
                                <td className="px-8 py-4">
                                     <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase transition-colors ${p.is_monitored ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-slate-900 border-slate-700 text-gray-500'}`}>
                                        {p.specification}
                                     </span>
                                </td>
                                <td className="px-8 py-4">
                                    <div className="flex items-center gap-1.5">
                                        <span className={`text-lg font-black transition-colors ${p.is_monitored ? 'text-white cyber-text-glow' : 'text-gray-400'}`}>NT$ {p.price.toLocaleString()}</span>
                                    </div>
                                </td>
                                <td className="px-8 py-4">
                                    <div className="flex items-center gap-1.5 animate-pulse-slow">
                                        <div className="flex flex-col">
                                            <span className="text-xl font-black text-blue-400">
                                                NT$ {Math.round(p.price * (1 + (margins[p.category] || 5) / 100)).toLocaleString()}
                                            </span>
                                            <span className="text-[9px] font-bold text-blue-500/50 uppercase tracking-tighter">
                                                +{margins[p.category] || 5}% CATEGORY_MARGIN
                                            </span>
                                        </div>
                                        <Zap size={14} className="text-blue-500 fill-current ml-2" />
                                    </div>
                                </td>
                                <td className="px-8 py-4">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter ${p.source === 'US3C' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                                        {p.source}
                                    </span>
                                </td>
                                <td className="px-8 py-4 text-right text-[10px] font-bold text-gray-500">
                                    {new Date(p.updated_at).toLocaleString('zh-TW')}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                
                {filteredPrices.length === 0 && (
                    <div className="py-32 flex flex-col items-center justify-center text-gray-600">
                        <Monitor size={64} className="mb-6 opacity-10 animate-pulse" />
                        <p className="font-bold tracking-tight">目前尚未取得任何市場基準行情數據</p>
                        <p className="text-xs mt-2 opacity-50">請嘗試啟動手動同步或等待排程更新</p>
                    </div>
                )}
            </div>
                </>
            )}
        </div>
    );
};

export default MarketPrices;
