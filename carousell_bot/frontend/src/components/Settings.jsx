import React from 'react';
import { Target, BarChart, RefreshCw, Trash2, ShieldAlert } from 'lucide-react';

export default function Settings({ targets, stats, onClearDB, onRefresh }) {
  return (
    <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Target size={20} color="var(--accent-blue)" />
          <h3 style={{ fontSize: '18px' }}>監控目標 ({targets.length})</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {targets.map((target, idx) => (
            <div key={idx} className="glass-morphism" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600 }}>{target.name}</span>
                <span className="glass-morphism" style={{ padding: '2px 8px', fontSize: '10px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-blue)', border: 'none' }}>
                  {target.category}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                關鍵字: {target.keyword || target.name}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <BarChart size={20} color="var(--accent-gold)" />
          <h3 style={{ fontSize: '18px' }}>系統操作</h3>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="glass-morphism" style={{ padding: '20px' }}>
            <h4 style={{ fontSize: '15px', marginBottom: '8px' }}>資料更新</h4>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}> 手動觸發 3C 收購行情更新與 Carousell 掃描。 </p>
            <button 
              onClick={onRefresh}
              className="glass-morphism"
              style={{ 
                width: '100%', 
                padding: '12px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '8px',
                background: 'var(--glass-bg)',
                color: 'white',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={18} /> 立即重新整理
            </button>
          </div>

          <div className="glass-morphism" style={{ padding: '20px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <h4 style={{ fontSize: '15px', marginBottom: '8px', color: '#ef4444' }}>危險區域</h4>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}> 清空所有已儲存的商品與歷史統計數據。 </p>
            <button 
              onClick={onClearDB}
              className="glass-morphism"
              style={{ 
                width: '100%', 
                padding: '12px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '8px',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <Trash2 size={18} /> 清空資料庫
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
