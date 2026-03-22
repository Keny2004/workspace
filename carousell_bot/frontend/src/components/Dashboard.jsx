import React from 'react';
import ItemCard from './ItemCard';

export default function Dashboard({ items, type, onMarkRead, onDelete, loading, marketStats = [] }) {
  if (loading && items.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
        <div className="loader">資料載入中...</div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="glass-morphism" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        目前沒有符合條件的項目。
      </div>
    );
  }

  return (
    <div>
      {type === 'market' && marketStats.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '12px' }}>📊 目標行情概覽 (3C 高價收購參考)</h3>
          <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
            {marketStats.filter(s => s.spec).map((stat, idx) => (
              <div key={idx} className="glass-morphism" style={{ padding: '12px 16px', minWidth: '180px', flexShrink: 0 }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{stat.name}</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', margin: '4px 0' }}>{stat.spec}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: 'var(--accent-gold)' }}>收購: NT${stat.buyback_price?.toLocaleString()}</span>
                  <span style={{ color: 'var(--accent-blue)' }}>市價: NT${stat.market_price?.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="item-grid">
        {items.map((item) => (
          <ItemCard 
            key={item.id} 
            item={item} 
            type={type} 
            onMarkRead={() => onMarkRead(item.id)} 
            onDelete={() => onDelete(item.id)}
          />
        ))}
      </div>
    </div>
  );
}
