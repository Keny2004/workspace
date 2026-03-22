import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Filter, Download, ArrowUpDown, ChevronLeft, ChevronRight, Monitor } from 'lucide-react';

const DataExplorer = () => {
    const [products, setProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterPlatform, setFilterPlatform] = useState("All");
    const [minProfit, setMinProfit] = useState(0);
    
    useEffect(() => {
        axios.get('/api/products').then(res => setProducts(res.data));
    }, []);

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesPlatform = filterPlatform === "All" || p.platform === filterPlatform;
        const matchesProfit = p.profit_margin_percent >= minProfit;
        return matchesSearch && matchesPlatform && matchesProfit;
    });

    const exportCSV = () => {
        const headers = ["ID", "平台", "標題", "價格", "預估利潤", "利潤率 (%)", "獲利標記", "網址"];
        const rows = filteredProducts.map(p => [
            p.id, p.platform, p.title, p.price, 
            p.estimated_profit > 0 ? p.estimated_profit : 0, 
            p.profit_margin_percent > 0 ? p.profit_margin_percent : 0, 
            p.is_potential_profit ? "是" : "否", p.url
        ]);
        let csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `3c_monitor_export_${new Date().toLocaleDateString()}.csv`);
        document.body.appendChild(link);
        link.click();
    };

    return (
        <div className="p-8 w-full space-y-8 relative cyber-grid min-h-screen">
            <div className="scanline"></div>
            
            <header className="flex justify-between items-center relative z-10">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-white via-cyan-400 to-magenta-500 bg-clip-text text-transparent cyber-text-glow uppercase italic">數據總覽</h1>
                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2 opacity-70">Neural Archive // Big_Data_Explorer</p>
                </div>
                <button 
                  onClick={exportCSV}
                  className="flex items-center gap-3 px-8 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-xl shadow-cyan-600/30 text-white cyber-button active:scale-95"
                >
                    <Download size={16} />
                    EXPORT_CSV
                </button>
            </header>

            {/* Filters */}
            <div className="flex flex-wrap gap-6 items-center bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800 backdrop-blur-md relative z-10 cyber-border">
                <div className="flex-1 relative group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-cyan-500/50 group-focus-within:text-cyan-400 transition-colors" size={18} />
                    <input 
                        type="text" 
                        placeholder="SEARCH_ENTITY_TITLE..."
                        className="w-full bg-slate-950 border border-white/10 rounded-2xl pl-14 pr-6 py-4 outline-none focus:border-cyan-500/50 transition-all font-mono text-cyan-400 text-xs"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select 
                  className="bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-cyan-500/50 transition-all font-black text-[10px] uppercase tracking-widest text-cyan-500/70 appearance-none shadow-inner min-w-[150px]"
                  value={filterPlatform}
                  onChange={(e) => setFilterPlatform(e.target.value)}
                >
                    <option value="All">-- ALL_NODES --</option>
                    <option value="Carousell">CAROUSELL</option>
                </select>
                <div className="flex items-center gap-3 bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 focus-within:border-cyan-500/50 transition-all group">
                    <span className="text-gray-600 text-[10px] font-black uppercase tracking-widest px-1">MIN_PROFIT_ROI:</span>
                    <input 
                        type="number" 
                        className="w-16 bg-transparent outline-none text-right font-mono font-black text-cyan-400 text-sm"
                        value={minProfit}
                        onChange={(e) => setMinProfit(Number(e.target.value))}
                    />
                    <span className="text-cyan-500/30 font-black font-mono text-xs">%</span>
                </div>
                <button className="p-4 bg-slate-950 border border-white/10 rounded-2xl hover:border-cyan-500/50 hover:text-cyan-400 transition-all duration-500">
                    <Filter size={18} />
                </button>
            </div>

            {/* Table */}
            <div className="bg-slate-900/40 rounded-[2.5rem] border border-slate-800 overflow-hidden relative z-10 cyber-border shadow-2xl backdrop-blur-md">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-950 border-b border-white/5">
                                <th className="px-8 py-6 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Node_Platform</th>
                                <th className="px-8 py-6 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Entity_Identity</th>
                                <th className="px-8 py-6 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Quote_NT$</th>
                                <th className="px-8 py-6 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Est_Profit</th>
                                <th className="px-8 py-6 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">ROI_Index</th>
                                <th className="px-8 py-6 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Recommendation</th>
                                <th className="px-8 py-6 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] text-right">Operations</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredProducts.map(p => (
                                <tr key={p.id} className="hover:bg-cyan-500/5 transition-colors group">
                                    <td className="px-8 py-5">
                                        <span className="px-3 py-1 bg-cyan-500/10 text-cyan-400 text-[9px] font-black rounded-md border border-cyan-500/20 uppercase tracking-widest">
                                            {p.platform}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5 font-bold text-gray-300 text-xs max-w-md truncate group-hover:text-white transition-colors uppercase tracking-tight">{p.title}</td>
                                    <td className="px-8 py-5 font-mono font-black text-white text-sm">NT$ {p.price.toLocaleString()}</td>
                                    <td className="px-8 py-5 font-mono font-black text-magenta-400 text-sm cyber-text-glow">{p.estimated_profit > 0 ? `+ NT$ ${p.estimated_profit.toLocaleString()}` : '-'}</td>
                                    <td className="px-8 py-5 font-mono font-black text-cyan-400 text-sm">{p.profit_margin_percent > 0 ? `${p.profit_margin_percent}%` : '-'}</td>
                                    <td className="px-8 py-5">
                                        {p.is_potential_profit ? (
                                            <span className="flex items-center gap-2 text-magenta-400 text-[10px] font-black uppercase tracking-widest cyber-text-glow animate-pulse">
                                                <ArrowUpDown size={14} /> POTENTIAL_ROI
                                            </span>
                                        ) : (
                                            <span className="text-gray-700 text-[10px] font-black uppercase tracking-widest">NONE</span>
                                        )}
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <a 
                                          href={p.url} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-2 text-cyan-500 hover:text-cyan-300 text-[10px] font-black uppercase tracking-[0.2em] transition-all group/link"
                                        >
                                            OPEN_SOURCE
                                            <ChevronRight size={14} className="group-hover/link:translate-x-1 transition-transform" />
                                        </a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                
                {filteredProducts.length === 0 && (
                    <div className="py-32 flex flex-col items-center justify-center text-gray-700 font-black italic text-[10px] uppercase opacity-20 tracking-[0.5em] gap-6">
                        <Monitor size={80} className="animate-float" />
                        <span>No_Match_Found // Re-Index_Filters</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DataExplorer;
