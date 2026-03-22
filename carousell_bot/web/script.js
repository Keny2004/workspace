document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('items-grid');
    const rawDbArea = document.getElementById('raw-db-area');
    const manageArea = document.getElementById('manage-area');
    const logsArea = document.getElementById('logs-area');
    const logOutput = document.getElementById('log-output');
    const rawTbody = document.getElementById('raw-tbody');
    const targetFilter = document.getElementById('target-filter');
    const specFilter = document.getElementById('spec-filter');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const marketStatsContainer = document.getElementById('market-stats-container');
    const statusText = document.getElementById('connection-status');
    
    let localDataCache = { 'deals': [], 'market': [], 'parts': [] };
    let localMarketStats = [];
    let knownTargets = new Set();
    let knownSpecs = new Set();
    let showRead = false;
    let currentTab = 'deals'; 
    let hasFetchedInitial = false;
    
    // WebSocket 處理
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    
    ws.onopen = () => {
        statusText.textContent = "🟢 WebSocket 即時連線中";
        statusText.style.color = "#4ade80";
        fetchInitialData();
    };
    
    ws.onclose = () => {
        statusText.textContent = "🔴 WebSocket 斷線，請重整頁面";
        statusText.style.color = "#ef4444";
    };
    
    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        
        if (msg.type === "log") {
            const span = document.createElement('div');
            span.textContent = msg.message;
            logOutput.appendChild(span);
            // 限制日誌長度以防瀏覽器卡頓
            if (logOutput.childNodes.length > 500) {
                logOutput.removeChild(logOutput.firstChild);
            }
            logOutput.scrollTop = logOutput.scrollHeight;
        } 
        else if (msg.type === "new_item") {
            const currentTarget = targetFilter.value;
            const currentSpec = specFilter.value;
            const item = msg.data;
            
            // 建立已知分類與規格（無論目前過濾為何，都要加入選單）
            addKnownTarget(item.target_name);
            addKnownSpec(item.specification);

            if (currentTarget && item.target_name !== currentTarget) return;
            if (currentSpec && item.specification !== currentSpec) return;

            if(localDataCache[msg.item_type]) {
                localDataCache[msg.item_type].unshift(item);
                if(currentTab === msg.item_type || currentTab === 'raw-db') {
                    renderUI();
                }
            }
        }
        else if (msg.type === "market_stats") {
            localMarketStats = msg.data;
            renderMarketStats(msg.data);
            // 同時重新渲染系統統計以確保價格同步
            fetchSystemStats();
        }
        else if (msg.type === "stats_update") {
            fetchSystemStats();
        }
    };

    let hasFetchedInitial = false;

    const fetchInitialData = async () => {
        try {
            const target = targetFilter.value || '';
            const spec = specFilter.value || '';
            const extra = `&include_read=${showRead}&target=${target}&spec=${spec}`;
            
            const fetches = [
                fetch(`/api/deals?limit=100${extra}`).then(res => res.json()).then(d => localDataCache['deals'] = d.data || []),
                fetch(`/api/market?limit=100${extra}`).then(res => res.json()).then(d => localDataCache['market'] = d.data || []),
                fetch(`/api/parts?limit=100${extra}`).then(res => res.json()).then(d => localDataCache['parts'] = d.data || [])
            ];
            await Promise.all(fetches);
            
            // Extract targets and specs to populate filters
            ['deals', 'market', 'parts'].forEach(k => {
                if(localDataCache[k]){
                    localDataCache[k].forEach(item => {
                        addKnownTarget(item.target_name);
                        addKnownSpec(item.specification);
                    });
                }
            });
            renderUI();
        } catch (e) {
            console.error("載入資料失敗:", e);
            renderUI();
        }
    };
    
    // 確保即使 WebSocket 不穩，我們一開始也會去拉取 API
    setTimeout(() => {
        if (!hasFetchedInitial) fetchInitialData();
    }, 1000);
    
    const addKnownTarget = (name) => {
        if(name && !knownTargets.has(name)) {
            knownTargets.add(name);
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            targetFilter.appendChild(opt);
        }
    }

    const addKnownSpec = (spec) => {
        if(spec && !knownSpecs.has(spec)) {
            knownSpecs.add(spec);
            const opt = document.createElement('option');
            opt.value = spec;
            opt.textContent = spec;
            specFilter.appendChild(opt);
        }
    }

    // 預填寫常見規格以優化體驗
    ['128G', '256G', '512G', '1TB'].forEach(s => addKnownSpec(s));
    
    targetFilter.addEventListener('change', () => {
        fetchInitialData();
    });

    specFilter.addEventListener('change', () => {
        fetchInitialData();
    });

    const renderMarketStats = (stats) => {
        marketStatsContainer.innerHTML = '';
        const currentTarget = targetFilter.value;
        const currentSpec = specFilter.value;

        // 如果選擇了特定目標，顯示該目標的所有規格市價
        if (currentTarget) {
            const targetStats = stats.filter(s => s.name === currentTarget);
            targetStats.forEach(s => {
                const el = document.createElement('div');
                el.className = 'market-stat-item';
                const label = s.spec ? `${s.name} (${s.spec})` : `${s.name} (總體)`;
                const price = new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(s.price);
                el.innerHTML = `<strong>${label}</strong>: ${price}`;
                if (currentSpec === s.spec) el.style.border = "1px solid var(--primary)";
                marketStatsContainer.appendChild(el);
            });
        } else {
            // 顯示所有目標的總體市價
            const generalStats = stats.filter(s => !s.spec);
            generalStats.forEach(s => {
                const el = document.createElement('div');
                el.className = 'market-stat-item';
                const price = new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(s.price);
                el.innerHTML = `<strong>${s.name}</strong> 基準市價: ${price}`;
                marketStatsContainer.appendChild(el);
            });
        }
    };

    const fetchSystemStats = async () => {
        try {
            const res = await fetch('/api/system_stats');
            const data = await res.json();
            if (data.status === 'success') {
                renderSystemStats(data.targets, data.stats);
            }
        } catch (e) {
            console.error("無法取得追蹤統計:", e);
        }
    };

    const renderSystemStats = (targets, stats) => {
        const container = document.getElementById('target-stats-container');
        if (!container) return;
        if (!targets || targets.length === 0) {
            container.innerHTML = "目前沒有任何追蹤目標，請透過下方介面新增。";
            return;
        }
        
        let html = '<div style="display: flex; flex-direction: column; gap: 10px;">';
        targets.forEach(t => {
            const name = t.name;
            const st = stats[name] || {scraped: 0, ignored: 0, saved: 0};
            
            // 從最新的市場統計中找出對應價格，確保同步
            const marketItem = localMarketStats.find(s => s.name === name);
            const displayPrice = marketItem ? 
                new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(marketItem.price) : 
                `$${new Intl.NumberFormat('zh-TW').format(t.market_price_estimate)}`;

            // 將關鍵字清單用標籤方式顯示
            const reqKw = (t.required_keywords || []).join(', ') || '無';
            const excKw = (t.excluded_keywords || []).join(', ') || '無';

            html += `
                <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; border-left: 3px solid var(--primary);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px;">
                        <div style="font-weight: bold; color: white; font-size:1.1rem;">📌 ${name}</div>
                        <div style="background:var(--primary); color:white; padding:4px 10px; border-radius:20px; font-size:0.85rem; font-weight:bold;">基準市價: ${displayPrice}</div>
                    </div>
                    </div>

                    <div style="display: flex; gap: 20px; font-size: 0.85rem; color: var(--text-sub);">
                        <span>🔍 累計掃描: <strong style="color: white; font-size: 1rem;">${st.scraped}</strong> 物件</span>
                        <span title="因為太貴、太便宜、或觸碰到剛才設定的黑名單而被丟棄的商品">🗑️ 條件剔除: <strong style="color: #ef4444; font-size: 1rem;">${st.ignored}</strong> 件</span>
                        <span title="價格合理，已存入您的市價庫供 AI 進一步判斷的商品">✅ 收錄市價庫: <strong style="color: #4ade80; font-size: 1rem;">${st.saved}</strong> 件</span>
                        <span>💰 設定基準價: $${new Intl.NumberFormat('zh-TW').format(t.market_price_estimate)}</span>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    };

    const renderUI = () => {
        // 使用 classList 隱藏所有板塊，徹底解決 CSS !important 衝突
        [grid, rawDbArea, manageArea, logsArea].forEach(el => el.classList.add('hidden'));
        
        if (currentTab === 'logs') {
            logsArea.classList.remove('hidden');
            return;
        }
        if (currentTab === 'manage') {
            manageArea.classList.remove('hidden');
            return;
        }
        if (currentTab === 'raw-db') {
            rawDbArea.classList.remove('hidden');
            renderRawTable();
            return;
        }
        
        grid.classList.remove('hidden');
        grid.innerHTML = '';
        
        let displayData = localDataCache[currentTab] || [];
        const filterName = targetFilter.value;
        const currentSpec = specFilter.value;

        if(filterName) {
            displayData = displayData.filter(i => i.target_name === filterName);
        }
        if(currentSpec) {
             displayData = displayData.filter(i => i.specification === currentSpec);
        }
        
        displayData.forEach(item => {
            const card = document.createElement('div');
            let badgeClass = 'badge-normal';
            let statusText = item.status || "無資料";
            
            if (currentTab === 'deals') {
                statusText = "推薦優惠 (AI核准)";
                badgeClass = 'badge-great';
            } else if (currentTab === 'parts') {
                statusText = "零件機";
                badgeClass = 'badge-special';
            }

            card.className = `item-card ${badgeClass}`;
            if (item.is_read) card.style.opacity = '0.5';
            
            const priceFormatted = new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(item.price);
            
            let aiReasonHtml = '';
            if (item.ai_reason) {
                 aiReasonHtml = `<div style="font-size:0.875rem; background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; border-left:3px solid ${currentTab==='parts'?'#ef4444':'#3b82f6'}; margin-top: 10px;">
                    <strong>🤖 AI 判斷：</strong> ${item.ai_reason}
                </div>`;
            }

            // 規格與交易資訊標籤
            let tagsHtml = '<div class="tags-row" style="display:flex; gap:5px; flex-wrap:wrap; margin-top:8px;">';
            if (item.specification) tagsHtml += `<span class="tag-badge spec">🏷️ ${item.specification}</span>`;
            if (item.location) tagsHtml += `<span class="tag-badge loc">📍 ${item.location}</span>`;
            if (item.payment) tagsHtml += `<span class="tag-badge pay">💳 ${item.payment}</span>`;
            tagsHtml += '</div>';

            const timeStr = item.created_at ? new Date(item.created_at + 'Z').toLocaleString('zh-TW', {timeZone: 'Asia/Taipei'}) : item.time;
            
            const tableMap = { 'deals': 'profitable_deals', 'market': 'items', 'parts': 'parts_deals' };
            const currentTable = tableMap[currentTab];

            card.innerHTML = `
                <div class="item-badge ${badgeClass}">${statusText}</div>
                <div style="font-size:0.75rem; color:#888; margin-bottom:5px;">📁 ${item.target_name || '未分類'}</div>
                <h3 class="item-title" title="${item.title}">${item.title}</h3>
                <div class="item-price"><span></span>${priceFormatted}</div>
                ${tagsHtml}
                ${aiReasonHtml}
                <div class="item-time">紀錄時間: ${timeStr}</div>
                <div style="display:flex; gap:10px; margin-top:12px;">
                    <a href="${item.url}" target="_blank" class="item-link" style="flex:2; margin:0;">前往拍賣 ↗</a>
                    <button class="clear-btn" onclick="markAsRead('${currentTable}', '${item.id}')" style="flex:1; background:rgba(255,255,255,0.1); border:none; border-radius:10px; color:white; cursor:pointer;">🗑️ 略過</button>
                </div>
            `;
            grid.appendChild(card);
        });
    };
    
    const renderRawTable = () => {
        rawTbody.innerHTML = '';
        // 匯集所有三筆資料，標明來源
        const filterName = targetFilter.value;
        const allData = [];
        const add = (arr, label) => arr.forEach(i => allData.push({...i, source: label}));
        add(localDataCache['deals'], 'Deals(套利)');
        add(localDataCache['parts'], 'Parts(零件)');
        add(localDataCache['market'], 'Market(市價)');
        
        allData.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
        
        allData.forEach(item => {
            if(filterName && item.target_name !== filterName) return;
            const tr = document.createElement('tr');
            const reason = item.ai_reason ? `<span style="color:#60a5fa">${item.ai_reason}</span>` : item.status;
            
            const tableMap = { 'Deals(套利)': 'profitable_deals', 'Market(市價)': 'items', 'Parts(零件)': 'parts_deals' };
            const currentTable = tableMap[item.source] || 'items';

            tr.innerHTML = `
                <td style="font-size:0.7rem; color:#888;">${item.id}</td>
                <td><a href="${item.url}" target="_blank" style="color:white; font-size:0.85rem;">${item.title.substring(0,25)}...</a></td>
                <td style="color:#fbbf24; font-weight:bold;">$${item.price}</td>
                <td style="font-size:0.8rem;">${item.source}<br>${reason}</td>
                <td style="font-size:0.8rem;">${item.target_name}</td>
                <td style="font-size:0.7rem; color:#888;">${item.created_at}</td>
                <td>
                    <button onclick="markAsRead('${currentTable}', '${item.id}')" style="background:rgba(255,255,255,0.1); border:none; padding:4px 8px; border-radius:4px; color:white; cursor:pointer; font-size:0.75rem;">🗑️ 略過</button>
                </td>
            `;
            rawTbody.appendChild(tr);
        });
    };

    // Tab 切換
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTab = btn.getAttribute('data-tab');
            renderUI();
        });
    });
    
    // AI target 設定器
    document.getElementById('ai-submit-btn').addEventListener('click', async () => {
        const val = document.getElementById('ai-product-name').value;
        const con = document.getElementById('ai-result-console');
        if(!val) return;
        
        document.getElementById('ai-submit-btn').disabled = true;
        con.innerHTML = `正在請 Gemma3 分析 [${val}] 的最佳過濾關鍵字...\n這可能需要幾十秒，請稍候...`;
        
        try {
            const res = await fetch('/api/generate_target', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({product_name: val})
            });
            const dat = await res.json();
            
            if (dat.status === 'confirm_delete') {
                con.innerHTML = `⚠️ ${dat.message}\n\n`;
                
                const btnYes = document.createElement('button');
                btnYes.textContent = `🚨 是的，確定取消追蹤 [${dat.target_name}]`;
                btnYes.style.cssText = "background: #ef4444; color: white; padding: 10px 15px; border: none; border-radius: 6px; cursor: pointer; margin-top: 15px; font-weight: bold;";
                btnYes.onclick = async () => {
                    con.innerHTML = "正在執行刪除動作...";
                    try {
                        const delRes = await fetch('/api/delete_target', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ target_name: dat.target_name })
                        });
                        const delData = await delRes.json();
                        con.innerHTML = delData.message;
                    } catch(err) {
                        con.innerHTML = `刪除失敗: ${err}`;
                    }
                };
                con.appendChild(btnYes);
                
                const btnNo = document.createElement('button');
                btnNo.textContent = "取消操作";
                btnNo.style.cssText = "background: #475569; color: white; padding: 10px 15px; border: none; border-radius: 6px; cursor: pointer; margin-left: 10px; margin-top: 15px;";
                btnNo.onclick = () => {
                    con.innerHTML = "已取消刪除。等待下一個指令...";
                };
                con.appendChild(btnNo);

            } else if (dat.status === 'success') {
                document.getElementById('ai-product-name').value = ''; // 成功後清空輸入框
                if(dat.yaml) {
                    con.innerHTML = `✅ ${dat.message}\n\n---\n${dat.yaml}`;
                } else {
                    con.innerHTML = `✅ ${dat.message}`;
                }
            } else {
                con.innerHTML = `❌ 錯誤：${dat.message}`;
            }
        } catch(e) {
            con.innerHTML = `連線錯誤: ${e}`;
        }
        document.getElementById('ai-submit-btn').disabled = false;
        fetchTargets(); // 更新列表
    });

    // 已讀/清除功能
    window.markAsRead = async (table, id) => {
        try {
            const res = await fetch('/api/mark_read', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({table, id, is_read: 1})
            });
            const dat = await res.json();
            if(dat.status === 'success') {
                // 從 cache 移除或更新其狀態
                ['deals', 'market', 'parts'].forEach(k => {
                    localDataCache[k] = localDataCache[k].filter(i => i.id !== id);
                });
                renderUI();
            }
        } catch(e) { console.error("標記失敗:", e); }
    };

    // 顯示已讀切換
    document.getElementById('show-read-toggle').addEventListener('change', (e) => {
        showRead = e.target.checked;
        hasFetchedInitial = false;
        fetchInitialData();
    });

    // 監控目標管理
    const fetchTargets = async () => {
        try {
            const res = await fetch('/api/targets');
            const data = await res.json();
            if (data.status === 'success') {
                renderTargetsTable(data.data);
            }
        } catch (e) {
            console.error("無法取得目標清單:", e);
        }
    };

    const renderTargetsTable = (targets) => {
        const tbody = document.getElementById('targets-tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        targets.forEach(t => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:bold;">${t.name}</td>
                <td><code style="background:rgba(255,255,255,0.1); padding:2px 5px; border-radius:4px;">${t.keyword}</code></td>
                <td>$${new Intl.NumberFormat('zh-TW').format(t.market_price_estimate)}</td>
                <td>
                    <button class="delete-target-btn" data-name="${t.name}" style="background:#ef4444; border:none; border-radius:6px; color:white; padding:5px 10px; cursor:pointer; font-size:0.8rem;">🗑️ 刪除</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.delete-target-btn').forEach(btn => {
            btn.onclick = async () => {
                const name = btn.getAttribute('data-name');
                if (btn.dataset.confirming === 'true') {
                    try {
                        const res = await fetch('/api/delete_target', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({target_name: name})
                        });
                        const dat = await res.json();
                        btn.textContent = "✅ 已刪除";
                        setTimeout(() => {
                            fetchTargets();
                            fetchSystemStats();
                        }, 500);
                    } catch(e) { 
                        btn.textContent = "❌ 失敗";
                        setTimeout(() => {
                            btn.dataset.confirming = 'false';
                            btn.textContent = "🗑️ 刪除";
                        }, 2000);
                    }
                } else {
                    btn.dataset.confirming = 'true';
                    btn.textContent = "🚨 確定刪除？";
                    btn.style.background = "#dc2626";
                    setTimeout(() => {
                        if (btn && btn.dataset.confirming === 'true') {
                            btn.dataset.confirming = 'false';
                            btn.textContent = "🗑️ 刪除";
                            btn.style.background = "#ef4444";
                        }
                    }, 3000);
                }
            };
        });
    };

    // 儲存交易偏好
    document.getElementById('save-trading-prefs-btn').addEventListener('click', async () => {
        const locations = document.getElementById('pref-locations').value;
        const payments = document.getElementById('pref-payments').value;
        
        try {
            const res = await fetch('/api/save_config', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    trading: {
                        locations: locations,
                        payments: payments
                    }
                })
            });
            const dat = await res.json();
            alert(dat.message);
        } catch(e) {
            alert("儲存失敗: " + e);
        }
    });

    // 初次載入就先抓取一次追蹤數據
    setTimeout(() => {
        fetchSystemStats();
        fetchTargets();
    }, 500);
});
