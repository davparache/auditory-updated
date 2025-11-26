import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AuditItem, InventoryItem } from '../types';
import { ArrowLeft, Check, CheckCircle2, ScanBarcode } from 'lucide-react';

interface AuditViewProps {
    items: InventoryItem[];
    zoneFilter: string[];
    onFinish: (auditedItems: AuditItem[]) => void;
    onCancel: () => void;
}

const AuditView: React.FC<AuditViewProps> = ({ items, zoneFilter, onFinish, onCancel }) => {
    // Initialize audit state ONLY ONCE from items filtered by zone
    const [auditList, setAuditList] = useState<AuditItem[]>(() => {
        return items
            .filter(i => zoneFilter.includes(i.bin))
            .map(i => ({ ...i, done: false }));
    });
    
    const [input, setInput] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleScan = (e: React.FormEvent) => {
        e.preventDefault();
        const code = input.trim().toUpperCase();
        if (!code) return;

        // Optimized lookup using findIndex
        const targetIndex = auditList.findIndex(i => i.part === code);
        
        if (targetIndex !== -1) {
            setAuditList(prev => {
                const newList = [...prev];
                newList[targetIndex].done = true;
                return newList;
            });
            setInput('');
        } else {
            // Using a simple alert for now, but a toast would be cleaner in a real app context
            alert(`Item ${code} not found in selected zones.`);
            setInput('');
        }
    };

    const toggleItem = (part: string) => {
        setAuditList(prev => prev.map(i => i.part === part ? { ...i, done: !i.done } : i));
        // Keep focus on input for continued scanning
        if(inputRef.current) inputRef.current.focus();
    };

    const progress = useMemo(() => {
        if (auditList.length === 0) return 0;
        return Math.round((auditList.filter(i => i.done).length / auditList.length) * 100);
    }, [auditList]);

    return (
        <div className="fixed inset-0 z-40 bg-gray-950 flex flex-col animate-fade-in">
            {/* Header */}
            <div className="px-4 py-4 bg-gray-900 border-b border-white/10 flex justify-between items-center shadow-lg z-10">
                <button onClick={onCancel} className="text-gray-400 hover:text-white flex items-center gap-1 text-sm font-medium">
                    <ArrowLeft size={16} /> Cancel
                </button>
                <div className="flex flex-col items-center">
                    <span className="text-white font-bold tracking-widest text-lg">AUDIT MODE</span>
                    <span className="text-xs text-emerald-400 font-mono">{progress}% Complete</span>
                </div>
                <button onClick={() => onFinish(auditList)} className="text-emerald-400 hover:text-emerald-300 font-bold text-sm">
                    FINISH
                </button>
            </div>

            {/* Progress Bar */}
            <div className="h-1 bg-gray-800 w-full">
                <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${progress}%` }}></div>
            </div>

            {/* Scanner Input */}
            <div className="p-4 bg-gray-900/50">
                <form onSubmit={handleScan} className="relative">
                    <ScanBarcode className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                    <input
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-center font-mono text-xl text-white font-bold uppercase tracking-widest focus:outline-none focus:border-emerald-500 transition-all shadow-inner placeholder-gray-600"
                        placeholder="SCAN BARCODE"
                        autoFocus
                        onBlur={() => setTimeout(() => inputRef.current?.focus(), 100)} // Keep focus
                    />
                </form>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {auditList.map(item => (
                    <div 
                        key={item.part}
                        onClick={() => toggleItem(item.part)}
                        className={`
                            relative overflow-hidden rounded-xl p-4 border transition-all cursor-pointer
                            ${item.done 
                                ? 'bg-emerald-500/10 border-emerald-500/30' 
                                : 'bg-white/5 border-white/5 hover:bg-white/10'}
                        `}
                    >
                        <div className="flex justify-between items-center relative z-10">
                            <div>
                                <h4 className={`text-lg font-bold ${item.done ? 'text-emerald-100' : 'text-white'}`}>
                                    {item.part}
                                </h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono text-gray-400">
                                        {item.bin}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-2xl font-light text-gray-200">{item.qty}</span>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${item.done ? 'bg-emerald-500 text-white' : 'bg-white/10 text-gray-500'}`}>
                                    {item.done ? <Check size={16} strokeWidth={3} /> : <div className="w-2 h-2 rounded-full bg-gray-600" />}
                                </div>
                            </div>
                        </div>
                        {/* Background filler animation */}
                         {item.done && (
                            <div className="absolute inset-0 bg-emerald-500/5 pointer-events-none" />
                        )}
                    </div>
                ))}
                
                {auditList.length === 0 && (
                    <div className="text-center text-gray-400 py-10">
                        No items in selected zones.
                    </div>
                )}
            </div>
        </div>
    );
};

export default AuditView;