
import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Zap, ScanBarcode } from 'lucide-react';

interface ScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScan: (code: string) => void;
    title?: string;
}

const ScannerModal: React.FC<ScannerModalProps> = ({ isOpen, onClose, onScan, title = "Scan Barcode" }) => {
    const [error, setError] = useState<string | null>(null);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const elementId = "global-scanner-reader";
    const isRunning = useRef(false);

    useEffect(() => {
        let mounted = true;

        const cleanup = async () => {
            if (scannerRef.current && isRunning.current) {
                try {
                    await scannerRef.current.stop();
                    scannerRef.current.clear();
                } catch (e) {
                    console.warn("Scanner stop error:", e);
                }
                isRunning.current = false;
                scannerRef.current = null;
            }
        };

        const startScanner = async () => {
            // Wait for DOM
            await new Promise(r => setTimeout(r, 100));
            if (!mounted) return;

            const element = document.getElementById(elementId);
            if (!element) {
                if (mounted) setError("Scanner element not found");
                return;
            }

            try {
                // Initialize if not exists
                if (!scannerRef.current) {
                    scannerRef.current = new Html5Qrcode(elementId);
                }

                const config = {
                    fps: 10,
                    qrbox: { width: 250, height: 150 },
                    aspectRatio: 1.0,
                    formatsToSupport: [
                        Html5QrcodeSupportedFormats.CODE_128,
                        Html5QrcodeSupportedFormats.CODE_39,
                        Html5QrcodeSupportedFormats.QR_CODE,
                        Html5QrcodeSupportedFormats.EAN_13,
                    ]
                };

                if (!isRunning.current) {
                    await scannerRef.current.start(
                        { facingMode: "environment" },
                        config,
                        (decodedText) => {
                            if (mounted) {
                                // Stop immediately upon success to prevent duplicate scans
                                cleanup().then(() => {
                                    onScan(decodedText.trim().toUpperCase());
                                    // onClose will be called by parent usually, but we ensure cleanup happens first
                                });
                            }
                        },
                        (errorMessage) => {
                            // ignore frame errors
                        }
                    );
                    isRunning.current = true;
                }
            } catch (err: any) {
                console.error("Scanner Start Error:", err);
                if (mounted) {
                    setError(err?.message || "Camera permission denied or unavailable.");
                }
            }
        };

        if (isOpen) {
            startScanner();
        } else {
            cleanup();
        }

        return () => {
            mounted = false;
            cleanup();
        };
    }, [isOpen, onScan]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center animate-fade-in">
             <div className="absolute top-0 w-full p-6 flex justify-between items-start z-10 bg-gradient-to-b from-black/80 to-transparent">
                 <div className="flex flex-col">
                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                        <ScanBarcode className="text-[#0A84FF]" size={20} />
                        {title}
                    </h3>
                    <p className="text-gray-300 text-xs">Align code within frame</p>
                 </div>
                 <button 
                    onClick={onClose}
                    className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white backdrop-blur-md hover:bg-white/20 transition-colors"
                 >
                     <X size={20} />
                 </button>
            </div>

            <div className="w-full max-w-md relative overflow-hidden rounded-3xl border-2 border-white/10 shadow-2xl bg-black">
                <div id={elementId} className="w-full h-full min-h-[400px]"></div>
                
                {/* Visual Guide Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-64 h-32 border-2 border-[#0A84FF]/50 rounded-lg relative shadow-[0_0_50px_rgba(10,132,255,0.3)]">
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-[#0A84FF] -mt-0.5 -ml-0.5"></div>
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-[#0A84FF] -mt-0.5 -mr-0.5"></div>
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-[#0A84FF] -mb-0.5 -ml-0.5"></div>
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-[#0A84FF] -mb-0.5 -mr-0.5"></div>
                        {/* Scanning Laser Line */}
                        <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)] opacity-70 animate-pulse"></div>
                    </div>
                </div>
            </div>
            
            <div className="mt-8 px-6 py-3 bg-white/5 rounded-full border border-white/5 backdrop-blur-md">
                 <p className="text-gray-300 text-sm font-medium flex items-center gap-2">
                    <Zap size={14} className="text-yellow-400" fill="currentColor" />
                    Supports Code 128, Code 39, QR
                 </p>
            </div>
            
            {error && (
                <div className="absolute bottom-10 px-6 py-3 bg-red-500/20 border border-red-500/50 rounded-xl">
                    <p className="text-red-200 text-sm font-medium">{error}</p>
                </div>
            )}
        </div>
    );
};

export default ScannerModal;
