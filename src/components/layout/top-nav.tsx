'use client';

import React from 'react';
import { useUIStore } from '@/store/ui-store';
import { useSettingsStore } from '@/store/settings-store';
import {
  Search,
  Lock,
  Upload,
  Download,
  Menu,
  ChevronDown,
  Cloud,
  CloudOff,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { useSyncStore } from '@/store/sync-store';
import { db } from '@/lib/db/dexie-db';

export default function TopNav() {
  const {
    searchTerm,
    setSearchTerm,
    setCommandPaletteOpen,
    toggleSidebar
  } = useUIStore();

  const { lockVault } = useSettingsStore();
  const { isAuthenticated, isSyncing, isOnline } = useSyncStore();

  const handleLock = () => {
    lockVault();
    toast.info('Vault locked successfully');
  };

  const handleExport = async () => {
    try {
      const allProjects = await db.projects.toArray();
      const allUrls = await db.urls.toArray();
      const allCredentials = await db.credentials.toArray();
      const allHosting = await db.hosting.toArray();
      const allDatabases = await db.databases.toArray();
      const allServices = await db.services.toArray();
      const allDomains = await db.domains.toArray();
      const allContacts = await db.contacts.toArray();
      const allSettings = await db.settings.toArray();

      const backupData = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        data: {
          projects: allProjects,
          urls: allUrls,
          credentials: allCredentials,
          hosting: allHosting,
          databases: allDatabases,
          services: allServices,
          domains: allDomains,
          contacts: allContacts,
          settings: allSettings
        }
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `site-vault-export-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success("Backup JSON exported successfully");
    } catch {
      toast.error("Failed to export backup");
    }
  };

  const handleImportClick = () => {
    toast.info("Navigate to Settings to import data backups safely.");
  };


  return (
    <header className="h-14 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-900 flex items-center justify-between px-4 select-none relative z-10 transition-colors duration-200">
      {/* Mobile Sidebar Toggle & Search */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <button
          onClick={toggleSidebar}
          className="lg:hidden text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative w-full max-w-sm group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500 group-focus-within:text-zinc-650 dark:group-focus-within:text-zinc-300 transition-colors" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Global search..."
            className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-lg pl-9 pr-14 py-1.5 text-zinc-800 dark:text-zinc-100 text-xs placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-700 focus:border-zinc-400 dark:focus:border-zinc-700 transition"
          />
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-500 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-1.5 py-0.5 rounded cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-700 transition"
          >
            ⌘K
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {/* Quick Backup menu */}
        <div className="relative group shrink-0 hidden md:block">
          <button className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 px-3 py-1.5 rounded-lg border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 transition cursor-pointer">
            Backup
            <ChevronDown className="w-3 h-3 text-zinc-455 dark:text-zinc-500" />
          </button>

          <div className="absolute right-0 top-full mt-1.5 w-40 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl opacity-0 translate-y-1 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition duration-250 flex flex-col p-1.5">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 text-left text-zinc-655 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-850 p-2 rounded text-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export JSON
            </button>
            <button
              onClick={handleImportClick}
              className="flex items-center gap-2 text-left text-zinc-655 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-855 p-2 rounded text-xs transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Import Backup
            </button>
          </div>
        </div>

        {/* Cloud Sync Status Indicator */}
        <div className="flex items-center justify-center shrink-0">
          {!isOnline ? (
            <span className="p-2 text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-center cursor-help" title="Vault Offline — syncing paused">
              <CloudOff className="w-4 h-4" />
            </span>
          ) : isAuthenticated ? (
            isSyncing ? (
              <span className="p-2 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center" title="Syncing changes with Supabase...">
                <RefreshCw className="w-4 h-4 animate-spin" />
              </span>
            ) : (
              <span className="p-2 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center cursor-help" title="Vault synchronized with cloud backup">
                <Cloud className="w-4 h-4" />
              </span>
            )
          ) : (
            <span className="p-2 text-zinc-500 bg-zinc-900/40 border border-zinc-800/80 rounded-lg flex items-center justify-center cursor-help" title="Cloud backup not configured (disconnected)">
              <Cloud className="w-4 h-4" />
            </span>
          )}
        </div>

        {/* Lock Vault */}
        <button
          onClick={handleLock}
          className="bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-100/40 dark:hover:bg-red-950/20 border border-zinc-200 dark:border-zinc-800 hover:border-red-300 dark:hover:border-red-900/40 p-2 rounded-lg transition cursor-pointer shrink-0 flex items-center justify-center"
          title="Lock Vault"
        >
          <Lock className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
