
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { AuditItem, InventoryItem } from '../types';
import { ArrowLeft, Check, ScanBarcode, Camera, X, Zap } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

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
    
    // Create a Ref for auditList to allow the scanner callback to access latest state 
    // without triggering a re-render/re-initialization of the camera.
    const auditListRef = useRef(auditList);
    useEffect(() => { auditListRef.current = auditList; }, [auditList]);

    const [input, setInput] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [scannerError, setScannerError] = useState<string | null>(null);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const isScannerRunning = useRef(false);

    // Focus input on mount or when scanner closes
    useEffect(() => {
        if (!isScanning) {
            inputRef.current?.focus();
        }
    }, [isScanning]);

    // Handle Logic for matching a code (used by both manual input and camera)
    const processCode = useCallback((code: string) => {
        if (!code) return;
        
        const currentList = auditListRef.current;
        const targetIndex = currentList.findIndex(i => i.part === code);
        
        if (targetIndex !== -1) {
            setAuditList(prev => {
                const newList = [...prev];
                newList[targetIndex].done = true;
                return newList;
            });
            setInput('');
            if (navigator.vibrate) navigator.vibrate(200);
            return true;
        } else {
            alert(`Item ${code} not found in selected zones.`);
            setInput('');
            return false;
        }
    }, []);

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const code = input.trim().toUpperCase();
        processCode(code);
    };

    const toggleItem = (part: string) => {
        setAuditList(prev => prev.map(i => i.part === part ? { ...i, done: !i.done } : i));
        if(inputRef.current) inputRef.current.focus();
    };

    const progress = useMemo(() => {
        if (auditList.length === 0) return 0;
        return Math.round((auditList.filter(i => i.done).length / auditList.length) * 100);
    }, [auditList]);

    // --- SCANNER EFFECT ---
    useEffect(() => {
        let mounted = true;

        const cleanupScanner = async () => {
             if (scannerRef.current && isScannerRunning.current) {
                try {
                    await scannerRef.current.stop();
                    scannerRef.current.clear();
                } catch (e) {
                    console.warn("Audit scanner cleanup error", e);
                }
                isScannerRunning.current = false;
                scannerRef.current = null;
            }
        };

        if (isScanning) {
            const startScanner = async () => {
                await new Promise(r => setTimeout(r, 100));
                if (!mounted) return;
                
                const element = document.getElementById("reader");
                if (!element) return;

                try {
                    if (!scannerRef.current) {
                        scannerRef.current = new Html5Qrcode("reader");
                    }

                    const config = {
                        fps: 15,
                        qrbox: { width: 280, height: 150 },
                        aspectRatio: 1.0,
                        formatsToSupport: [
                            Html5QrcodeSupportedFormats.CODE_128,
                            Html5QrcodeSupportedFormats.CODE_39,
                            Html5QrcodeSupportedFormats.QR_CODE
                        ]
                    };

                    if (!isScannerRunning.current) {
                        await scannerRef.current.start(
                            { facingMode: "environment" },
                            config,
                            (decodedText) => {
                                if (mounted) {
                                    cleanupScanner().then(() => {
                                        setIsScanning(false);
                                        processCode(decodedText.trim().toUpperCase());
                                    });
                                }
                            },
                            (errorMessage) => { }
                        );
                        isScannerRunning.current = true;
                    }
                } catch (err: any) {
                    console.error("Camera start failed", err);
                    if (mounted) setScannerError(err?.message || "Camera not accessible");
                    setIsScanning(false);
                }
            };
            
            startScanner();
        } else {
            cleanupScanner();
        }

        return () => {
            mounted = false;
            cleanupScanner();
        };
    }, [isScanning, processCode]);

    return (
        <div className="fixed inset-0 z-40 bg-[#050505] flex flex-col animate-fade-in">
            {/* Header */}
            <div className="px-4 py-4 pt-safe-top bg-black/80 backdrop-blur-xl border-b border-white/10 flex justify-between items-center shadow-lg z-10">
                <button onClick={onCancel} className="text-gray-400 hover:text-white flex items-center gap-1 text-sm font-medium">
                    <ArrowLeft size={18} /> Exit
                </button>
                <div className="flex flex-col items-center">
                    <span className="text-white font-black tracking-[0.2em] text-sm neon-text-blue">AUDIT MODE</span>
                    <span className="text-[10px] text-gray-500 font-mono mt-0.5">{auditList.filter(i=>i.done).length} / {auditList.length} Items</span>
                </div>
                <button onClick={() => onFinish(auditList)} className="text-[#39ff14] hover:text-white font-bold text-sm drop-shadow-[0_0_8px_rgba(57,255,20,0.5)]">
                    FINISH
                </button>
            </div>

            {/* Neon Progress Bar */}
            <div className="h-1.5 bg-gray-900 w-full relative overflow-hidden">
                <div 
                    className="h-full bg-[#39ff14] transition-all duration-300 shadow-[0_0_15px_#39ff14]" 
                    style={{ width: `${progress}%` }}
                ></div>
                {/* Glare effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent w-full -translate-x-full animate-[slide_2s_infinite]"></div>
            </div>

            {/* Scanner Input Area */}
            <div className="p-4 bg-white/[0.02]">
                <div className="relative flex gap-3">
                    <form onSubmit={handleManualSubmit} className="relative flex-1 group">
                        <ScanBarcode className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-[#00f3ff] transition-colors" size={20} />
                        <input
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            className="w-full glass-input rounded-xl py-4 pl-12 pr-4 text-center font-mono text-xl text-white font-bold uppercase tracking-widest focus:outline-none focus:border-[#00f3ff] focus:shadow-[0_0_20px_rgba(0,243,255,0.15)] transition-all placeholder-gray-700"
                            placeholder="SCAN CODE"
                            autoFocus
                        />
                    </form>
                    
                    {/* Camera Trigger */}
                    <button 
                        onClick={() => { setIsScanning(true); setScannerError(null); }}
                        className="bg-[#00f3ff]/10 border border-[#00f3ff]/30 text-[#00f3ff] w-16 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-[0_0_15px_rgba(0,243,255,0.1)] hover:bg-[#00f3ff]/20"
                    >
                        <Camera size={26} />
                    </button>
                </div>
                {scannerError && <p className="text-[#ff073a] text-xs text-center mt-2 font-bold">{scannerError}</p>}
            </div>

            {/* CAMERA OVERLAY */}
            {isScanning && (
                <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center animate-fade-in">
                    
                    {/* Camera Header */}
                    <div className="absolute top-0 w-full p-6 pt-12 flex justify-between items-start z-10 bg-gradient-to-b from-black/90 to-transparent">
                         <div className="flex flex-col">
                            <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                <Zap className="text-[#00f3ff]" size={18} fill="currentColor" />
                                Scanner Active
                            </h3>
                            <p className="text-gray-400 text-xs font-mono">CODE 128 / 39 / QR</p>
                         </div>
                         <button 
                            onClick={() => setIsScanning(false)}
                            className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white backdrop-blur-md border border-white/10 hover:bg-white/20 transition-all"
                         >
                             <X size={24} />
                         </button>
                    </div>

                    {/* Scanner */}
                    <div className="w-full max-w-md relative overflow-hidden rounded-[30px] border-2 border-white/5 shadow-2xl bg-black">
                        <div id="reader" className="w-full h-full min-h-[500px] object-cover"></div>
                        
                        {/* High-Tech Overlay */}
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            <div className="w-72 h-40 border-2 border-[#00f3ff] rounded-lg relative shadow-[0_0_30px_rgba(0,243,255,0.3)] bg-[#00f3ff]/5">
                                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-[#00f3ff] -mt-1 -ml-1"></div>
                                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-[#00f3ff] -mt-1 -mr-1"></div>
                                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-[#00f3ff] -mb-1 -ml-1"></div>
                                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-[#00f3ff] -mb-1 -mr-1"></div>
                                {/* Scanning Laser Line */}
                                <div className="absolute top-1/2 left-2 right-2 h-0.5 bg-[#ff073a] shadow-[0_0_15px_#ff073a] opacity-80 animate-pulse"></div>
                            </div>
                        </div>
                    </div>

                    <p className="text-gray-500 mt-8 text-xs font-mono tracking-widest uppercase animate-pulse">Initializing Optical Sensor...</p>
                </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {auditList.map(item => (
                    <div 
                        key={item.part}
                        onClick={() => toggleItem(item.part)}
                        className={`
                            relative overflow-hidden rounded-2xl p-4 border transition-all cursor-pointer group
                            ${item.done 
                                ? 'bg-[#39ff14]/5 border-[#39ff14]/30 shadow-[0_0_20px_rgba(57,255,20,0.05)]' 
                                : 'glass-panel hover:bg-white/5'}
                        `}
                    >
                        <div className="flex justify-between items-center relative z-10">
                            <div>
                                <h4 className={`text-lg font-black tracking-wide ${item.done ? 'text-white' : 'text-gray-200'}`}>
                                    {item.part}
                                </h4>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-[10px] font-mono text-gray-400">
                                        {item.bin}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className={`text-2xl font-bold ${item.done ? 'text-[#39ff14] drop-shadow-[0_0_5px_rgba(57,255,20,0.8)]' : 'text-gray-600'}`}>
                                    {item.qty}
                                </span>
                                {item.done && (
                                    <div className="w-8 h-8 rounded-full bg-[#39ff14] flex items-center justify-center shadow-[0_0_15px_#39ff14] animate-scale-in">
                                        <Check size={18} className="text-black" strokeWidth={4} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AuditView;