import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Trash2, RotateCcw, PauseCircle, PlayCircle, Zap, Activity, Cpu, Database, Brain, X, Globe, ShieldCheck, Info } from 'lucide-react';
import axios from 'axios';

const StatusBadge = ({ icon: Icon, label, value, color }) => (
  <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-800/40 rounded-lg border border-slate-700/50 hover:bg-slate-800/60 transition shadow-inner">
    <Icon size={12} className={color} />
    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">{label}:</span>
    <span className="text-[11px] font-black tabular-nums">{value}</span>
  </div>
);

const ServiceRow = ({ name, status, icon: Icon, color }) => (
    <div className="flex flex-col gap-2 p-4 bg-slate-900/40 rounded-2xl border border-slate-800/50 group hover:bg-slate-800/60 transition-all duration-500 hover:scale-[1.02] hover:shadow-lg hover:shadow-blue-500/5">
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl bg-slate-800 border border-slate-700/50 ${color} shadow-inner`}>
                {Icon && <Icon size={16} />}
            </div>
            <span className="font-black text-[13px] text-gray-200 tracking-tight">{name}</span>
        </div>
        <div className="flex items-center justify-between mt-1 px-1">
            <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${status === "Online" ? "text-emerald-500" : "text-amber-500"}`}>{status}</span>
            <div className={`w-2 h-2 rounded-full ${status === "Online" ? "bg-emerald-500" : "bg-amber-500"} shadow-[0_0_12px] ${status === "Online" ? "shadow-emerald-500/60" : "shadow-amber-500/60"} animate-pulse`}></div>
        </div>
    </div>
);

