import React, { useState } from 'react';
import axios from 'axios';
import { Sparkles, Copy, ShoppingBag, Smartphone, DollarSign, Tag, CheckCircle2, ChevronRight, BrainCircuit } from 'lucide-react';

const ListingGenerator = () => {
    const [formData, setFormData] = useState({
        product_name: '',
        condition: '',
        target_price: '',
        platform: '蝦皮購物'
    });
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState('');
    const [copied, setCopied] = useState(false);

    const handleGenerate = async (e) => {
        e.preventDefault();
        setLoading(true);
        setResult('');
        try {
            const res = await axios.post('/api/ai/generate-listing', formData);
            if (res.data.status === 'success') {
                setResult(res.data.data);
            } else {
                setResult(`Error: ${res.data.message}`);
            }
        } catch (err) {
            setResult('Failed to connect to AI engine.');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(result);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="p-8 w-full max-w-6xl mx-auto space-y-8 relative cyber-grid min-h-screen animate-in fade-in duration-700">
            <div className="scanline"></div>
            
            <header className="relative z-10">
                <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent cyber-text-glow uppercase italic flex items-center gap-4">
                    <Sparkles className="text-emerald-400" size={32} /> 轉售文案生成器
                </h1>
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2 opacity-70">Neural Copywriter // Listing_Automation</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
                {/* Form Section */}
                <div className="bg-slate-900/40 rounded-[2rem] border border-slate-800 p-8 cyber-border backdrop-blur-md shadow-2xl relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[2rem] pointer-events-none"></div>
                    <h2 className="text-sm font-black text-cyan-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <BrainCircuit size={16} /> 輸入拍賣參數
                    </h2>
                    
                    <form onSubmit={handleGenerate} className="space-y-5 relative z-10">
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                                <Smartphone size={12} /> 商品名稱
                            </label>
                            <input 
                                type="text" 
                                required
                                value={formData.product_name}
                                onChange={e => setFormData({...formData, product_name: e.target.value})}
                                placeholder="例如: iPhone 14 Pro 256G 黑色"
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-gray-200 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all placeholder:text-slate-700"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                                <Tag size={12} /> 機況描述 (優缺點均可)
                            </label>
                            <textarea 
                                required
                                rows={3}
                                value={formData.condition}
                                onChange={e => setFormData({...formData, condition: e.target.value})}
                                placeholder="例如: 電池健康度88%，外觀無傷，有貼保貼，單機無盒裝配件"
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-gray-200 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all placeholder:text-slate-700 resize-none custom-scrollbar"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                                    <DollarSign size={12} /> 預計售價
                                </label>
                                <input 
                                    type="text" 
                                    required
                                    value={formData.target_price}
                                    onChange={e => setFormData({...formData, target_price: e.target.value})}
                                    placeholder="例如: 23500 或 隨便您定"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-gray-200 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all placeholder:text-slate-700"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                                    <ShoppingBag size={12} /> 預計上架平台
                                </label>
                                <select 
                                    value={formData.platform}
                                    onChange={e => setFormData({...formData, platform: e.target.value})}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-gray-200 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
                                >
                                    <option value="蝦皮購物">蝦皮購物</option>
                                    <option value="旋轉拍賣">旋轉拍賣</option>
                                    <option value="Facebook Marketplace">Facebook Marketplace</option>
                                    <option value="PTT MacShop / Mobilesales">PTT (BBS)</option>
                                </select>
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full mt-6 flex justify-center items-center gap-2 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white p-4 rounded-xl font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group cyber-button"
                        >
                            {loading ? (
                                <span className="flex items-center gap-2"><Sparkles className="animate-spin" size={18} /> GENERATING NEURAL COPY...</span>
                            ) : (
                                <span className="flex items-center gap-2">生成高轉化率文案 <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" /></span>
                            )}
                        </button>
                    </form>
                </div>

                {/* Result Section */}
                <div className="bg-slate-900/40 rounded-[2rem] border border-slate-800 p-8 cyber-border backdrop-blur-md flex flex-col relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none"></div>
                    
                    <div className="flex items-center justify-between mb-6 z-10">
                        <h2 className="text-sm font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                            <Sparkles size={16} /> 智能生成結果
                        </h2>
                        
                        {result && (
                            <button 
                                onClick={copyToClipboard}
                                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[10px] font-bold text-gray-300 hover:text-white transition-colors active:scale-95"
                            >
                                {copied ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                {copied ? 'COPIED!' : 'COPY TEXT'}
                            </button>
                        )}
                    </div>

                    <div className="flex-1 bg-slate-950/80 rounded-xl border border-white/5 p-6 relative overflow-auto custom-scrollbar shadow-inner z-10 min-h-[400px]">
                        {!result && !loading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600 opacity-30">
                                <BrainCircuit size={64} className="mb-6 text-slate-700" />
                                <p className="text-[10px] font-black uppercase tracking-[0.4em]">Awaiting Input Parameters</p>
                            </div>
                        )}
                        
                        {loading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-emerald-500/50">
                                <div className="w-12 h-12 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">Running Language Model...</p>
                            </div>
                        )}

                        {result && !loading && (
                            <pre className="text-sm text-gray-300 font-sans whitespace-pre-wrap leading-relaxed animate-in slide-in-from-bottom-2 duration-500">
                                {result}
                            </pre>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ListingGenerator;
