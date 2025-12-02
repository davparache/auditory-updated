
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { InventoryItem, InventoryMap, Toast, CloudState, AuditItem, ZoneHierarchy } from './types';
import { Search, PenLine, ClipboardList, Upload, Zap, Ghost, Wifi, WifiOff, RefreshCw, AlertTriangle, ChevronDown, ChevronRight, Layers, CheckSquare, Square, CloudUpload, Share2, FolderOpen, ScanBarcode } from 'lucide-react';
import EditorModal from './components/EditorModal';
import AuditView from './components/AuditView';
import GeminiModal from './components/GeminiModal';
import ConnectModal from './components/ConnectModal';
import ScannerModal from './components/ScannerModal';
import ErrorBanner from './components/ErrorBanner';
import ParacheLogo from './components/ParacheLogo';
import { initFirebase, saveToCloud, subscribeToSession, disconnectFirebase, updateSessionPin } from './services/firebaseService';

// Mock data for initial load if empty
const INITIAL_DATA: InventoryMap = {};

// --- HELPER: STRICT BIN PARSER ---
const getBinHierarchy = (binRaw: string) => {
    const bin = binRaw ? binRaw.trim().toUpperCase() : '0';
    
    // 0. Catch Empty or Generic or "0"
    if (!bin || bin === '0' || bin === 'UNASSIGNED') return { group: 'NO_LOCATION', subgroup: '0' };

    // 1. Strict Numeric Zones (2xx, 3xx, 6xx)
    const numericMatch = bin.match(/^(\d{3})/);
    if (numericMatch) {
        const zonePrefix = numericMatch[1];
        if (zonePrefix.startsWith('2') || zonePrefix.startsWith('3') || zonePrefix.startsWith('6')) {
             const subMatch = bin.match(/^\d{3}([A-Z])/);
             const sub = subMatch ? `${zonePrefix}${subMatch[1]}` : zonePrefix;
             return { group: zonePrefix, subgroup: sub };
        }
    }

    // 2. NG Zones (NG1, NG1-10)
    if (bin.startsWith('NG')) {
        return { group: 'NG', subgroup: 'NG1' };
    }

    // 3. AREA Zones (AREA-300, AREA-307)
    if (bin.startsWith('AREA')) {
        const simple = bin.split(' ')[0]; 
        return { group: 'AREAS', subgroup: simple };
    }

    // 4. Garbage / Description Detection
    if (bin.length > 8 || bin.includes(' ') || /(ALTERNATOR|ASSY|KIT|SET|HOLDER|BOLT|NUT|WASHER|CLIP|SENSOR)/.test(bin)) {
        return { group: 'DATA_CHECK', subgroup: 'BAD_DATA' };
    }

    // 5. Fallback for valid but unlisted short codes (e.g. A1, B2)
    return { group: 'MISC', subgroup: 'GENERAL' };
};

const App: React.FC = () => {
  // Inventory State
  const [inventory, setInventory] = useState<InventoryMap>(() => {
    try {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('zeevra_v32_data');
            return saved ? JSON.parse(saved) : INITIAL_DATA;
        }
    } catch (e) {
        console.error("Failed to load local data", e);
    }
    return INITIAL_DATA;
  });

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
  const [showScanner, setShowScanner] = useState(false);
  const [editorData, setEditorData] = useState<InventoryItem>({ part: '', bin: '0', qty: 0 });
  const [isNewItem, setIsNewItem] = useState(false);
  
  const [showZones, setShowZones] = useState(false);
  
  // Stores strict LIST of BIN IDs to be audited
  const [selectedBins, setSelectedBins] = useState<string[]>([]);
  
  const [isAuditMode, setIsAuditMode] = useState(false);
  const [showGemini, setShowGemini] = useState(false);
  
  // UI State for Accordion
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [collapsedSubgroups, setCollapsedSubgroups] = useState<Record<string, boolean>>({});

  // --- DERIVED VALUES ---
  const inventoryList = useMemo(() => {
    if (!inventory) return [];
    return Object.values(inventory);
  }, [inventory]);
  
  const filteredList = useMemo(() => {
    if (!inventoryList) return [];

    if (!search) {
        return [...inventoryList].sort((a, b) => {
            const binA = a.bin || '';
            const binB = b.bin || '';
            return binA.localeCompare(binB);
        });
    }

    const q = search.toUpperCase();
    return inventoryList.filter(i => {
        const p = i.part || '';
        const b = i.bin || '';
        return p.includes(q) || b.includes(q);
    }).sort((a, b) => (a.bin || '').localeCompare(b.bin || ''));
  }, [inventoryList, search]);

  const groupedFilteredList = useMemo(() => {
    if (!filteredList.length) return [];
    
    const hierarchy: Record<string, { total: number, subgroups: Record<string, InventoryItem[]> }> = {};
    
    filteredList.forEach(item => {
        const { group, subgroup } = getBinHierarchy(item.bin);
        
        if (!hierarchy[group]) {
            hierarchy[group] = { total: 0, subgroups: {} };
        }
        if (!hierarchy[group].subgroups[subgroup]) {
            hierarchy[group].subgroups[subgroup] = [];
        }
        
        hierarchy[group].subgroups[subgroup].push(item);
        hierarchy[group].total++;
    });

    return Object.keys(hierarchy).sort().map(groupKey => ({
        key: groupKey,
        total: hierarchy[groupKey].total,
        subgroups: Object.keys(hierarchy[groupKey].subgroups).sort().map(subKey => ({
            key: subKey,
            items: hierarchy[groupKey].subgroups[subKey]
        }))
    }));
  }, [filteredList]);

  useEffect(() => {
      if (search) {
          setCollapsedGroups({});
          setCollapsedSubgroups({});
      }
  }, [search]);

  const zoneHierarchy = useMemo<ZoneHierarchy>(() => {
    const tree: ZoneHierarchy = {};
    if (!inventoryList) return tree;

    inventoryList.forEach(item => {
        const rawBin = item.bin ? item.bin.toUpperCase() : '0';
        const { group, subgroup } = getBinHierarchy(rawBin);

        if (!tree[group]) {
            tree[group] = { label: group, totalItems: 0, subgroups: {} };
        }
        
        if (!tree[group].subgroups[subgroup]) {
            tree[group].subgroups[subgroup] = [];
        }

        if (!tree[group].subgroups[subgroup].includes(rawBin)) {
            tree[group].subgroups[subgroup].push(rawBin);
        }
        
        tree[group].totalItems++;
    });

    return tree;
  }, [inventoryList]);

  // --- PERSISTENCE ---
  useEffect(() => {
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

  const syncToCloud = useCallback(async (newData: InventoryMap) => {
      if (cloud.connected && cloud.sessionId && !cloud.isReadOnly) {
          setCloud(prev => ({ ...prev, syncing: true, error: null }));
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
      localStorage.setItem('zeevra_pin', pin);
      
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

  const handleResetPin = useCallback(async (sessionId: string, newPin: string) => {
    const sid = sessionId.toUpperCase();
    const success = await updateSessionPin(sid, newPin);
    if (success) {
        notify("PIN Updated Successfully");
        handleConnect(sid, newPin);
    } else {
        notify("Failed to update PIN", "error");
    }
  }, [notify, handleConnect]);

  const handleDisconnect = useCallback(() => {
      disconnectFirebase();
      localStorage.removeItem('zeevra_session_id');
      localStorage.removeItem('zeevra_pin');
      
      setCloud({ connected: false, sessionId: '', syncing: false, error: null, isReadOnly: false });
      notify("Disconnected");
  }, [notify]);

  const handleCreate = useCallback(() => {
    if(cloud.isReadOnly) return notify("Read Only Mode", "error");
    setEditorData({ part: search.toUpperCase() || '', bin: '0', qty: 0 });
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
    setInventory(prev => {
        const newInv = { ...prev, [item.part]: item };
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
      if (inventory[term]) { 
          handleEdit(inventory[term]); 
          setSearch(''); 
          return; 
      }
      const smartList = Object.values(inventory).filter((i: InventoryItem) => i.part.includes(term) || i.bin.includes(term));
      if (smartList.length === 1) { 
          handleEdit(smartList[0]); 
          setSearch(''); 
          return; 
      }
      handleCreate();
      setSearch('');
  }, [search, inventory, handleEdit, handleCreate]);

  const handleScanResult = (code: string) => {
      const term = code.trim().toUpperCase();
      setSearch(term);
      setShowScanner(false);
      
      if (inventory[term]) {
          handleEdit(inventory[term]);
          setSearch('');
          notify("Item found");
      } else {
          notify("Item not found - Create new?", "info");
      }
  };

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
          const newItems: InventoryMap = { ...inventory }; 
          let count = 0;
          
          lines.forEach(line => {
            if (!line.trim()) return;
            const cols = line.split(/[,;]/).map(s => s.trim());
            let p = '', b = '0', q = 0;

            if (cols.length >= 4) {
                 p = cols[0];
                 b = cols[2] || '0';
                 q = parseInt(cols[3] || '0');
            } else if (cols.length === 3) {
                 const col1 = cols[1];
                 const isBinLike = col1.length < 8 && /\d/.test(col1) && !col1.includes(' ');
                 if (isBinLike) {
                     p = cols[0];
                     b = cols[1];
                     q = parseInt(cols[2] || '0');
                 } else {
                     p = cols[0];
                     b = '0';
                     q = parseInt(cols[2] || '0');
                 }
            } else if (cols.length === 2) {
                 p = cols[0];
                 b = '0';
                 q = parseInt(cols[1] || '0');
            }

            if (p && p.length > 1 && p.toUpperCase() !== 'PART') {
               const pUpper = p.toUpperCase();
               if (!isNaN(q)) {
                   newItems[pUpper] = { part: pUpper, bin: b.toUpperCase(), qty: q };
                   count++;
               }
            }
          });

          if (count === 0) { notify("No valid items found", "error"); return; }
          setInventory(newItems);
          syncToCloud(newItems);
          notify(`Imported ${count} items`);
      } catch (err) { 
          notify("Import failed - check CSV format", "error"); 
      }
    };
    reader.readAsText(file);
    e.target.value = ''; 
  }, [cloud.isReadOnly, inventory, syncToCloud, notify]);

  const handleAuditStart = useCallback(() => {
    if(cloud.isReadOnly) return notify("Read Only Mode", "error");
    if (selectedBins.length === 0) return notify("Select at least one zone", "error");
    setShowZones(false);
    setIsAuditMode(true);
  }, [cloud.isReadOnly, selectedBins, notify]);

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

  const handleShareOrSave = () => {
      if (cloud.connected) {
          const pin = localStorage.getItem('zeevra_pin') || '';
          const textToShare = `PARACHE ACCESS\nSession: ${cloud.sessionId}\nPIN: ${pin}`;
          
          navigator.clipboard.writeText(textToShare).then(() => {
              notify("Access Credentials Copied!");
          }).catch(() => {
              notify("Session: " + cloud.sessionId, "info");
          });
      } else {
          setShowConnect(true);
      }
  };

  useEffect(() => {
      const boot = async () => {
        await initFirebase();
        const savedSession = localStorage.getItem('zeevra_session_id');
        const savedPin = localStorage.getItem('zeevra_pin');
        if (savedSession) {
            handleConnect(savedSession, savedPin || '');
        }
      };
      boot();
      return () => { disconnectFirebase(); };
  }, [handleConnect]);

  const toggleGroup = (group: string) => {
      setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };
  
  const toggleMainGroup = (group: string) => {
      setCollapsedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const toggleSubGroup = (uniqueKey: string) => {
      setCollapsedSubgroups(prev => ({ ...prev, [uniqueKey]: !prev[uniqueKey] }));
  };

  const isGroupFullySelected = (group: string) => {
      const allBinsInGroup = Object.values(zoneHierarchy[group].subgroups).flat();
      return allBinsInGroup.every(b => selectedBins.includes(b));
  };

  const toggleSelectGroup = (group: string) => {
      const allBins = Object.values(zoneHierarchy[group].subgroups).flat();
      if (isGroupFullySelected(group)) {
          setSelectedBins(prev => prev.filter(b => !allBins.includes(b)));
      } else {
          setSelectedBins(prev => [...new Set([...prev, ...allBins])]);
      }
  };

  const toggleSelectSubgroup = (bins: string[]) => {
      const allSelected = bins.every(b => selectedBins.includes(b));
      if (allSelected) {
           setSelectedBins(prev => prev.filter(b => !bins.includes(b)));
      } else {
           setSelectedBins(prev => [...new Set([...prev, ...bins])]);
      }
  };

  return (
    <div className="h-screen flex flex-col bg-transparent text-white relative overflow-hidden font-sans">
        
        <div className="safe-top w-full"></div>

        {/* TOASTS */}
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-auto pointer-events-none">
            {toasts.map(t => (
                <div key={t.id} className="glass-panel px-4 py-2 rounded-full flex items-center gap-3 shadow-[0_4px_12px_rgba(0,0,0,0.5)] animate-scale-in border border-white/20">
                    <div className={`w-2 h-2 rounded-full shadow-[0_0_8px_currentColor] ${t.type === 'success' ? 'bg-[#39ff14] text-[#39ff14]' : t.type === 'error' ? 'bg-[#ff073a] text-[#ff073a]' : 'bg-[#00f3ff] text-[#00f3ff]'}`} />
                    <span className="text-[13px] font-semibold tracking-wide text-white drop-shadow-md">{t.message}</span>
                </div>
            ))}
        </div>

        {/* MAIN HEADER */}
        <header className="px-3 pt-4 pb-2 flex flex-col gap-5 z-10">
            <div className="flex justify-between items-start">
                <ParacheLogo />
                <button 
                    onClick={() => cloud.connected ? handleDisconnect() : setShowConnect(true)}
                    className="glass-card h-8 px-2 pl-2 pr-3 rounded-full flex items-center gap-2 active:scale-95 transition-all mt-2 hover:border-white/20 hover:bg-white/5"
                >
                     <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${cloud.connected ? (cloud.error ? 'bg-red-500/20 text-red-400' : 'bg-[#00f3ff]/20 text-[#00f3ff] shadow-[0_0_10px_rgba(0,243,255,0.3)]') : 'bg-gray-500/20 text-gray-400'}`}>
                        {cloud.syncing ? <RefreshCw size={12} className="animate-spin"/> : cloud.error ? <AlertTriangle size={12}/> : cloud.connected ? <Wifi size={12}/> : <WifiOff size={12}/>}
                     </div>
                     <span className={`text-[10px] font-bold tracking-wider ${cloud.connected ? 'text-[#00f3ff]' : 'text-gray-400'}`}>
                        {cloud.isReadOnly ? 'READ ONLY' : cloud.connected ? 'ONLINE' : 'OFFLINE'}
                     </span>
                </button>
            </div>

            <div className="relative z-20 group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400 group-focus-within:text-[#00f3ff] transition-colors" />
                </div>
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchAction()}
                    className="block w-full pl-10 pr-12 py-3 rounded-2xl leading-5 glass-input text-white placeholder-gray-500 focus:outline-none focus:border-[#00f3ff]/50 focus:shadow-[0_0_15px_rgba(0,243,255,0.1)] transition-all text-[16px]"
                    placeholder="Search Part or Bin..."
                    type="search"
                />
                <button 
                    onClick={() => setShowScanner(true)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-[#00f3ff] transition-colors"
                >
                    <ScanBarcode size={22} />
                </button>
            </div>
        </header>

        {/* MAIN BODY */}
        <main className="flex-1 flex flex-col px-3 pb-5 gap-5 overflow-hidden">
            
            {!cloud.isReadOnly && (
                <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar shrink-0 pt-1">
                    <button onClick={() => handleCreate()} className="glass-card min-w-[85px] h-[85px] rounded-[24px] active:scale-95 flex flex-col justify-between p-3.5 transition-all hover:border-[#00f3ff]/50 hover:shadow-[0_0_15px_rgba(0,243,255,0.15)] group">
                        <PenLine size={24} className="text-[#00f3ff] drop-shadow-[0_0_5px_rgba(0,243,255,0.5)]" />
                        <span className="text-[11px] font-bold text-gray-300 group-hover:text-white transition-colors">Manual<br/>Entry</span>
                    </button>
                    
                    <button onClick={() => setShowZones(true)} className="glass-card min-w-[85px] h-[85px] rounded-[24px] active:scale-95 flex flex-col justify-between p-3.5 transition-all hover:border-[#39ff14]/50 hover:shadow-[0_0_15px_rgba(57,255,20,0.15)] group">
                        <ClipboardList size={24} className="text-[#39ff14] drop-shadow-[0_0_5px_rgba(57,255,20,0.5)]" />
                        <span className="text-[11px] font-bold text-gray-300 group-hover:text-white transition-colors">Start<br/>Audit</span>
                    </button>
                    
                    <button 
                        onClick={handleShareOrSave} 
                        className={`glass-card min-w-[85px] h-[85px] rounded-[24px] active:scale-95 flex flex-col justify-between p-3.5 transition-all hover:border-[#bc13fe]/50 hover:shadow-[0_0_15px_rgba(188,19,254,0.15)] group ${cloud.connected ? 'bg-[#00f3ff]/5' : ''}`}
                    >
                         {cloud.connected ? <Share2 size={24} className="text-[#bc13fe] drop-shadow-[0_0_5px_rgba(188,19,254,0.5)]" /> : <CloudUpload size={24} className="text-[#bc13fe]" />}
                         <span className="text-[11px] font-bold text-gray-300 group-hover:text-white transition-colors leading-tight">
                            {cloud.connected ? 'Share\nAccess' : 'Save\nOnline'}
                         </span>
                    </button>
                    
                    <label className="glass-card min-w-[85px] h-[85px] rounded-[24px] active:scale-95 flex flex-col justify-between p-3.5 transition-all cursor-pointer hover:border-[#ff073a]/50 hover:shadow-[0_0_15px_rgba(255,7,58,0.15)] group">
                        <Upload size={24} className="text-[#ff073a] drop-shadow-[0_0_5px_rgba(255,7,58,0.5)]" />
                        <span className="text-[11px] font-bold text-gray-300 group-hover:text-white transition-colors">Import<br/>CSV</span>
                        <input type="file" className="hidden" accept=".csv" onChange={handleImport} />
                    </label>

                    <button onClick={() => setShowGemini(true)} className="min-w-[85px] h-[85px] rounded-[24px] bg-gradient-to-br from-[#bc13fe]/20 to-[#00f3ff]/20 backdrop-blur-md border border-white/10 flex flex-col justify-between p-3.5 transition-all relative overflow-hidden group hover:border-white/30">
                        <Zap size={24} className="text-[#FFD60A] drop-shadow-[0_0_8px_rgba(255,214,10,0.8)] group-hover:scale-110 transition-transform" />
                        <span className="text-[11px] font-bold text-gray-200 z-10">AI<br/>Insight</span>
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-slide-up opacity-50"></div>
                    </button>
                </div>
            )}

            <ErrorBanner message={cloud.error} onDismiss={() => setCloud(prev => ({ ...prev, error: null }))} />

            <div className="flex-1 flex flex-col min-h-0">
                <div className="flex justify-between items-end mb-2 px-2">
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Inventory</span>
                    <span className="text-[11px] font-bold text-[#00f3ff] drop-shadow-[0_0_8px_rgba(0,243,255,0.4)]">{filteredList.length} items</span>
                </div>
                
                <div className="glass-panel rounded-[28px] flex-1 overflow-hidden flex flex-col shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10">
                    {filteredList.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-600 gap-3">
                            <Ghost size={48} strokeWidth={1} className="opacity-30" />
                            <p className="text-sm font-medium opacity-50">No items found</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto w-full pb-6">
                            {groupedFilteredList.map((group) => {
                                const isCollapsed = collapsedGroups[group.key];
                                return (
                                    <div key={group.key} className="flex flex-col">
                                        {/* Sticky Group Header */}
                                        <div 
                                            onClick={() => toggleMainGroup(group.key)}
                                            className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-black/60 backdrop-blur-xl border-y border-white/5 cursor-pointer hover:bg-white/5 transition-colors group"
                                        >
                                            <div className="flex items-center gap-2">
                                                {isCollapsed ? 
                                                    <ChevronRight size={14} className="text-gray-500 group-hover:text-white transition-colors" /> : 
                                                    <ChevronDown size={14} className="text-[#00f3ff]" />
                                                }
                                                <span className={`text-[11px] font-bold tracking-widest uppercase ${isCollapsed ? 'text-gray-400' : 'text-gray-100 neon-text-blue'}`}>
                                                    Zone {group.key}
                                                </span>
                                            </div>
                                            <div className="px-2 py-0.5 rounded bg-white/5 border border-white/5">
                                                <span className="text-[10px] font-mono font-bold text-gray-400">{group.total}</span>
                                            </div>
                                        </div>

                                        {!isCollapsed && (
                                            <div className="animate-slide-up">
                                                {group.subgroups.map(subgroup => {
                                                     const uniqueSubKey = `${group.key}_${subgroup.key}`;
                                                     const isSubCollapsed = collapsedSubgroups[uniqueSubKey];
                                                     
                                                     return (
                                                         <div key={subgroup.key} className="border-l border-white/5 ml-4">
                                                              {/* Subgroup Header */}
                                                              <div 
                                                                  onClick={() => toggleSubGroup(uniqueSubKey)}
                                                                  className="flex items-center gap-2 py-1.5 px-3 cursor-pointer hover:bg-white/5 rounded-r-lg group"
                                                              >
                                                                  <FolderOpen size={12} className="text-gray-600 group-hover:text-[#bc13fe] transition-colors" />
                                                                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide group-hover:text-gray-300 transition-colors">{subgroup.key}</span>
                                                              </div>

                                                              {/* Items */}
                                                              {!isSubCollapsed && (
                                                                  <div className="pl-1">
                                                                      {subgroup.items.map((item) => (
                                                                          <div 
                                                                              key={item.part}
                                                                              onClick={() => !cloud.isReadOnly && handleEdit(item)}
                                                                              className={`
                                                                                  py-2 px-3 
                                                                                  active:bg-white/5 cursor-pointer transition-colors
                                                                                  border-b border-white/5 last:border-0 hover:bg-white/[0.03]
                                                                              `}
                                                                          >
                                                                            <div className="flex items-center justify-between">
                                                                                <div className="flex items-center gap-3 overflow-hidden flex-1 mr-2">
                                                                                    <span className="text-[13px] font-bold text-gray-200 truncate min-w-[80px] tracking-wide">
                                                                                        {item.part}
                                                                                    </span>
                                                                                    <span className={`
                                                                                        text-[9px] font-mono shrink-0 px-1.5 py-0.5 rounded border border-white/5
                                                                                        ${item.bin.includes(' ') || item.bin.length > 8 ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-white/5 text-gray-400'}
                                                                                    `}>
                                                                                        {item.bin}
                                                                                    </span>
                                                                                </div>
                                                                                
                                                                                <span className="text-[13px] font-bold text-[#00f3ff] min-w-[20px] text-right drop-shadow-[0_0_5px_rgba(0,243,255,0.3)]">
                                                                                    {item.qty}
                                                                                </span>
                                                                            </div>
                                                                          </div>
                                                                      ))}
                                                                  </div>
                                                              )}
                                                         </div>
                                                     );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </main>

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
            onResetPin={handleResetPin}
        />

        <ScannerModal
            isOpen={showScanner}
            onClose={() => setShowScanner(false)}
            onScan={handleScanResult}
            title="Search Item"
        />

        {isAuditMode && (
            <AuditView 
                items={inventoryList}
                zoneFilter={selectedBins}
                onFinish={handleAuditFinish}
                onCancel={() => setIsAuditMode(false)}
            />
        )}

        {/* ZONE SELECTION MODAL */}
        {showZones && (
            <div className="fixed inset-0 z-50 flex items-end justify-center">
                <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowZones(false)} />
                <div className="glass-panel bg-[#050505]/90 w-full rounded-t-[35px] shadow-[0_-10px_40px_rgba(0,0,0,0.8)] h-[85vh] flex flex-col animate-slide-up relative z-10 border-t border-white/10">
                     <div className="w-16 h-1 bg-white/20 rounded-full mx-auto mt-4 mb-4"></div>
                     <div className="px-6 pb-4 border-b border-white/5 flex justify-between items-center">
                        <div>
                             <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Layers size={20} className="text-[#39ff14] drop-shadow-[0_0_8px_rgba(57,255,20,0.6)]" />
                                Audit Zones
                             </h3>
                             <p className="text-xs text-gray-400 mt-1 font-medium tracking-wide">Configure specific scanning targets</p>
                        </div>
                        <button onClick={() => setShowZones(false)} className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors border border-white/5">✕</button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                        {Object.keys(zoneHierarchy).length === 0 && (
                            <div className="text-center text-gray-500 py-10 opacity-50">No zones defined via Bins.</div>
                        )}
                        
                        {Object.entries(zoneHierarchy).sort().map(([groupKey, rawGroupData]) => {
                            const groupData = rawGroupData as ZoneHierarchy[string];
                            const isFullySelected = isGroupFullySelected(groupKey);
                            const isExpanded = expandedGroups[groupKey];
                            
                            return (
                                <div key={groupKey} className={`rounded-2xl border transition-all duration-300 ${isExpanded ? 'bg-white/[0.02] border-white/10' : 'bg-transparent border-transparent hover:bg-white/[0.02]'}`}>
                                    <div className="flex items-center p-3 cursor-pointer select-none">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); toggleGroup(groupKey); }}
                                            className="p-1 text-gray-500 hover:text-[#00f3ff] transition-colors"
                                        >
                                            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                        </button>
                                        
                                        <div className="flex-1 ml-3 flex flex-col" onClick={() => toggleGroup(groupKey)}>
                                            <span className="text-sm font-bold text-gray-200">Group {groupKey}</span>
                                            <span className="text-[10px] text-gray-500 font-mono mt-0.5">{groupData.totalItems} items</span>
                                        </div>

                                        <button 
                                            onClick={(e) => { e.stopPropagation(); toggleSelectGroup(groupKey); }}
                                            className={`p-2 rounded-lg transition-all ${isFullySelected ? 'text-[#39ff14] drop-shadow-[0_0_5px_rgba(57,255,20,0.5)]' : 'text-gray-600 hover:text-gray-400'}`}
                                        >
                                            {isFullySelected ? <CheckSquare size={22} strokeWidth={2.5} /> : <Square size={22} />}
                                        </button>
                                    </div>

                                    {isExpanded && (
                                        <div className="border-t border-white/5 p-3 grid grid-cols-2 gap-2 animate-fade-in bg-black/20">
                                            {Object.entries(groupData.subgroups).sort().map(([subKey, bins]) => {
                                                const allSubSelected = bins.every(b => selectedBins.includes(b));
                                                return (
                                                    <button
                                                        key={subKey}
                                                        onClick={() => toggleSelectSubgroup(bins)}
                                                        className={`
                                                            flex items-center justify-between p-2.5 rounded-xl border text-left transition-all relative overflow-hidden
                                                            ${allSubSelected 
                                                                ? 'bg-[#00f3ff]/10 border-[#00f3ff]/30 text-[#00f3ff]' 
                                                                : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'}
                                                        `}
                                                    >
                                                        <span className="text-xs font-bold tracking-wide z-10 relative">
                                                            {subKey}
                                                        </span>
                                                        {allSubSelected && <div className="absolute inset-0 bg-[#00f3ff]/5 animate-pulse z-0"></div>}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    
                    <div className="px-6 pt-4 pb-8 border-t border-white/10 bg-[#0A0A0C]">
                        <div className="flex justify-between items-center mb-3 px-1">
                            <span className="text-xs font-mono text-gray-400">
                                {selectedBins.length} ZONES SELECTED
                            </span>
                            {selectedBins.length > 0 && (
                                <button onClick={() => setSelectedBins([])} className="text-xs text-[#ff073a] hover:text-red-300 font-bold uppercase tracking-wider">
                                    Reset
                                </button>
                            )}
                        </div>
                        <button 
                            onClick={handleAuditStart}
                            disabled={selectedBins.length === 0}
                            className="w-full bg-[#39ff14] hover:bg-[#32e612] disabled:opacity-20 disabled:grayscale text-black h-14 rounded-2xl font-black text-lg shadow-[0_0_30px_rgba(57,255,20,0.3)] active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-wide"
                        >
                            Start Session
                        </button>
                    </div>
                </div>
            </div>
        )}

    </div>
  );
};

export default App;