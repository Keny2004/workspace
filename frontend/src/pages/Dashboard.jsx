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

  const togglePause = () => {
      const endpoint = wsStatus.is_paused ? '/api/crawl/resume' : '/api/crawl/pause';
      axios.post(endpoint);
  };

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
    <div className="p-8 w-full space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">行情儀表板</h1>
          <p className="text-gray-400">追蹤已關注商品的收購行情趨勢</p>
        </div>
        <div className="flex gap-4">
            <div className="flex items-center gap-3 bg-slate-800/80 px-4 py-2 rounded-2xl border border-slate-700/50 shadow-inner">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${wsStatus.is_paused ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : (wsStatus.crawler_status === 'running' ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-600')}`}></div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        {wsStatus.is_paused ? '已暫停' : (wsStatus.crawler_status === 'running' ? '進行中' : '待機')}
                    </span>
                </div>
                <div className="w-[1px] h-4 bg-slate-700/50"></div>
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${wsStatus.ai_status === 'running' ? 'bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-slate-600'}`}></div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">AI: {wsStatus.ai_status === 'running' ? '運算中' : '就緒'}</span>
                </div>
                <div className="w-[1px] h-4 bg-slate-700/50"></div>
                <button 
                    onClick={togglePause}
                    title={wsStatus.is_paused ? "恢復所有爬蟲任務" : "立即暫停所有爬蟲任務"}
                    className={`p-1 rounded-lg transition-colors ${wsStatus.is_paused ? "text-emerald-400 hover:bg-emerald-500/10" : "text-amber-400 hover:bg-amber-500/10"}`}
                >
                    {wsStatus.is_paused ? <PlayCircle size={16} /> : <PauseCircle size={16} />}
                </button>
            </div>
        </div>
      </header>

      {/* Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <select 
          value={selectedCat} 
          onChange={(e) => setSelectedCat(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500"
        >
          <option value="">選擇類別</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select 
          value={selectedModel} 
          onChange={(e) => setSelectedModel(e.target.value)}
          disabled={!selectedCat}
          className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500 disabled:opacity-50"
        >
          <option value="">選擇型號</option>
          {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select 
          value={selectedSpec} 
          onChange={(e) => setSelectedSpec(e.target.value)}
          disabled={!selectedModel}
          className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500 disabled:opacity-50"
        >
          <option value="">選擇規格</option>
          {specs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-slate-800 p-6 rounded-2xl border border-slate-700 h-[450px]">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <TrendingUp className="text-blue-400" size={20} />
            價格趨勢演變
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
        <div className="space-y-6">
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
            <p className="text-sm text-gray-400 mb-1">平均收購價</p>
            <div className="text-3xl font-bold text-blue-400">NT$ {summary.avg.toLocaleString()}</div>
          </div>
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
            <p className="text-sm text-gray-400 mb-1">歷史紀錄筆數</p>
            <div className="text-3xl font-bold">{summary.count} 次更新</div>
          </div>
          <div className="bg-blue-600/10 p-6 rounded-2xl border border-blue-500/20 text-blue-400">
            <p className="text-sm font-bold flex items-center gap-2 mb-2">
              <MessageSquare size={16} />
              市場小助手
            </p>
            <p className="text-sm leading-relaxed">
              根據近期更新，此規格行情相對穩定。推薦於獲利推薦區塊關注是否有利差機會。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
