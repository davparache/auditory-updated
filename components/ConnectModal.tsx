
import React, { useState } from 'react';
import { Cloud, Lock, Info, RefreshCcw } from 'lucide-react';

interface ConnectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConnect: (sessionId: string, pin: string) => void;
    onResetPin: (sessionId: string, newPin: string) => void;
}

const ConnectModal: React.FC<ConnectModalProps> = ({ isOpen, onClose, onConnect, onResetPin }) => {
    const [sessionId, setSessionId] = useState('');
    const [pin, setPin] = useState('');
    const [isResetMode, setIsResetMode] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (sessionId.trim()) {
            if (isResetMode) {
                onResetPin(sessionId.trim(), pin.trim());
            } else {
                onConnect(sessionId.trim(), pin.trim());
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
                onClick={onClose}
            />

            {/* Sheet */}
            <div className="w-full glass-panel bg-[#050505]/90 rounded-t-[36px] overflow-hidden shadow-[0_-10px_50px_rgba(0,0,0,0.8)] animate-slide-up relative z-10 pb-10 border-t border-white/10">
                <div className="w-16 h-1.5 bg-white/20 rounded-full mx-auto mt-4 mb-8"></div>
                
                <div className="px-8">
                    <div className="flex items-center gap-5 mb-8">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)] border border-white/5 ${isResetMode ? 'bg-[#ff073a]/10 text-[#ff073a]' : 'bg-[#00f3ff]/10 text-[#00f3ff]'}`}>
                            {isResetMode ? <RefreshCcw size={32} /> : <Cloud size={32} className="drop-shadow-[0_0_10px_rgba(0,243,255,0.5)]" />}
                        </div>
                        <div>
                            <h3 className="text-3xl font-black text-white tracking-tight">
                                {isResetMode ? 'UPDATE PIN' : 'SYNC CLOUD'}
                            </h3>
                            <p className="text-gray-400 text-sm font-medium mt-1">
                                {isResetMode ? 'Overwrite security key' : 'Join a collaborative session.'}
                            </p>
                        </div>
                    </div>
                    
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className={`glass-input rounded-2xl p-1 border transition-colors ${isResetMode ? 'border-[#ff073a]/50' : 'border-transparent focus-within:border-[#00f3ff]/50'}`}>
                            <input
                                type="text"
                                value={sessionId}
                                onChange={(e) => setSessionId(e.target.value.toUpperCase())}
                                className="w-full bg-transparent py-4 px-4 text-xl font-bold text-white placeholder-gray-600 uppercase focus:outline-none border-b border-white/10 tracking-wide"
                                placeholder="SESSION ID"
                                autoFocus
                            />
                            <div className="flex items-center px-4 py-1">
                                <Lock size={18} className={`mr-3 ${isResetMode ? 'text-[#ff073a]' : 'text-gray-500'}`} />
                                <input
                                    type="text"
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value)}
                                    className="w-full bg-transparent py-4 text-lg font-medium text-white placeholder-gray-600 focus:outline-none"
                                    placeholder={isResetMode ? "ENTER NEW PIN" : "PIN (Optional)"}
                                />
                            </div>
                        </div>

                        {/* Helper / Toggle */}
                        <div className="flex justify-between items-start px-2 py-1 gap-2">
                             <div className="flex gap-3">
                                <Info size={16} className="text-gray-600 shrink-0 mt-0.5" />
                                <p className="text-[11px] text-gray-500 leading-tight">
                                    {isResetMode ? (
                                        <span className="text-[#ff073a]">Warning: This will change the PIN for everyone.</span>
                                    ) : (
                                        <>
                                            <strong className="text-gray-400">First time?</strong> The PIN becomes the Admin Password.
                                        </>
                                    )}
                                </p>
                            </div>
                            
                            <button 
                                type="button"
                                onClick={() => setIsResetMode(!isResetMode)}
                                className={`text-[10px] font-bold uppercase tracking-wider py-1.5 px-3 rounded-lg transition-colors ${isResetMode ? 'bg-white/10 text-white' : 'bg-[#ff073a]/10 text-[#ff073a]'}`}
                            >
                                {isResetMode ? 'Cancel' : 'Reset PIN'}
                            </button>
                        </div>

                        <button
                            type="submit"
                            disabled={!sessionId.trim()}
                            className={`w-full text-black h-16 rounded-2xl font-black text-xl mt-4 active:scale-95 transition-all shadow-lg ${isResetMode ? 'bg-[#ff073a] hover:bg-red-500 shadow-[0_0_20px_rgba(255,7,58,0.4)]' : 'bg-[#00f3ff] hover:bg-cyan-400 disabled:opacity-50 disabled:shadow-none shadow-[0_0_25px_rgba(0,243,255,0.4)]'}`}
                        >
                            {isResetMode ? 'UPDATE PIN' : 'CONNECT'}
                        </button>
                    </form>
                    
                    <button onClick={onClose} className="w-full py-4 mt-2 text-xs font-bold uppercase tracking-widest text-gray-600 hover:text-white transition-colors">
                        Dismiss
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConnectModal;