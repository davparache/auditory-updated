
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
            await new Promise(r => setTimeout(r, 100));
            if (!mounted) return;

            const element = document.getElementById(elementId);
            if (!element) {
                if (mounted) setError("Scanner element not found");
                return;
            }

            try {
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
                                cleanup().then(() => {
                                    onScan(decodedText.trim().toUpperCase());
                                });
                            }
                        },
                        (errorMessage) => { }
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
             <div className="absolute top-0 w-full p-6 pt-12 flex justify-between items-start z-10 bg-gradient-to-b from-black/80 to-transparent">
                 <div className="flex flex-col">
                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                        <ScanBarcode className="text-[#bc13fe]" size={20} />
                        {title}
                    </h3>
                    <p className="text-gray-300 text-xs tracking-wider">ALIGN CODE WITHIN FRAME</p>
                 </div>
                 <button 
                    onClick={onClose}
                    className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white backdrop-blur-md hover:bg-white/20 transition-colors border border-white/10"
                 >
                     <X size={20} />
                 </button>
            </div>

            <div className="w-full max-w-md relative overflow-hidden rounded-[32px] border-2 border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] bg-black">
                <div id={elementId} className="w-full h-full min-h-[400px]"></div>
                
                {/* Visual Guide Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-64 h-32 border-2 border-[#bc13fe] rounded-lg relative shadow-[0_0_30px_rgba(188,19,254,0.3)] bg-[#bc13fe]/5">
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-[#bc13fe] -mt-0.5 -ml-0.5"></div>
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-[#bc13fe] -mt-0.5 -mr-0.5"></div>
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-[#bc13fe] -mb-0.5 -ml-0.5"></div>
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-[#bc13fe] -mb-0.5 -mr-0.5"></div>
                        {/* Scanning Laser Line */}
                        <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-[#00f3ff] shadow-[0_0_15px_#00f3ff] opacity-80 animate-pulse"></div>
                    </div>
                </div>
            </div>
            
            <div className="mt-8 px-6 py-3 bg-white/5 rounded-full border border-white/5 backdrop-blur-md shadow-lg">
                 <p className="text-gray-300 text-sm font-bold flex items-center gap-2">
                    <Zap size={16} className="text-[#FFD60A]" fill="currentColor" />
                    <span className="text-[10px] tracking-widest uppercase">Scanner Active</span>
                 </p>
            </div>
            
            {error && (
                <div className="absolute bottom-10 px-6 py-3 bg-[#ff073a]/20 border border-[#ff073a]/50 rounded-xl">
                    <p className="text-[#ff073a] text-sm font-bold">{error}</p>
                </div>
            )}
        </div>
    );
};

export default ScannerModal;