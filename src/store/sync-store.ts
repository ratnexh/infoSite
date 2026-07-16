import { create } from 'zustand';

interface SyncState {
  isAuthenticated: boolean;
  userEmail: string | null;
  userId: string | null;
  isSyncing: boolean;
  lastSyncedAt: number | null;
  syncError: string | null;
  isOnline: boolean;
  
  setAuthenticated: (authenticated: boolean, email: string | null, userId: string | null) => void;
  setSyncing: (syncing: boolean) => void;
  setLastSyncedAt: (time: number | null) => void;
  setSyncError: (error: string | null) => void;
  setOnlineStatus: (status: boolean) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  isAuthenticated: false,
  userEmail: null,
  userId: null,
  isSyncing: false,
  lastSyncedAt: null,
  syncError: null,
  isOnline: typeof window !== 'undefined' ? window.navigator.onLine : true,

  setAuthenticated: (authenticated, email, userId) => set({ 
    isAuthenticated: authenticated, 
    userEmail: email,
    userId: userId,
    syncError: null 
  }),
  setSyncing: (syncing) => set({ isSyncing: syncing }),
  setLastSyncedAt: (time) => set({ lastSyncedAt: time, syncError: null }),
  setSyncError: (error) => set({ syncError: error }),
  setOnlineStatus: (status) => set({ isOnline: status })
}));
