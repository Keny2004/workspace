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
        <div className="p-8 w-full space-y-8">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">數據總覽</h1>
                    <p className="text-gray-400">管理並篩選所有已爬取的商品數據</p>
                </div>
                <button 
                  onClick={exportCSV}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-bold transition"
                >
                    <Download size={18} />
                    匯出 CSV
                </button>
            </header>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center bg-slate-800 p-6 rounded-2xl border border-slate-700">
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                    <input 
                        type="text" 
                        placeholder="搜尋商品標題..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-12 pr-4 py-3 outline-none focus:border-blue-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select 
                  className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500"
                  value={filterPlatform}
                  onChange={(e) => setFilterPlatform(e.target.value)}
                >
                    <option value="All">所有平台</option>
                    <option value="Carousell">Carousell</option>
                </select>
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus-within:border-blue-500 hover:border-slate-500 transition">
                    <span className="text-gray-400 text-sm font-bold">最低利潤率:</span>
                    <input 
                        type="number" 
                        className="w-16 bg-transparent outline-none text-right font-bold text-white focus:text-blue-400"
                        value={minProfit}
                        onChange={(e) => setMinProfit(Number(e.target.value))}
                    />
                    <span className="text-gray-400 font-bold">%</span>
                </div>
                <button className="p-3 bg-slate-900 border border-slate-700 rounded-xl hover:border-gray-500 transition">
                    <Filter size={18} />
                </button>
            </div>

            {/* Table */}
            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-900/50 border-b border-slate-700">
                            <th className="px-6 py-4 text-sm font-bold text-gray-400">平台</th>
                            <th className="px-6 py-4 text-sm font-bold text-gray-400">商品標題</th>
                            <th className="px-6 py-4 text-sm font-bold text-gray-400">標價 NT$</th>
                            <th className="px-6 py-4 text-sm font-bold text-gray-400">預估利潤</th>
                            <th className="px-6 py-4 text-sm font-bold text-gray-400">利潤率</th>
                            <th className="px-6 py-4 text-sm font-bold text-gray-400">獲利推薦</th>
                            <th className="px-6 py-4 text-sm font-bold text-gray-400 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {filteredProducts.map(p => (
                            <tr key={p.id} className="hover:bg-slate-700/30 transition">
                                <td className="px-6 py-4">
                                    <span className="px-2 py-1 bg-blue-600/10 text-blue-400 text-[10px] font-bold rounded uppercase">
                                        {p.platform}
                                    </span>
                                </td>
                                <td className="px-6 py-4 font-medium max-w-md truncate">{p.title}</td>
                                <td className="px-6 py-4 font-black">NT$ {p.price.toLocaleString()}</td>
                                <td className="px-6 py-4 font-black text-emerald-400">{p.estimated_profit > 0 ? `+ NT$ ${p.estimated_profit.toLocaleString()}` : '-'}</td>
                                <td className="px-6 py-4 font-bold text-blue-400">{p.profit_margin_percent > 0 ? `${p.profit_margin_percent}%` : '-'}</td>
                                <td className="px-6 py-4">
                                    {p.is_potential_profit ? (
                                        <span className="flex items-center gap-1 text-emerald-400 text-sm font-bold">
                                            <ArrowUpDown size={14} /> 是
                                        </span>
                                    ) : (
                                        <span className="text-gray-500 text-sm">否</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <a 
                                      href={p.url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-2 text-blue-400 hover:underline text-sm font-bold"
                                    >
                                        開啟
                                        <ChevronRight size={14} />
                                    </a>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                
                {filteredProducts.length === 0 && (
                    <div className="py-20 flex flex-col items-center justify-center text-gray-500">
                        <Monitor size={48} className="mb-4 opacity-10" />
                        <p>未找到符合篩選條件的商品</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DataExplorer;
