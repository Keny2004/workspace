import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Filter, ArrowUpDown, ChevronRight, Monitor, Smartphone, Laptop, Tablet, Hash } from 'lucide-react';

const MarketPrices = () => {
    const [prices, setPrices] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterCategory, setFilterCategory] = useState("All");
    
    useEffect(() => {
        axios.get('/api/market-prices/all').then(res => setPrices(res.data));
    }, []);

    const filteredPrices = prices.filter(p => {
        const matchesSearch = p.model.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             p.specification.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = filterCategory === "All" || p.category === filterCategory;
        return matchesSearch && matchesCategory;
    });

    const categories = ["All", ...new Set(prices.map(p => p.category))];

    const getIcon = (cat) => {
        if (cat === "手機") return <Smartphone size={16} />;
        if (cat === "筆電") return <Laptop size={16} />;
        if (cat === "平板") return <Tablet size={16} />;
        return <Monitor size={16} />;
    };

    return (
        <div className="p-8 w-full space-y-8">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">市場基準行情</h1>
                    <p className="text-gray-400 font-medium">查看來自 US3C 與 Sogo3C 等平台的官方收購報價</p>
                </div>
            </header>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                    <input 
                        type="text" 
                        placeholder="搜尋型號或規格..."
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-12 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/50 transition"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3">
                    <Filter size={18} className="text-gray-500" />
                    <select 
                        className="bg-transparent outline-none font-bold text-sm"
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                    >
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat === "All" ? "所有類別" : cat}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Price Cards/Table */}
            <div className="bg-slate-800/30 rounded-3xl border border-slate-700/50 overflow-hidden backdrop-blur-md">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-900/80 border-b border-slate-700/50">
                            <th className="px-8 py-5 text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">類別</th>
                            <th className="px-8 py-5 text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">型號名稱</th>
                            <th className="px-8 py-5 text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">詳細規格</th>
                            <th className="px-8 py-5 text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">市場報價</th>
                            <th className="px-8 py-5 text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">來源平台</th>
                            <th className="px-8 py-5 text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none text-right">最後更新</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/30">
                        {filteredPrices.map((p, idx) => (
                            <tr key={`${p.id}-${idx}`} className="hover:bg-blue-500/5 transition group">
                                <td className="px-8 py-4">
                                    <div className="flex items-center gap-2 text-xs font-bold text-gray-300">
                                        <div className="p-1.5 bg-slate-800 rounded-lg group-hover:bg-blue-500/20 group-hover:text-blue-400 transition">
                                            {getIcon(p.category)}
                                        </div>
                                        {p.category}
                                    </div>
                                </td>
                                <td className="px-8 py-4 font-bold text-sm">{p.model}</td>
                                <td className="px-8 py-4">
                                     <span className="px-2.5 py-1 bg-slate-900 rounded-lg border border-slate-700 text-[10px] font-black text-gray-500 uppercase">
                                        {p.specification}
                                     </span>
                                </td>
                                <td className="px-8 py-4">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-lg font-black text-blue-400">NT$ {p.price.toLocaleString()}</span>
                                        <ArrowUpDown size={12} className="text-gray-600" />
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
        </div>
    );
};

export default MarketPrices;
