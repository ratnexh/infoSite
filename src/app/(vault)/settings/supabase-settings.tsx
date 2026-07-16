'use client';

import React from 'react';
import { useSyncStore } from '@/store/sync-store';
import { supabase } from '@/lib/supabase/client';
import { SyncEngine } from '@/lib/supabase/sync-engine';
import { Cloud, CloudOff, RefreshCw, LogOut, CheckCircle, AlertTriangle, Loader2, Database, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function SupabaseSettings() {
  const { 
    userEmail, 
    isSyncing, 
    lastSyncedAt, 
    syncError, 
    isOnline 
  } = useSyncStore();

  const handleLogout = async () => {
    if (confirm('Are you sure you want to disconnect your cloud account? This will stop syncing and clear all local cache for security.')) {
      try {
        await supabase.auth.signOut();
        toast.success('Signed out of cloud vault');
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
    <div className="bg-zinc-900/20 border border-zinc-900 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
          <Cloud className="w-4 h-4 text-emerald-500" />
          Cloud Sync Backup
        </h3>
        
        <div className="flex items-center gap-1.5">
          {!isOnline ? (
            <span className="flex items-center gap-1 text-[9px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/15 px-2 py-0.5 rounded-full uppercase">
              Offline
            </span>
          ) : isSyncing ? (
            <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/15 px-2 py-0.5 rounded-full uppercase">
              <RefreshCw className="w-2.5 h-2.5 animate-spin" />
              Syncing
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/15 px-2 py-0.5 rounded-full uppercase">
              Connected
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-zinc-400 leading-relaxed">
        Sync your developer vault securely with Supabase. All credentials remain encrypted client-side using the Web Crypto API.
      </p>

      {/* Sync Status Badge details */}
      <div className="bg-zinc-950/60 border border-zinc-900/80 rounded-xl p-4 space-y-3.5 shadow-inner">
        {/* Email details */}
        {userEmail && (
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-bold text-zinc-550 uppercase tracking-wider">Sync Account</span>
            <span className="text-xs font-bold text-zinc-200 truncate">{userEmail}</span>
          </div>
        )}

        {/* Sync Progress Indicator / Storage meter */}
        <div className="space-y-1.5 border-t border-zinc-900/60 pt-3">
          <div className="flex items-center justify-between text-[9px] text-zinc-500 font-bold uppercase">
            <span>Storage Usage</span>
            <span className="text-zinc-400">4.8 KB of 50 MB</span>
          </div>
          <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: '1%' }} />
          </div>
        </div>

        {/* Last synced timestamp */}
        {lastSyncedAt && (
          <div className="border-t border-zinc-900/60 pt-3 flex items-center justify-between text-[10px]">
            <span className="font-semibold text-zinc-550 uppercase text-[9px]">Last Synced</span>
            <span className="font-mono text-zinc-400 font-semibold">
              {new Date(lastSyncedAt).toLocaleTimeString()} ({new Date(lastSyncedAt).toLocaleDateString()})
            </span>
          </div>
        )}

        {syncError && (
          <div className="bg-red-500/5 border border-red-500/10 p-2.5 rounded-lg text-[10px] text-red-400 font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {syncError}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleManualSync}
          disabled={isSyncing || !isOnline}
          className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-600/30 text-emerald-950 font-bold py-2 px-3 rounded-lg text-xs transition cursor-pointer shadow-sm active:scale-[0.98]"
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
          className="flex items-center justify-center gap-1.5 bg-zinc-950 border border-zinc-850 hover:bg-red-950/20 hover:text-red-400 hover:border-red-900/40 py-2 px-3 rounded-lg text-xs font-bold text-zinc-400 transition cursor-pointer"
          title="Disconnect cloud backup sync"
        >
          <LogOut className="w-3.5 h-3.5" />
          Disconnect
        </button>
      </div>
    </div>
  );
}
