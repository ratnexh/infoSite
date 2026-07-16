import { supabase } from './client';
import { db } from '../db/dexie-db';
import { useSyncStore } from '@/store/sync-store';
import { toast } from 'sonner';

// Helper to check if online and authenticated
const canSync = () => {
  const store = useSyncStore.getState();
  return store.isAuthenticated && store.isOnline && store.userId;
};

// Conversions mapping Dexie (camelCase) <-> Supabase (snake_case)
const maps = {
  projects: {
    toDb: (p: any, userId: string) => ({
      id: p.id,
      user_id: userId,
      name: p.name,
      aka: p.aka,
      status: p.status,
      color: p.color,
      is_favorite: p.isFavorite,
      is_pinned: p.isPinned,
      notes: p.notes,
      docs_urls: p.docsUrls,
      figma_urls: p.figmaUrls,
      url2: p.url2,
      dashboard_url2: p.dashboardUrl2,
      cred2_username: p.cred2Username,
      cred2_password: p.cred2Password,
      cred2_password_iv: p.cred2PasswordIv,
      url3: p.url3,
      dashboard_url3: p.dashboardUrl3,
      cred3_username: p.cred3Username,
      cred3_password: p.cred3Password,
      cred3_password_iv: p.cred3PasswordIv,
      created_at: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
      updated_at: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : p.updatedAt,
      deleted_at: p.deletedAt instanceof Date ? p.deletedAt.toISOString() : p.deletedAt,
    }),
    fromDb: (p: any) => ({
      id: p.id,
      name: p.name,
      aka: p.aka,
      status: p.status,
      color: p.color,
      isFavorite: p.is_favorite,
      isPinned: p.is_pinned,
      notes: p.notes,
      docsUrls: p.docs_urls,
      figmaUrls: p.figma_urls,
      url2: p.url2,
      dashboardUrl2: p.dashboard_url2,
      cred2Username: p.cred2_username,
      cred2Password: p.cred2_password,
      cred2PasswordIv: p.cred2_password_iv,
      url3: p.url3,
      dashboardUrl3: p.dashboard_url3,
      cred3Username: p.cred3_username,
      cred3Password: p.cred3_password,
      cred3PasswordIv: p.cred3_password_iv,
      createdAt: new Date(p.created_at),
      updatedAt: new Date(p.updated_at),
      deletedAt: p.deleted_at ? new Date(p.deleted_at) : null,
    })
  },
  urls: {
    toDb: (u: any, userId: string) => ({
      id: u.id,
      project_id: u.projectId,
      user_id: userId,
      title: u.title,
      url: u.url,
      category: u.category,
      position: u.position,
    }),
    fromDb: (u: any) => ({
      id: u.id,
      projectId: u.project_id,
      title: u.title,
      url: u.url,
      category: u.category,
      position: u.position,
    })
  },
  credentials: {
    toDb: (c: any, userId: string) => ({
      id: c.id,
      project_id: c.projectId,
      user_id: userId,
      title: c.title,
      username: c.username,
      email: c.email,
      encrypted_password: c.encryptedPassword,
      encrypted_api_key: c.encryptedApiKey,
      encrypted_secret: c.encryptedSecret,
      encrypted_notes: c.encryptedNotes,
      iv: c.iv,
      position: c.position,
    }),
    fromDb: (c: any) => ({
      id: c.id,
      projectId: c.project_id,
      title: c.title,
      username: c.username,
      email: c.email,
      encryptedPassword: c.encrypted_password,
      encryptedApiKey: c.encrypted_api_key,
      encryptedSecret: c.encrypted_secret,
      encryptedNotes: c.encrypted_notes,
      iv: c.iv,
      position: c.position,
    })
  },
  hosting: {
    toDb: (h: any, userId: string) => ({
      id: h.id,
      project_id: h.projectId,
      user_id: userId,
      provider: h.provider,
      ip: h.ip,
      username: h.username,
      port: h.port,
      cdn: h.cdn,
      dns_provider: h.dnsProvider,
      notes: h.notes,
    }),
    fromDb: (h: any) => ({
      id: h.id,
      projectId: h.project_id,
      provider: h.provider,
      ip: h.ip,
      username: h.username,
      port: h.port,
      cdn: h.cdn,
      dnsProvider: h.dns_provider,
      notes: h.notes,
    })
  },
  databases: {
    toDb: (d: any, userId: string) => ({
      id: d.id,
      project_id: d.projectId,
      user_id: userId,
      type: d.type,
      host: d.host,
      port: d.port,
      username: d.username,
      encrypted_password: d.encryptedPassword,
      database_name: d.databaseName,
      iv: d.iv,
    }),
    fromDb: (d: any) => ({
      id: d.id,
      projectId: d.project_id,
      type: d.type,
      host: d.host,
      port: d.port,
      username: d.username,
      encryptedPassword: d.encrypted_password,
      databaseName: d.database_name,
      iv: d.iv,
    })
  },
  services: {
    toDb: (s: any, userId: string) => ({
      id: s.id,
      project_id: s.projectId,
      user_id: userId,
      name: s.name,
      url: s.url,
      email: s.email,
      notes: s.notes,
      position: s.position,
    }),
    fromDb: (s: any) => ({
      id: s.id,
      projectId: s.project_id,
      name: s.name,
      url: s.url,
      email: s.email,
      notes: s.notes,
      position: s.position,
    })
  },
  domains: {
    toDb: (d: any, userId: string) => ({
      id: d.id,
      project_id: d.projectId,
      user_id: userId,
      registrar: d.registrar,
      expiry_date: d.expiryDate,
      ssl_expiry: d.sslExpiry,
      auto_renewal: d.autoRenewal,
    }),
    fromDb: (d: any) => ({
      id: d.id,
      projectId: d.project_id,
      registrar: d.registrar,
      expiryDate: d.expiry_date,
      sslExpiry: d.ssl_expiry,
      autoRenewal: d.auto_renewal,
    })
  },
  contacts: {
    toDb: (c: any, userId: string) => ({
      id: c.id,
      project_id: c.projectId,
      user_id: userId,
      role: c.role,
      name: c.name,
      email: c.email,
      phone: c.phone,
      notes: c.notes,
      position: c.position,
    }),
    fromDb: (c: any) => ({
      id: c.id,
      projectId: c.project_id,
      role: c.role,
      name: c.name,
      email: c.email,
      phone: c.phone,
      notes: c.notes,
      position: c.position,
    })
  },
  activities: {
    toDb: (a: any, userId: string) => ({
      id: a.id,
      project_id: a.projectId,
      user_id: userId,
      project_name: a.projectName,
      action: a.action,
      details: a.details,
      created_at: a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt,
    }),
    fromDb: (a: any) => ({
      id: a.id,
      projectId: a.project_id,
      projectName: a.project_name,
      action: a.action,
      details: a.details,
      createdAt: new Date(a.created_at),
    })
  }
};

