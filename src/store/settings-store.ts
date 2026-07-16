import { create } from 'zustand';
import { SettingsRepository, CredentialRepository, DatabaseRepository, ActivityRepository } from '@/lib/storage/repositories';
import { 
  deriveKeyFromPassword, 
  generateSalt, 
  createVerifier, 
  verifyVerifier,
  arrayBufferToBase64,
  base64ToArrayBuffer
} from '@/lib/crypto/web-crypto';
import { db } from '@/lib/db/dexie-db';
import { supabase } from '@/lib/supabase/client';
import { useSyncStore } from './sync-store';


interface SettingsState {
  isSetup: boolean;
  isUnlocked: boolean;
  encryptionKey: CryptoKey | null;
  lockTimeout: number; // in minutes (0 means never)
  lastActivity: number;
  isLoading: boolean;
  currentRole: 'admin' | 'editor' | 'viewer';

  checkSetup: () => Promise<void>;
  setupVault: (password: string) => Promise<void>;
  unlockVault: (password: string) => Promise<boolean>;
  lockVault: () => void;
  updateActivity: () => void;
  setLockTimeout: (minutes: number) => Promise<void>;
  changeMasterPassword: (oldPassword: string, newPassword: string) => Promise<boolean>;
  setCurrentRole: (role: 'admin' | 'editor' | 'viewer') => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  isSetup: false,
  isUnlocked: false,
  encryptionKey: null,
  lockTimeout: 10, // default 10 minutes
  lastActivity: Date.now(),
  isLoading: true,
  currentRole: 'admin',

  checkSetup: async () => {
    set({ isLoading: true });
    try {
      const verifier = await SettingsRepository.get('vault_verifier');
      const salt = await SettingsRepository.get('vault_salt');
      const timeout = await SettingsRepository.get('lock_timeout');
      
      set({ 
        isSetup: !!(verifier && salt),
        lockTimeout: typeof timeout === 'number' ? timeout : 10,
        isLoading: false
      });
    } catch (e) {
      console.error('Failed to check vault setup state:', e);
      set({ isLoading: false });
    }
  },

  setupVault: async (password: string) => {
    set({ isLoading: true });
    try {
      const saltBytes = generateSalt();
      const saltBase64 = arrayBufferToBase64(saltBytes.buffer as ArrayBuffer);
      
      const key = await deriveKeyFromPassword(password, saltBytes);
      const verifier = await createVerifier(key);

      await SettingsRepository.set('vault_salt', saltBase64);
      await SettingsRepository.set('vault_verifier', verifier);
      await SettingsRepository.set('lock_timeout', 10);

      set({
        isSetup: true,
        isUnlocked: true,
        encryptionKey: key,
        lockTimeout: 10,
        lastActivity: Date.now(),
        isLoading: false
      });

      await ActivityRepository.log(null, 'import', 'Vault initialized and master password configured');
    } catch (e) {
      set({ isLoading: false });
      console.error('Vault setup failed:', e);
      throw e;
    }
  },

  unlockVault: async (password: string): Promise<boolean> => {
    try {
      const saltBase64 = await SettingsRepository.get('vault_salt');
      const verifier = await SettingsRepository.get('vault_verifier');

      if (!saltBase64 || !verifier) {
        throw new Error('Vault is not set up yet');
      }

      const saltBytes = new Uint8Array(base64ToArrayBuffer(saltBase64));
      const key = await deriveKeyFromPassword(password, saltBytes);
      const isVerified = await verifyVerifier(verifier, key);

      if (isVerified) {
        set({
          isUnlocked: true,
          encryptionKey: key,
          lastActivity: Date.now()
        });
        return true;
      }
      return false;
    } catch (e) {
      console.error('Unlocking vault failed:', e);
      return false;
    }
  },

  lockVault: () => {
    set({
      isUnlocked: false,
      encryptionKey: null
    });
  },

  updateActivity: () => {
    if (get().isUnlocked) {
      set({ lastActivity: Date.now() });
    }
  },

  setLockTimeout: async (minutes: number) => {
    await SettingsRepository.set('lock_timeout', minutes);
    set({ lockTimeout: minutes });
  },

  changeMasterPassword: async (oldPassword: string, newPassword: string): Promise<boolean> => {
    const key = get().encryptionKey;
    if (!key) return false;

    // 1. Verify old password
    const saltBase64 = await SettingsRepository.get('vault_salt');
    const verifier = await SettingsRepository.get('vault_verifier');
    if (!saltBase64 || !verifier) return false;

    const oldSaltBytes = new Uint8Array(base64ToArrayBuffer(saltBase64));
    const oldKey = await deriveKeyFromPassword(oldPassword, oldSaltBytes);
    const isOldVerified = await verifyVerifier(verifier, oldKey);

    if (!isOldVerified) return false;

    set({ isLoading: true });

    try {
      // 2. Fetch all credentials and database details, and decrypt them with OLD key
      const credentials = await db.credentials.toArray();
      const decryptedCredentials = await Promise.all(
        credentials.map(c => CredentialRepository.decrypt(c, oldKey))
      );

      const databases = await db.databases.toArray();
      const decryptedDatabases = await Promise.all(
        databases.map(d => DatabaseRepository.decrypt(d, oldKey))
      );

      // 3. Derive NEW key from new password and new salt
      const newSaltBytes = generateSalt();
      const newSaltBase64 = arrayBufferToBase64(newSaltBytes.buffer as ArrayBuffer);
      const newKey = await deriveKeyFromPassword(newPassword, newSaltBytes);
      const newVerifier = await createVerifier(newKey);

      // 4. Re-encrypt everything using the NEW key
      await db.transaction('rw', [db.credentials, db.databases, db.settings], async () => {
        // Save new salt and verifier
        await SettingsRepository.set('vault_salt', newSaltBase64);
        await SettingsRepository.set('vault_verifier', newVerifier);

        // Re-save credentials
        for (const cred of decryptedCredentials) {
          await CredentialRepository.save({
            id: cred.id,
            projectId: cred.projectId,
            title: cred.title,
            username: cred.username,
            email: cred.email,
            password: cred.password || '',
            apiKey: cred.apiKey || '',
            secret: cred.secret || '',
            notes: cred.notes || ''
          }, newKey);
        }

        // Re-save databases
        for (const dbInfo of decryptedDatabases) {
          await DatabaseRepository.save({
            id: dbInfo.id,
            projectId: dbInfo.projectId,
            type: dbInfo.type,
            host: dbInfo.host,
            port: dbInfo.port,
            username: dbInfo.username,
            databaseName: dbInfo.databaseName,
            password: dbInfo.password || ''
          }, newKey);
        }
      });

      // 4.5 If authenticated, update Supabase user password & metadata
      if (useSyncStore.getState().isAuthenticated) {
        if (!useSyncStore.getState().isOnline) {
          throw new Error('You must be online to update your cloud account password');
        }
        const { error } = await supabase.auth.updateUser({
          password: newPassword,
          data: {
            vault_salt: newSaltBase64,
            vault_verifier: newVerifier
          }
        });
        if (error) throw error;
      }

      // 5. Update state
      set({
        encryptionKey: newKey,
        lastActivity: Date.now(),
        isLoading: false
      });

      await ActivityRepository.log(null, 'update', 'Vault master password updated successfully; rotated all cipherkeys');
      return true;
    } catch (e) {
      console.error('Password rotation failed:', e);
      set({ isLoading: false });
      return false;
    }
  },

  setCurrentRole: (role) => {
    set({ currentRole: role });
  }
}));
