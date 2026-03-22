document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('items-grid');
    const loading = document.getElementById('loading');
    const lastUpdated = document.getElementById('last-updated');
    const tabs = document.querySelectorAll('.tab-btn');
    
    let currentTab = 'all';
    let itemsData = [];

    const fetchItems = async () => {
        try {
            const response = await fetch('/api/deals?limit=100');
            const result = await response.json();
            
            if (result.status === 'success') {
                itemsData = result.data;
                renderItems();
                
                const now = new Date();
                lastUpdated.textContent = `Last synced: ${now.toLocaleTimeString()}`;
            }
        } catch (error) {
            console.error("Error fetching items:", error);
            lastUpdated.textContent = "Error syncing data.";
        }
    };

    const renderItems = () => {
        grid.innerHTML = '';
        loading.style.display = 'none';
        
        const filteredItems = itemsData.filter(item => {
            if (currentTab === 'all') return true;
            return item.status === currentTab;
        });

        if (filteredItems.length === 0) {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #94a3b8; padding: 2rem;">No items found matching this filter.</div>';
            return;
        }

        filteredItems.forEach(item => {
            const card = document.createElement('div');
            
            // Adjust styling based on status
            let badgeClass = 'badge-normal';
            let cardClass = '';
            let statusText = item.status;
            
            if (item.status === 'Great Deal') {
                badgeClass = 'badge-great';
                cardClass = 'Great';
                statusText = '🔥 Great Deal';
            } else if (item.status === 'Special') {
                badgeClass = 'badge-special';
                cardClass = 'Special';
                statusText = '⚠️ Special';
            }

            card.className = `item-card ${cardClass}`;
            
            const priceFormatted = new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(item.price);

            card.innerHTML = `
                <div class="item-badge ${badgeClass}">${statusText}</div>
                <h3 class="item-title" title="${item.title}">${item.title}</h3>
                <div class="item-price"><span></span>${priceFormatted}</div>
                <div style="font-size:0.875rem; background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; border-left:3px solid #3b82f6;">
                    <strong>🤖 AI 判斷：</strong> ${item.ai_reason}
                </div>
                <div class="item-time">Scraped: ${new Date(item.created_at + 'Z').toLocaleString('zh-TW', {timeZone: 'Asia/Taipei'})}</div>
                <a href="${item.url}" target="_blank" class="item-link">View Listing ↗</a>
            `;
            grid.appendChild(card);
        });
    };

    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            tabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            currentTab = e.target.dataset.tab;
            renderItems();
        });
    });

    // Initial fetch
    fetchItems();
    
    // Poll every 30 seconds to update UI automatically
    setInterval(fetchItems, 30000);
});
