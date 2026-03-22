import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Cpu, RotateCcw, Database, Brain, CheckCircle, Activity, Globe, ShieldCheck, Zap, Info, X, PauseCircle, PlayCircle } from 'lucide-react';

const StatusCard = ({ icon: Icon, label, value, color, subValue }) => (
  <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700/50 backdrop-blur-md flex flex-col justify-between h-40 group hover:border-blue-500/50 transition duration-500 shadow-xl">
    <div className="flex justify-between items-start">
        <div className={`${color} p-3 rounded-2xl shadow-lg ring-4 ring-slate-800`}>
            {Icon && <Icon size={20} className="text-white" />}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-slate-900/50 px-2 py-1 rounded-full border border-slate-700/50">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
            Live
        </div>
    </div>
    <div>
      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-3xl font-black tracking-tight">{value || '0%'}</p>
        <p className="text-[10px] text-gray-600 font-bold">{subValue}</p>
      </div>
    </div>
  </div>
);

const ServiceRow = ({ name, status, icon: Icon, color }) => (
    <div className="flex items-center justify-between p-4 bg-slate-900/30 rounded-2xl border border-slate-800/50 group hover:bg-slate-800/50 transition duration-300">
        <div className="flex items-center gap-4">
            <div className={`p-2 rounded-xl bg-slate-800 border border-slate-700 ${color}`}>
                {Icon && <Icon size={18} />}
            </div>
            <span className="font-bold text-sm text-gray-300">{name}</span>
        </div>
        <div className="flex items-center gap-2">
            <span className={`text-[10px] font-black uppercase tracking-tighter ${status === "Online" ? "text-emerald-400" : "text-amber-400"}`}>{status}</span>
            <div className={`w-2 h-2 rounded-full ${status === "Online" ? "bg-emerald-500" : "bg-amber-500"} shadow-[0_0_8px_rgba(16,185,129,0.5)]`}></div>
        </div>
    </div>
);

