import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Copy, Trash2, Maximize2 } from 'lucide-react';

const TerminalLog = () => {
  const [logs, setLogs] = useState(() => {
    const saved = localStorage.getItem('terminal_logs');
    return saved ? JSON.parse(saved) : [];
  });
  const logEndRef = useRef(null);

  useEffect(() => {
    const host = window.location.host.split(':')[0];
    const ws = new WebSocket(`ws://${host}:8000/ws/logs`);
    ws.onmessage = (event) => {
      setLogs((prev) => {
        const newLogs = [...prev, event.data].slice(-500); // Keep last 500 lines
        return newLogs;
      });
    };
    return () => ws.close();
  }, []);

  useEffect(() => {
    localStorage.setItem('terminal_logs', JSON.stringify(logs));
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const clearLogs = () => {
    setLogs([]);
    localStorage.removeItem('terminal_logs');
  };

  return (
    <div className="p-8 h-[calc(100vh-6rem)] flex flex-col space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">系統控制台</h1>
          <p className="text-gray-400">實時監控後端運作日誌與爬蟲指令</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={clearLogs}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-bold transition"
          >
            <Trash2 size={16} />
            清空內容
          </button>
        </div>
      </header>

      <div className="flex-1 bg-black rounded-2xl border border-slate-700 p-6 font-mono text-sm overflow-hidden flex flex-col shadow-2xl">
        <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
            <div className="flex items-center gap-2 text-gray-500">
                <Terminal size={14} />
                <span>system_logs ~ /backend.log</span>
            </div>
            <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
            </div>
        </div>
        
        <div className="flex-1 overflow-auto custom-scrollbar space-y-1">
          {logs.map((log, index) => (
            <div key={index} className="text-gray-300 whitespace-pre-wrap leading-relaxed">
              <span className="text-blue-500 mr-2">➜</span>
              {log}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
};

export default TerminalLog;