export const SyncEngine = {
  // Push changes to Supabase (Upsert)
  async push(dexieTable: keyof typeof maps, record: any) {
    if (!canSync()) return;
    const userId = useSyncStore.getState().userId!;
    const mapper = maps[dexieTable];
    if (!mapper) return;

    try {
      const payload = mapper.toDb(record, userId);
      let supabaseTable = dexieTable;
      if (dexieTable === 'urls') supabaseTable = 'project_urls' as any;

      const { error } = await (supabase
        .from(supabaseTable) as any)
        .upsert(payload);

      if (error) throw error;
    } catch (e: any) {
      console.error(`Sync push error [${dexieTable}]:`, e.message || e, e.details || '', e.hint || '');
      useSyncStore.getState().setSyncError(`Failed to sync changes: ${e.message || 'Unknown error'}`);
    }
  },

  // Delete record from Supabase
  async delete(dexieTable: keyof typeof maps, id: string) {
    if (!canSync()) return;
    try {
      let supabaseTable = dexieTable;
      if (dexieTable === 'urls') supabaseTable = 'project_urls' as any;

      const { error } = await (supabase
        .from(supabaseTable) as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (e) {
      console.error(`Sync delete error [${dexieTable}]:`, e);
    }
  },

  // Bidirectional full sync (Pull cloud data -> Merge with Dexie -> Push unsynced local data)
  async fullSync() {
    if (!canSync()) return;
    const store = useSyncStore.getState();
    store.setSyncing(true);

    try {
      const tables: Array<keyof typeof maps> = [
        'projects',
        'urls',
        'credentials',
        'hosting',
        'databases',
        'services',
        'domains',
        'contacts',
        'activities'
      ];

      for (const t of tables) {
        let supabaseTable = t;
        if (t === 'urls') supabaseTable = 'project_urls' as any;

        // 1. Fetch from cloud
        const { data: cloudData, error } = await (supabase
          .from(supabaseTable) as any)
          .select('*');

        if (error) throw error;

        // 2. Load from local Dexie
        const localData = await (db[t] as any).toArray();

        // Map cloud data items to camelCase
        const mapper = maps[t];
        const mappedCloud = (cloudData || []).map(mapper.fromDb);

        // 3. Merging logic (Timestamp-based last-write-wins)
        for (const cloudItem of mappedCloud) {
          const localMatch = localData.find((l: any) => l.id === cloudItem.id);
          if (!localMatch) {
            // Local doesn't have it -> save local
            await (db[t] as any).put(cloudItem);
          } else {
            // Both exist -> compare timestamp (if available, otherwise fallback)
            const localTime = localMatch.updatedAt ? new Date(localMatch.updatedAt).getTime() : 0;
            const cloudTime = cloudItem.updatedAt ? new Date(cloudItem.updatedAt).getTime() : 0;

            if (cloudTime > localTime) {
              await (db[t] as any).put(cloudItem);
            }
          }
        }

        // 4. Push locally updated / unsynced items back to Cloud
        const currentLocal = await (db[t] as any).toArray();
        for (const localItem of currentLocal) {
          const cloudMatch = mappedCloud.find((c: any) => c.id === localItem.id);
          if (!cloudMatch) {
            await this.push(t, localItem);
          } else {
            const localTime = localItem.updatedAt ? new Date(localItem.updatedAt).getTime() : 0;
            const cloudTime = cloudMatch.updatedAt ? new Date(cloudMatch.updatedAt).getTime() : 0;
            if (localTime > cloudTime) {
              await this.push(t, localItem);
            }
          }
        }
      }

      store.setLastSyncedAt(Date.now());
    } catch (e: any) {
      console.error('Full sync failed:', e.message || e, e.details || '', e.hint || '');
      store.setSyncError(e.message || 'An error occurred during synchronization.');
      toast.error('Cloud synchronization failed');
    } finally {
      store.setSyncing(false);
    }
  }
};

// Setup Dexie hooks to listen to local mutations and auto-sync to cloud
export function setupDexieSyncHooks() {
  const tables: Array<keyof typeof maps> = [
    'projects',
    'urls',
    'credentials',
    'hosting',
    'databases',
    'services',
    'domains',
    'contacts',
    'activities'
  ];

  tables.forEach((tableName) => {
    const table = db[tableName] as any;
    if (!table) return;

    table.hook('creating', (primKey: string, obj: any) => {
      const store = useSyncStore.getState();
      if (store.isSyncing) return;
      setTimeout(() => SyncEngine.push(tableName, obj), 0);
    });

    table.hook('updating', (mods: any, primKey: string, obj: any) => {
      const store = useSyncStore.getState();
      if (store.isSyncing) return;
      setTimeout(() => SyncEngine.push(tableName, { ...obj, ...mods }), 0);
    });

    table.hook('deleting', (primKey: string) => {
      const store = useSyncStore.getState();
      if (store.isSyncing) return;
      setTimeout(() => SyncEngine.delete(tableName, primKey), 0);
    });
  });
}

