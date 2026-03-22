import React from 'react';
import { ExternalLink, Check, Trash2, Clock, MapPin, Battery, Cpu, Info } from 'lucide-react';

export default function ItemCard({ item, type, onMarkRead, onDelete }) {
  const isArbReady = item.status && item.status.includes('Arb-Ready');
  const isGoodCondition = !item.is_parts_machine;
  const categoryIcons = { phone: '📱', tablet: '📟', laptop: '💻' };

  return (
    <div className={`glass-morphism animate-fade-in ${item.is_read ? 'read-item' : ''}`} style={{ 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden',
      transition: 'transform 0.2s',
      position: 'relative'
    }}>
      {/* Redesigned Header to prevent Overlap */}
      <div style={{ position: 'relative' }}>
        <img 
          src={item.image_url || 'https://via.placeholder.com/300x200?text=No+Image'} 
          alt={item.title}
          style={{ width: '100%', height: '180px', objectFit: 'cover' }}
        />
        
        {/* Badges placed with proper spacing */}
        <div style={{ 
          position: 'absolute', 
          top: '12px', 
          left: '12px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '8px' 
        }}>
          <span style={{ 
            background: 'rgba(0,0,0,0.6)', 
            padding: '4px 8px', 
            borderRadius: '8px', 
            fontSize: '12px',
            backdropFilter: 'blur(4px)'
          }}>
            {categoryIcons[item.category] || '📦'}
          </span>
          {isArbReady && (
            <span style={{ 
              background: '#ef4444', 
              color: 'white', 
              padding: '4px 8px', 
              borderRadius: '8px', 
              fontSize: '10px', 
              fontWeight: 'bold',
              textTransform: 'uppercase',
              boxShadow: '0 0 10px rgba(239, 68, 68, 0.5)'
            }}>
              🔥 Arb-Ready
            </span>
          )}
        </div>

        <div style={{ 
          position: 'absolute', 
          top: '12px', 
          right: '12px'
        }}>
           <span style={{ 
              background: item.status?.includes('Great') ? '#22c55e' : 'rgba(0,0,0,0.6)', 
              padding: '4px 8px', 
              borderRadius: '8px', 
              fontSize: '11px',
              fontWeight: 500
            }}>
              {item.status || '偵測中'}
            </span>
        </div>
      </div>

      <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <h4 style={{ fontSize: '16px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {item.title}
          </h4>
          <span style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--accent-gold)', marginLeft: '12px' }}>
            NT${item.price?.toLocaleString()}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
          {item.specification && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <Cpu size={14} /> {item.specification}
            </span>
          )}
          {item.battery_health && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <Battery size={14} /> {item.battery_health}
            </span>
          )}
          {item.location && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <MapPin size={14} /> {item.location}
            </span>
          )}
        </div>

        {item.ai_summary && (
          <div className="glass-morphism" style={{ 
            padding: '10px', 
            fontSize: '13px', 
            borderRadius: '10px', 
            marginBottom: '12px',
            background: 'rgba(255,255,255,0.03)',
            border: 'none',
            fontStyle: 'italic',
            color: '#e2e8f0'
          }}>
            "{item.ai_summary}"
          </div>
        )}

        {item.ai_reason && (
           <div style={{ fontSize: '12px', color: 'var(--accent-blue)', marginBottom: '16px', display: 'flex', gap: '4px' }}>
             <Info size={14} style={{ flexShrink: 0 }} />
             <span>{item.ai_reason}</span>
           </div>
        )}

        <div style={{ marginTop: 'auto', display: 'flex', gap: '8px' }}>
          <a 
            href={item.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="glass-morphism"
            style={{ 
              flex: 1, 
              padding: '8px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '6px',
              textDecoration: 'none',
              color: 'white',
              fontSize: '14px',
              fontWeight: 500,
              background: 'rgba(255,255,255,0.1)'
            }}
          >
            詳情 <ExternalLink size={14} />
          </a>
          {!item.is_read && (
            <button 
              onClick={onMarkRead}
              className="glass-morphism"
              style={{ 
                width: '40px', 
                height: '40px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                border: 'none',
                background: 'var(--accent-blue)',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              <Check size={18} />
            </button>
          )}
          <button 
            onClick={onDelete}
            className="glass-morphism"
            style={{ 
              width: '40px', 
              height: '40px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              border: 'none',
              background: 'rgba(239, 68, 68, 0.2)',
              color: '#ef4444',
              cursor: 'pointer'
            }}
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
