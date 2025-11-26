export interface InventoryItem {
    part: string;
    bin: string;
    qty: number;
    lastUpdated?: string;
}

export type InventoryMap = Record<string, InventoryItem>;

export interface AuditItem extends InventoryItem {
    done: boolean;
}

export interface ZoneGroup {
    prefix: string;
    zones: string[];
}

export type ModalType = 'EDITOR' | 'ZONES' | 'CONNECT' | 'GEMINI' | null;

export interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

export interface CloudState {
    connected: boolean;
    sessionId: string;
    syncing: boolean;
    error: string | null;
    isReadOnly: boolean;
}