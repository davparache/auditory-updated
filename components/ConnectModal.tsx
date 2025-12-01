
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
                className="absolute inset-0 bg-black/60 backdrop-blur-md"
                onClick={onClose}
            />

            {/* Sheet */}
            <div className="w-full bg-[#1C1C1E] rounded-t-[35px] overflow-hidden shadow-2xl animate-slide-up relative z-10 pb-10">
                <div className="w-12 h-1.5 bg-gray-600 rounded-full opacity-30 mx-auto mt-3 mb-6"></div>
                
                <div className="px-8">
                    <div className="flex items-center gap-4 mb-6">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${isResetMode ? 'bg-orange-500/20 text-orange-500' : 'bg-[#2C2C2E] text-[#0A84FF]'}`}>
                            {isResetMode ? <RefreshCcw size={28} /> : <Cloud size={28} />}
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-white tracking-tight">
                                {isResetMode ? 'Update PIN' : 'Sync Cloud'}
                            </h3>
                            <p className="text-gray-400 text-sm font-medium">
                                {isResetMode ? 'Overwrite security key' : 'Join a session to collaborate.'}
                            </p>
                        </div>
                    </div>
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className={`bg-[#2C2C2E] rounded-2xl p-1 border transition-colors ${isResetMode ? 'border-orange-500/50' : 'border-transparent'}`}>
                            <input
                                type="text"
                                value={sessionId}
                                onChange={(e) => setSessionId(e.target.value.toUpperCase())}
                                className="w-full bg-transparent py-4 px-4 text-lg font-medium text-white placeholder-gray-500 uppercase focus:outline-none border-b border-[#38383A]"
                                placeholder="SESSION ID (e.g. STORE-1)"
                                autoFocus
                            />
                            <div className="flex items-center px-4 py-1">
                                <Lock size={16} className={`mr-3 ${isResetMode ? 'text-orange-500' : 'text-gray-500'}`} />
                                <input
                                    type="text"
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value)}
                                    className="w-full bg-transparent py-4 text-lg font-medium text-white placeholder-gray-500 focus:outline-none"
                                    placeholder={isResetMode ? "ENTER NEW PIN" : "PIN (Admin Key)"}
                                />
                            </div>
                        </div>

                        {/* Helper / Toggle */}
                        <div className="flex justify-between items-start px-2 py-1 gap-2">
                             <div className="flex gap-3">
                                <Info size={16} className="text-gray-500 shrink-0 mt-0.5" />
                                <p className="text-[11px] text-gray-500 leading-tight">
                                    {isResetMode ? (
                                        <span className="text-orange-400">Warning: This will change the PIN for everyone in this session.</span>
                                    ) : (
                                        <>
                                            <strong className="text-gray-400">First time?</strong> The PIN becomes the Admin Password.
                                            <br/><span className="mt-1 block">Leave empty for <strong>Read-Only</strong>.</span>
                                        </>
                                    )}
                                </p>
                            </div>
                            
                            <button 
                                type="button"
                                onClick={() => setIsResetMode(!isResetMode)}
                                className={`text-[10px] font-bold uppercase tracking-wider py-1 px-2 rounded-lg transition-colors ${isResetMode ? 'bg-gray-700 text-gray-300' : 'bg-orange-500/10 text-orange-400'}`}
                            >
                                {isResetMode ? 'Cancel' : 'Reset PIN'}
                            </button>
                        </div>

                        <button
                            type="submit"
                            disabled={!sessionId.trim()}
                            className={`w-full text-white h-14 rounded-2xl font-bold text-lg mt-2 active:scale-95 transition-transform ${isResetMode ? 'bg-orange-500 hover:bg-orange-600' : 'bg-[#0A84FF] hover:bg-[#007AFF] disabled:opacity-50'}`}
                        >
                            {isResetMode ? 'Update PIN' : 'Connect'}
                        </button>
                    </form>
                    
                    <button onClick={onClose} className="w-full py-4 mt-2 text-sm font-medium text-gray-500">
                        Dismiss
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConnectModal;
