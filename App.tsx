
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { InventoryItem, InventoryMap, Toast, CloudState, AuditItem } from './types';
import { Search, Plus, Layers, WifiOff, RefreshCw, AlertTriangle, Lock, CheckCircle2, ScanBarcode, Download, Trash2, Edit, Box, LayoutDashboard, Database, ChevronRight } from 'lucide-react';
import EditorModal from './components/EditorModal';
import AuditView from './components/AuditView';
import ConnectModal from './components/ConnectModal';
import ScannerModal from './components/ScannerModal';
import ErrorBanner from './components/ErrorBanner';
import ParacheLogo from './components/ParacheLogo';
import { initFirebase, saveToCloud, subscribeToSession, disconnectFirebase, updateSessionPin } from './services/firebaseService';
import * as XLSX from 'xlsx';

const INITIAL_DATA: InventoryMap = {};

const App: React.FC = () => {
  // --- STATE ---
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'INVENTORY'>('DASHBOARD');
  const [inventory, setInventory] = useState<InventoryMap>(() => {
    try {
        const saved = localStorage.getItem('zeevra_v32_data');
        return saved ? JSON.parse(saved) : INITIAL_DATA;
    } catch (e) { return INITIAL_DATA; }
  });

  const [search, setSearch] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  // Cloud
  const [cloud, setCloud] = useState<CloudState>({
      connected: false, sessionId: '', syncing: false, error: null, isReadOnly: false
  });

  // Modals
  const [showEditor, setShowEditor] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [editorData, setEditorData] = useState<InventoryItem>({ part: '', bin: 'A-01', qty: 0 });
  const [isNewItem, setIsNewItem] = useState(false);
  const [isAuditMode, setIsAuditMode] = useState(false);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- DATA COMPUTATION ---
  const filteredList = useMemo(() => {
    const list = Object.values(inventory) as InventoryItem[];
    if (!search) return list.sort((a, b) => a.part.localeCompare(b.part));
    const q = search.toUpperCase();
    return list.filter(i => i.part.includes(q) || i.bin.includes(q));
  }, [inventory, search]);

  const stats = useMemo(() => {
    const list = Object.values(inventory) as InventoryItem[];
    return {
        totalItems: list.length,
        totalQty: list.reduce((a, b) => a + b.qty, 0),
        lowStock: list.filter(i => i.qty <= 5).length
    };
  }, [inventory]);

  // --- PERSISTENCE ---
  useEffect(() => {
    const handler = setTimeout(() => {
        localStorage.setItem('zeevra_v32_data', JSON.stringify(inventory));
    }, 1000);
    return () => clearTimeout(handler);
  }, [inventory]);

  // --- STATUS UI ---
  const statusConfig = useMemo(() => {
    if (!cloud.connected) return { label: 'OFFLINE', icon: <WifiOff size={10} />, color: 'text-gray-500', bg: 'bg-white/5 border-white/5' };
    if (cloud.error) return { label: 'ERROR', icon: <AlertTriangle size={10} />, color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20' };
    if (cloud.syncing) return { label: 'SYNCING', icon: <RefreshCw size={10} className="animate-spin" />, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' };
    if (cloud.isReadOnly) return { label: 'READ ONLY', icon: <Lock size={10} />, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' };
    return { label: 'ONLINE', icon: <CheckCircle2 size={10} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' };
  }, [cloud]);

  const notify = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  // --- CLOUD OPS ---
  const syncToCloud = async (newData: InventoryMap) => {
      if (cloud.connected && cloud.sessionId && !cloud.isReadOnly) {
          setCloud(prev => ({ ...prev, syncing: true }));
          const success = await saveToCloud(cloud.sessionId, newData);
          setCloud(prev => ({ ...prev, syncing: false, error: success ? null : 'Sync Failed' }));
      }
  };

  const handleConnect = (sessionId: string, pin: string) => {
      const sid = sessionId.toUpperCase();
      localStorage.setItem('zeevra_session_id', sid);
      localStorage.setItem('zeevra_pin', pin);
      setCloud(prev => ({ ...prev, sessionId: sid }));
      setShowConnect(false);
      
      subscribeToSession(sid, pin,
          (data, isReadOnly) => {
              setInventory(data);
              setCloud(prev => ({ ...prev, connected: true, syncing: false, isReadOnly, error: null }));
              notify(isReadOnly ? "Connected (Read Only)" : "Connected Successfully");
          },
          (err) => { notify(err, "error"); setCloud(prev => ({ ...prev, error: err })); }
      );
  };

  // --- CRUD & IMPORT OPS ---
  const handleSaveItem = (item: InventoryItem) => {
    if(cloud.isReadOnly) return notify("Read Only Mode", "error");
    setInventory(prev => {
        const next = { ...prev, [item.part]: { ...item, lastUpdated: new Date().toISOString() } };
        syncToCloud(next);
        return next;
    });
    setShowEditor(false);
    notify(`Saved ${item.part}`);
  };

  const handleDeleteItem = (part: string) => {
    if(cloud.isReadOnly) return notify("Read Only Mode", "error");
    setInventory(prev => {
        const next = { ...prev };
        delete next[part];
        syncToCloud(next);
        return next;
    });
    setShowEditor(false);
    notify("Item Deleted", "info");
  };

  const handleAuditFinish = (auditedItems: AuditItem[]) => {
      if(cloud.isReadOnly) return notify("Read Only Mode", "error");
      setInventory(prev => {
          const next = { ...prev };
          auditedItems.forEach(i => { if(i.done) next[i.part] = { part: i.part, bin: i.bin, qty: i.qty, lastUpdated: new Date().toISOString() }; });
          syncToCloud(next);
          return next;
      });
      setIsAuditMode(false);
      notify("Audit Completed");
  };

  const handleImportClick = () => {
      if (cloud.isReadOnly) return notify("Cannot import in Read Only Mode", "error");
      fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!confirm("This will overwrite all current inventory data. Are you sure?")) {
          if (e.target) e.target.value = '';
          return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const data = event.target?.result;
              const workbook = XLSX.read(data, { type: 'array' });
              const sheetName = workbook.SheetNames[0];
              const worksheet = workbook.Sheets[sheetName];
              const json = XLSX.utils.sheet_to_json(worksheet) as any[];

              const newInventory: InventoryMap = {};
              json.forEach(row => {
                  const part = (row.Part || row.part || row.SKU || row.sku || '').toString().toUpperCase().trim();
                  if (part) {
                      newInventory[part] = {
                          part: part,
                          bin: (row.Bin || row.bin || row.Location || row.location || 'N/A').toString().toUpperCase().trim(),
                          qty: parseInt(row.Qty || row.qty || row.Quantity || row.quantity || '0'),
                          lastUpdated: new Date().toISOString(),
                      };
                  }
              });

              setInventory(newInventory);
              syncToCloud(newInventory);
              notify(`${Object.keys(newInventory).length} items imported successfully!`);

          } catch (error) {
              console.error("File parsing error:", error);
              notify("Failed to parse file. Check format.", "error");
          } finally {
              if (e.target) e.target.value = '';
          }
      };
      reader.readAsArrayBuffer(file);
  };


  // --- BOOT ---
  useEffect(() => {
      initFirebase().then(() => {
          const sid = localStorage.getItem('zeevra_session_id');
          const pin = localStorage.getItem('zeevra_pin');
          if (sid) handleConnect(sid, pin || '');
      });
  }, []);

  return (
    <div className="min-h-screen bg-transparent text-white font-sans selection:bg-cyan-500/30 flex flex-col">
        {/* HIDDEN FILE INPUT */}
        <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
            accept=".csv, .xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
        />

        {/* TOASTS */}
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
            {toasts.map(t => (
                <div key={t.id} className="glass-card px-4 py-2 rounded-lg flex items-center gap-3 shadow-lg border-l-4 border-l-cyan-500">
                    <span className="text-xs font-bold tracking-wide">{t.message}</span>
                </div>
            ))}
        </div>

        {/* --- NAVBAR --- */}
        <div className="px-6 py-4 flex justify-between items-center glass-panel border-b border-white/5 bg-black/20 shrink-0">
             <div className="flex items-center gap-4">
                 <ParacheLogo />
                 {cloud.connected && (
                     <div className="hidden md:flex flex-col border-l border-white/10 pl-4">
                         <span className="text-[9px] text-gray-500 uppercase tracking-widest">Session ID</span>
                         <span className="text-xs font-mono text-cyan-400">{cloud.sessionId}</span>
                     </div>
                 )}
             </div>
             <div className="flex items-center gap-3">
                 <div className={`hidden md:flex px-3 py-1.5 rounded-lg border ${statusConfig.color} ${statusConfig.bg} items-center gap-2`}>
                    {statusConfig.icon} <span className="text-[9px] font-black tracking-widest">{statusConfig.label}</span>
                 </div>
                 <button onClick={() => cloud.connected ? disconnectFirebase() : setShowConnect(true)} className="glass-panel px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 border-white/10">
                    {cloud.connected ? 'Disconnect' : 'Connect'}
                 </button>
             </div>
        </div>

        {/* --- MAIN CONTENT AREA --- */}
        <div className="flex-1 overflow-hidden relative max-w-7xl mx-auto w-full p-4 md:p-6 flex flex-col gap-6">
            
            {/* TABS HEADER */}
            <div className="flex gap-4 border-b border-white/10 pb-1">
                <button 
                    onClick={() => setActiveTab('DASHBOARD')}
                    className={`pb-3 px-2 text-xs font-bold tracking-widest uppercase transition-all ${activeTab === 'DASHBOARD' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-500 hover:text-white'}`}
                >
                    <LayoutDashboard size={14} className="inline mb-1 mr-1" /> Dashboard
                </button>
                <button 
                    onClick={() => setActiveTab('INVENTORY')}
                    className={`pb-3 px-2 text-xs font-bold tracking-widest uppercase transition-all ${activeTab === 'INVENTORY' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-500 hover:text-white'}`}
                >
                    <Database size={14} className="inline mb-1 mr-1" /> Full Inventory
                </button>
            </div>

            {/* TAB CONTENT */}
            <div className="flex-1 overflow-hidden flex flex-col">
                
                {/* --- DASHBOARD TAB --- */}
                {activeTab === 'DASHBOARD' && (
                    <div className="h-full overflow-y-auto animate-fade-in pb-10">
                        {/* Quick Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                            <div className="glass-card p-5 rounded-2xl border-l-4 border-l-cyan-500">
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Total Items</p>
                                <p className="text-3xl font-black text-white">{stats.totalItems}</p>
                            </div>
                            <div className="glass-card p-5 rounded-2xl border-l-4 border-l-purple-500">
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Total Stock</p>
                                <p className="text-3xl font-black text-white">{stats.totalQty}</p>
                            </div>
                            <div className="glass-card p-5 rounded-2xl border-l-4 border-l-red-500">
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Low Stock</p>
                                <p className="text-3xl font-black text-white">{stats.lowStock}</p>
                            </div>
                        </div>

                        {/* Actions Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* ADD ITEM CARD */}
                            <button 
                                onClick={() => { setIsNewItem(true); setEditorData({ part: '', bin: 'A-01', qty: 0 }); setShowEditor(true); }}
                                disabled={cloud.isReadOnly}
                                className="glass-card p-6 rounded-2xl flex items-center justify-between group hover:border-cyan-500/50 transition-all text-left disabled:opacity-50"
                            >
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2"><Plus className="text-cyan-400" /> ADD NEW ITEM</h3>
                                    <p className="text-xs text-gray-400">Create entry manually or scan barcode.</p>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500 group-hover:text-black transition-all">
                                    <ChevronRight />
                                </div>
                            </button>

                            {/* AUDIT CARD */}
                            <button 
                                onClick={() => setIsAuditMode(true)}
                                disabled={cloud.isReadOnly}
                                className="glass-card p-6 rounded-2xl flex items-center justify-between group hover:border-purple-500/50 transition-all text-left disabled:opacity-50"
                            >
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2"><Layers className="text-purple-400" /> START AUDIT</h3>
                                    <p className="text-xs text-gray-400">Select zones and verify counts.</p>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500 group-hover:text-black transition-all">
                                    <ChevronRight />
                                </div>
                            </button>

                            {/* IMPORT FROM FILE CARD */}
                            <button
                                onClick={handleImportClick}
                                disabled={cloud.isReadOnly}
                                className="glass-card p-6 rounded-2xl flex items-center justify-between group hover:border-emerald-500/50 transition-all text-left disabled:opacity-50 md:col-span-2"
                            >
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2"><Download className="text-emerald-400" /> IMPORT FROM FILE</h3>
                                    <p className="text-xs text-gray-400">Upload a .csv or .xlsx file to overwrite inventory.</p>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-black transition-all">
                                    <ChevronRight />
                                </div>
                            </button>

                            {/* SEARCH BAR WIDGET */}
                            <div className="glass-card p-6 rounded-2xl md:col-span-2 flex items-center gap-4">
                                <Search className="text-gray-500" />
                                <input 
                                    value={search}
                                    onChange={(e) => { setSearch(e.target.value); setActiveTab('INVENTORY'); }}
                                    placeholder="Quick Search inventory..." 
                                    className="bg-transparent border-none outline-none text-white w-full placeholder-gray-600 font-medium"
                                />
                                <button onClick={() => setShowScanner(true)} className="p-2 bg-white/5 rounded-lg hover:bg-white/10">
                                    <ScanBarcode className="text-cyan-400" size={20} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- INVENTORY LIST TAB --- */}
                {activeTab === 'INVENTORY' && (
                    <div className="flex-1 flex flex-col glass-card rounded-2xl overflow-hidden animate-fade-in">
                        {/* Table Controls */}
                        <div className="px-4 py-3 border-b border-white/5 flex gap-2">
                             <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                                <input 
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Filter items..." 
                                    className="bg-black/30 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs w-full text-white focus:border-cyan-500/50 outline-none"
                                />
                             </div>
                             <button onClick={() => setShowScanner(true)} className="px-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10">
                                <ScanBarcode size={16} className="text-cyan-400" />
                             </button>
                        </div>

                        {/* COMPACT TABLE HEADER */}
                        <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-black/40 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/5">
                            <div className="col-span-4 md:col-span-5">Part Number</div>
                            <div className="col-span-3">Location</div>
                            <div className="col-span-3 text-center">Qty</div>
                            <div className="col-span-2 md:col-span-1"></div>
                        </div>

                        {/* LIST */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/20">
                            {filteredList.map(item => (
                                <div 
                                    key={item.part} 
                                    onClick={() => { setEditorData(item); setIsNewItem(false); setShowEditor(true); }}
                                    className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/5 hover:bg-white/5 cursor-pointer items-center transition-colors group"
                                >
                                    <div className="col-span-4 md:col-span-5 font-mono text-xs font-bold text-white truncate">{item.part}</div>
                                    <div className="col-span-3 font-mono text-xs text-cyan-200 truncate bg-cyan-900/10 px-1.5 py-0.5 rounded w-fit">{item.bin}</div>
                                    <div className={`col-span-3 text-center font-bold text-xs ${item.qty <= 5 ? 'text-red-400' : 'text-gray-300'}`}>{item.qty}</div>
                                    <div className="col-span-2 md:col-span-1 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Edit size={12} className="text-gray-500" />
                                    </div>
                                </div>
                            ))}
                            {filteredList.length === 0 && (
                                <div className="p-8 text-center text-gray-600 text-xs tracking-widest">NO DATA FOUND</div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* MODALS */}
        <ConnectModal isOpen={showConnect} onClose={() => setShowConnect(false)} onConnect={handleConnect} onResetPin={(s, p) => updateSessionPin(s, p).then(ok => ok ? notify("PIN Updated") : notify("Update Failed", "error"))} />
        <EditorModal isOpen={showEditor} initialData={editorData} isNew={isNewItem} onClose={() => setShowEditor(false)} onSave={handleSaveItem} onDelete={handleDeleteItem} />
        <ScannerModal isOpen={showScanner} onClose={() => setShowScanner(false)} onScan={(c) => { setSearch(c); setActiveTab('INVENTORY'); notify("Filtered by Scan"); }} />
        {isAuditMode && <AuditView items={Object.values(inventory)} onFinish={handleAuditFinish} onCancel={() => setIsAuditMode(false)} />}
    </div>
  );
};

export default App;