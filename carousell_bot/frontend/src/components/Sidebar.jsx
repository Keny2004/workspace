import React from 'react';
import { Layout, LineChart, Tag, Wrench, Settings, Trash2 } from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, stats }) {
  const menuItems = [
    { id: 'market', label: '市場監控', icon: LineChart },
    { id: 'deals', label: '套利機會', icon: Tag },
    { id: 'parts', label: '零件/故障', icon: Wrench },
    { id: 'settings', label: '系統設定', icon: Settings },
  ];

  return (
    <aside className="glass-morphism" style={{ 
      width: '280px', 
      height: '100vh', 
      position: 'sticky', 
      top: 0, 
      display: 'flex', 
      flexDirection: 'column',
      padding: '24px',
      borderRadius: '0 24px 24px 0'
    }}>
      <div style={{ marginBottom: '40px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ 
          width: '40px', 
          height: '40px', 
          background: 'var(--accent-blue)', 
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Layout size={24} color="white" />
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>Carousell Bot</h2>
      </div>

      <nav style={{ flex: 1 }}>
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              marginBottom: '8px',
              borderRadius: '12px',
              border: 'none',
              background: activeTab === item.id ? 'var(--accent-blue)' : 'transparent',
              color: activeTab === item.id ? 'white' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'left'
            }}
          >
            <item.icon size={20} />
            <span style={{ fontWeight: 500 }}>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="glass-morphism" style={{ padding: '20px', marginTop: 'auto', borderRadius: '16px' }}>
        <h4 style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>系統統計</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <StatBox label="已掃描" value={stats.total_scraped || 0} />
          <StatBox label="已儲存" value={stats.total_saved || 0} />
          <StatBox label="好物" value={stats.total_deals || 0} />
          <StatBox label="自動過濾" value={stats.total_ignored || 0} />
        </div>
      </div>
    </aside>
  );
}

function StatBox({ label, value }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--accent-blue)' }}>{value}</div>
      <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{label}</div>
    </div>
  );
}
