'use client';

import React, { useEffect } from 'react';
import { Command } from 'cmdk';
import { useUIStore } from '@/store/ui-store';
import { useSettingsStore } from '@/store/settings-store';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/dexie-db';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { 
  Search, 
  FolderPlus, 
  Lock, 
  Sun, 
  Moon, 
  Download, 
  Folder, 
  FileText,
  Star,
  Archive,
  Settings,
  LayoutDashboard
} from 'lucide-react';
import { ProjectRepository } from '@/lib/storage/repositories';
import { toast } from 'sonner';

export default function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen, setStatusFilter, setActiveProjectId } = useUIStore();
  const { lockVault } = useSettingsStore();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  // Fetch active projects reactively
  const projects = useLiveQuery(() => db.projects.toArray()) || [];
  const activeProjects = projects.filter(p => !p.deletedAt);

  // Toggle Command Palette listener
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  const handleSelectProject = (projectId: string) => {
    setActiveProjectId(projectId);
    setCommandPaletteOpen(false);
    router.push(`/project/${projectId}`);
  };

  const handleNavigation = (path: string, status?: any) => {
    if (status) setStatusFilter(status);
    setActiveProjectId(null);
    setCommandPaletteOpen(false);
    router.push(path);
  };

  const triggerExport = async () => {
    setCommandPaletteOpen(false);
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

  if (!commandPaletteOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => setCommandPaletteOpen(false)}
    >
      <div 
        className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[450px]"
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Command Menu" className="flex flex-col h-full">
          <div className="flex items-center border-b border-zinc-800 px-3.5 py-3 gap-2.5">
            <Search className="w-4 h-4 text-zinc-400 shrink-0" />
            <Command.Input 
              placeholder="Type a command or search projects..." 
              className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
              autoFocus
            />
          </div>

          <Command.List className="overflow-y-auto p-2 space-y-1 scrollbar-thin select-none">
            <Command.Empty className="text-zinc-500 text-xs px-3.5 py-4 text-center">
              No results found.
            </Command.Empty>

            {/* NAVIGATION GROUP */}
            <Command.Group heading="Navigation" className="text-[10px] font-bold text-zinc-500 tracking-wider uppercase px-2 py-1.5">
              <Command.Item 
                onSelect={() => handleNavigation('/dashboard', 'all')}
                className="flex items-center gap-2.5 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/60 rounded-lg px-2 py-1.5 text-sm cursor-pointer"
              >
                <LayoutDashboard className="w-4 h-4 text-zinc-400" />
                <span>Dashboard</span>
              </Command.Item>
              <Command.Item 
                onSelect={() => handleNavigation('/dashboard', 'favorites')}
                className="flex items-center gap-2.5 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/60 rounded-lg px-2 py-1.5 text-sm cursor-pointer"
              >
                <Star className="w-4 h-4 text-zinc-400" />
                <span>Favorites</span>
              </Command.Item>
              <Command.Item 
                onSelect={() => handleNavigation('/dashboard', 'archived')}
                className="flex items-center gap-2.5 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/60 rounded-lg px-2 py-1.5 text-sm cursor-pointer"
              >
                <Archive className="w-4 h-4 text-zinc-400" />
                <span>Archived Projects</span>
              </Command.Item>
              <Command.Item 
                onSelect={() => handleNavigation('/settings')}
                className="flex items-center gap-2.5 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/60 rounded-lg px-2 py-1.5 text-sm cursor-pointer"
              >
                <Settings className="w-4 h-4 text-zinc-400" />
                <span>Settings & Security</span>
              </Command.Item>
            </Command.Group>

            {/* ACTIONS GROUP */}
            <Command.Group heading="Quick Actions" className="text-[10px] font-bold text-zinc-500 tracking-wider uppercase px-2 py-1.5">
              <Command.Item 
                onSelect={() => {
                  setCommandPaletteOpen(false);
                  lockVault();
                  toast.success("Vault locked");
                }}
                className="flex items-center gap-2.5 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/60 rounded-lg px-2 py-1.5 text-sm cursor-pointer"
              >
                <Lock className="w-4 h-4 text-zinc-400" />
                <span>Lock Vault</span>
              </Command.Item>
              <Command.Item 
                onSelect={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="flex items-center gap-2.5 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/60 rounded-lg px-2 py-1.5 text-sm cursor-pointer"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-zinc-400" /> : <Moon className="w-4 h-4 text-zinc-400" />}
                <span>Toggle Light/Dark Theme</span>
              </Command.Item>
              <Command.Item 
                onSelect={triggerExport}
                className="flex items-center gap-2.5 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/60 rounded-lg px-2 py-1.5 text-sm cursor-pointer"
              >
                <Download className="w-4 h-4 text-zinc-400" />
                <span>Export Vault (JSON Backup)</span>
              </Command.Item>
            </Command.Group>

            {/* PROJECTS GROUP */}
            {activeProjects.length > 0 && (
              <Command.Group heading="Projects" className="text-[10px] font-bold text-zinc-500 tracking-wider uppercase px-2 py-1.5">
                {activeProjects.map(proj => (
                  <Command.Item 
                    key={proj.id} 
                    onSelect={() => handleSelectProject(proj.id)}
                    className="flex items-center justify-between text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/60 rounded-lg px-2 py-1.5 text-sm cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Folder className="w-4 h-4" style={{ color: proj.color || '#10b981' }} />
                      <span>{proj.name}</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-medium capitalize bg-zinc-800 border border-zinc-700/55 rounded px-1.5 py-0.5">
                      {proj.status}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
