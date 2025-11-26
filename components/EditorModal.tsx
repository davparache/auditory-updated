import React, { useState, useEffect } from 'react';
import { InventoryItem } from '../types';
import { Save, Trash2, AlertTriangle, X } from 'lucide-react';

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
                className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`}
                onClick={handleClose}
            />

            {/* Bottom Sheet */}
            <div 
                className={`w-full bg-[#1C1C1E] rounded-t-[32px] overflow-hidden shadow-2xl transform transition-transform duration-400 cubic-bezier(0.32, 0.72, 0, 1) ${isClosing ? 'translate-y-full' : 'translate-y-0'} animate-slide-up`}
                style={{ maxHeight: '90vh' }}
            >
                {/* Drag Handle */}
                <div className="w-full h-8 flex items-center justify-center pt-3 pb-1" onClick={handleClose}>
                    <div className="w-12 h-1.5 bg-gray-600 rounded-full opacity-50"></div>
                </div>

                <div className="px-6 pb-2 flex justify-between items-center">
                    <h3 className="text-2xl font-bold text-white tracking-tight">
                        {isNew ? 'New Entry' : 'Edit details'}
                    </h3>
                    <button 
                        onClick={handleClose} 
                        className="w-8 h-8 rounded-full bg-[#2C2C2E] flex items-center justify-center text-gray-400 font-bold text-sm"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6 pb-10">
                    {/* iOS Grouped Input Style */}
                    <div className="space-y-4">
                        <div className="bg-[#2C2C2E] rounded-2xl p-4 flex flex-col gap-1">
                            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide ml-1">Part Number</label>
                            <input
                                type="text"
                                value={formData.part}
                                onChange={(e) => setFormData({ ...formData, part: e.target.value.toUpperCase() })}
                                disabled={!isNew}
                                className={`w-full bg-transparent text-2xl font-semibold text-white focus:outline-none placeholder-gray-600 ${!isNew ? 'opacity-60' : ''}`}
                                placeholder="PART-001"
                                autoFocus={isNew}
                            />
                        </div>

                        <div className="flex gap-3">
                             <div className="bg-[#2C2C2E] rounded-2xl p-4 flex-1 flex flex-col gap-1">
                                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide ml-1">Location</label>
                                <input
                                    type="text"
                                    value={formData.bin}
                                    onChange={(e) => setFormData({ ...formData, bin: e.target.value.toUpperCase() })}
                                    className="w-full bg-transparent text-xl font-medium text-white focus:outline-none placeholder-gray-600 uppercase"
                                    placeholder="GEN"
                                />
                            </div>
                            <div className="bg-[#2C2C2E] rounded-2xl p-4 flex-1 flex flex-col gap-1">
                                <label className="text-[11px] font-semibold text-blue-400 uppercase tracking-wide ml-1">Quantity</label>
                                <input
                                    type="number"
                                    value={formData.qty}
                                    onChange={(e) => setFormData({ ...formData, qty: parseInt(e.target.value) || 0 })}
                                    className="w-full bg-transparent text-2xl font-bold text-blue-500 focus:outline-none placeholder-gray-600"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 pt-2">
                        {/* Save Button */}
                        {!showDeleteConfirm && (
                            <div className="flex gap-3">
                                {!isNew && (
                                    <button
                                        type="button"
                                        onClick={() => setShowDeleteConfirm(true)}
                                        className="flex-1 bg-[#2C2C2E] text-red-400 h-14 rounded-2xl font-semibold text-lg active:scale-95 transition-transform flex items-center justify-center"
                                    >
                                        <Trash2 size={22} />
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    className="flex-[3] bg-[#0A84FF] text-white h-14 rounded-2xl font-bold text-lg shadow-lg shadow-blue-900/30 active:scale-95 transition-transform flex items-center justify-center gap-2"
                                >
                                    Save
                                </button>
                            </div>
                        )}

                        {/* Delete Confirmation State */}
                        {showDeleteConfirm && (
                            <div className="bg-[#2C2C2E] rounded-2xl p-2 animate-scale-in border border-red-500/30">
                                <div className="text-center p-2 mb-2">
                                    <h4 className="text-red-400 font-bold flex items-center justify-center gap-2">
                                        <AlertTriangle size={18} />
                                        Delete this item?
                                    </h4>
                                    <p className="text-xs text-gray-400">This action cannot be undone.</p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowDeleteConfirm(false)}
                                        className="flex-1 bg-[#3A3A3C] text-white h-12 rounded-xl font-semibold text-sm"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onDelete(formData.part)}
                                        className="flex-1 bg-red-500 text-white h-12 rounded-xl font-bold text-sm shadow-lg shadow-red-900/30"
                                    >
                                        Confirm Delete
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditorModal;