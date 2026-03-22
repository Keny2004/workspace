import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, Bell, DollarSign, Cpu, Trash2, Plus, Monitor, CheckCircle, Smartphone, Laptop, Tablet, Info, Send, X, AlertCircle, Globe } from 'lucide-react';

const SettingsPage = () => {
    const [config, setConfig] = useState({
        profit_margin: "5",
        telegram_token: "",
        telegram_user_id: "",
        telegram_profit_threshold: "1000",
        ollama_url: "http://localhost:11434/api/generate",
        ollama_model: "gemma3:1b",
        app_url: "http://localhost:3000"
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
        <div className="p-8 w-full mx-auto space-y-10 relative">
            {/* Custom Toast */}
            {notification && (
                <div className="fixed top-24 right-10 z-50 animate-in slide-in-from-right duration-500">
                    <div className={`${notification.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'} text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 font-bold border border-white/20`}>
                        {notification.type === 'error' ? <AlertCircle size={20}/> : <CheckCircle size={20}/>}
                        {notification.msg}
                    </div>
                </div>
            )}

            {/* Custom Modal */}
            {modal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-slate-800 border border-slate-700 p-8 rounded-3xl shadow-2xl w-full max-w-md space-y-6">
                        <h3 className="text-xl font-bold">{modal.title}</h3>
                        {modal.type !== 'confirm' ? (
                            <input 
                                autoFocus
                                type="text" 
                                placeholder="請輸入名稱..."
                                value={modalInputValue}
                                onChange={(e) => setModalInputValue(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/50"
                                onKeyDown={(e) => e.key === 'Enter' && handleModalSubmit(modalInputValue)}
                            />
                        ) : (
                            <p className="text-gray-400 text-sm">此操作無法復原，請謹慎執行。</p>
                        )}
                        <div className="flex justify-end gap-4">
                            <button onClick={() => setModal(null)} className="px-6 py-2 text-gray-400 font-bold hover:text-white transition">取消</button>
                            {modal.type === 'confirm' ? (
                                <button 
                                    onClick={modal.clearAll ? executeClear : confirmDelete} 
                                    className="px-6 py-2 bg-red-600 hover:bg-red-500 rounded-xl font-bold transition"
                                >
                                    確認刪除
                                </button>
                            ) : (
                                <button 
                                    onClick={() => handleModalSubmit(modalInputValue)} 
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition"
                                >
                                    確認新增
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
                <div>
                    <h1 className="text-4xl font-black tracking-tight mb-2">系統設定</h1>
                    <p className="text-gray-400 font-medium">系統核心參數與追蹤目標配置中心</p>
                </div>
                <div className="flex gap-4">
                    <button 
                        onClick={clearData}
                        className="px-6 py-2 bg-red-600/10 text-red-400 border border-red-500/20 hover:bg-red-600/20 rounded-xl font-bold transition text-sm"
                    >
                        清空舊資料
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition disabled:opacity-50 text-sm shadow-xl shadow-blue-500/20"
                    >
                        <Save size={18} />
                        {saving ? "處理中..." : "儲存變更"}
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Column 1: Config Groups */}
                <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <section className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 backdrop-blur-sm space-y-6">
                        <div className="flex items-center gap-3 border-b border-slate-700 pb-4">
                            <DollarSign className="text-blue-400" size={20} />
                            <h3 className="font-bold">金流與門檻</h3>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">獲利判定趴數 (%)</label>
                                <input 
                                    type="number" 
                                    name="profit_margin"
                                    value={config.profit_margin}
                                    onChange={handleChange}
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 transition"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Telegram 推播門檻 ($)</label>
                                <input 
                                    type="number" 
                                    name="telegram_profit_threshold"
                                    value={config.telegram_profit_threshold}
                                    onChange={handleChange}
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 transition"
                                />
                            </div>
                        </div>
                    </section>

                    <section className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 backdrop-blur-sm space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-700 pb-4">
                            <div className="flex items-center gap-3">
                                <Bell className="text-purple-400" size={20} />
                                <h3 className="font-bold">Telegram 權限</h3>
                            </div>
                            <button 
                                onClick={testTelegram}
                                disabled={testing}
                                className="flex items-center gap-1 px-3 py-1 bg-purple-600/20 text-purple-400 border border-purple-500/30 rounded-lg text-[10px] font-black hover:bg-purple-600 hover:text-white transition disabled:opacity-50"
                            >
                                <Send size={10} />
                                {testing ? 'TESTING' : 'TEST NOW'}
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Bot Token</label>
                                <input 
                                    type="password" 
                                    name="telegram_token"
                                    value={config.telegram_token}
                                    onChange={handleChange}
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-purple-500/50 transition"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Receiver User ID</label>
                                <input 
                                    type="text" 
                                    name="telegram_user_id"
                                    value={config.telegram_user_id}
                                    onChange={handleChange}
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-purple-500/50 transition"
                                />
                            </div>
                        </div>
                    </section>

                    <section className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 backdrop-blur-sm space-y-6">
                        <div className="flex items-center gap-3 border-b border-slate-700 pb-4">
                            <Cpu className="text-yellow-400" size={20} />
                            <h3 className="font-bold">Ollama 推論</h3>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Ollama Endpoint</label>
                                <input 
                                    type="text" 
                                    name="ollama_url"
                                    value={config.ollama_url}
                                    onChange={handleChange}
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-yellow-500/50 transition"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Model Name</label>
                                <input 
                                    type="text" 
                                    name="ollama_model"
                                    value={config.ollama_model}
                                    onChange={handleChange}
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-yellow-500/50 transition"
                                />
                            </div>
                        </div>
                    </section>

                    <section className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 backdrop-blur-sm space-y-6">
                        <div className="flex items-center gap-3 border-b border-slate-700 pb-4">
                            <Globe className="text-emerald-400" size={20} />
                            <h3 className="font-bold">外部行情自動匯入</h3>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <select 
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/50 mb-3 text-sm text-gray-300"
                                    value={importCategory}
                                    onChange={e => setImportCategory(e.target.value)}
                                >
                                    <option value="">選擇目標擴充分類...</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <input 
                                    type="text" 
                                    placeholder="貼上收購價網址..."
                                    value={importUrl}
                                    onChange={e => setImportUrl(e.target.value)}
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/50 transition mb-3 text-sm"
                                />
                                <button 
                                    onClick={handleImportUrl}
                                    disabled={importing || !importUrl || !importCategory}
                                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:bg-slate-700 rounded-xl font-bold transition shadow-lg shadow-emerald-500/20 text-sm"
                                >
                                    {importing ? "匯入分析中..." : "開始擴充資料庫"}
                                </button>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Column 2: Hierarchy Management */}
                <div className="lg:col-span-12">
                    <section className="bg-slate-800/50 p-8 rounded-3xl border border-slate-700/50 shadow-2xl">
                        <div className="flex justify-between items-center mb-10 border-b border-slate-700 pb-6">
                             <div className="flex items-center gap-3">
                                <Monitor className="text-emerald-400" size={24} />
                                <h3 className="text-xl font-black italic tracking-tighter">MONITOR HIERARCHY</h3>
                            </div>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    placeholder="新增類別名稱..."
                                    value={newCategory}
                                    onChange={(e) => setNewCategory(e.target.value)}
                                    className="bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/50 transition w-64"
                                />
                                <button onClick={addCategory} className="p-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl transition text-white shadow-lg shadow-emerald-500/20"><Plus size={20}/></button>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                            {categories.map(cat => (
                                <div key={cat.id} className="bg-slate-900/30 rounded-3xl border border-slate-700/50 flex flex-col hover:border-slate-500 transition duration-500 group/cat overflow-hidden">
                                    <div className="bg-slate-800/50 px-6 py-5 flex justify-between items-center border-b border-slate-700/50 group-hover/cat:bg-slate-700/50 transition">
                                        <span className="font-bold text-gray-200 tracking-wide flex items-center gap-2">
                                            {cat.name === "手機" ? <Smartphone size={16} className="text-blue-400"/> : (cat.name === "筆電" ? <Laptop size={16} className="text-purple-400"/> : <Monitor size={16} className="text-emerald-400"/>)}
                                            {cat.name}
                                        </span>
                                        <div className="flex gap-4">
                                            <button onClick={() => setModal({ type: 'model', parentId: cat.id, title: `新增「${cat.name}」下的型號` })} className="text-emerald-400 hover:scale-125 transition"><Plus size={20}/></button>
                                            <button onClick={() => deleteItem('categories', cat.id, cat.name)} className="text-gray-600 hover:text-red-400 transition"><Trash2 size={18}/></button>
                                        </div>
                                    </div>
                                    <div className="p-6 flex-1 min-h-[200px] space-y-8 bg-slate-900/20">
                                        {cat.models?.length > 0 ? cat.models?.map(model => (
                                            <div key={model.id} className="pl-4 border-l-2 border-blue-500/20 group/model">
                                                <div className="flex justify-between items-center mb-4">
                                                    <span className="text-sm font-black text-gray-300 tracking-tight">{model.name}</span>
                                                    <div className="flex gap-3 opacity-0 group-hover/model:opacity-100 transition">
                                                        <button onClick={() => setModal({ type: 'spec', parentId: model.id, title: `新增「${model.name}」的規格` })} className="text-blue-400 font-black text-[10px] uppercase tracking-tighter hover:text-blue-300">Add Spec</button>
                                                        <button onClick={() => deleteItem('models', model.id, model.name)} className="text-gray-700 hover:text-red-400 transition"><Trash2 size={14}/></button>
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {model.specifications?.map(spec => (
                                                        <div key={spec.id} className="flex items-center gap-2.5 bg-slate-800 border border-slate-700/50 px-3 py-1.5 rounded-xl text-[10px] font-black text-gray-500 hover:text-gray-200 transition group/spec">
                                                            <span>{spec.name}</span>
                                                            <button onClick={() => deleteItem('specifications', spec.id, spec.name)} className="text-gray-700 hover:text-red-500 border-l border-slate-700 pl-2 ml-1"><X size={10}/></button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="h-full flex items-center justify-center text-gray-700 font-bold italic text-xs uppercase opacity-20">
                                                Empty Category
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
