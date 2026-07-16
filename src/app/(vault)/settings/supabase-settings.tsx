import React, { useState } from 'react';
import { useSyncStore } from '@/store/sync-store';
import { supabase } from '@/lib/supabase/client';
import { SyncEngine } from '@/lib/supabase/sync-engine';
import { Cloud, CloudOff, RefreshCw, LogIn, LogOut, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import SupabaseAuthModal from '@/components/supabase-auth-modal';
import { toast } from 'sonner';

export default function SupabaseSettings() {
  const { 
    isAuthenticated, 
    userEmail, 
    isSyncing, 
    lastSyncedAt, 
    syncError, 
    isOnline 
  } = useSyncStore();

  const [authModalOpen, setAuthModalOpen] = useState(false);

  const handleLogout = async () => {
    if (confirm('Disconnect from your cloud vault? Your local data will remain safe.')) {
      try {
        await supabase.auth.signOut();
        toast.success('Disconnected from cloud vault');
      } catch (err: any) {
        toast.error(err.message || 'Logout failed');
      }
    }
  };

  const handleManualSync = async () => {
    if (!isOnline) {
      toast.error('You are currently offline');
      return;
    }
    toast.promise(SyncEngine.fullSync(), {
      loading: 'Syncing with cloud vault...',
      success: 'Cloud synchronization completed successfully',
      error: 'Cloud synchronization failed'
    });
  };

  return (
    <div className="bg-zinc-900/20 border border-zinc-900 rounded-xl p-4.5 space-y-4 animate-fade-in">
      <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
        <Cloud className="w-4 h-4 text-zinc-500" />
        Cloud Sync Backup
      </h3>
      
      <p className="text-xs text-zinc-400 leading-relaxed">
        Sync your developer vault securely with Supabase. All credentials remain encrypted on the client side before upload.
      </p>

      {/* Sync Status Badge */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Cloud Status</span>
          <div className="flex items-center gap-1.5">
            {!isOnline ? (
              <span className="flex items-center gap-1 text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                <CloudOff className="w-3 h-3" />
                Offline
              </span>
            ) : isAuthenticated ? (
              isSyncing ? (
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Syncing...
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  <CheckCircle className="w-3 h-3" />
                  Connected
                </span>
              )
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 bg-zinc-500/10 px-2 py-0.5 rounded-full">
                <CloudOff className="w-3 h-3" />
                Not Configured
              </span>
            )}
          </div>
        </div>

        {isAuthenticated && userEmail && (
          <div className="border-t border-zinc-900/60 pt-2 flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-zinc-500">ACCOUNT</span>
            <span className="text-xs font-bold text-zinc-300 truncate">{userEmail}</span>
          </div>
        )}

        {lastSyncedAt && (
          <div className="border-t border-zinc-900/60 pt-2 flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-zinc-500">LAST SYNCED</span>
            <span className="text-xs font-mono font-bold text-zinc-400">
              {new Date(lastSyncedAt).toLocaleString()}
            </span>
          </div>
        )}

        {syncError && (
          <div className="bg-red-500/5 border border-red-500/10 p-2 rounded text-[10px] text-red-400 font-semibold flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {syncError}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="pt-1.5">
        {isAuthenticated ? (
          <div className="flex gap-2">
            <button
              onClick={handleManualSync}
              disabled={isSyncing || !isOnline}
              className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-600/30 text-emerald-950 font-bold p-2.5 rounded-lg text-[10px] transition cursor-pointer"
            >
              {isSyncing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Sync Now
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-1.5 bg-zinc-950 border border-zinc-850 hover:bg-red-950/20 hover:text-red-400 hover:border-red-900/40 p-2.5 rounded-lg text-[10px] font-bold text-zinc-400 transition cursor-pointer"
              title="Disconnect cloud vault"
            >
              <LogOut className="w-3.5 h-3.5" />
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAuthModalOpen(true)}
            disabled={!isOnline}
            className="w-full flex items-center justify-center gap-1.5 bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 p-2.5 rounded-lg text-[10px] font-bold text-zinc-300 hover:text-zinc-100 transition cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5 text-emerald-400" />
            Connect Supabase Cloud
          </button>
        )}
      </div>

      <SupabaseAuthModal 
        isOpen={authModalOpen} 
        onClose={() => setAuthModalOpen(false)} 
      />
    </div>
  );
}
