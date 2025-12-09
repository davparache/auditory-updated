
import React, { useState, useMemo } from 'react';
import { AuditItem, InventoryItem } from '../types';
import { ArrowLeft, Check, CheckSquare, Square, Filter, Save } from 'lucide-react';

interface AuditViewProps {
    items: InventoryItem[];
    onFinish: (auditedItems: AuditItem[]) => void;
    onCancel: () => void;
}

const AuditView: React.FC<AuditViewProps> = ({ items, onFinish, onCancel }) => {
    // 0 = Zone Selection, 1 = Auditing Table
    const [step, setStep] = useState<0 | 1>(0);
    const [selectedZones, setSelectedZones] = useState<Set<string>>(new Set());
    
    // Convert items to Audit Items state
    const [auditState, setAuditState] = useState<AuditItem[]>([]);

    // 1. Extract Zones (First letter or word of Bin)
    const zones = useMemo(() => {
        const unique = new Set<string>();
        items.forEach(i => {
            // Logic: "A-101" -> Zone A. "RACK-1" -> Zone RACK. "GEN" -> Zone GEN.
            const zone = i.bin ? i.bin.split(/[- ]/)[0].toUpperCase() : 'UNCATEGORIZED';
            unique.add(zone);
        });
        return Array.from(unique).sort();
    }, [items]);

    const toggleZone = (zone: string) => {
        const next = new Set(selectedZones);
        if (next.has(zone)) next.delete(zone);
        else next.add(zone);
        setSelectedZones(next);
    };

    const startAudit = () => {
        if (selectedZones.size === 0) return;
        
        // Filter items belonging to selected zones
        const filtered = items.filter(i => {
            const zone = i.bin ? i.bin.split(/[- ]/)[0].toUpperCase() : 'UNCATEGORIZED';
            return selectedZones.has(zone);
        }).map(i => ({ ...i, done: false }));
        
        // Sort by BIN for logical walkthrough
        filtered.sort((a, b) => a.bin.localeCompare(b.bin));
        
        setAuditState(filtered);
        setStep(1);
    };

    const toggleCheck = (part: string) => {
        setAuditState(prev => prev.map(i => i.part === part ? { ...i, done: !i.done } : i));
    };

    const progress = useMemo(() => {
        if (auditState.length === 0) return 0;
        return Math.round((auditState.filter(i => i.done).length / auditState.length) * 100);
    }, [auditState]);

    return (
        <div className="fixed inset-0 z-40 bg-[#08080a] flex flex-col animate-fade-in">
            {/* HEADER */}
            <div className="px-5 py-4 pt-safe-top bg-black/40 backdrop-blur-xl border-b border-white/10 flex justify-between items-center z-10">
                <button onClick={onCancel} className="text-gray-400 hover:text-white flex items-center gap-1 text-sm font-bold tracking-wide">
                    <ArrowLeft size={18} /> CANCEL
                </button>
                <div className="flex flex-col items-center">
                    <span className="text-cyan-400 font-black tracking-[0.2em] text-sm uppercase">
                        {step === 0 ? 'SELECT ZONES' : 'AUDIT SHEET'}
                    </span>
                    {step === 1 && (
                        <span className="text-[10px] text-gray-500 font-mono mt-0.5">
                            {auditState.filter(i => i.done).length} / {auditState.length} COUNTED
                        </span>
                    )}
                </div>
                {step === 1 ? (
                    <button onClick={() => onFinish(auditState)} className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider transition-all">
                        FINISH
                    </button>
                ) : (
                    <div className="w-16"></div> // Spacer
                )}
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-hidden flex flex-col relative">
                
                {/* STEP 0: ZONE SELECTOR */}
                {step === 0 && (
                    <div className="flex-1 overflow-y-auto p-6">
                        <p className="text-gray-400 text-sm mb-6 text-center max-w-md mx-auto">
                            Select the areas you are physically counting today. The system will generate a checklist ordered by location.
                        </p>
                        
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-2xl mx-auto">
                            {zones.map(zone => {
                                const isSelected = selectedZones.has(zone);
                                const count = items.filter(i => (i.bin?.split(/[- ]/)[0].toUpperCase() || 'UNCATEGORIZED') === zone).length;
                                return (
                                    <button
                                        key={zone}
                                        onClick={() => toggleZone(zone)}
                                        className={`
                                            p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all duration-200 active:scale-95
                                            ${isSelected 
                                                ? 'bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.1)]' 
                                                : 'bg-white/5 border-white/5 hover:bg-white/10 text-gray-400'}
                                        `}
                                    >
                                        <span className={`text-xl font-black tracking-wide ${isSelected ? 'text-white' : ''}`}>{zone}</span>
                                        <span className="text-[10px] font-mono opacity-60 bg-black/30 px-2 py-0.5 rounded">{count} Items</span>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-8 flex justify-center">
                            <button
                                onClick={startAudit}
                                disabled={selectedZones.size === 0}
                                className="bg-cyan-500 text-black px-8 py-4 rounded-2xl font-bold tracking-widest uppercase shadow-[0_0_20px_rgba(34,211,238,0.3)] disabled:opacity-30 disabled:shadow-none transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                            >
                                Start Counting <Filter size={16} />
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 1: EXCEL STYLE TABLE */}
                {step === 1 && (
                    <div className="flex-1 flex flex-col bg-black/20">
                        {/* Progress Line */}
                        <div className="h-1 w-full bg-gray-900">
                            <div className="h-full bg-cyan-500 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                        </div>

                        {/* Table Header */}
                        <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-white/5 border-b border-white/5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            <div className="col-span-2 md:col-span-1 text-center">Check</div>
                            <div className="col-span-4 md:col-span-5">Part Number</div>
                            <div className="col-span-3 text-center">Bin</div>
                            <div className="col-span-3 text-center">Sys Qty</div>
                        </div>

                        {/* Table Body */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar pb-20">
                            {auditState.map((item, idx) => (
                                <div 
                                    key={`${item.part}-${idx}`}
                                    onClick={() => toggleCheck(item.part)}
                                    className={`
                                        grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/5 items-center cursor-pointer transition-colors
                                        ${item.done ? 'bg-emerald-500/5' : 'hover:bg-white/5'}
                                    `}
                                >
                                    <div className="col-span-2 md:col-span-1 flex justify-center">
                                        {item.done 
                                            ? <CheckSquare className="text-emerald-400" size={20} /> 
                                            : <Square className="text-gray-600" size={20} />
                                        }
                                    </div>
                                    <div className={`col-span-4 md:col-span-5 font-mono text-sm font-medium ${item.done ? 'text-gray-500 line-through' : 'text-white'}`}>
                                        {item.part}
                                    </div>
                                    <div className="col-span-3 text-center">
                                        <span className="bg-white/5 border border-white/10 px-2 py-1 rounded text-xs font-mono text-cyan-200">
                                            {item.bin}
                                        </span>
                                    </div>
                                    <div className="col-span-3 text-center">
                                        <span className={`text-sm font-bold ${item.done ? 'text-emerald-500' : 'text-gray-400'}`}>
                                            {item.qty}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AuditView;
