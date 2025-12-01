
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-gray-900/95 border border-white/10 w-full max-w-2xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-purple-900/20 to-blue-900/20">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                            <Sparkles className="text-white" size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">ZEEVRA AI Assistant</h3>
                            <p className="text-xs text-purple-300">Powered by Gemini 2.5 Flash</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 text-gray-300 space-y-4">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center gap-4 text-purple-300">
                            <Loader2 size={48} className="animate-spin" />
                            <p className="animate-pulse font-medium">Analyzing inventory patterns...</p>
                        </div>
                    ) : isApiKeyError ? (
                        <div className="h-full flex flex-col items-center justify-center gap-4 text-center p-8">
                            <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-2">
                                <KeyRound size={40} className="text-red-400" />
                            </div>
                            <h4 className="text-xl font-bold text-white">API Key Not Found</h4>
                            <p className="text-gray-400 max-w-md">
                                The application could not detect a valid <code>API_KEY</code> in the environment variables.
                            </p>
                            <div className="bg-white/5 p-4 rounded-lg border border-white/10 text-sm text-left w-full max-w-md mt-2">
                                <p className="text-gray-300 mb-2 font-semibold flex items-center gap-2">
                                    <AlertTriangle size={14} className="text-yellow-400"/>
                                    How to fix:
                                </p>
                                <p className="text-gray-400">
                                    Do not edit the code. Ensure the <code>API_KEY</code> environment variable is set in your deployment settings or `.env` configuration file.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="prose prose-invert prose-sm max-w-none prose-headings:text-gray-100 prose-p:text-gray-300 prose-strong:text-white">
                            <ReactMarkdown>{analysis}</ReactMarkdown>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 bg-black/20 flex justify-end">
                    <button 
                        onClick={runAnalysis} 
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-medium transition-colors border border-white/5 text-gray-300 hover:text-white"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        {isApiKeyError ? 'Retry Connection' : 'Regenerate Analysis'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GeminiModal;
