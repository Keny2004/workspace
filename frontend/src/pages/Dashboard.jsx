import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowUpRight, ArrowDownRight, TrendingUp, DollarSign, Package, AlertCircle, RefreshCcw, Zap, PauseCircle, PlayCircle, MessageSquare, Activity, Brain } from 'lucide-react';

const Dashboard = () => {
  const [categories, setCategories] = useState([]);
  const [models, setModels] = useState([]);
  const [specs, setSpecs] = useState([]);
  
  const [selectedCat, setSelectedCat] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedSpec, setSelectedSpec] = useState("");
  
  const [chartData, setChartData] = useState([]);
  const [summary, setSummary] = useState({ avg: 0, count: 0 });
  
  const [wsStatus, setWsStatus] = useState({
    crawler_status: "idle",
    ai_status: "idle",
    is_paused: false
  });

  useEffect(() => {
    let ws;
    try {
        const host = window.location.host.split(':')[0];
        ws = new WebSocket(`ws://${host}:8000/ws/status`);
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                setWsStatus({ crawler_status: data.crawler_status, ai_status: data.ai_status, is_paused: data.is_paused });
            } catch (e) {
                console.error("Failed to parse status data", e);
            }
        };
    } catch (e) {}
    
    return () => {
        if (ws) ws.close();
    };
  }, []);


  useEffect(() => {
    axios.get('/api/categories').then(res => setCategories(res.data));
  }, []);

  useEffect(() => {
    if (selectedCat) {
      axios.get(`/api/models?category_id=${selectedCat}`).then(res => setModels(res.data));
      setSelectedModel("");
      setSelectedSpec("");
    }
  }, [selectedCat]);

  useEffect(() => {
    if (selectedModel) {
      axios.get(`/api/specifications?model_id=${selectedModel}`).then(res => setSpecs(res.data));
      setSelectedSpec("");
    }
  }, [selectedModel]);

  useEffect(() => {
    if (selectedSpec) {
      axios.get(`/api/market-prices?spec_id=${selectedSpec}`).then(res => {
        const formatted = res.data.map(d => ({
          date: new Date(d.updated_at).toLocaleDateString(),
          price: d.price
        }));
        setChartData(formatted);
        
        if (formatted.length > 0) {
          const avg = formatted.reduce((acc, curr) => acc + curr.price, 0) / formatted.length;
          setSummary({ avg: Math.round(avg), count: formatted.length });
        }
      });
    }
  }, [selectedSpec]);

  return (
    <div className="p-8 w-full space-y-8 relative cyber-grid min-h-screen overflow-x-hidden">
      <div className="scanline"></div>
      
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
        <div>
          <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-white via-cyan-400 to-magenta-500 bg-clip-text text-transparent cyber-text-glow">行情儀表板</h1>
          <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2">Market Volatility Index // Live Feed</p>
        </div>
        <div className="flex gap-4">
            <div className="flex items-center gap-3 bg-slate-900/80 backdrop-blur-xl px-5 py-2.5 rounded-2xl border border-cyan-500/20 shadow-[0_0_15px_rgba(0,243,255,0.1)] cyber-border">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full shadow-[0_0_10px] ${wsStatus.is_paused ? 'bg-amber-500 shadow-amber-500/50' : (wsStatus.crawler_status === 'running' ? 'bg-cyan-500 animate-pulse shadow-cyan-500/80' : 'bg-slate-700')}`}></div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${wsStatus.is_paused ? 'text-amber-500' : (wsStatus.crawler_status === 'running' ? 'text-cyan-500' : 'text-gray-500')}`}>
                        {wsStatus.is_paused ? 'PAUSED' : (wsStatus.crawler_status === 'running' ? 'CRAWLING' : 'STANDBY')}
                    </span>
                </div>
                <div className="w-[1px] h-4 bg-slate-800 mx-2"></div>
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full shadow-[0_0_10px] ${wsStatus.ai_status === 'running' ? 'bg-magenta-500 animate-pulse shadow-magenta-500/80' : 'bg-slate-700'}`}></div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${wsStatus.ai_status === 'running' ? 'text-magenta-500' : 'text-gray-500'}`}>
                        AI: {wsStatus.ai_status === 'running' ? 'NEURO_LINK' : 'READY'}
                    </span>
                </div>
            </div>
        </div>
      </header>

      {/* Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
        <select 
          value={selectedCat} 
          onChange={(e) => setSelectedCat(e.target.value)}
          className="bg-slate-900/50 border border-cyan-500/20 rounded-xl px-5 py-3.5 outline-none focus:border-cyan-500/50 transition-all font-black text-[11px] uppercase tracking-widest text-cyan-500/70 shadow-inner appearance-none"
        >
          <option value="">-- SELECT_CATEGORY --</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select 
          value={selectedModel} 
          onChange={(e) => setSelectedModel(e.target.value)}
          disabled={!selectedCat}
          className="bg-slate-900/50 border border-cyan-500/20 rounded-xl px-5 py-3.5 outline-none focus:border-cyan-500/50 transition-all font-black text-[11px] uppercase tracking-widest text-cyan-500/70 shadow-inner appearance-none disabled:opacity-20"
        >
          <option value="">-- SELECT_MODEL --</option>
          {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select 
          value={selectedSpec} 
          onChange={(e) => setSelectedSpec(e.target.value)}
          disabled={!selectedModel}
          className="bg-slate-900/50 border border-cyan-500/20 rounded-xl px-5 py-3.5 outline-none focus:border-cyan-500/50 transition-all font-black text-[11px] uppercase tracking-widest text-cyan-500/70 shadow-inner appearance-none disabled:opacity-20"
        >
          <option value="">-- SELECT_SPEC --</option>
          {specs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-slate-900/40 p-8 rounded-3xl border border-slate-800 h-[450px] relative z-10 cyber-border">
          <h3 className="text-xs font-black uppercase tracking-[0.3em] mb-8 flex items-center gap-3 text-cyan-500/80">
            <TrendingUp size={16} className="cyber-text-glow" />
            Market Volatility Trend // PRICE_DELTA_INDEX
          </h3>
          <div className="h-[350px] w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                    itemStyle={{ color: '#60a5fa' }}
                  />
                  <Line type="monotone" dataKey="price" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-500">
                <AlertCircle size={48} className="mb-4 opacity-20" />
                <p>請先選擇分類與規格以顯示行情內容</p>
              </div>
            )}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="space-y-6 relative z-10">
          <div className="bg-slate-900/40 p-8 rounded-3xl border border-slate-800 cyber-border group">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">平均收購價 // AVG_QUOTE</p>
            <div className="text-4xl font-black text-cyan-400 cyber-text-glow group-hover:scale-110 transition-transform origin-left">NT$ {summary.avg.toLocaleString()}</div>
          </div>
          <div className="bg-slate-900/40 p-8 rounded-3xl border border-slate-800 cyber-border group">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">歷史紀錄筆數 // LOG_ENTRY_COUNT</p>
            <div className="text-4xl font-black text-white group-hover:text-magenta-500 transition-colors uppercase tracking-tighter">{summary.count} ENTRIES</div>
          </div>
          <div className="bg-cyan-500/5 p-8 rounded-3xl border border-cyan-500/20 text-cyan-400 cyber-border relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-30 transition-opacity">
                <Brain size={48} className="text-cyan-500" />
            </div>
            <p className="text-[10px] font-black flex items-center gap-2 mb-4 uppercase tracking-[0.2em]">
              <MessageSquare size={14} className="fill-current" />
              Neural Assistant // INSIGHT
            </p>
            <p className="text-[11px] font-bold leading-relaxed text-cyan-300/80 uppercase tracking-tight">
              根據近期更新，此規格行情相對穩定。推薦於獲利推薦區塊關注是否有利差機會。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
