
import React, { useState, useEffect } from 'react';
import { InventoryItem } from '../types';
import { Save, Trash2, AlertTriangle, X, ScanBarcode } from 'lucide-react';
import ScannerModal from './ScannerModal';

interface EditorModalProps {
    isOpen: boolean;
    initialData: InventoryItem;
    isNew: boolean;
    onClose: () => void;
    onSave: (item: InventoryItem) => void;
    onDelete: (part: string) => void;
}

const EditorModal: React.FC<EditorModalProps> = ({ isOpen, initialData, isNew, onClose, onSave, onDelete }) => {
    const [formData, setFormData] = useState<InventoryItem>(initialData);
    const [isClosing, setIsClosing] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showScanner, setShowScanner] = useState(false);

    useEffect(() => {
        setFormData(initialData);
        setShowDeleteConfirm(false);
    }, [initialData, isOpen]);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            setIsClosing(false);
            onClose();
        }, 300);
    };

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
            {/* Backdrop */}
            <div 
                className={`absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`}
                onClick={handleClose}
            />

            {/* Bottom Sheet */}
            <div 
                className={`w-full glass-panel bg-[#050505]/95 border-t border-white/10 rounded-t-[36px] overflow-hidden shadow-[0_-10px_40px_rgba(0,0,0,0.8)] transform transition-transform duration-400 cubic-bezier(0.32, 0.72, 0, 1) ${isClosing ? 'translate-y-full' : 'translate-y-0'} animate-slide-up`}
                style={{ maxHeight: '90vh' }}
            >
                {/* Drag Handle */}
                <div className="w-full h-8 flex items-center justify-center pt-3 pb-1" onClick={handleClose}>
                    <div className="w-16 h-1.5 bg-white/20 rounded-full"></div>
                </div>

                <div className="px-8 pb-4 flex justify-between items-center">
                    <h3 className="text-2xl font-black text-white tracking-tight uppercase">
                        {isNew ? 'New Entry' : 'Edit details'}
                    </h3>
                    <button 
                        onClick={handleClose} 
                        className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 transition-colors border border-white/5"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-8 pb-12">
                    {/* iOS Grouped Input Style */}
                    <div className="space-y-5">
                        <div className="glass-input rounded-2xl p-4 flex flex-col gap-1 relative focus-within:border-[#00f3ff]/50 focus-within:shadow-[0_0_15px_rgba(0,243,255,0.1)] transition-all">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Part Number</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={formData.part}
                                    onChange={(e) => setFormData({ ...formData, part: e.target.value.toUpperCase() })}
                                    disabled={!isNew}
                                    className={`flex-1 bg-transparent text-2xl font-bold text-white focus:outline-none placeholder-gray-600 ${!isNew ? 'opacity-60' : ''}`}
                                    placeholder="PART-001"
                                    autoFocus={isNew}
                                />
                                {isNew && (
                                    <button
                                        type="button"
                                        onClick={() => setShowScanner(true)}
                                        className="p-2 text-[#00f3ff] hover:text-white bg-[#00f3ff]/10 hover:bg-[#00f3ff]/30 rounded-lg transition-colors"
                                    >
                                        <ScanBarcode size={24} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-4">
                             <div className="glass-input rounded-2xl p-4 flex-1 flex flex-col gap-1 focus-within:border-white/30 transition-all">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Location</label>
                                <input
                                    type="text"
                                    value={formData.bin}
                                    onChange={(e) => setFormData({ ...formData, bin: e.target.value.toUpperCase() })}
                                    className="w-full bg-transparent text-xl font-bold text-white focus:outline-none placeholder-gray-600 uppercase"
                                    placeholder="GEN"
                                />
                            </div>
                            <div className="glass-input rounded-2xl p-4 flex-1 flex flex-col gap-1 focus-within:border-[#00f3ff]/50 transition-all">
                                <label className="text-[10px] font-bold text-[#00f3ff] uppercase tracking-widest ml-1">Quantity</label>
                                <input
                                    type="number"
                                    value={formData.qty}
                                    onChange={(e) => setFormData({ ...formData, qty: parseInt(e.target.value) || 0 })}
                                    className="w-full bg-transparent text-3xl font-black text-[#00f3ff] focus:outline-none placeholder-gray-600 drop-shadow-[0_0_8px_rgba(0,243,255,0.5)]"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 pt-4">
                        {/* Save Button */}
                        {!showDeleteConfirm && (
                            <div className="flex gap-3">
                                {!isNew && (
                                    <button
                                        type="button"
                                        onClick={() => setShowDeleteConfirm(true)}
                                        className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-[#ff073a] h-14 rounded-2xl font-bold text-lg active:scale-95 transition-all flex items-center justify-center border border-red-500/30"
                                    >
                                        <Trash2 size={24} />
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    className="flex-[3] bg-[#00f3ff] hover:bg-cyan-400 text-black h-14 rounded-2xl font-black text-lg shadow-[0_0_25px_rgba(0,243,255,0.4)] active:scale-95 transition-all flex items-center justify-center gap-2 tracking-wide uppercase"
                                >
                                    Save Entry
                                </button>
                            </div>
                        )}

                        {/* Delete Confirmation State */}
                        {showDeleteConfirm && (
                            <div className="bg-[#ff073a]/10 rounded-3xl p-4 animate-scale-in border border-[#ff073a]/30">
                                <div className="text-center p-2 mb-4">
                                    <h4 className="text-[#ff073a] font-bold flex items-center justify-center gap-2 text-lg">
                                        <AlertTriangle size={24} />
                                        Delete Item?
                                    </h4>
                                    <p className="text-xs text-red-200/70 mt-1">This action cannot be undone.</p>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowDeleteConfirm(false)}
                                        className="flex-1 bg-white/10 text-white h-12 rounded-xl font-bold text-sm hover:bg-white/20"
                                    >
                                        CANCEL
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onDelete(formData.part)}
                                        className="flex-1 bg-[#ff073a] text-white h-12 rounded-xl font-bold text-sm shadow-[0_0_15px_rgba(255,7,58,0.5)]"
                                    >
                                        DELETE
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </form>
                
                <ScannerModal 
                    isOpen={showScanner} 
                    onClose={() => setShowScanner(false)} 
                    onScan={(code) => setFormData(prev => ({ ...prev, part: code }))}
                    title="Scan Part Number"
                />
            </div>
        </div>
    );
};

export default EditorModal;