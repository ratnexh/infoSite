'use client';

import React, { useEffect } from 'react';
import { supabase, hasSupabaseConfigured } from '@/lib/supabase/client';
import { useSyncStore } from '@/store/sync-store';
import { SyncEngine, setupDexieSyncHooks } from '@/lib/supabase/sync-engine';
import { clearAllTables } from '@/lib/db/dexie-db';
import { useSettingsStore } from '@/store/settings-store';
import { SettingsRepository } from '@/lib/storage/repositories';

export default function SyncInitializer() {
  const { setAuthenticated, setOnlineStatus } = useSyncStore();

  useEffect(() => {
    // 1. Setup Dexie database sync hooks (called once on startup)
    setupDexieSyncHooks();

    // 2. Setup online/offline listeners
    const handleOnline = () => setOnlineStatus(true);
    const handleOffline = () => setOnlineStatus(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 3. Setup Supabase Auth listener if configured
    let authSubscription: { unsubscribe: () => void } | null = null;

    if (hasSupabaseConfigured()) {
      // Check current session
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (session?.user) {
          setAuthenticated(true, session.user.email ?? null, session.user.id);
          // Sync metadata to local Dexie settings on load if not set up
          const metadata = session.user.user_metadata;
          if (metadata?.vault_salt && metadata?.vault_verifier) {
            await SettingsRepository.set('vault_salt', metadata.vault_salt);
            await SettingsRepository.set('vault_verifier', metadata.vault_verifier);
            await useSettingsStore.getState().checkSetup();
          }
          // Trigger initial synchronization on load
          SyncEngine.fullSync();
        } else {
          setAuthenticated(false, null, null);
        }
      });

      // Listen for auth state changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          setAuthenticated(true, session.user.email ?? null, session.user.id);
          const metadata = session.user.user_metadata;
          if (metadata?.vault_salt && metadata?.vault_verifier) {
            await SettingsRepository.set('vault_salt', metadata.vault_salt);
            await SettingsRepository.set('vault_verifier', metadata.vault_verifier);
            await useSettingsStore.getState().checkSetup();
          }
          if (event === 'SIGNED_IN') {
            SyncEngine.fullSync();
          }
        } else {
          setAuthenticated(false, null, null);
          if (event === 'SIGNED_OUT') {
            // Clear local cache, lock vault, reset settings store
            await clearAllTables();
            useSettingsStore.setState({
              isSetup: false,
              isUnlocked: false,
              encryptionKey: null
            });
          }
        }
      });
      authSubscription = subscription;
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, [setAuthenticated, setOnlineStatus]);

  // This is a provider-style logic, does not render anything visual
  return null;
}
