import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, AlertCircle, CheckCircle, RefreshCcw, Bell, Shield, Database, Trash2, Plus, X, Globe, Lock, Monitor, Smartphone, Laptop, Send, DollarSign, Cpu } from 'lucide-react';

const SettingsPage = () => {
    const [config, setConfig] = useState({
        profit_margin: "5",
        telegram_token: "",
        telegram_user_id: "",
        telegram_profit_threshold: "1000",
        crawler_proxy_enabled: 'false',
        crawler_stealth_level: 'high',
        ollama_url: "http://localhost:11434/api/generate",
        ollama_model: "qwen3.5:4b",
        app_url: "http://localhost:3000",
        custom_proxies: "",
        crawler_stealth_level: "high"
    });
    const [categories, setCategories] = useState([]);
    const [newCategory, setNewCategory] = useState("");
    
    // UI States
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [notification, setNotification] = useState(null);
    const [modal, setModal] = useState(null); // { type: 'model'|'spec'|'confirm', parentId: number, title: string }
    const [modalInputValue, setModalInputValue] = useState("");
    const [importUrl, setImportUrl] = useState("");
    const [importCategory, setImportCategory] = useState("");
    const [importing, setImporting] = useState(false);

    useEffect(() => {
        if (!modal) setModalInputValue("");
    }, [modal]);

    useEffect(() => {
        fetchConfig();
        fetchCategories();
    }, []);

    const fetchConfig = () => {
        axios.get('/api/config').then(res => {
            if (res.data) {
                const newConfig = { ...config };
                res.data.forEach(item => {
                    newConfig[item.key] = item.value;
                });
                setConfig(newConfig);
            }
        });
    };

    const fetchCategories = () => {
        axios.get('/api/categories').then(res => setCategories(res.data));
    };

    const showNotification = (msg, type = 'success') => {
        setNotification({ msg, type });
        setTimeout(() => setNotification(null), 5000);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setConfig(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = () => {
        setSaving(true);
        axios.post('/api/config', config)
            .then(() => showNotification("✅ 系統配置已成功儲存並生效"))
            .catch(err => showNotification("❌ 儲存失敗，請檢查後端連線", "error"))
            .finally(() => setSaving(false));
    };

    const testTelegram = () => {
        setTesting(true);
        axios.post('/api/test-telegram', {
            token: config.telegram_token,
            user_id: config.telegram_user_id
        }).then(res => {
            if (res.data.status === "success") {
                showNotification("📡 Telegram 測試訊息已送出，請檢查手機！");
            } else {
                showNotification("⚠️ Telegram 測試失敗，請檢查 Token 與 ID", "error");
            }
        }).catch(() => showNotification("❌ 無法連繫 Telegram 服務", "error"))
          .finally(() => setTesting(false));
    };

    const addCategory = () => {
        if (!newCategory) return;
        axios.post(`/api/categories?name=${newCategory}`).then(() => {
            setNewCategory("");
            fetchCategories();
            showNotification(`已新增類別：${newCategory}`);
        });
    };

    const handleModalSubmit = (val) => {
        if (!val) return;
        if (modal.type === 'model') {
            axios.post(`/api/models?category_id=${modal.parentId}&name=${val}`).then(() => {
                fetchCategories();
                setModal(null);
                showNotification(`已新增型號：${val}`);
            });
        } else if (modal.type === 'spec') {
            axios.post(`/api/specifications?model_id=${modal.parentId}&name=${val}`).then(() => {
                fetchCategories();
                setModal(null);
                showNotification(`已新增規格：${val}`);
            });
        }
    };

    const deleteItem = (type, id, name) => {
        setModal({ type: 'confirm', id, itemType: type, title: `確定要刪除「${name}」嗎？` });
    };

    const confirmDelete = () => {
        axios.delete(`/api/${modal.itemType}/${modal.id}`).then(() => {
            fetchCategories();
            setModal(null);
            showNotification("項目已成功移除");
        });
    };

    const clearData = () => {
        setModal({ type: 'confirm', clearAll: true, title: "確定要清空所有已爬取的商品資料嗎？" });
    };

    const executeClear = () => {
        axios.delete('/api/products/clear').then(() => {
            setModal(null);
            showNotification("🗑️ 所有爬取資料已清空");
        });
    };

    const handleImportUrl = () => {
        if (!importUrl || !importCategory) return;
        setImporting(true);
        axios.post('/api/market-prices/import-url', {
            url: importUrl,
            category_id: importCategory
        }).then(res => {
            showNotification(`✅ 成功匯入 ${res.data.imported_count} 筆行情資料`);
            fetchCategories(); // Refresh hierarchy
            setImportUrl("");
        }).catch(err => {
            showNotification("❌ 匯入失敗，請檢查網址", "error");
        }).finally(() => setImporting(false));
    };

    return (
        <div className="p-8 w-full mx-auto space-y-10 relative min-h-screen cyber-grid overflow-x-hidden transition-all duration-700">
            <div className="scanline"></div>

            {/* Custom Toast */}
            {notification && (
                <div className="fixed top-24 right-10 z-[100] animate-in slide-in-from-right duration-500">
                    <div className={`${notification.type === 'error' ? 'bg-red-900/90' : 'bg-cyan-900/90'} text-white px-8 py-5 rounded-3xl shadow-2xl flex items-center gap-4 font-black border border-white/20 backdrop-blur-2xl cyber-border`}>
                        {notification.type === 'error' ? <AlertCircle size={22} className="text-red-400" /> : <CheckCircle size={22} className="text-cyan-400" />}
                        <span className="uppercase tracking-widest text-[10px]">{notification.msg}</span>
                    </div>
                </div>
            )}

            {/* Custom Modal */}
            {modal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="bg-slate-900 border border-cyan-500/20 p-10 rounded-[2.5rem] shadow-[0_0_50px_rgba(0,243,255,0.1)] w-full max-w-lg space-y-8 relative overflow-hidden cyber-border">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50"></div>
                        <h3 className="text-2xl font-black tracking-tighter text-white uppercase italic">{modal.title}</h3>
                        {modal.type !== 'confirm' ? (
                            <div className="relative group">
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-magenta-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                                <input 
                                    autoFocus
                                    type="text" 
                                    placeholder="INPUT_ENTITY_IDENTITY..."
                                    value={modalInputValue}
                                    onChange={(e) => setModalInputValue(e.target.value)}
                                    className="relative w-full bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-cyan-500/50 transition-all font-mono text-cyan-400"
                                    onKeyDown={(e) => e.key === 'Enter' && handleModalSubmit(modalInputValue)}
                                />
                            </div>
                        ) : (
                            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest leading-relaxed">執行此操作將導致數據結構永久變更。確認執行 Neural_Wipe 指令？</p>
                        )}
                        <div className="flex justify-end gap-6 pt-4">
                            <button onClick={() => setModal(null)} className="px-8 py-3 text-gray-500 font-black text-[10px] uppercase tracking-widest hover:text-white transition-colors">Abort</button>
                            {modal.type === 'confirm' ? (
                                <button 
                                    onClick={modal.clearAll ? executeClear : confirmDelete} 
                                    className="px-8 py-3 bg-red-600 hover:bg-red-500 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-red-600/30 text-white cyber-button"
                                >
                                    Confirm_Wipe
                                </button>
                            ) : (
                                <button 
                                    onClick={() => handleModalSubmit(modalInputValue)} 
                                    className="px-8 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-cyan-600/30 text-white cyber-button"
                                >
                                    Confirm_Inject
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-6 relative z-10">
                <div>
                    <h1 className="text-5xl font-black tracking-tighter bg-gradient-to-r from-white via-cyan-400 to-magenta-500 bg-clip-text text-transparent cyber-text-glow">系統設定</h1>
                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.4em] mt-2 opacity-70">Core Configuration // Root Access</p>
                </div>
                <div className="flex gap-4">
                    <button 
                        onClick={clearData}
                        className="px-6 py-3 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 rounded-2xl font-black text-[10px] uppercase tracking-widest transition active:scale-95 cyber-button"
                    >
                        清空舊資料
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-3 px-10 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-2xl font-black transition disabled:opacity-50 text-[11px] uppercase tracking-[0.2em] shadow-2xl shadow-cyan-600/30 text-white cyber-button"
                    >
                        <Save size={16} />
                        {saving ? "SAVING..." : "COMMIT_CHANGES"}
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
                {/* Column 1: Config Groups */}
                <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <section className="bg-slate-900/40 p-8 rounded-3xl border border-slate-800 backdrop-blur-md space-y-6 cyber-border">
                        <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                            <DollarSign className="text-cyan-400 cyber-text-glow" size={20} />
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">獲利門檻設定 // ARBITRAGE_LEVELS</h3>
                        </div>
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase mb-2 tracking-widest px-1">
                                        <Smartphone size={12} className="text-cyan-400" /> 手機獲利判定 (%)
                                    </label>
                                    <input 
                                        type="number" 
                                        name="profit_margin_手機"
                                        value={config.profit_margin_手機}
                                        onChange={handleChange}
                                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-cyan-500/50 transition-all font-mono text-cyan-400"
                                    />
                                </div>
                                <div>
                                    <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase mb-2 tracking-widest px-1">
                                        <Smartphone size={12} className="text-magenta-400 rotate-90" /> 平板獲利判定 (%)
                                    </label>
                                    <input 
                                        type="number" 
                                        name="profit_margin_平板"
                                        value={config.profit_margin_平板}
                                        onChange={handleChange}
                                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-cyan-500/50 transition-all font-mono text-cyan-400"
                                    />
                                </div>
                                <div>
                                    <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase mb-2 tracking-widest px-1">
                                        <Laptop size={12} className="text-yellow-400" /> 筆電獲利判定 (%)
                                    </label>
                                    <input 
                                        type="number" 
                                        name="profit_margin_筆電"
                                        value={config.profit_margin_筆電}
                                        onChange={handleChange}
                                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-cyan-500/50 transition-all font-mono text-cyan-400"
                                    />
                                </div>
                            </div>
                            <div className="pt-2 border-t border-white/5">
                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 tracking-widest px-1">Telegram 推播門檻 ($)</label>
                                <input 
                                    type="number" 
                                    name="telegram_profit_threshold"
                                    value={config.telegram_profit_threshold}
                                    onChange={handleChange}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-cyan-500/50 transition-all font-mono text-[11px] text-gray-400"
                                />
                            </div>
                        </div>
                    </section>

                    <section className="bg-slate-900/40 p-8 rounded-3xl border border-slate-800 backdrop-blur-md space-y-6 cyber-border">
                        <div className="flex items-center justify-between border-b border-white/5 pb-4">
                            <div className="flex items-center gap-3">
                                <Bell className="text-magenta-400 cyber-text-glow" size={20} />
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-magenta-400">TELEGRAM AUTH</h3>
                            </div>
                            <button 
                                onClick={testTelegram}
                                disabled={testing}
                                className="flex items-center gap-2 px-3 py-1 bg-magenta-500/10 text-magenta-400 border border-magenta-500/30 rounded-lg text-[9px] font-black hover:bg-magenta-500 hover:text-white transition active:scale-95"
                            >
                                <Send size={10} />
                                {testing ? 'PINGING...' : 'TEST_STRAT'}
                            </button>
                        </div>
                        <div className="space-y-5">
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 tracking-widest px-1">Bot Token</label>
                                <input 
                                    type="password" 
                                    name="telegram_token"
                                    value={config.telegram_token}
                                    onChange={handleChange}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-magenta-500/50 transition-all font-mono text-magenta-400"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 tracking-widest px-1">Receiver User ID</label>
                                <input 
                                    type="text" 
                                    name="telegram_user_id"
                                    value={config.telegram_user_id}
                                    onChange={handleChange}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-magenta-500/50 transition-all font-mono text-magenta-400"
                                />
                            </div>
                        </div>
                    </section>

                    <section className="bg-slate-900/40 p-8 rounded-3xl border border-slate-800 backdrop-blur-md space-y-6 cyber-border">
                        <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                            <Cpu className="text-yellow-400 cyber-text-glow" size={20} />
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-400">Ollama Neuro-Link</h3>
                        </div>
                        <div className="space-y-5">
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 tracking-widest px-1">Ollama Endpoint</label>
                                <input 
                                    type="text" 
                                    name="ollama_url"
                                    value={config.ollama_url}
                                    onChange={handleChange}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-yellow-500/50 transition-all font-mono text-yellow-500"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 tracking-widest px-1">Model Identity</label>
                                <input 
                                    type="text" 
                                    name="ollama_model"
                                    value={config.ollama_model}
                                    onChange={handleChange}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-yellow-500/50 transition-all font-mono text-yellow-500"
                                />
                            </div>
                        </div>
                    </section>

                    <section className="bg-slate-900/40 p-8 rounded-3xl border border-slate-800 backdrop-blur-md space-y-6 cyber-border">
                        <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                            <RefreshCcw className="text-cyan-400 cyber-text-glow" size={20} />
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">自動排程間隔 // SCHEDULER_INTERVALS</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[9px] font-black text-gray-500 uppercase mb-2 tracking-widest px-1">商品爬蟲間隔 (m)</label>
                                <input 
                                    type="number" 
                                    name="crawl_interval_mins"
                                    value={config.crawl_interval_mins}
                                    onChange={handleChange}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-cyan-500/50 transition-all font-mono text-cyan-400 text-xs"
                                />
                            </div>
                            <div>
                                <label className="block text-[9px] font-black text-gray-500 uppercase mb-2 tracking-widest px-1">AI 預測更新 (h)</label>
                                <input 
                                    type="number" 
                                    name="ai_prediction_interval_hours"
                                    value={config.ai_prediction_interval_hours}
                                    onChange={handleChange}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-cyan-500/50 transition-all font-mono text-cyan-400 text-xs"
                                />
                            </div>
                            <div>
                                <label className="block text-[9px] font-black text-gray-500 uppercase mb-2 tracking-widest px-1">摘要掃描頻率 (m)</label>
                                <input 
                                    type="number" 
                                    name="summary_sweep_interval_mins"
                                    value={config.summary_sweep_interval_mins}
                                    onChange={handleChange}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-cyan-500/50 transition-all font-mono text-cyan-400 text-xs"
                                />
                            </div>
                            <div>
                                <label className="block text-[9px] font-black text-gray-500 uppercase mb-2 tracking-widest px-1">詳情補全頻率 (m)</label>
                                <input 
                                    type="number" 
                                    name="metadata_enrichment_interval_mins"
                                    value={config.metadata_enrichment_interval_mins}
                                    onChange={handleChange}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-cyan-500/50 transition-all font-mono text-cyan-400 text-xs"
                                />
                            </div>
                        </div>
                    </section>
                    <section className="bg-slate-900/40 p-8 rounded-3xl border border-slate-800 backdrop-blur-md space-y-6 cyber-border">
                        <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                            <Shield className="text-orange-400 cyber-text-glow" size={20} />
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-400">進階防封禁設定 // STEALTH_OPS</h3>
                        </div>
                        <div className="space-y-5">
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 tracking-widest px-1">隱身強度 (STEALTH_LEVEL)</label>
                                <select 
                                    name="crawler_stealth_level"
                                    value={config.crawler_stealth_level}
                                    onChange={handleChange}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-orange-500/50 text-[11px] font-black uppercase text-orange-400/80 appearance-none"
                                >
                                    <option value="high">HIGH (30-90s Jitter)</option>
                                    <option value="balanced">BALANCED (5-15s Jitter)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-2 tracking-widest px-1">自定義代理列表 (One per line)</label>
                                <textarea 
                                    name="custom_proxies"
                                    value={config.custom_proxies}
                                    onChange={handleChange}
                                    placeholder="127.0.0.1:8080&#10;user:pass@proxy.com:3128"
                                    rows={4}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-orange-500/50 transition-all font-mono text-orange-400 text-[10px] leading-relaxed resize-none"
                                />
                                <p className="text-[9px] text-gray-600 mt-2 italic">* 系統將優先使用您的自定義地址，失效時自動切換備份池。</p>
                            </div>
                        </div>
                    </section>

                    <section className="bg-slate-950/60 p-8 rounded-3xl border border-emerald-500/20 space-y-6 cyber-border col-span-1 md:col-span-3">
                        <div className="flex items-center gap-3 border-b border-emerald-500/20 pb-4">
                            <Globe className="text-emerald-400 cyber-text-glow" size={20} />
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">行情同步擴充 // URL_INJECTOR</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                            <div className="md:col-span-3">
                                <label className="block text-[10px] font-black text-gray-600 uppercase mb-2 tracking-widest px-1">Target Category</label>
                                <select 
                                    className="w-full bg-slate-950 border border-emerald-500/20 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 text-[11px] font-black uppercase tracking-widest text-emerald-500/70 appearance-none shadow-inner"
                                    value={importCategory}
                                    onChange={e => setImportCategory(e.target.value)}
                                >
                                    <option value="">-- SELECT_CATEGORY --</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="md:col-span-6">
                                <label className="block text-[10px] font-black text-gray-600 uppercase mb-2 tracking-widest px-1">Remote Data URL</label>
                                <input 
                                    type="text" 
                                    placeholder="https://source.platform.com/prices..."
                                    value={importUrl}
                                    onChange={e => setImportUrl(e.target.value)}
                                    className="w-full bg-slate-950 border border-emerald-500/20 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 transition font-mono text-xs text-emerald-400 placeholder:text-emerald-900"
                                />
                            </div>
                            <div className="md:col-span-3">
                                <button 
                                    onClick={handleImportUrl}
                                    disabled={importing || !importUrl || !importCategory}
                                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-20 rounded-xl font-black text-[11px] uppercase tracking-widest transition shadow-2xl shadow-emerald-600/20 text-white cyber-button"
                                >
                                    {importing ? "SYCHRONIZING..." : "START_IMPORT"}
                                </button>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Column 2: Hierarchy Management */}
                <div className="lg:col-span-12">
                    <section className="bg-slate-900/40 p-10 rounded-[2.5rem] border border-slate-800 shadow-2xl relative overflow-hidden cyber-border">
                        <div className="flex justify-between items-center mb-12 border-b border-white/5 pb-8 relative z-10">
                             <div className="flex items-center gap-4">
                                <div className="p-3 bg-cyan-500/10 rounded-2xl border border-cyan-500/20">
                                    <Monitor className="text-cyan-400 cyber-text-glow" size={24} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black italic tracking-tighter text-white uppercase px-1">MONITOR_HIERARCHY</h3>
                                    <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mt-1">Target Node Definition // Tree_V2.0</p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <input 
                                    type="text" 
                                    placeholder="NEW_CAT_IDENTITY..."
                                    value={newCategory}
                                    onChange={(e) => setNewCategory(e.target.value)}
                                    className="bg-slate-950 border border-white/10 rounded-2xl px-6 py-3 text-xs outline-none focus:border-cyan-500/50 transition w-72 font-mono text-cyan-400"
                                />
                                <button onClick={addCategory} className="p-3 bg-cyan-600 hover:bg-cyan-500 rounded-2xl transition text-white shadow-xl shadow-cyan-600/30 cyber-button active:scale-90"><Plus size={22}/></button>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10 relative z-10">
                            {categories.map(cat => (
                                <div key={cat.id} className="bg-slate-950/50 rounded-[2rem] border border-white/5 flex flex-col hover:border-cyan-500/30 transition-all duration-700 group/cat overflow-hidden shadow-inner">
                                    <div className="bg-slate-900/80 px-8 py-6 flex justify-between items-center border-b border-white/5 group-hover/cat:bg-slate-800/80 transition duration-500">
                                        <span className="font-black text-gray-200 text-xs uppercase tracking-[0.2em] flex items-center gap-3">
                                            {cat.name === "手機" ? <Smartphone size={16} className="text-cyan-400 cyber-text-glow"/> : (cat.name === "筆電" ? <Laptop size={16} className="text-magenta-400 cyber-text-glow"/> : <Monitor size={16} className="text-yellow-400 cyber-text-glow"/>)}
                                            {cat.name}
                                        </span>
                                        <div className="flex gap-5">
                                            <button onClick={() => setModal({ type: 'model', parentId: cat.id, title: `新增「${cat.name}」下的型號` })} className="text-cyan-400 hover:scale-125 transition-all cyber-text-glow"><Plus size={22}/></button>
                                            <button onClick={() => deleteItem('categories', cat.id, cat.name)} className="text-gray-700 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                                        </div>
                                    </div>
                                    <div className="p-8 flex-1 min-h-[300px] space-y-10 bg-gradient-to-b from-transparent to-slate-950/30">
                                        {cat.models?.length > 0 ? cat.models?.map(model => (
                                            <div key={model.id} className="pl-6 border-l-2 border-cyan-500/10 hover:border-cyan-500/40 transition-colors group/model">
                                                <div className="flex justify-between items-center mb-5">
                                                    <span className="text-[11px] font-black text-gray-400 tracking-widest uppercase">{model.name}</span>
                                                    <div className="flex gap-4 opacity-0 group-hover/model:opacity-100 transition duration-500">
                                                        <button onClick={() => setModal({ type: 'spec', parentId: model.id, title: `新增「${model.name}」的規格` })} className="text-cyan-500 font-black text-[9px] uppercase tracking-widest hover:text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">Add_Spec</button>
                                                        <button onClick={() => deleteItem('models', model.id, model.name)} className="text-gray-700 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-3">
                                                    {model.specifications?.map(spec => (
                                                        <div key={spec.id} className="flex items-center gap-3 bg-slate-900 border border-white/5 px-4 py-2 rounded-xl text-[9px] font-black text-gray-600 hover:text-cyan-400 hover:border-cyan-500/30 transition-all group/spec cursor-default shadow-sm hover:shadow-cyan-500/5">
                                                            <span className="uppercase tracking-widest">{spec.name}</span>
                                                            <button onClick={() => deleteItem('specifications', spec.id, spec.name)} className="text-gray-800 hover:text-red-500 border-l border-white/10 pl-3 ml-1 transition-colors"><X size={12}/></button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="h-full flex flex-col items-center justify-center text-gray-800 font-black italic text-[10px] uppercase opacity-20 tracking-[0.5em] gap-4">
                                                <Database size={40} />
                                                <span>Node_Empty</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
