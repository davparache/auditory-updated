
import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ErrorBannerProps {
    message: string | null;
    onDismiss: () => void;
}

const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, onDismiss }) => {
    if (!message) return null;

    return (
        <div className="mx-6 mt-4 p-4 bg-red-500/10 border border-red-500/50 rounded-xl flex items-start gap-3 text-red-100 animate-fade-in backdrop-blur-md shadow-lg shadow-red-900/10">
            <AlertTriangle className="shrink-0 text-red-400" size={20} />
            <div className="flex-1 text-sm font-medium pt-0.5 leading-relaxed">
                <span className="font-bold block text-red-300 mb-1">System Alert</span>
                {message}
            </div>
            <button 
                onClick={onDismiss} 
                className="p-1 text-red-400 hover:text-white hover:bg-red-500/20 rounded-lg transition-colors"
                aria-label="Dismiss error"
            >
                <X size={18} />
            </button>
        </div>
    );
};

export default ErrorBanner;
