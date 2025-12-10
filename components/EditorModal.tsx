
import React, { useState, useEffect } from 'react';
import { InventoryItem } from '../types';
import { X, ScanBarcode, Trash2, Save, MapPin, Hash, Package, AlertOctagon, FileText } from 'lucide-react';
import ScannerModal from '../components/ScannerModal';

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
    const [showScanner, setShowScanner] = useState(false);

    useEffect(() => {
        setFormData({
            ...initialData,
            bo: initialData.bo || 0,
            description: initialData.description || ''
        });
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

            <div className="w-full max-w-md glass-card rounded-2xl relative z-10 animate-fade-in bg-[#111]">
                <div className="px-5 py-4 border-b border-white/5 flex justify-between items-center">
                    <h3 className="text-white font-bold tracking-wide flex items-center gap-2">
                        {isNew ? <Package className="text-cyan-400" size={18} /> : <Hash className="text-gray-400" size={18} />}
                        {isNew ? 'NEW ENTRY' : 'EDIT ITEM'}
                    </h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-5">
                    {/* Part Number Input Group */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Part Number (SKU)</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={formData.part}
                                onChange={(e) => setFormData({ ...formData, part: e.target.value.toUpperCase() })}
                                disabled={!isNew}
                                className={`glass-input flex-1 px-4 py-3 rounded-xl font-mono text-lg font-bold uppercase ${!isNew ? 'opacity-50' : ''}`}
                                placeholder="PART-001"
                                autoFocus={isNew}
                            />
                            {isNew && (
                                <button
                                    type="button"
                                    onClick={() => setShowScanner(true)}
                                    className="bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 w-12 rounded-xl flex items-center justify-center hover:bg-cyan-500/20 active:scale-95 transition-colors"
                                >
                                    <ScanBarcode size={22} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1 flex items-center gap-1"><FileText size={10} /> Description</label>
                        <input
                            type="text"
                            value={formData.description || ''}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="glass-input w-full px-4 py-3 rounded-xl text-sm"
                            placeholder="Item description (optional)"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Location</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={14} />
                                <input
                                    type="text"
                                    value={formData.bin}
                                    onChange={(e) => setFormData({ ...formData, bin: e.target.value.toUpperCase() })}
                                    className="glass-input w-full pl-9 pr-3 py-3 rounded-xl font-mono text-sm font-medium uppercase"
                                    placeholder="A-01"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">On Hand (Qty)</label>
                            <input
                                type="number"
                                value={formData.qty}
                                onChange={(e) => setFormData({ ...formData, qty: parseInt(e.target.value) || 0 })}
                                className="glass-input w-full px-3 py-3 rounded-xl font-mono text-lg font-bold text-center"
                            />
                        </div>
                    </div>

                    {/* Back Order Section */}
                    <div className="space-y-1.5 p-3 rounded-xl bg-red-900/10 border border-red-500/20">
                         <label className="text-[10px] font-bold text-[#ff003c] uppercase tracking-widest ml-1 flex items-center gap-1">
                             <AlertOctagon size={12} /> Back Order (Missing)
                         </label>
                         <input
                            type="number"
                            value={formData.bo}
                            onChange={(e) => setFormData({ ...formData, bo: parseInt(e.target.value) || 0 })}
                            className="glass-input w-full px-3 py-2 rounded-lg font-mono text-lg font-bold text-center text-[#ff003c] focus:border-[#ff003c]"
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        {!isNew && (
                            <button
                                type="button"
                                onClick={() => { if(confirm('Delete?')) onDelete(formData.part); }}
                                className="p-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                            >
                                <Trash2 size={20} />
                            </button>
                        )}
                        <button
                            type="submit"
                            className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-black py-3 rounded-xl font-bold tracking-wide transition-all shadow-[0_0_20px_rgba(34,211,238,0.2)] hover:shadow-[0_0_30px_rgba(34,211,238,0.4)] flex items-center justify-center gap-2"
                        >
                            <Save size={18} /> {isNew ? 'ADD TO STOCK' : 'UPDATE'}
                        </button>
                    </div>
                </form>

                <ScannerModal 
                    isOpen={showScanner} 
                    onClose={() => setShowScanner(false)} 
                    onScan={(code) => {
                        setFormData(prev => ({ ...prev, part: code }));
                        setShowScanner(false);
                    }}
                    title="Scan Part Number"
                />
            </div>
        </div>
    );
};

export default EditorModal;
