import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Database, Settings, Activity, Terminal, Tag } from 'lucide-react';

import Dashboard from './pages/Dashboard';
import Recommendations from './pages/Recommendations';
import DataExplorer from './pages/DataExplorer';
import SettingsPage from './pages/Settings';
import SystemStatus from './pages/SystemStatus';
import TerminalLog from './pages/TerminalLog';
import MarketPrices from './pages/MarketPrices';

const NavItem = ({ to, icon: Icon, label }) => (
  <Link to={to} className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-gray-700 hover:text-white rounded-lg transition-colors">
    <Icon size={20} />
    <span>{label}</span>
  </Link>
);

function App() {
  return (
    <Router>
      <div className="flex min-h-screen w-full bg-slate-900 text-white font-sans overflow-x-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-slate-800 border-r border-slate-700 p-4 shrink-0 hidden md:block">
          <div className="text-2xl font-bold text-blue-500 mb-8 px-4 flex items-center gap-2">
            <Activity className="text-blue-400" />
            <span>3C 監控系統</span>
          </div>
          <nav className="space-y-2">
            <NavItem to="/" icon={LayoutDashboard} label="行情儀表板" />
            <NavItem to="/market-prices" icon={Tag} label="市場基準價" />
            <NavItem to="/recommendations" icon={ShoppingCart} label="獲利推薦" />
            <NavItem to="/data" icon={Database} label="數據總覽" />
            <NavItem to="/status" icon={Activity} label="系統狀態" />
            <NavItem to="/terminal" icon={Terminal} label="系統控制台" />
            <NavItem to="/settings" icon={Settings} label="設定更新" />
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 bg-slate-900 h-screen overflow-auto">
          <header className="h-16 border-b border-slate-700 flex items-center justify-end px-8 bg-slate-800/50 backdrop-blur-md sticky top-0 z-10 text-xs text-gray-500 shrink-0">
            {new Date().toLocaleDateString('zh-TW')} | 系統運行中
          </header>
          
          <div className="flex-1 overflow-auto bg-slate-900">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/market-prices" element={<MarketPrices />} />
              <Route path="/recommendations" element={<Recommendations />} />
              <Route path="/data" element={<DataExplorer />} />
              <Route path="/status" element={<SystemStatus />} />
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
