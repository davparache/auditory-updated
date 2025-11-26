import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { InventoryItem, InventoryMap, Toast, CloudState, AuditItem } from './types';
import { Search, PenLine, ClipboardList, Upload, Zap, Box, Ghost, Wifi, WifiOff, RefreshCw, AlertTriangle, Lock } from 'lucide-react';
import EditorModal from './components/EditorModal';
import AuditView from './components/AuditView';
import GeminiModal from './components/GeminiModal';
import ConnectModal from './components/ConnectModal';
import ErrorBanner from './components/ErrorBanner';
import { initFirebase, saveToCloud, subscribeToSession, disconnectFirebase } from './services/firebaseService';

// Mock data for initial load if empty
const INITIAL_DATA: InventoryMap = {};

const App: React.FC = () => {
  // Inventory State
  const [inventory, setInventory] = useState<InventoryMap>(INITIAL_DATA);
  const [search, setSearch] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  // Cloud State
  const [cloud, setCloud] = useState<CloudState>({
      connected: false,
      sessionId: '',
      syncing: false,
      error: null,
      isReadOnly: false
  });

  // Modal States
  const [showEditor, setShowEditor] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [editorData, setEditorData] = useState<InventoryItem>({ part: '', bin: '', qty: 0 });
  const [isNewItem, setIsNewItem] = useState(false);
  
  const [showZones, setShowZones] = useState(false);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  
  const [isAuditMode, setIsAuditMode] = useState(false);
  const [showGemini, setShowGemini] = useState(false);

  // --- DERIVED VALUES (Memoized for Performance) ---
  const inventoryList = useMemo(() => {
    if (!inventory) return [];
    return Object.values(inventory);
  }, [inventory]);
  
  const filteredList = useMemo(() => {
    // 1. Safety check
    if (!inventoryList) return [];

    // 2. If no search, return sorted full list
    if (!search) {
        return [...inventoryList].sort((a, b) => {
            // Robust sort handling null/undefined
            const binA = a.bin || '';
            const binB = b.bin || '';
            return binA.localeCompare(binB);
        });
    }

    // 3. Search filter
    const q = search.toUpperCase();
    return inventoryList.filter(i => {
        const p = i.part || '';
        const b = i.bin || '';
        return p.includes(q) || b.includes(q);
    }).sort((a, b) => (a.bin || '').localeCompare(b.bin || ''));
  }, [inventoryList, search]);

  const zoneGroups = useMemo<Record<string, string[]>>(() => {
    const groups: Record<string, string[]> = {};
    if (!inventoryList) return groups;

    inventoryList.forEach(item => {
        const bin = item.bin || 'GEN';
        // Optimize regex creation by simple string split
        const prefix = bin.split(/[- ]/)[0] || 'GEN'; 
        if (!groups[prefix]) groups[prefix] = [];
        if (!groups[prefix].includes(bin)) groups[prefix].push(bin);
    });
    return groups;
  }, [inventoryList]);

  // --- INITIALIZATION ---
  useEffect(() => {
      const boot = async () => {
        await initFirebase();
        
        // Load local cache first for instant UI
        const savedLocal = localStorage.getItem('zeevra_v32_data');
        if (savedLocal) {
            try { 
                const parsed = JSON.parse(savedLocal);
                if (parsed && typeof parsed === 'object') setInventory(parsed);
            } catch (e) { console.error("Local load error", e); }
        }

        // Check if we were connected before
        const savedSession = localStorage.getItem('zeevra_session_id');
        // Note: We don't auto-reconnect logic here to keep it secure/simple in this version,
        // user presses connect button to re-enter pin if needed.
      };
      
      boot();

      return () => { disconnectFirebase(); };
  }, []);

  // --- PERSISTENCE ---
  useEffect(() => {
    // Debounce local storage writes slightly if data changes fast
    const handler = setTimeout(() => {
        localStorage.setItem('zeevra_v32_data', JSON.stringify(inventory));
    }, 500);
    return () => clearTimeout(handler);
  }, [inventory]);

  const notify = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  // Use callback to prevent re-creating this function on every render
  const syncToCloud = useCallback(async (newData: InventoryMap) => {
      if (cloud.connected && cloud.sessionId && !cloud.isReadOnly) {
          setCloud(prev => ({ ...prev, syncing: true, error: null }));
          
          // Perform save
          const success = await saveToCloud(cloud.sessionId, newData);

          if (success) {
            setCloud(prev => ({ ...prev, syncing: false }));
          } else {
            setCloud(prev => ({ ...prev, syncing: false, error: 'Sync Failed' }));
            notify("Sync Failed - Check Internet", "error");
          }
      }
  }, [cloud.connected, cloud.sessionId, cloud.isReadOnly, notify]);

  // --- ACTIONS ---
  const handleConnect = useCallback((sessionId: string, pin: string) => {
      const sid = sessionId.toUpperCase();
      localStorage.setItem('zeevra_session_id', sid);
      setCloud(prev => ({ ...prev, sessionId: sid, error: null }));
      setShowConnect(false);
      notify("Connecting...", "info");

      subscribeToSession(
          sid,
          pin,
          (data, isReadOnly) => {
              setInventory(data);
              setCloud(prev => ({ ...prev, connected: true, syncing: false, error: null, isReadOnly }));
              if (isReadOnly) notify("Connected (Read Only)", "info");
              else notify("Connected Successfully");
          },
          (error) => {
              notify(error, "error");
              setCloud(prev => ({ ...prev, connected: false, error: error }));
          }
      );
  }, [notify]);

  const handleDisconnect = useCallback(() => {
      disconnectFirebase();
      localStorage.removeItem('zeevra_session_id');
      setCloud({ connected: false, sessionId: '', syncing: false, error: null, isReadOnly: false });
      notify("Disconnected");
  }, [notify]);

  const handleCreate = useCallback(() => {
    if(cloud.isReadOnly) return notify("Read Only Mode", "error");
    setEditorData({ part: search.toUpperCase() || '', bin: '', qty: 0 });
    setIsNewItem(true);
    setShowEditor(true);
  }, [cloud.isReadOnly, search, notify]);

  const handleEdit = useCallback((item: InventoryItem) => {
    setEditorData(item);
    setIsNewItem(false);
    setShowEditor(true);
  }, []);

  const handleSaveItem = useCallback((item: InventoryItem) => {
    if(cloud.isReadOnly) return notify("Read Only Mode", "error");
    
    // Optimistic update
    setInventory(prev => {
        const newInv = { ...prev, [item.part]: item };
        // Sync trigger
        syncToCloud(newInv); 
        return newInv;
    });
    
    setShowEditor(false);
    notify(`Saved ${item.part}`);
  }, [cloud.isReadOnly, syncToCloud, notify]);

  const handleDeleteItem = useCallback((part: string) => {
    if(cloud.isReadOnly) return notify("Read Only Mode", "error");
    
    setInventory(prev => {
        const newInv = { ...prev };
        delete newInv[part];
        syncToCloud(newInv);
        return newInv;
    });

    setShowEditor(false);
    notify(`Deleted ${part}`, 'info');
  }, [cloud.isReadOnly, syncToCloud, notify]);

  const handleSearchAction = useCallback(() => {
      if (!search) return;
      const term = search.trim().toUpperCase();
      // Check for exact match
      if (inventory[term]) { 
          handleEdit(inventory[term]); 
          setSearch(''); 
          return; 
      }
      // Check for smart single match in filtered list
      // Note: we can't access filteredList directly in callback without adding it to deps, 
      // which causes re-creation. Better to re-calculate simple filter here or use ref.
      // For simplicity/performance, we'll re-check filter here.
      const smartList = Object.values(inventory).filter((i: InventoryItem) => i.part.includes(term) || i.bin.includes(term));
      
      if (smartList.length === 1) { 
          handleEdit(smartList[0]); 
          setSearch(''); 
          return; 
      }
      
      // Default to create
      handleCreate();
      setSearch('');
  }, [search, inventory, handleEdit, handleCreate]);

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if(cloud.isReadOnly) return notify("Read Only Mode", "error");
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
          const text = event.target?.result as string;
          if (!text) throw new Error("File is empty");
          
          const lines = text.split(/\r?\n/);
          // Use a local copy to batch updates
          const newItems: InventoryMap = { ...inventory }; 
          let count = 0;
          
          lines.forEach(line => {
            if (!line.trim()) return;
            const [part, desc, bin, qty] = line.split(/[,;]/); 
            
            // Basic validation
            if (part && part.trim().length > 1 && part.toUpperCase() !== 'PART') {
               const p = part.trim().toUpperCase();
               const q = parseInt(qty || '0');
               
               if (!isNaN(q)) {
                   newItems[p] = {
                       part: p,
                       bin: (bin || 'GEN').trim().toUpperCase(),
                       qty: q
                   };
                   count++;
               }
            }
          });
          
          if (count === 0) { notify("No valid items found", "error"); return; }
          
          setInventory(newItems);
          syncToCloud(newItems);
          notify(`Inventory Updated Successfully (${count} items)`);
      } catch (err) { 
          console.error(err); 
          notify("Import failed - check CSV format", "error"); 
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input to allow re-upload
  }, [cloud.isReadOnly, inventory, syncToCloud, notify]);

  const handleAuditStart = useCallback(() => {
    if(cloud.isReadOnly) return notify("Read Only Mode", "error");
    if (selectedZones.length === 0) return notify("Select a zone", "error");
    setShowZones(false);
    setIsAuditMode(true);
  }, [cloud.isReadOnly, selectedZones, notify]);

  const handleAuditFinish = useCallback((auditedItems: AuditItem[]) => {
      setInventory(prev => {
          const newInv = { ...prev };
          auditedItems.forEach(item => {
              if (item.done) {
                  newInv[item.part] = { part: item.part, bin: item.bin, qty: item.qty };
              }
          });
          syncToCloud(newInv);
          return newInv;
      });
      setIsAuditMode(false);
      notify("Audit synced successfully");
  }, [syncToCloud, notify]);

  // --- RENDER ---
  return (
    <div className="h-screen flex flex-col bg-black text-white relative overflow-hidden font-sans">
        
        {/* iOS STATUS BAR SPACE (Safe Area) */}
        <div className="h-[env(safe-area-inset-top)] w-full bg-black"></div>

        {/* TOASTS (Dynamic Island Style) */}
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-auto pointer-events-none">
            {toasts.map(t => (
                <div key={t.id} className="bg-[#2C2C2E] border border-white/5 rounded-full px-4 py-2 flex items-center gap-3 shadow-2xl animate-scale-in">
                    <div className={`w-2 h-2 rounded-full ${t.type === 'success' ? 'bg-[#30D158]' : t.type === 'error' ? 'bg-[#FF453A]' : 'bg-[#0A84FF]'}`} />
                    <span className="text-[13px] font-semibold tracking-wide">{t.message}</span>
                </div>
            ))}
        </div>

        {/* MAIN HEADER */}
        <header className="px-5 pt-4 pb-2 flex flex-col gap-6 z-10">
            {/* Top Bar: Brand + Status */}
            <div className="flex justify-between items-center">
                <div className="flex flex-col">
                    <h1 className="text-[17px] font-bold text-gray-500 tracking-wide uppercase">Parache</h1>
                    <h2 className="text-3xl font-bold text-white tracking-tight -mt-1">Technologies</h2>
                </div>
                
                {/* Dynamic Status Pill */}
                <button 
                    onClick={() => cloud.connected ? handleDisconnect() : setShowConnect(true)}
                    className="h-9 px-1 pl-1.5 pr-3 rounded-full bg-[#1C1C1E] border border-white/5 flex items-center gap-2 active:scale-95 transition-transform"
                >
                     <div className={`w-6 h-6 rounded-full flex items-center justify-center ${cloud.connected ? (cloud.error ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400') : 'bg-gray-700/30 text-gray-400'}`}>
                        {cloud.syncing ? <RefreshCw size={12} className="animate-spin"/> : cloud.error ? <AlertTriangle size={12}/> : cloud.connected ? <Wifi size={12}/> : <WifiOff size={12}/>}
                     </div>
                     <span className="text-[11px] font-bold text-gray-300 tracking-wide">
                        {cloud.isReadOnly ? 'READ ONLY' : cloud.connected ? 'ONLINE' : 'OFFLINE'}
                     </span>
                </button>
            </div>

            {/* SEARCH BAR (iOS Spotlight Style) */}
            <div className="relative z-20">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-500" />
                </div>
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchAction()}
                    className="block w-full pl-10 pr-3 py-3 border-none rounded-[14px] leading-5 bg-[#1C1C1E] text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0A84FF]/50 transition-all text-[17px]"
                    placeholder="Search Part or Bin"
                    type="search"
                />
            </div>
        </header>

        {/* MAIN BODY */}
        <main className="flex-1 flex flex-col px-5 pb-5 gap-6 overflow-hidden">
            
            {/* HORIZONTAL ACTIONS (HomeKit Style Tiles) */}
            {!cloud.isReadOnly && (
                <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar shrink-0">
                    <button onClick={() => handleCreate()} className="min-w-[85px] h-[85px] rounded-[22px] bg-[#1C1C1E] active:bg-[#2C2C2E] flex flex-col justify-between p-3 transition-colors">
                        <PenLine size={24} className="text-[#0A84FF]" />
                        <span className="text-[11px] font-semibold text-gray-200 text-left">Manual<br/>Entry</span>
                    </button>
                    <button onClick={() => setShowZones(true)} className="min-w-[85px] h-[85px] rounded-[22px] bg-[#1C1C1E] active:bg-[#2C2C2E] flex flex-col justify-between p-3 transition-colors">
                        <ClipboardList size={24} className="text-[#30D158]" />
                        <span className="text-[11px] font-semibold text-gray-200 text-left">Start<br/>Audit</span>
                    </button>
                    <label className="min-w-[85px] h-[85px] rounded-[22px] bg-[#1C1C1E] active:bg-[#2C2C2E] flex flex-col justify-between p-3 transition-colors cursor-pointer">
                        <Upload size={24} className="text-[#BF5AF2]" />
                        <span className="text-[11px] font-semibold text-gray-200 text-left">Import<br/>CSV</span>
                        <input type="file" className="hidden" accept=".csv" onChange={handleImport} />
                    </label>
                    <button onClick={() => setShowGemini(true)} className="min-w-[85px] h-[85px] rounded-[22px] bg-gradient-to-br from-[#1C1C1E] to-[#2C2C2E] border border-white/5 active:bg-[#2C2C2E] flex flex-col justify-between p-3 transition-colors relative overflow-hidden">
                        <Zap size={24} className="text-[#FFD60A]" />
                        <span className="text-[11px] font-semibold text-gray-200 text-left z-10">AI<br/>Insight</span>
                        <div className="absolute top-0 right-0 w-12 h-12 bg-[#FFD60A]/10 blur-xl rounded-full"></div>
                    </button>
                </div>
            )}

            {/* ERROR BANNER */}
            <ErrorBanner message={cloud.error} onDismiss={() => setCloud(prev => ({ ...prev, error: null }))} />

            {/* INVENTORY LIST (iOS Inset Grouped) */}
            <div className="flex-1 flex flex-col min-h-0">
                <div className="flex justify-between items-end mb-2 px-1">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Inventory</span>
                    <span className="text-xs font-semibold text-gray-500">{inventoryList.length} items</span>
                </div>
                
                <div className="bg-[#1C1C1E] rounded-[22px] flex-1 overflow-hidden flex flex-col">
                    {filteredList.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-600 gap-2">
                            <Ghost size={40} strokeWidth={1.5} />
                            <p className="text-sm">No items found</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto w-full">
                            {filteredList.map((item, index) => (
                                <div 
                                    key={item.part}
                                    onClick={() => !cloud.isReadOnly && handleEdit(item)}
                                    className={`
                                        flex justify-between items-center py-4 px-5 
                                        active:bg-[#2C2C2E] cursor-pointer transition-colors
                                        ${index !== filteredList.length - 1 ? 'border-b border-[#38383A]' : ''}
                                    `}
                                >
                                    <div className="flex flex-col">
                                        <span className="text-[17px] font-semibold text-white">{item.part}</span>
                                        <span className="text-[13px] text-gray-500 font-medium">{item.bin}</span>
                                    </div>
                                    <span className="text-[17px] font-medium text-gray-300 tabular-nums">
                                        {item.qty}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </main>

        {/* --- MODALS --- */}
        <EditorModal 
            isOpen={showEditor} 
            initialData={editorData} 
            isNew={isNewItem} 
            onClose={() => setShowEditor(false)}
            onSave={handleSaveItem}
            onDelete={handleDeleteItem}
        />

        <GeminiModal
            isOpen={showGemini}
            items={inventoryList}
            onClose={() => setShowGemini(false)}
        />
        
        <ConnectModal
            isOpen={showConnect}
            onClose={() => setShowConnect(false)}
            onConnect={handleConnect}
        />

        {isAuditMode && (
            <AuditView 
                items={inventoryList}
                zoneFilter={selectedZones}
                onFinish={handleAuditFinish}
                onCancel={() => setIsAuditMode(false)}
            />
        )}

        {/* ZONES SELECTION (Bottom Sheet Style) */}
        {showZones && (
            <div className="fixed inset-0 z-50 flex items-end justify-center">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowZones(false)} />
                <div className="bg-[#1C1C1E] w-full rounded-t-[35px] shadow-2xl max-h-[85vh] flex flex-col animate-slide-up relative z-10 pb-8">
                     <div className="w-12 h-1.5 bg-gray-600 rounded-full opacity-30 mx-auto mt-3 mb-4"></div>
                     <div className="px-6 pb-4 border-b border-[#38383A] flex justify-between items-center">
                        <h3 className="text-xl font-bold text-white">Select Audit Zones</h3>
                        <button onClick={() => setShowZones(false)} className="w-8 h-8 bg-[#2C2C2E] rounded-full flex items-center justify-center text-gray-400">✕</button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {Object.entries(zoneGroups).map(([prefix, zones]: [string, string[]]) => (
                            <div key={prefix}>
                                <div className="flex justify-between mb-3 px-1">
                                    <span className="font-bold text-gray-400 text-sm">{prefix}</span>
                                    <button 
                                        onClick={() => {
                                            const allSelected = zones.every(z => selectedZones.includes(z));
                                            if(allSelected) setSelectedZones(prev => prev.filter(z => !zones.includes(z)));
                                            else setSelectedZones(prev => [...prev, ...zones.filter(z => !prev.includes(z))]);
                                        }}
                                        className="text-xs text-[#0A84FF] font-medium"
                                    >
                                        Select All
                                    </button>
                                </div>
                                <div className="grid grid-cols-4 gap-3">
                                    {zones.map(z => (
                                        <button 
                                            key={z}
                                            onClick={() => {
                                                if(selectedZones.includes(z)) setSelectedZones(prev => prev.filter(x => x !== z));
                                                else setSelectedZones(prev => [...prev, z]);
                                            }}
                                            className={`h-10 rounded-xl text-xs font-semibold transition-all ${
                                                selectedZones.includes(z) 
                                                ? 'bg-[#0A84FF] text-white shadow-lg shadow-blue-500/20' 
                                                : 'bg-[#2C2C2E] text-gray-400'
                                            }`}
                                        >
                                            {z}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="px-6 pt-4">
                        <button 
                            onClick={handleAuditStart}
                            disabled={selectedZones.length === 0}
                            className="w-full bg-[#30D158] hover:bg-[#28cd41] disabled:opacity-50 text-white h-14 rounded-2xl font-bold text-lg shadow-lg shadow-green-900/20"
                        >
                            Start Audit ({selectedZones.length})
                        </button>
                    </div>
                </div>
            </div>
        )}

    </div>
  );
};

export default App;