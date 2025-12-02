
import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ErrorBannerProps {
    message: string | null;
    onDismiss: () => void;
}

const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, onDismiss }) => {
    if (!message) return null;

    return (
        <div className="mx-4 mt-2 mb-2 p-4 glass-panel bg-[#ff073a]/5 border-[#ff073a]/30 rounded-2xl flex items-start gap-3 shadow-[0_0_20px_rgba(255,7,58,0.1)] animate-slide-up">
            <div className="w-8 h-8 rounded-full bg-[#ff073a]/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="text-[#ff073a]" size={18} />
            </div>
            <div className="flex-1 pt-1">
                <h4 className="text-[#ff073a] text-[10px] font-black uppercase tracking-widest mb-0.5">System Alert</h4>
                <p className="text-gray-200 text-xs font-medium leading-relaxed">{message}</p>
            </div>
            <button 
                onClick={onDismiss} 
                className="w-8 h-8 rounded-full hover:bg-[#ff073a]/10 flex items-center justify-center text-gray-400 hover:text-[#ff073a] transition-colors"
                aria-label="Dismiss error"
            >
                <X size={18} />
            </button>
        </div>
    );
};

export default ErrorBanner;
