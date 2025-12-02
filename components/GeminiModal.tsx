
import React, { useEffect, useState } from 'react';
import { InventoryItem } from '../types';
import { analyzeInventory } from '../services/geminiService';
import { Sparkles, X, Loader2, RefreshCw, AlertTriangle, KeyRound } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface GeminiModalProps {
    isOpen: boolean;
    items: InventoryItem[];
    onClose: () => void;
}

const GeminiModal: React.FC<GeminiModalProps> = ({ isOpen, items, onClose }) => {
    const [loading, setLoading] = useState(false);
    const [analysis, setAnalysis] = useState<string>('');

    const runAnalysis = async () => {
        setLoading(true);
        const result = await analyzeInventory(items);
        setAnalysis(result);
        setLoading(false);
    };

    useEffect(() => {
        if (isOpen && !analysis) {
            runAnalysis();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const isApiKeyError = analysis.includes("API Key is missing");

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md animate-fade-in" onClick={onClose} />
            
            <div className="glass-panel w-full max-w-2xl h-[80vh] rounded-[32px] shadow-[0_0_50px_rgba(188,19,254,0.15)] flex flex-col overflow-hidden relative z-10 animate-scale-in border border-white/10 bg-[#050505]/80">
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-[#bc13fe]/10 to-transparent">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-[#bc13fe]/10 border border-[#bc13fe]/30 flex items-center justify-center shadow-[0_0_15px_rgba(188,19,254,0.2)]">
                            <Sparkles className="text-[#bc13fe]" size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-white tracking-tight uppercase">ZEEVRA AI</h3>
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#39ff14] shadow-[0_0_5px_#39ff14]"></span>
                                <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Gemini 2.5 Flash</p>
                            </div>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 transition-colors border border-white/5"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center gap-6">
                            <div className="relative">
                                <div className="absolute inset-0 bg-[#bc13fe] blur-xl opacity-20 animate-pulse"></div>
                                <Loader2 size={64} className="text-[#bc13fe] animate-spin relative z-10" />
                            </div>
                            <p className="text-sm font-bold text-[#bc13fe] tracking-widest animate-pulse uppercase">Analyzing Inventory Data...</p>
                        </div>
                    ) : isApiKeyError ? (
                        <div className="h-full flex flex-col items-center justify-center gap-6 text-center p-4">
                            <div className="w-24 h-24 rounded-full bg-[#ff073a]/10 flex items-center justify-center border border-[#ff073a]/20 shadow-[0_0_30px_rgba(255,7,58,0.2)]">
                                <KeyRound size={48} className="text-[#ff073a]" />
                            </div>
                            <div>
                                <h4 className="text-2xl font-black text-white mb-2">API KEY MISSING</h4>
                                <p className="text-gray-400 max-w-md mx-auto leading-relaxed">
                                    The application needs a valid <code>API_KEY</code> to communicate with Gemini.
                                </p>
                            </div>
                            <div className="glass-card p-4 rounded-xl border-l-2 border-[#ff073a] text-left w-full max-w-md">
                                <p className="text-[#ff073a] text-xs font-bold uppercase mb-1 flex items-center gap-2">
                                    <AlertTriangle size={12} /> System Alert
                                </p>
                                <p className="text-gray-400 text-xs">
                                    Ensure the environment variable is configured in your deployment settings.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="prose prose-invert prose-sm max-w-none 
                            prose-headings:text-white prose-headings:font-bold prose-headings:uppercase prose-headings:tracking-wide
                            prose-p:text-gray-300 prose-p:leading-relaxed
                            prose-strong:text-[#00f3ff] prose-strong:font-bold
                            prose-ul:marker:text-[#bc13fe]
                            prose-li:text-gray-300"
                        >
                            <ReactMarkdown>{analysis}</ReactMarkdown>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/5 bg-[#050505]/50 flex justify-end backdrop-blur-sm">
                    <button 
                        onClick={runAnalysis} 
                        disabled={loading}
                        className={`
                            flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all
                            ${loading 
                                ? 'bg-white/5 text-gray-500 cursor-not-allowed' 
                                : 'bg-[#bc13fe]/10 border border-[#bc13fe]/30 text-[#bc13fe] hover:bg-[#bc13fe]/20 hover:shadow-[0_0_20px_rgba(188,19,254,0.2)] active:scale-95'}
                        `}
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        {isApiKeyError ? 'Retry Connection' : 'Regenerate Analysis'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GeminiModal;
