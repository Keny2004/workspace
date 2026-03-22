import React, { useState } from 'react';
import { useCarousell } from './hooks/useCarousell';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import FilterBar from './components/FilterBar';
import Settings from './components/Settings';
import { Layout, LineChart, Tag, Wrench, Settings as SettingsIcon } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('market');
  const { 
    items, deals, parts, stats, targets, marketStats, loading,
    currentCategory, setCurrentCategory,
    searchQuery, setSearchQuery,
    markAsRead, deleteItem, clearDB, refresh
  } = useCarousell();

  const renderContent = () => {
    switch (activeTab) {
      case 'market':
        return (
          <>
            <FilterBar 
              currentCategory={currentCategory} 
              onCategoryChange={setCurrentCategory}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
            <Dashboard 
              items={items.filter(i => i.title.toLowerCase().includes(searchQuery.toLowerCase()))} 
              type="market" 
              onMarkRead={(id) => markAsRead('items', id)}
              onDelete={deleteItem}
              loading={loading}
              marketStats={marketStats}
            />
          </>
        );
      case 'deals':
        return (
          <Dashboard 
            items={deals.filter(i => i.title.toLowerCase().includes(searchQuery.toLowerCase()))} 
            type="deals"
            onMarkRead={(id) => markAsRead('profitable_deals', id)}
            onDelete={deleteItem}
            loading={loading}
          />
        );
      case 'parts':
        return (
          <Dashboard 
            items={parts.filter(i => i.title.toLowerCase().includes(searchQuery.toLowerCase()))} 
            type="parts"
            onMarkRead={(id) => markAsRead('parts_deals', id)}
            onDelete={deleteItem}
            loading={loading}
          />
        );
      case 'settings':
        return <Settings targets={targets} stats={stats} onClearDB={clearDB} onRefresh={refresh} />;
      default:
        return null;
    }
  };

  return (
    <div className="app-container">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        stats={stats} 
      />
      <main className="main-content">
        <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 'bold' }}>
              {activeTab === 'market' && '市場監控'}
              {activeTab === 'deals' && '套利機會'}
              {activeTab === 'parts' && '零件/故障機'}
              {activeTab === 'settings' && '系統設定'}
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
              {activeTab === 'market' && '即時抓取 Carousell 市場行情'}
              {activeTab === 'deals' && 'AI 判定具備套利空間的好物'}
              {activeTab === 'parts' && '低價零件機與維修標的'}
              {activeTab === 'settings' && '管理追蹤目標與系統偏好'}
            </p>
          </div>
          <div className="glass-morphism" style={{ padding: '8px 16px', fontSize: '14px' }}>
            🔄 自動更新中...
          </div>
        </header>

        {renderContent()}
      </main>
    </div>
  );
}

export default App;
