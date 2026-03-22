import React, { useState, useEffect } from 'react';
import axios from 'axios';

import { ArrowUpRight, TrendingUp, Package, Activity, RefreshCcw, Zap, Brain, MessageSquare, AlertCircle, Layers, Info, User } from 'lucide-react';

const Dashboard = () => {
  const [categories, setCategories] = useState([]);
  const [models, setModels] = useState([]);
  const [specs, setSpecs] = useState([]);
  const [latestHits, setLatestHits] = useState([]);
  
  const [selectedCat, setSelectedCat] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedSpec, setSelectedSpec] = useState("");
  
  const [chartData, setChartData] = useState([]);
  const [summary, setSummary] = useState({ avg: 0, count: 0 });
  const [stats, setStats] = useState({ 
    today: { scanned: 0, filtered: 0, potential: 0 }, 
    overall: { scanned: 0, potential: 0 } 
  });
  
  const [wsStatus, setWsStatus] = useState({
    crawler_status: "idle",
    ai_status: "idle",
    is_paused: false
  });

  useEffect(() => {
    fetchStats();
    fetchLatestHits();
    const timer = setInterval(() => {
        fetchStats();
        fetchLatestHits();
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const fetchStats = () => axios.get('/api/stats').then(res => setStats(res.data));
  const fetchLatestHits = () => {
    axios.get('/api/products').then(res => {
        const potential = res.data.filter(p => p.is_potential_profit).slice(0, 5);
        setLatestHits(potential);
    });
  };

  useEffect(() => {
    let ws;
    try {
        const host = window.location.host.split(':')[0];
        ws = new WebSocket(`ws://${host}:8000/ws/status`);
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                setWsStatus({ crawler_status: data.crawler_status, ai_status: data.ai_status, is_paused: data.is_paused });
            } catch (e) { console.error(e); }
        };
    } catch (e) {}
    return () => ws && ws.close();
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
          <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-white via-cyan-400 to-magenta-500 bg-clip-text text-transparent cyber-text-glow italic uppercase">系統概覽</h1>
          <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2 italic opacity-60">System Resilience // Cognitive Overview</p>
        </div>
        <div className="flex gap-4">
            <button 
                onClick={() => {
                  axios.post('/api/ai/summarize/trigger');
                  setWsStatus(prev => ({...prev, ai_status: 'running'}));
                }}
                className="flex items-center gap-2 bg-magenta-600/20 text-magenta-500 border border-magenta-500/50 hover:bg-magenta-600 hover:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(255,0,255,0.2)] active:scale-95 cyber-button"
            >
                <Brain size={14} />
                強制執行 AI 總結
            </button>
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

      {/* Stats QuickView */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative z-10">
        <div className="bg-slate-900/40 p-6 rounded-3xl border border-slate-800 cyber-border group overflow-hidden relative">
            <Activity className="absolute -right-4 -bottom-4 text-cyan-500 opacity-5 w-24 h-24 rotate-12 transition-transform group-hover:scale-110" />
            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1">今日掃描 // SCAN_TODAY</p>
            <div className="text-3xl font-black text-white px-1 tracking-tighter">{stats?.today?.scanned || 0} <span className="text-xs text-slate-600">ITEMS</span></div>
        </div>
        <div className="bg-slate-900/40 p-6 rounded-3xl border border-slate-800 cyber-border group overflow-hidden relative">
            <RefreshCcw className="absolute -right-4 -bottom-4 text-amber-500 opacity-5 w-24 h-24 rotate-12 transition-transform group-hover:scale-110" />
            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1">精確過濾 // FILTER_PASS</p>
            <div className="text-3xl font-black text-white px-1 tracking-tighter text-amber-500/80">{stats?.today?.filtered || 0} <span className="text-xs text-slate-600">UNMATCHED</span></div>
        </div>
        <div className="bg-slate-900/40 p-6 rounded-3xl border border-slate-800 cyber-border group overflow-hidden relative">
            <Zap className="absolute -right-4 -bottom-4 text-magenta-500 opacity-5 w-24 h-24 rotate-12 transition-transform group-hover:scale-110" />
            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1">今日發現 // POTENTIAL_HIT</p>
            <div className="text-3xl font-black text-white px-1 tracking-tighter text-magenta-500 cyber-text-glow">{stats?.today?.potential || 0} <span className="text-xs text-slate-600">PROFIT_HITS</span></div>
        </div>
        <div className="bg-slate-950/60 p-6 rounded-3xl border border-cyan-500/20 cyber-border group overflow-hidden relative shadow-inner">
            <Package className="absolute -right-4 -bottom-4 text-cyan-500 opacity-10 w-24 h-24 rotate-12 transition-transform group-hover:scale-110" />
            <p className="text-[9px] font-black text-cyan-500/50 uppercase tracking-widest mb-2 px-1">全域存檔 // GLOBAL_ARCHIVE</p>
            <div className="text-3xl font-black text-cyan-400 px-1 tracking-tighter">{stats?.overall?.scanned || 0} <span className="text-xs text-slate-600">NODES</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
        <div className="lg:col-span-2 space-y-8">
            {/* Latest Hits Section */}
            <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800 cyber-border relative overflow-hidden group backdrop-blur-md">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-magenta-500/10 rounded-full blur-3xl group-hover:bg-magenta-500/20 transition-all"></div>
                <h3 className="text-xs font-black uppercase tracking-[0.3em] mb-6 flex items-center gap-3 text-magenta-400">
                    <Zap size={16} className="cyber-text-glow shadow-[0_0_10px_rgba(255,0,255,0.5)]" />
                    LATEST_POTENTIAL_DISCOVERIES // 近期高潛力項目
                </h3>
                <div className="space-y-4">
                    {latestHits.map(hit => (
                        <div key={hit.id} className="flex items-center justify-between p-4 bg-slate-950/50 rounded-2xl border border-white/5 hover:border-magenta-500/30 transition-all group/item hover:bg-slate-950/80">
                            <div className="flex-1 min-w-0 mr-4">
                                <div className="text-[9px] font-black text-magenta-500/50 uppercase tracking-widest mb-1">{hit.platform} // ID_{hit.id}</div>
                                <h4 className="text-xs font-bold text-gray-300 truncate tracking-tight uppercase group-hover/item:text-white transition-colors">{hit.title}</h4>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-black text-white">NT$ {hit.price?.toLocaleString() || '0'}</div>
                                <div className="text-[10px] font-black text-emerald-500 cyber-text-glow">+{hit.profit_margin_percent?.toFixed(1) || '0'}% ROI</div>
                            </div>
                        </div>
                    ))}
                    {latestHits.length === 0 && (
                        <div className="py-12 flex flex-col items-center justify-center opacity-20">
                            {wsStatus.crawler_status === 'running' ? (
                                <>
                                    <RefreshCcw size={32} className="animate-spin mb-4" />
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em]">Neural Scan in Progress...</p>
                                </>
                            ) : (
                                <>
                                    <Zap size={32} className="mb-4 opacity-70" />
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em]">No Potential Hits Yet</p>
                                    <p className="text-[8px] font-black mt-2 opacity-50 uppercase tracking-widest">Wait for schedule or trigger manually</p>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>


        </div>

        <div className="space-y-8">
            {/* Quick Metrics */}
            <div className="bg-slate-900/40 p-8 rounded-3xl border border-slate-800 cyber-border group hover:bg-slate-900/60 transition-all">
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-3">平均基準價 // AVG_QUOTE</p>
                <div className="text-4xl font-black text-cyan-400 cyber-text-glow">NT$ {summary.avg?.toLocaleString() || '0'}</div>
            </div>
            <div className="bg-slate-900/40 p-8 rounded-3xl border border-slate-800 cyber-border group hover:bg-slate-900/60 transition-all">
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-3">紀錄筆數 // LOG_ENTRIES</p>
                <div className="text-4xl font-black text-white group-hover:text-magenta-500 transition-colors uppercase tracking-tighter">{summary.count} NODES</div>
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
                    系統運行正常。近期爬蟲過濾率為 {((stats?.today?.filtered / (stats?.today?.scanned || 1)) * 100).toFixed(1)}%。
                    偵測到潛在利潤項目 {stats?.today?.potential || 0} 筆，建議前往獲利推薦區進行深度分析。
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