const SystemStatus = () => {
  const [status, setStatus] = useState({
    cpu: "0",
    ram: "0",
    crawler_status: "idle",
    ai_status: "idle",
    is_paused: false,
    db_count: 0
  });

  const [notification, setNotification] = useState(null);

  useEffect(() => {
    let ws;
    try {
        const host = window.location.host.split(':')[0];
        ws = new WebSocket(`ws://${host}:8000/ws/status`);
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                setStatus(prev => ({ ...prev, ...data }));
            } catch (e) {
                console.error("Failed to parse status data", e);
            }
        };
        ws.onerror = (err) => console.error("WebSocket error", err);
    } catch (e) {
        console.error("WebSocket setup failed", e);
    }
    
    return () => {
        if (ws) ws.close();
    };
  }, []);

  const showNotification = (msg) => {
      setNotification(msg);
      // Auto dismiss after 8 seconds
      setTimeout(() => setNotification(null), 8000);
  };

  const triggerCrawl = () => {
    axios.post('/api/crawl').then(() => showNotification("🚀 深度爬取任務已啟動！系統正於後端開始檢索商品..."));
  };

  const triggerUpdate = () => {
    axios.post('/api/update-prices').then(() => showNotification("📈 市場行情同步中！正在更新各規格基準收購價..."));
  };

  const togglePause = () => {
    const endpoint = status.is_paused ? '/api/crawl/resume' : '/api/crawl/pause';
    axios.post(endpoint).then(() => {
        showNotification(status.is_paused ? "▶️ 爬蟲已恢復運作" : "⏸️ 爬蟲已暫停");
    });
  };

  return (
    <div className="p-8 w-full mx-auto space-y-10 min-h-full relative overflow-hidden">
      {/* Toast Notification */}
      {notification && (
          <div className="fixed bottom-10 right-10 z-50 animate-in slide-in-from-right duration-500">
              <div className="bg-slate-800/90 backdrop-blur-xl border border-blue-500/30 p-5 rounded-2xl shadow-2xl flex items-center gap-4 max-w-md ring-1 ring-white/10">
                  <div className="bg-blue-600 p-2 rounded-xl">
                      <Zap size={20} className="text-white animate-pulse" />
                  </div>
                  <div className="flex-1">
                      <p className="text-sm font-bold text-white leading-snug">{notification}</p>
                      <p className="text-[10px] text-blue-400 font-bold mt-1 uppercase tracking-widest">System Broadcast</p>
                  </div>
                  <button onClick={() => setNotification(null)} className="text-gray-500 hover:text-white transition">
                      <X size={18} />
                  </button>
              </div>
          </div>
      )}

      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black mb-2 tracking-tighter">系統運行概況</h1>
          <p className="text-gray-500 font-medium">即時監控全局服務狀態與資源分配</p>
        </div>
        <div className="flex gap-4">
            <button onClick={triggerUpdate} className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl font-bold transition text-xs shadow-lg shadow-black/20">
                <RotateCcw size={14} />
                強制重新同步行情
            </button>
            <button onClick={togglePause} className={`flex items-center gap-2 px-6 py-2.5 border rounded-2xl font-bold transition text-xs shadow-lg ${status.is_paused ? "bg-emerald-600/20 border-emerald-500/50 text-emerald-400 hover:bg-emerald-600/30" : "bg-amber-600/20 border-amber-500/50 text-amber-400 hover:bg-amber-600/30"}`}>
                {status.is_paused ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
                {status.is_paused ? "恢復爬蟲" : "暫停爬蟲"}
            </button>
            <button onClick={triggerCrawl} className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:scale-105 active:scale-95 border border-blue-500 rounded-2xl font-bold transition text-xs shadow-xl shadow-blue-500/20">
                <Zap size={14} className="fill-current" />
                立即啟動深度掃描
            </button>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatusCard icon={Cpu} label="運算負載" value={`${status.cpu}%`} subValue="CPU USAGE" color="bg-blue-600 shadow-blue-500/50" />
            <StatusCard icon={RotateCcw} label="記憶體資源" value={`${status.ram}%`} subValue="RAM CONSUMPTION" color="bg-purple-600 shadow-purple-500/50" />
            <StatusCard icon={Activity} label="任務調度" value={status.crawler_status === "idle" ? "SLEEP" : "CRAWLING"} subValue="CRAWLER ENGINE" color="bg-orange-600 shadow-orange-500/50" />
            <StatusCard icon={Brain} label="神經網絡" value={status.ai_status === "idle" ? "READY" : "SUMMARIZING"} subValue="AI INFERENCE" color="bg-emerald-600 shadow-emerald-500/50" />
        </div>

        <div className="lg:col-span-8 flex flex-col gap-6">
             <div className="bg-slate-800/30 p-8 rounded-3xl border border-slate-700/50 flex items-center justify-between">
                <div>
                    <h3 className="text-gray-500 font-black text-xs uppercase tracking-widest mb-2">Total Scraped Items</h3>
                    <div className="text-6xl font-black tracking-tighter text-blue-400">
                        {(status.db_count || 0).toLocaleString()}
                    </div>
                </div>
                <div className="hidden md:block">
                    <Database size={80} className="text-slate-700/30" />
                </div>
             </div>

             <div className="bg-slate-800/30 p-8 rounded-3xl border border-slate-700/50">
                 <h3 className="text-gray-200 font-bold mb-6 flex items-center gap-3">
                    <ShieldCheck size={20} className="text-blue-400" />
                    服務健康監控 (Service Health)
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ServiceRow name="FastAPI Backend" status="Online" icon={Globe} color="text-blue-400" />
                    <ServiceRow name="SQLite Engine" status="Online" icon={Database} color="text-amber-400" />
                    <ServiceRow name="Ollama API" status={status.ai_status !== "error" ? "Online" : "Retry"} icon={Brain} color="text-emerald-400" />
                    <ServiceRow name="Telegram Gateway" status="Online" icon={Activity} color="text-purple-400" />
                 </div>
             </div>
        </div>

        <div className="lg:col-span-4 bg-blue-600/5 p-8 rounded-3xl border border-blue-500/10 flex flex-col justify-between">
            <div>
                 <h3 className="font-bold mb-4 flex items-center gap-2">
                    <Info size={18} />
                    系統提示
                 </h3>
                 <ul className="space-y-4 text-sm text-gray-400 leading-relaxed font-medium">
                    <li>• 系統每 6 小時自動執行一次深度掃描。</li>
                    <li>• AI 摘要僅針對「高獲利潛力」商品生成。</li>
                    <li>• 若 CPU 負載超過 90%，請檢查是否開啟過分離頁。</li>
                    <li>• 建議定期匯出 CSV 備份重要行情數據。</li>
                 </ul>
            </div>
            <div className="mt-8 pt-8 border-t border-blue-500/10">
                <span className="text-[10px] font-black text-blue-500/50 uppercase tracking-widest">Build v1.0.4 Stable</span>
            </div>
        </div>
      </main>
    </div>
  );
};

export default SystemStatus;
