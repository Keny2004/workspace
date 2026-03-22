import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Database, Settings, Activity, Terminal, Tag, Brain, Sparkles } from 'lucide-react';

import Dashboard from './pages/Dashboard';
import Recommendations from './pages/Recommendations';
import DataExplorer from './pages/DataExplorer';
import SettingsPage from './pages/Settings';
import TerminalLog from './pages/TerminalLog';
import MarketPrices from './pages/MarketPrices';
import AIPredictions from './pages/AIPredictions';
import ListingGenerator from './pages/ListingGenerator';

const NavItem = ({ to, icon: Icon, label }) => (
  <Link to={to} className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:bg-cyan-500/10 hover:text-cyan-400 rounded-lg transition-all duration-300 group">
    <Icon size={18} className="group-hover:scale-110 transition-transform" />
    <span className="text-xs font-black uppercase tracking-widest">{label}</span>
  </Link>
);

function App() {
  return (
    <Router>
      <div className="flex min-h-screen w-full bg-slate-950 text-white font-sans overflow-x-hidden cyber-grid relative">
        <div className="scanline"></div>
        
        {/* Sidebar */}
        <aside className="w-64 bg-slate-950/80 backdrop-blur-xl border-r border-cyan-500/20 p-6 shrink-0 hidden md:block relative z-10">
          <div className="text-2xl font-black text-white mb-12 px-2 flex items-center gap-3 tracking-tighter">
            <div className="p-2 bg-cyan-500 rounded-lg shadow-[0_0_15px_rgba(0,243,255,0.6)]">
                <Activity size={24} className="text-white" />
            </div>
            <div className="flex flex-col">
                <span className="cyber-text-glow leading-none">NEURO</span>
                <span className="text-[10px] text-cyan-500/50 uppercase tracking-[0.3em] mt-1 font-black">Crawl Ops</span>
            </div>
          </div>
          <nav className="space-y-4">
            <NavItem to="/" icon={LayoutDashboard} label="行情儀表板" />
            <NavItem to="/market-prices" icon={Tag} label="市場基準價" />
            <NavItem to="/predictions" icon={Brain} label="AI 市價預測" />
            <NavItem to="/recommendations" icon={ShoppingCart} label="獲利推薦" />
            <NavItem to="/listing-generator" icon={Sparkles} label="轉售文案" />
            <NavItem to="/data" icon={Database} label="數據總覽" />
            <NavItem to="/terminal" icon={Terminal} label="系統控制中心" />
            <NavItem to="/settings" icon={Settings} label="設定更新" />
          </nav>
          
          <div className="absolute bottom-10 left-6 right-6 p-4 bg-cyan-500/5 border border-cyan-500/10 rounded-2xl">
              <div className="text-[9px] font-black text-cyan-500/40 uppercase tracking-widest mb-2">System Status</div>
              <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-500 uppercase">Neural Link</span>
                  <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(0,243,255,1)]"></div>
              </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 bg-transparent h-screen overflow-auto relative z-10">
          <header className="h-14 border-b border-cyan-500/10 flex items-center justify-end px-8 bg-slate-950/50 backdrop-blur-md sticky top-0 z-50 text-[10px] font-black text-gray-500 shrink-0 uppercase tracking-widest">
            <span className="text-cyan-500/50">Node: Local_Cluster</span>
            <div className="w-[1px] h-3 bg-slate-800 mx-4"></div>
            {new Date().toLocaleDateString('zh-TW')} // SECURE_TRANS_ID: {Math.random().toString(16).slice(2,8)}
          </header>
          
          <div className="flex-1 overflow-auto bg-slate-900">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/market-prices" element={<MarketPrices />} />
              <Route path="/predictions" element={<AIPredictions />} />
              <Route path="/recommendations" element={<Recommendations />} />
              <Route path="/listing-generator" element={<ListingGenerator />} />
              <Route path="/data" element={<DataExplorer />} />
              <Route path="/terminal" element={<TerminalLog />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  );
}

export default App;
