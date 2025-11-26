
import { InventoryMap } from "../types";

// Firebase Configuration
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyB8DNGnwIXtaYfVTk2-w7ChYOZUx-4DNZo",
    authDomain: "auditory-a5f2f.firebaseapp.com",
    projectId: "auditory-a5f2f",
    storageBucket: "auditory-a5f2f.firebasestorage.app",
    messagingSenderId: "225421245808",
    appId: "1:225421245808:web:e045291f6241bf1c1ae3b5",
    measurementId: "G-PVCPL4VF1Z"
};

// Global type definition for window.firebase
declare global {
    interface Window {
        firebase: any;
    }
}

let db: any = null;
let unsubscribe: (() => void) | null = null;

// Helper to get the authorized document reference
const getInventoryRef = (sessionId: string) => {
    if (!db) return null;
    const safeId = sessionId.trim().replace(/[\/\.]/g, '_').toUpperCase();
    // CHANGED: Use a simple root-level collection to avoid deep-nesting permission issues
    return db.collection('sessions').doc(safeId);
};

export const initFirebase = async () => {
    // Prevent re-initialization if already loaded
    if (db) return true;

    if (typeof window.firebase === 'undefined') {
        console.error("Firebase SDK not loaded");
        return false;
    }

    // Quick check for network status
    if (!navigator.onLine) {
        console.log("Device offline: Skipping Firebase initialization");
        return false;
    }

    try {
        if (!window.firebase.apps.length) {
            window.firebase.initializeApp(FIREBASE_CONFIG);
        }
        const auth = window.firebase.auth();
        db = window.firebase.firestore();
        
        // Set persistence to LOCAL to avoid re-auth loops
        await auth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL);

        // Anonymous sign in with Retry Logic
        if (!auth.currentUser) {
            let retries = 3;
            while (retries > 0) {
                try {
                    await auth.signInAnonymously();
                    break; // Success
                } catch (err: any) {
                    console.warn(`Auth attempt failed (${retries} retries left):`, err.code);
                    retries--;
                    if (retries === 0) throw err;
                    // Wait 1s before retry
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            // Small delay to ensure auth token propagates
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        console.log("Firebase Initialized. User:", auth.currentUser?.uid);
        return true;
    } catch (e: any) {
        console.error("Firebase Init Error:", e.message || e);
        return false;
    }
};

export const subscribeToSession = (
    sessionId: string, 
    pin: string,
    onUpdate: (data: InventoryMap, isReadOnly: boolean) => void,
    onError: (msg: string) => void
) => {
    if (!db) {
        // Try to re-init if db is missing (e.g. network recovered)
        initFirebase().then(success => {
            if (success) {
                subscribeToSession(sessionId, pin, onUpdate, onError);
            } else {
                onError("Network unavailable. Working offline.");
            }
        });
        return;
    }
    
    // CRITICAL: Unsubscribe from previous listener to prevent memory leaks
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }

    const docRef = getInventoryRef(sessionId);
    if (!docRef) {
        onError("Invalid Session Reference");
        return;
    }

    // 1. Initial check to CLAIM session or CREATE it
    docRef.get().then((docSnapshot: any) => {
        if (!docSnapshot.exists) {
            // BRAND NEW SESSION: User becomes Admin
            console.log("Creating new session...");
            docRef.set({
                json: '{}',
                updated: new Date().toISOString(),
                adminPin: pin
            }, { merge: true }).catch((err: any) => console.warn("Creation error", err));
        } else {
            // EXISTING SESSION: Check for legacy claim
            const data = docSnapshot.data();
            if (data && (!data.adminPin || data.adminPin === '')) {
                console.log("Claiming legacy session...");
                docRef.set({ adminPin: pin }, { merge: true }).catch((err: any) => console.warn("Claim error", err));
            }
        }
    }).catch((err: any) => {
        console.error("Initial fetch error", err);
        // If Permission Denied on GET, it might mean we can't LIST, but we might be able to CREATE.
        // Try to force create/join blindly.
        if (err.code === 'permission-denied') {
             console.log("Attempting blind join/create...");
             docRef.set({
                updated: new Date().toISOString()
                // We don't set adminPin here to avoid locking out existing sessions if we just couldn't read them
             }, { merge: true }).catch((e:any) => console.error("Blind join failed", e));
        }
    });

    // 2. Real-time Listener
    unsubscribe = docRef.onSnapshot((doc: any) => {
        if (doc.exists) {
            try {
                const data = doc.data();
                
                // Security Check
                let isReadOnly = false;
                if (data.adminPin && data.adminPin !== '') {
                    if (data.adminPin !== pin) {
                        isReadOnly = true;
                    }
                }

                if (data.json) {
                    try {
                        const parsed = JSON.parse(data.json);
                        onUpdate(parsed || {}, isReadOnly);
                    } catch (jsonErr) {
                        console.error("JSON Parse Error:", jsonErr);
                        onUpdate({}, true); 
                    }
                } else {
                    onUpdate({}, isReadOnly);
                }
            } catch (e) {
                console.error("Data Processing Error", e);
                onError("Corrupted data received");
            }
        } else {
            // Document created locally but snapshot not yet fired with data
            // Or document doesn't exist yet on server
            onUpdate({}, false); 
        }
    }, (error: any) => {
        console.error("Sync Error", error);
        if (error.code === 'permission-denied') {
            onError("Access denied. Database rules restrict this path.");
        } else {
            onError("Connection lost. Retrying...");
        }
    });
};

export const saveToCloud = async (sessionId: string, inventory: InventoryMap) => {
    if (!db || !sessionId) return false;
    
    const docRef = getInventoryRef(sessionId);
    if (!docRef) return false;

    try {
        const jsonString = JSON.stringify(inventory);
        await docRef.update({
            json: jsonString,
            updated: new Date().toISOString()
        });
        return true;
    } catch (e: any) {
        // Fallback to SET if document missing
        if (e.code === 'not-found' || e.message?.includes('No document')) {
             try {
                await docRef.set({
                    json: JSON.stringify(inventory),
                    updated: new Date().toISOString()
                }, { merge: true });
                return true;
             } catch (innerE) {
                 console.error("Save (Set) Error", innerE);
                 return false;
             }
        }
        console.error("Save (Update) Error", e);
        return false;
    }
};

export const disconnectFirebase = () => {
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }
};
