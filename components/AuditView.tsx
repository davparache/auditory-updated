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
    // We use a separate function for the Scanner that relies on the REF to avoid dependencies.
    const processCode = useCallback((code: string) => {
        if (!code) return;
        
        // Optimize lookup using the REF
        const currentList = auditListRef.current;
        const targetIndex = currentList.findIndex(i => i.part === code);
        
        if (targetIndex !== -1) {
            setAuditList(prev => {
                const newList = [...prev];
                newList[targetIndex].done = true;
                return newList;
            });
            setInput('');
            // Haptic feedback
            if (navigator.vibrate) navigator.vibrate(200);
            return true;
        } else {
            // Using a simple alert for now
            alert(`Item ${code} not found in selected zones.`);
            setInput('');
            return false;
        }
    }, []); // No dependencies needed because we use functional state update and Ref

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const code = input.trim().toUpperCase();
        processCode(code);
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

    // --- SCANNER EFFECT ---
    // This effect should only re-run if isScanning changes, NOT if items change.
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
                // Wait for DOM
                await new Promise(r => setTimeout(r, 100));
                if (!mounted) return;
                
                const element = document.getElementById("reader");
                if (!element) return;

                try {
                    if (!scannerRef.current) {
                        scannerRef.current = new Html5Qrcode("reader");
                    }

                    const config = {
                        fps: 15, // Higher FPS for Code 128 detection
                        qrbox: { width: 280, height: 150 }, // Wider box for linear barcodes
                        aspectRatio: 1.0,
                        // Configured specifically for CODE_128 as requested
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
                                    // STOP CAMERA ON SUCCESS
                                    // This is usually better for battery and UX to verify the scan
                                    cleanupScanner().then(() => {
                                        setIsScanning(false);
                                        processCode(decodedText.trim().toUpperCase());
                                    });
                                }
                            },
                            (errorMessage) => {
                                // On Frame Error - ignore for UI cleanliness
                            }
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
    }, [isScanning, processCode]); // processCode is now stable thanks to useCallback

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

            {/* Scanner Input Area */}
            <div className="p-4 bg-gray-900/50">
                <div className="relative flex gap-2">
                    <form onSubmit={handleManualSubmit} className="relative flex-1">
                        <ScanBarcode className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                        <input
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-center font-mono text-xl text-white font-bold uppercase tracking-widest focus:outline-none focus:border-emerald-500 transition-all shadow-inner placeholder-gray-600"
                            placeholder="SCAN BARCODE"
                            autoFocus
                        />
                    </form>
                    
                    {/* Camera Trigger */}
                    <button 
                        onClick={() => { setIsScanning(true); setScannerError(null); }}
                        className="bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 w-16 rounded-xl flex items-center justify-center transition-all active:scale-95"
                    >
                        <Camera size={24} />
                    </button>
                </div>
                {scannerError && <p className="text-red-400 text-xs text-center mt-2">{scannerError}</p>}
            </div>

            {/* CAMERA OVERLAY */}
            {isScanning && (
                <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center animate-fade-in">
                    
                    {/* Camera Header */}
                    <div className="absolute top-0 w-full p-6 flex justify-between items-start z-10 bg-gradient-to-b from-black/80 to-transparent">
                         <div className="flex flex-col">
                            <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                <Zap className="text-yellow-400" size={18} fill="currentColor" />
                                Scanner Active
                            </h3>
                            <p className="text-gray-300 text-xs">Point at Code 128 / QR</p>
                         </div>
                         <button 
                            onClick={() => setIsScanning(false)}
                            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white backdrop-blur-md"
                         >
                             <X size={20} />
                         </button>
                    </div>

                    {/* The HTML5-QRCode Scanner Element */}
                    <div className="w-full max-w-md relative overflow-hidden rounded-3xl border-2 border-white/10 shadow-2xl bg-black">
                        <div id="reader" className="w-full h-full min-h-[400px]"></div>
                        
                        {/* Visual Guide Overlay */}
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            {/* Wide Rect for Barcodes */}
                            <div className="w-72 h-40 border-2 border-emerald-500/50 rounded-lg relative shadow-[0_0_50px_rgba(16,185,129,0.3)]">
                                <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-400 -mt-0.5 -ml-0.5"></div>
                                <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-400 -mt-0.5 -mr-0.5"></div>
                                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-400 -mb-0.5 -ml-0.5"></div>
                                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-400 -mb-0.5 -mr-0.5"></div>
                                {/* Scanning Laser Line */}
                                <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)] opacity-70 animate-pulse"></div>
                            </div>
                        </div>
                    </div>

                    <p className="text-gray-400 mt-8 text-sm animate-pulse">Scanning for part numbers...</p>
                </div>
            )}

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
                            <div className="flex items-center gap-3">
                                <span className={`text-xl font-bold ${item.done ? 'text-emerald-400' : 'text-gray-500'}`}>
                                    {item.qty}
                                </span>
                                {item.done && (
                                    <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 animate-scale-in">
                                        <Check size={16} className="text-white" strokeWidth={3} />
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {/* Progress bar background for checked items */}
                        {item.done && (
                             <div className="absolute inset-0 bg-emerald-500/5 z-0 transition-all duration-500"></div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AuditView;