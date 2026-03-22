import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Brain, TrendingUp, Info, User, Layers, RefreshCw } from 'lucide-react';

const AIPredictions = () => {
    const [predictions, setPredictions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPredictions();
    }, []);

    const fetchPredictions = () => {
        setLoading(true);
        axios.get('/api/market-predictions')
            .then(res => setPredictions(res.data))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    };

    return (
        <div className="p-8 w-full space-y-8 relative cyber-grid min-h-screen">
            <div className="scanline"></div>
            
            <header className="flex justify-between items-center relative z-10">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-cyan-400 to-magenta-500 bg-clip-text text-transparent cyber-text-glow uppercase italic">AI 市場預測</h1>
                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2 opacity-70">Predictive Intelligence // Market_Forecasting</p>
                </div>
                <div className="flex gap-4 items-center">
                    <button 
                        onClick={() => {
                          axios.post('/api/ai/predict/trigger');
                          setTimeout(fetchPredictions, 3000); // refresh after brief delay
                        }}
                        className="flex items-center gap-2 bg-cyan-600/20 text-cyan-400 border border-cyan-500/50 hover:bg-cyan-600 hover:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(0,243,255,0.2)] active:scale-95 cyber-button flex-shrink-0"
                    >
                        <Brain size={14} />
                        立即執行市價預測
                    </button>
                    <button 
                      onClick={fetchPredictions}
                      className="p-4 bg-slate-900 border border-white/10 rounded-2xl hover:border-cyan-500/50 hover:text-cyan-400 transition-all duration-500 group"
                    >
                        <RefreshCw size={20} className={`group-hover:rotate-180 transition-transform duration-700 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 gap-6 relative z-10">
                {predictions.map(p => (
                    <div key={p.id} className="bg-slate-900/40 rounded-[2rem] border border-slate-800 p-8 flex flex-col hover:border-cyan-500/30 transition-all group cyber-border backdrop-blur-md">
                        <div className="flex flex-wrap items-center justify-between gap-8 w-full">
                            <div className="flex-1 min-w-[300px]">
                                <div className="flex items-center gap-3 mb-2">
                                    <Layers size={14} className="text-cyan-500" />
                                    <span className="text-[10px] font-black text-cyan-500/50 uppercase tracking-widest">Specification_ID: {p.specification_id}</span>
                                </div>
                                <h2 className="text-2xl font-black text-white group-hover:text-cyan-400 transition-colors uppercase tracking-tighter">{p.specification_name}</h2>
                                <div className="mt-4 flex items-center gap-4">
                                    <span className="flex items-center gap-1.5 px-3 py-1 bg-slate-950 rounded-full border border-white/5 text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                                        <Info size={12} />
                                        樣本數: {p.sample_size} 筆有效刊登
                                    </span>
                                    <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest italic">
                                        最後更新: {new Date(p.updated_at).toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-12">
                                <div className="flex flex-col items-center p-6 bg-slate-950/50 rounded-3xl border border-white/5 min-w-[160px]">
                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <User size={12} /> 手標基準價
                                    </span>
                                    <span className="text-xl font-black text-white">NT$ {p.user_manual_price?.toLocaleString() || '---'}</span>
                                </div>

                                <div className="flex items-center text-cyan-500/20">
                                    <TrendingUp size={32} />
                                </div>

                                <div className="flex flex-col items-center p-6 bg-cyan-500/5 rounded-3xl border border-cyan-500/20 min-w-[200px] relative overflow-hidden group/pred">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-cyan-500 shadow-[0_0_10px_rgba(0,243,255,1)]"></div>
                                    <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <Brain size={12} className="animate-pulse" /> AI 預測市價
                                    </span>
                                    <span className="text-3xl font-black text-white cyber-text-glow">NT$ {p.predicted_price?.toLocaleString() || '0'}</span>
                                </div>
                            </div>
                        </div>

                        {/* AI Analysis Block */}
                        {p.ai_analysis && (
                            <div className="w-full mt-8 pt-6 border-t border-slate-800/50 grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="bg-slate-950/30 p-5 rounded-2xl border border-emerald-500/10">
                                    <span className="text-[9px] font-black text-emerald-500/70 uppercase tracking-widest block mb-2">建議收購價</span>
                                    <span className="text-xl font-black text-emerald-400">NT$ {p.ai_analysis.suggested_buy_price?.toLocaleString() || '---'}</span>
                                </div>
                                <div className="bg-slate-950/30 p-5 rounded-2xl border border-blue-500/10">
                                    <span className="text-[9px] font-black text-blue-500/70 uppercase tracking-widest block mb-2">建議轉售價</span>
                                    <span className="text-xl font-black text-blue-400">NT$ {p.ai_analysis.suggested_sell_price?.toLocaleString() || '---'}</span>
                                </div>
                                <div className="bg-slate-950/30 p-5 rounded-2xl border border-magenta-500/10">
                                    <span className="text-[9px] font-black text-magenta-500/70 uppercase tracking-widest block mb-2">市場熱度</span>
                                    <span className="text-sm font-bold text-magenta-400">{p.ai_analysis.market_demand || '---'}</span>
                                </div>
                                <div className="bg-slate-950/30 p-5 rounded-2xl border border-amber-500/10">
                                    <span className="text-[9px] font-black text-amber-500/70 uppercase tracking-widest block mb-2">跌價風險</span>
                                    <span className="text-xs font-bold text-amber-400 mt-1 block leading-relaxed">{p.ai_analysis.risk_assessment || '---'}</span>
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {predictions.length === 0 && !loading && (
                    <div className="py-40 flex flex-col items-center justify-center text-gray-700 bg-slate-900/40 rounded-[2rem] border border-slate-800 border-dashed">
                        <Brain size={80} className="opacity-10 mb-6" />
                        <p className="text-xs font-black uppercase tracking-[0.5em] opacity-30">Waiting for first hourly AI prediction cycle...</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AIPredictions;
