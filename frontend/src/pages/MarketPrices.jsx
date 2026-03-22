import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Filter, ArrowUpDown, ChevronRight, Monitor, Smartphone, Laptop, Tablet, Hash, Zap, Loader2, Edit3, X, TrendingUp } from 'lucide-react';

const MarketPrices = () => {
    const [prices, setPrices] = useState([]);
    
    // Group by specification to find benchmarks
    const specBenchmarks = prices.reduce((acc, p) => {
        if (!acc[p.specification_id] || p.price > acc[p.specification_id]) {
            acc[p.specification_id] = p.price;
        }
        return acc;
    }, {});
    const [searchTerm, setSearchTerm] = useState("");
    const [filterCategory, setFilterCategory] = useState("All");
    const [platformFilter, setPlatformFilter] = useState("All");
    const [margins, setMargins] = useState({});
    const [categoryData, setCategoryData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterMonitor, setFilterMonitor] = useState("All");
    const [showManualModal, setShowManualModal] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [manualForm, setManualForm] = useState({
        category: "手機",
        model: "",
        specification: "",
        price: ""
    });
    const [submitting, setSubmitting] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState({
        spec_id: null,
        category: "",
        model: "",
        specification: "",
        price: "",
        custom_margin: ""
    });
    
    useEffect(() => {
        refreshData();
    }, []);

    const refreshData = () => {
        setLoading(true);
        Promise.all([
            axios.get('/api/market-prices/all'),
            axios.get('/api/categories')
        ]).then(([pricesRes, catsRes]) => {
            setPrices(pricesRes.data);
            setCategoryData(catsRes.data);
            
            const m = {};
            catsRes.data.forEach(c => {
                m[c.name] = c.custom_margin;
            });
            setMargins(m);
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

    const handleManualSubmit = (e) => {
        e.preventDefault();
        setSubmitting(true);
        axios.post('/api/market-prices/manual', {
            ...manualForm,
            price: parseFloat(manualForm.price)
        }).then(res => {
            if (res.data.status === "success") {
                setShowManualModal(false);
                setManualForm({ category: "手機", model: "", specification: "", price: "" });
                refreshData();
            }
        }).catch(err => alert("提交失敗: " + err.message))
          .finally(() => setSubmitting(false));
    };

    const handleEditClick = (p) => {
        setEditForm({
            spec_id: p.specification_id,
            category: p.category,
            model: p.model,
            specification: p.specification,
            price: p.price,
            custom_margin: p.custom_margin !== null ? p.custom_margin : ""
        });
        setShowEditModal(true);
    };

    const handleEditSubmit = (e) => {
        e.preventDefault();
        setSubmitting(true);
        
        axios.post('/api/market-prices/manual', {
            category: editForm.category,
            model: editForm.model,
            specification: editForm.specification,
            price: parseFloat(editForm.price),
            custom_margin: editForm.custom_margin === "" ? null : parseFloat(editForm.custom_margin)
        }).then(res => {
            if (res.data.status === "success") {
                setShowEditModal(false);
                refreshData();
            }
        }).catch(err => alert("更新失敗: " + err.message))
          .finally(() => setSubmitting(false));
    };

    const handleCategoryMarginSubmit = (e) => {
        e.preventDefault();
        setSubmitting(true);
        axios.post(`/api/categories/${selectedCategory.id}/margin`, {
            margin: parseFloat(selectedCategory.custom_margin)
        }).then(res => {
            if (res.data.status === "success") {
                setShowCategoryModal(false);
                setSelectedCategory(null);
                refreshData();
            }
        }).catch(err => alert("更新類別加成失敗: " + err.message))
          .finally(() => setSubmitting(false));
    };

    const filteredPrices = prices.filter(p => {
        const pModel = (p.model || "").toLowerCase();
        const pSpec = (p.specification || "").toLowerCase();
        const sTerm = (searchTerm || "").toLowerCase();
        
        const matchesSearch = pModel.includes(sTerm) || pSpec.includes(sTerm);
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
                <div className="flex gap-4 items-center">
                    <button 
                        onClick={() => setShowManualModal(true)}
                        className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-cyan-500/20 active:scale-95 transition-all"
                    >
                        <Zap size={14} className="fill-current" />
                        手動新增行情
                    </button>
                    <button 
                        onClick={() => setShowCategoryModal(true)} // Note: This will be handled by a simpler list view or we just pick from available categories
                        className="flex items-center gap-2 bg-slate-900/80 border border-white/5 hover:border-blue-500/50 text-gray-400 hover:text-blue-400 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                    >
                        <TrendingUp size={14} />
                        類別加成設定
                    </button>
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
                                        <span className={`text-lg font-black transition-colors ${p.is_monitored ? 'text-white cyber-text-glow' : 'text-gray-400'}`}>NT$ {p.price?.toLocaleString() || '0'}</span>
                                    </div>
                                </td>
                                <td className="px-8 py-4">
                                    <div className="flex items-center gap-1.5 animate-pulse-slow">
                                        <div className="flex flex-col">
                                            <span className="text-xl font-black text-blue-400">
                                                NT$ {Math.round((specBenchmarks[p.specification_id] || 0) * (1 + (p.custom_margin !== null ? p.custom_margin : (margins[p.category] || 5)) / 100)).toLocaleString()}
                                            </span>
                                            <span className="text-[9px] font-bold text-blue-500/50 uppercase tracking-tighter">
                                                {p.price === specBenchmarks[p.specification_id] ? "BASED ON MAX BENCHMARK" : `BENCHMARK: NT$ ${specBenchmarks[p.specification_id]?.toLocaleString()}`}
                                            </span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-4">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter ${p.source === 'US3C' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                                        {p.source}
                                    </span>
                                </td>
                                <td className="px-8 py-4 text-right">
                                    <div className="flex flex-col items-end gap-1">
                                        <span className="text-[10px] font-bold text-gray-500">
                                            {p.updated_at ? new Date(p.updated_at).toLocaleString('zh-TW') : 'N/A'}
                                        </span>
                                        <button 
                                            onClick={() => handleEditClick(p)}
                                            className="p-1.5 bg-slate-800 hover:bg-cyan-500/20 text-gray-500 hover:text-cyan-400 rounded-lg transition-all border border-transparent hover:border-cyan-500/30"
                                            title="編輯此項"
                                        >
                                            <Edit3 size={14} />
                                        </button>
                                    </div>
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

            {/* Manual Entry Modal */}
            {showManualModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowManualModal(false)}></div>
                    <div className="bg-slate-900 border border-cyan-500/30 w-full max-w-md rounded-[2.5rem] p-8 relative z-10 shadow-2xl shadow-cyan-500/10 animate-in fade-in zoom-in duration-300">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-3 bg-cyan-500/10 rounded-2xl text-cyan-400">
                                <Zap size={24} className="fill-current" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-white tracking-tight">手動建立基準行情</h2>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Manual_Data_Injection</p>
                            </div>
                        </div>

                        <form onSubmit={handleManualSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">類別 Category</label>
                                <select 
                                    className="w-full bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-cyan-500/50 transition-all font-bold text-sm text-cyan-400"
                                    value={manualForm.category}
                                    onChange={(e) => setManualForm({...manualForm, category: e.target.value})}
                                >
                                    <option value="手機">手機 (Smartphone)</option>
                                    <option value="平板">平板 (Tablet)</option>
                                    <option value="筆電">筆電 (Laptop)</option>
                                    <option value="手錶">手錶 (Watch)</option>
                                    <option value="耳機">耳機 (Audio)</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">型號 Model_Name</label>
                                <input 
                                    type="text" 
                                    required
                                    placeholder="例如：iPhone 15 Pro"
                                    className="w-full bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-cyan-500/50 transition-all font-bold text-sm text-cyan-400 placeholder:text-gray-700"
                                    value={manualForm.model}
                                    onChange={(e) => setManualForm({...manualForm, model: e.target.value})}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">詳細規格 Specs</label>
                                <input 
                                    type="text" 
                                    required
                                    placeholder="例如：256GB"
                                    className="w-full bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-cyan-500/50 transition-all font-bold text-sm text-cyan-400 placeholder:text-gray-700"
                                    value={manualForm.specification}
                                    onChange={(e) => setManualForm({...manualForm, specification: e.target.value})}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">市場報價 Price_NT$</label>
                                <input 
                                    type="number" 
                                    required
                                    placeholder="0"
                                    className="w-full bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-cyan-500/50 transition-all font-bold text-sm text-cyan-400 placeholder:text-gray-700"
                                    value={manualForm.price}
                                    onChange={(e) => setManualForm({...manualForm, price: e.target.value})}
                                />
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button 
                                    type="button"
                                    onClick={() => setShowManualModal(false)}
                                    className="flex-1 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-gray-500 hover:text-white transition-colors"
                                >
                                    取消 Cancel
                                </button>
                                <button 
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-cyan-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Zap size={14} className="fill-current" />}
                                    確認新增 Confirm
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowEditModal(false)}></div>
                    <div className="bg-slate-900 border border-blue-500/30 w-full max-w-md rounded-[2.5rem] p-8 relative z-10 shadow-2xl shadow-blue-500/10 animate-in fade-in zoom-in duration-300">
                        <div className="flex justify-between items-start mb-8">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400">
                                    <Edit3 size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-white tracking-tight">編輯行情規格</h2>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Market_Data_Adjustment</p>
                                </div>
                            </div>
                            <button onClick={() => setShowEditModal(false)} className="text-gray-500 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="mb-6 p-4 bg-slate-950 rounded-2xl border border-white/5">
                            <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1">Target_Node</p>
                            <p className="text-sm font-bold text-white">{editForm.model} <span className="text-cyan-500">{editForm.specification}</span></p>
                        </div>

                        <form onSubmit={handleEditSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">自訂市場報價 Price_NT$</label>
                                <input 
                                    type="number" 
                                    required
                                    className="w-full bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-blue-500/50 transition-all font-bold text-sm text-blue-400"
                                    value={editForm.price}
                                    onChange={(e) => setEditForm({...editForm, price: e.target.value})}
                                />
                                <p className="text-[8px] text-gray-600 ml-4 font-bold">* 編輯後將會建立一個「手動新增」來源的行情，與其他來源競爭最高價</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">規格專屬加成 Custom_Margin (%)</label>
                                <input 
                                    type="number" 
                                    step="0.1"
                                    placeholder="留空則使用類別預設值"
                                    className="w-full bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-blue-500/50 transition-all font-bold text-sm text-blue-400 placeholder:text-gray-700"
                                    value={editForm.custom_margin}
                                    onChange={(e) => setEditForm({...editForm, custom_margin: e.target.value})}
                                />
                                <p className="text-[8px] text-gray-600 ml-4 font-bold">* 設定此項會覆蓋類別 (手機/平板/筆電) 的通用加成比例</p>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button 
                                    type="button"
                                    onClick={() => setShowEditModal(false)}
                                    className="flex-1 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-gray-500 hover:text-white transition-colors"
                                >
                                    取消 Cancel
                                </button>
                                <button 
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-slate-950 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Zap size={14} className="fill-current" />}
                                    確認更新 Update
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Category Margin Modal */}
            {showCategoryModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowCategoryModal(false)}></div>
                    <div className="bg-slate-900 border border-emerald-500/30 w-full max-w-md rounded-[2.5rem] p-8 relative z-10 shadow-2xl shadow-emerald-500/10">
                        <div className="flex justify-between items-start mb-8">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400">
                                    <TrendingUp size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-white tracking-tight">類別預設加成設定</h2>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Global_Category_Margins</p>
                                </div>
                            </div>
                            <button onClick={() => setShowCategoryModal(false)} className="text-gray-500 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                            {categoryData.map(cat => (
                                <div key={cat.id} className="p-5 bg-slate-950 rounded-[1.5rem] border border-white/5 flex justify-between items-center group hover:border-emerald-500/30 transition-all">
                                    <div>
                                        <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1">Category_Node</p>
                                        <p className="text-sm font-bold text-white uppercase">{cat.name}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-emerald-500/50 uppercase tracking-widest mb-1">Current_Margin</p>
                                            <p className="text-lg font-black text-emerald-400 cyber-text-glow">+{cat.custom_margin !== null ? cat.custom_margin : 5}%</p>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                setSelectedCategory({
                                                    id: cat.id,
                                                    name: cat.name,
                                                    custom_margin: cat.custom_margin !== null ? cat.custom_margin : 5
                                                });
                                            }}
                                            className="p-3 bg-slate-900 rounded-xl text-gray-500 hover:text-white transition-all border border-white/5 hover:border-emerald-500/50"
                                        >
                                            <Edit3 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {selectedCategory && (
                            <form onSubmit={handleCategoryMarginSubmit} className="mt-8 pt-8 border-t border-white/5 space-y-6">
                                <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Editing_Target</p>
                                    <p className="text-sm font-bold text-white uppercase">{selectedCategory.name}</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">設定加成百分比 Margin (%)</label>
                                    <input 
                                        type="number" 
                                        step="0.1"
                                        required
                                        className="w-full bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-emerald-500/50 transition-all font-bold text-sm text-emerald-400"
                                        value={selectedCategory.custom_margin}
                                        onChange={(e) => setSelectedCategory({...selectedCategory, custom_margin: e.target.value})}
                                    />
                                </div>
                                <div className="flex gap-4">
                                    <button 
                                        type="button"
                                        onClick={() => setSelectedCategory(null)}
                                        className="flex-1 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-gray-500 hover:text-white transition-colors"
                                    >
                                        取消 Cancel
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={submitting}
                                        className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                    >
                                        {submitting ? <Loader2 size={16} className="animate-spin" /> : <Zap size={14} className="fill-current" />}
                                        同步更新 Sync
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MarketPrices;