const TerminalLog = () => {
  const [logs, setLogs] = useState(() => {
    const saved = localStorage.getItem('terminal_logs');
    return saved ? JSON.parse(saved) : [];
  });
  const [status, setStatus] = useState({
    cpu: "0",
    ram: "0",
    crawler_status: "idle",
    ai_status: "idle",
    is_paused: false,
    db_count: 0
  });
  const [notification, setNotification] = useState(null);
  const logEndRef = useRef(null);

  useEffect(() => {
    const host = window.location.host.split(':')[0];
    
    const logWs = new WebSocket(`ws://${host}:8000/ws/logs`);
    logWs.onmessage = (event) => {
      setLogs((prev) => {
        const newLogs = [...prev, event.data].slice(-500);
        return newLogs;
      });
    };

    const statusWs = new WebSocket(`ws://${host}:8000/ws/status`);
    statusWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setStatus(prev => ({ ...prev, ...data }));
      } catch (e) {
        console.error("Failed to parse status data", e);
      }
    };

    return () => {
      logWs.close();
      statusWs.close();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('terminal_logs', JSON.stringify(logs));
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 5000);
  };

  const clearLogs = () => {
    setLogs([]);
    localStorage.removeItem('terminal_logs');
  };

  const triggerCrawl = () => {
    if (status.is_paused) {
        axios.post('/api/crawl/resume').then(() => {
            axios.post('/api/crawl').then(() => showNotification("🚀 爬蟲任務已重新啟動！"));
        });
    } else {
        axios.post('/api/crawl').then(() => showNotification("🚀 爬蟲任務已啟動！"));
    }
  };

  const triggerUpdate = () => {
    axios.post('/api/update-prices').then(() => showNotification("📈 市場行情同步中..."));
  };

  const triggerAISummarize = () => {
    axios.post('/api/ai/summarize/trigger').then(() => showNotification("🧠 AI 商品總結任務已觸發！"));
  };

  const triggerAIPredict = () => {
    axios.post('/api/ai/predict/trigger').then(() => showNotification("🔮 AI 市價預測任務已啟動！"));
  };

  const stopCrawl = () => {
    axios.post('/api/crawl/pause').then(() => {
      showNotification("🛑 爬蟲任務已取消/停止");
    });
  };

  const triggerCleanup = () => {
    showNotification("🧹 正在執行數據庫深層清理...");
    axios.post('/api/admin/db-cleanup')
      .then(res => {
        const { stats } = res.data;
        showNotification(`✅ 清理完成！合併 ${stats.models_merged} 個型號, ${stats.specs_merged} 個規格, 移除 ${stats.prices_cleaned + stats.products_cleaned} 筆重複數據`);
      })
      .catch(err => {
        console.error(err);
        showNotification("❌ 數據庫清理失敗，請檢查系統日誌");
      });
  };

  return (
    <div className="p-8 h-screen overflow-auto flex flex-col space-y-6 relative cyber-grid bg-slate-950 shadow-inner custom-scrollbar overflow-x-hidden group">
      <div className="scanline"></div>
      
      {/* Premium Background Elements */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/5 rounded-full blur-[120px] animate-float pointer-events-none transition-opacity duration-1000"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/5 rounded-full blur-[150px] animate-float pointer-events-none [animation-delay:-3s] transition-opacity duration-1000"></div>
      
      {/* Toast Notification */}
      {notification && (
          <div className="fixed bottom-10 right-10 z-50 animate-in slide-in-from-right duration-500">
              <div className="bg-slate-900/95 backdrop-blur-2xl border border-cyan-500/30 p-4 rounded-2xl shadow-2xl flex items-center gap-3 max-w-md ring-1 ring-white/10 cyber-border">
                  <div className="bg-cyan-600 p-1.5 rounded-lg shadow-[0_0_10px_rgba(0,243,255,0.5)]">
                      <Zap size={16} className="text-white animate-pulse" />
                  </div>
                  <p className="text-xs font-black text-white tracking-widest uppercase">{notification}</p>
                  <button onClick={() => setNotification(null)} className="text-gray-500 hover:text-white ml-2">
                      <X size={14} />
                  </button>
              </div>
          </div>
      )}

      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-700/30 relative z-10">
        <div>
          <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-white via-cyan-400 to-magenta-500 bg-clip-text text-transparent cyber-text-glow">系統控制中心</h1>
          <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.4em] mt-1 opacity-70">NEURAL TERMINAL // CLOUD_OS v2.4.0</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden lg:flex items-center gap-1.5 mr-2 border-r border-slate-700/50 pr-4">
            <StatusBadge icon={Cpu} label="CPU" value={`${status.cpu}%`} color="text-cyan-400" />
            <StatusBadge icon={Activity} label="RAM" value={`${status.ram}%`} color="text-magenta-400" />
            <StatusBadge icon={Brain} label="AI" value={status.ai_status === "idle" ? "IDLE" : "RUN"} color="text-emerald-400" />
            <StatusBadge icon={Globe} label="CRAWL" value={status.crawler_status === "idle" ? "IDLE" : "LIVE"} color={status.crawler_status === "idle" ? "text-slate-500" : "text-amber-500 animate-pulse-slow"} />
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={triggerAISummarize}
              title="執行 AI 總結"
              className="flex items-center gap-2 px-4 py-2 bg-magenta-500/10 hover:bg-magenta-500/20 border border-magenta-500/30 text-magenta-400 rounded-xl text-[11px] font-bold transition shadow-sm active:scale-95 cyber-button"
            >
              <Brain size={14} />
              <span className="hidden sm:inline">AI 總結</span>
            </button>

            <button 
              onClick={triggerAIPredict}
              title="執行市價預測"
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 rounded-xl text-[11px] font-bold transition shadow-sm active:scale-95 cyber-button"
            >
              <Activity size={14} />
              <span className="hidden sm:inline">AI 預測</span>
            </button>
            
            <div className="w-[1px] h-6 bg-slate-700/50 mx-1" />

            <button 
              onClick={triggerUpdate}
              title="重新同步行情"
              className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700 border border-slate-700/50 rounded-xl text-[11px] font-bold transition shadow-sm active:scale-95 group cyber-button"
            >
              <RotateCcw size={14} className="group-hover:rotate-180 transition-transform duration-500" />
              <span className="hidden sm:inline">同步行情</span>
            </button>
            
            <button 
              onClick={stopCrawl}
              title="取消爬蟲"
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-[11px] font-bold transition shadow-sm active:scale-95 cyber-button"
            >
              <X size={14} />
              <span className="hidden sm:inline">取消爬蟲</span>
            </button>

            <button 
              onClick={triggerCrawl}
              title="開始爬蟲"
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 border border-blue-400/50 rounded-xl text-[11px] font-black transition shadow-xl shadow-blue-600/20 active:scale-95 text-white cyber-button"
            >
              <Zap size={14} className="fill-current" />
              <span className="hidden sm:inline">開始爬蟲</span>
            </button>

            <div className="w-[1px] h-6 bg-slate-700/50 mx-2" />

            <button 
              onClick={clearLogs}
              title="清空日誌"
              className="flex items-center gap-2 px-4 py-2 bg-slate-700/30 hover:bg-slate-700/50 border border-slate-600/20 rounded-xl text-[11px] font-bold transition active:scale-95"
            >
              <Trash2 size={14} />
              <span className="hidden sm:inline">清空</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-[2] min-h-[400px] bg-slate-950 rounded-3xl border border-slate-800 p-6 font-mono text-xs overflow-hidden flex flex-col shadow-2xl ring-1 ring-white/5 relative group cyber-terminal">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
            <div className="flex items-center gap-3 text-gray-500">
                <Terminal size={14} className="text-cyan-500/50" />
                <span className="font-bold tracking-tight uppercase">system_logs // route: /backend.log</span>
            </div>
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-2 py-1 bg-slate-900/50 rounded-lg border border-white/5 shadow-inner">
                    <div className={`w-2 h-2 rounded-full shadow-[0_0_10px] ${status.crawler_status === "idle" ? "bg-slate-600 shadow-slate-600/20" : "bg-cyan-500 shadow-cyan-500/50 animate-pulse"}`}></div>
                    <span className={`text-[9px] font-black uppercase tracking-widest ${status.crawler_status === "idle" ? "text-slate-500" : "text-cyan-500"}`}>
                        {status.crawler_status === "idle" ? "Standby" : "Active"}
                    </span>
                </div>
            </div>
        </div>
        
        <div className="flex-1 overflow-auto custom-scrollbar-terminal space-y-1.5 selection:bg-cyan-500/30 relative">
          {logs.map((log, index) => (
            <div key={index} className="text-gray-400 whitespace-pre-wrap leading-relaxed flex items-start gap-4 group/line border-l border-transparent hover:border-cyan-500/30 pl-2 transition-colors">
              <span className="text-cyan-500/40 select-none font-black text-[10px] mt-0.5">0x{(index + 1).toString(16).padStart(3, '0')}</span>
              <span className="group-hover/line:text-gray-200 transition-colors uppercase tracking-tight text-[11px]">{log}</span>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>

      {/* Integrated Status Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4 pb-8 relative z-10">
          {/* Health & DB Status */}
          <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="bg-slate-900/40 p-6 rounded-3xl border border-slate-800 flex items-center justify-between hover:border-cyan-500/30 transition-all duration-500 shadow-lg group cyber-border">
                    <div>
                        <h3 className="text-gray-500 font-black text-[10px] uppercase tracking-widest mb-2 flex items-center gap-2">
                             <Database size={12} className="text-cyan-500 shadow-[0_0_8px_rgba(0,243,255,0.5)]" />
                             Total Scraped Items
                        </h3>
                        <div className="text-5xl font-black tracking-tighter text-cyan-400 group-hover:scale-110 transition-transform origin-left cyber-text-glow">
                            {(status.db_count || 0).toLocaleString()}
                        </div>
                    </div>
                    <button 
                        onClick={triggerCleanup}
                        className="px-6 py-3 bg-slate-950 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-cyan-500 hover:bg-cyan-500 hover:text-white transition-all shadow-inner active:scale-95 flex items-center gap-2 group/btn"
                    >
                        <RotateCcw size={12} className="group-hover/btn:rotate-180 transition-transform duration-500" />
                        深度清理數據庫
                    </button>
                 </div>
                 <div className="bg-slate-900/40 p-5 rounded-3xl border border-slate-800 cyber-border">
                    <h3 className="text-gray-400 font-black text-[10px] uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Activity size={12} className="text-magenta-500 shadow-[0_0_8px_rgba(255,0,255,0.5)]" />
                        Service Connectivity
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-cyan-500/80 px-3 py-2 bg-slate-950/80 rounded-lg border border-cyan-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(0,243,255,0.8)]"></span>
                            Backend OK
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-magenta-500/80 px-3 py-2 bg-slate-950/80 rounded-lg border border-magenta-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-magenta-500 shadow-[0_0_8px_rgba(255,0,255,0.8)]"></span>
                            DB Engine
                        </div>
                    </div>
                 </div>
              </div>

              <div className="bg-slate-900/40 p-6 rounded-3xl border border-slate-800 cyber-border">
                  <h3 className="text-gray-300 font-black text-xs uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                     <ShieldCheck size={18} className="text-emerald-500" />
                     服務健康監控 // STATUS_SUMMARY
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                     <ServiceRow name="FastAPI" status="Online" icon={Globe} color="text-cyan-400" />
                     <ServiceRow name="SQLite" status="Online" icon={Database} color="text-amber-400" />
                     <ServiceRow name="Ollama" status={status.ai_status !== "error" ? "Online" : "Retry"} icon={Brain} color="text-magenta-400" />
                     <ServiceRow name="Telegram" status="Online" icon={Activity} color="text-purple-400" />
                  </div>
              </div>
          </div>

          {/* System Tips */}
          <div className="bg-blue-600/5 p-8 rounded-3xl border border-blue-500/10 flex flex-col justify-between shadow-2xl">
            <div>
                 <h3 className="font-black text-xs uppercase tracking-widest mb-6 flex items-center gap-2 text-blue-400/80">
                    <Info size={14} />
                    系統操作提示
                 </h3>
                 <ul className="space-y-4 text-[11px] text-gray-500 leading-relaxed font-bold">
                    <li className="flex items-start gap-3">
                        <span className="text-blue-500/50 mt-0.5">•</span>
                        <span>爬蟲將依照進階防封鎖強度自動隨機延遲 (5-90s)。</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="text-blue-500/50 mt-0.5">•</span>
                        <span>遇 403 Forbidden 將自動進入 15 分鐘冷卻避險。</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="text-blue-500/50 mt-0.5">•</span>
                        <span>連刷 502 錯誤達 10 次時，系統將強制暫停搜索。</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="text-blue-500/50 mt-0.5">•</span>
                        <span>獲利潛力大於門檻之商品，將自動 Telegram 推播。</span>
                    </li>
                 </ul>
            </div>
            <div className="mt-8 pt-8 border-t border-blue-500/10 flex items-center justify-between">
                <span className="text-[9px] font-black text-blue-500/50 uppercase tracking-[0.2em]">Build v1.0.5 Stable</span>
                <div className="flex gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500/20"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500/30"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50 animate-pulse"></div>
                </div>
            </div>
          </div>
      </div>
    </div>
  );
};

export default TerminalLog;
