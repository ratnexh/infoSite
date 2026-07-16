'use client';

import React, { useEffect } from 'react';
import { supabase, hasSupabaseConfigured } from '@/lib/supabase/client';
import { useSyncStore } from '@/store/sync-store';
import { SyncEngine, setupDexieSyncHooks } from '@/lib/supabase/sync-engine';

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
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setAuthenticated(true, session.user.email ?? null, session.user.id);
          // Trigger initial synchronization on load
          SyncEngine.fullSync();
        } else {
          setAuthenticated(false, null, null);
        }
      });

      // Listen for auth state changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (session?.user) {
          setAuthenticated(true, session.user.email ?? null, session.user.id);
          if (event === 'SIGNED_IN') {
            SyncEngine.fullSync();
          }
        } else {
          setAuthenticated(false, null, null);
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
