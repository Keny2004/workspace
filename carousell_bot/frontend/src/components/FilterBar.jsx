import React from 'react';
import { Search } from 'lucide-react';

export default function FilterBar({ currentCategory, onCategoryChange, searchQuery, onSearchChange }) {
  const categories = [
    { id: 'all', label: '全部', icon: '📋' },
    { id: 'phone', label: '手機', icon: '📱' },
    { id: 'tablet', label: '平板', icon: '📟' },
    { id: 'laptop', label: '筆電', icon: '💻' },
  ];

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      marginBottom: '24px',
      gap: '16px',
      flexWrap: 'wrap'
    }}>
      <div className="glass-morphism" style={{ display: 'flex', padding: '4px', gap: '4px' }}>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onCategoryChange(cat.id)}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: 'none',
              background: currentCategory === cat.id ? 'var(--accent-blue)' : 'transparent',
              color: currentCategory === cat.id ? 'white' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              fontSize: '14px',
              fontWeight: 500
            }}
          >
            <span>{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
        <Search 
          size={18} 
          style={{ 
            position: 'absolute', 
            left: '12px', 
            top: '50%', 
            transform: 'translateY(-50%)', 
            color: 'var(--text-secondary)' 
          }} 
        />
        <input
          type="text"
          placeholder="搜尋標題關鍵字..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: '100%',
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            borderRadius: '12px',
            padding: '10px 16px 10px 40px',
            color: 'white',
            outline: 'none',
            fontSize: '14px'
          }}
        />
      </div>
    </div>
  );
}
