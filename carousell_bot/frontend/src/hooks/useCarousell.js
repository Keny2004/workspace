import { useState, useEffect, useCallback } from 'react';

const API_BASE = '/api';
const WS_URL = `ws://${window.location.host}/ws`;

export function useCarousell() {
  const [items, setItems] = useState([]);
  const [deals, setDeals] = useState([]);
  const [parts, setParts] = useState([]);
  const [stats, setStats] = useState({});
  const [targets, setTargets] = useState([]);
  const [marketStats, setMarketStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentCategory, setCurrentCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = useCallback(async (category = 'all') => {
    setLoading(true);
    try {
      const catParam = category !== 'all' ? `?category=${category}` : '';
      
      const [itemsRes, dealsRes, partsRes, statsRes, targetsRes, mStatsRes] = await Promise.all([
        fetch(`${API_BASE}/market${catParam}`).then(r => r.json()),
        fetch(`${API_BASE}/deals${catParam}`).then(r => r.json()),
        fetch(`${API_BASE}/parts${catParam}`).then(r => r.json()),
        fetch(`${API_BASE}/system_stats${catParam}`).then(r => r.json()),
        fetch(`${API_BASE}/targets${catParam}`).then(r => r.json()),
        fetch(`${API_BASE}/market_stats`).then(r => r.json())
      ]);

      if (itemsRes.status === 'success') setItems(itemsRes.data);
      if (dealsRes.status === 'success') setDeals(dealsRes.data);
      if (partsRes.status === 'success') setParts(partsRes.data);
      if (statsRes.status === 'success') setStats(statsRes.stats);
      if (targetsRes.status === 'success') setTargets(targetsRes.data);
      if (mStatsRes.status === 'success') setMarketStats(mStatsRes.data);

    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(currentCategory);
  }, [currentCategory, fetchData]);

  // WebSocket for real-time updates
  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'new_item') {
        const item = data.item;
        if (currentCategory === 'all' || item.category === currentCategory) {
          if (data.source === 'market') setItems(prev => [item, ...prev].slice(0, 100));
          if (data.source === 'deals') setDeals(prev => [item, ...prev].slice(0, 100));
          if (data.source === 'parts') setParts(prev => [item, ...prev].slice(0, 100));
        }
      } else if (data.type === 'stats_update') {
        fetchData(currentCategory);
      }
    };
    return () => ws.close();
  }, [currentCategory, fetchData]);

  const markAsRead = async (table, id) => {
    try {
      await fetch(`${API_BASE}/mark_read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, id, is_read: true })
      });
      // Update local state to reflect read status
      const updater = prev => prev.map(item => item.id === id ? { ...item, is_read: 1 } : item);
      if (table === 'items') setItems(updater);
      if (table === 'profitable_deals') setDeals(updater);
      if (table === 'parts_deals') setParts(updater);
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const deleteItem = async (id) => {
    try {
      await fetch(`${API_BASE}/delete_item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      setItems(prev => prev.filter(i => i.id !== id));
      setDeals(prev => prev.filter(i => i.id !== id));
      setParts(prev => prev.filter(i => i.id !== id));
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  };

  const clearDB = async () => {
    if (window.confirm('確定要清空所有商品資料嗎？')) {
      await fetch(`${API_BASE}/clear_db`, { method: 'POST' });
      setItems([]);
      setDeals([]);
      setParts([]);
    }
  };

  return {
    items, deals, parts, stats, targets, marketStats, loading,
    currentCategory, setCurrentCategory,
    searchQuery, setSearchQuery,
    markAsRead, deleteItem, clearDB, refresh: () => fetchData(currentCategory)
  };
}
