'use client';

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/dexie-db';
import { useUIStore } from '@/store/ui-store';
import { useSettingsStore } from '@/store/settings-store';
import { 
  Folder, 
  Activity as ActivityIcon, 
  Star, 
  Plus, 
  Settings, 
  Lock, 
  ShieldAlert, 
  ExternalLink,
  ChevronRight,
  Sparkles,
  RefreshCw,
  Clock,
  Download
} from 'lucide-react';
import ProjectDialog from '@/components/project-dialog';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';

export default function DashboardPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setCommandPaletteOpen, setActiveProjectId } = useUIStore();
  const { lockVault } = useSettingsStore();

  // 1. Live queries for stats
  const projects = useLiveQuery(() => db.projects.toArray()) || [];
  const activeProjects = projects.filter(p => !p.deletedAt);
  
  const totalCount = activeProjects.length;
  const devCount = activeProjects.filter(p => p.status === 'development').length;
  const prodCount = activeProjects.filter(p => p.status === 'production').length;
  const favCount = activeProjects.filter(p => p.isFavorite).length;
  const archivedCount = activeProjects.filter(p => p.status === 'archived').length;

  const pinnedProjects = activeProjects.filter(p => p.isPinned);
  const recentProjects = activeProjects.slice(0, 3); // top 3 recently created

  // 2. Live queries for activity logs
  const activities = useLiveQuery(() => db.activities.orderBy('createdAt').reverse().limit(6).toArray()) || [];

  // 3. Live queries for expiries (domains & ssl warnings)
  const domains = useLiveQuery(() => db.domains.toArray()) || [];
  const expiringItems = domains.map(dom => {
    const proj = activeProjects.find(p => p.id === dom.projectId);
    if (!proj) return null;
    
    const now = Date.now();
    const expiryTime = dom.expiryDate ? new Date(dom.expiryDate).getTime() : null;
    const sslTime = dom.sslExpiry ? new Date(dom.sslExpiry).getTime() : null;
    
    const alertItems = [];
    
    // Check if domain is expiring in 30 days (30 * 24 * 60 * 60 * 1000 = 2592000000 ms)
    if (expiryTime && (expiryTime - now) < 2592000000 && (expiryTime - now) > 0) {
      alertItems.push({
        type: 'domain',
        name: proj.name,
        date: new Date(dom.expiryDate!),
        projectId: proj.id
      });
    }

    if (sslTime && (sslTime - now) < 2592000000 && (sslTime - now) > 0) {
      alertItems.push({
        type: 'ssl',
        name: proj.name,
        date: new Date(dom.sslExpiry!),
        projectId: proj.id
      });
    }

    return alertItems;
  }).filter(Boolean).flat().filter(Boolean);

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
      toast.success("Backup JSON exported");
    } catch {
      toast.error("Failed to export backup");
    }
  };

  const statCards = [
    { label: 'Total Projects', value: totalCount, border: 'border-zinc-800' },
    { label: 'Development', value: devCount, border: 'border-zinc-800' },
    { label: 'Production', value: prodCount, border: 'border-emerald-950/40' },
    { label: 'Favorites', value: favCount, border: 'border-zinc-800' },
    { label: 'Archived', value: archivedCount, border: 'border-zinc-800' }
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Upper header banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50 flex items-center gap-2">
            Dashboard
            <Sparkles className="w-5 h-5 text-emerald-400" />
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Local time: {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setDialogOpen(true)}
            className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-semibold py-2 px-3.5 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-md hover:shadow-emerald-500/10 transition active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>
      </div>

      {/* Grid of stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((stat, i) => (
          <div 
            key={i} 
            className={`bg-zinc-900/30 backdrop-blur border ${stat.border} rounded-xl p-4.5 flex flex-col justify-between min-h-[90px] shadow-sm`}
          >
            <span className="text-[10px] font-bold text-zinc-500 tracking-wider uppercase">{stat.label}</span>
            <span className="text-3xl font-extrabold text-zinc-100 mt-2">{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Primary widgets layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Pinned Projects Section */}
          {pinnedProjects.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                Pinned Projects
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {pinnedProjects.map(proj => (
                  <Link 
                    key={proj.id} 
                    href={`/project/${proj.id}`}
                    onClick={() => setActiveProjectId(proj.id)}
                    className="group bg-zinc-900/20 hover:bg-zinc-900/50 border border-zinc-800/80 hover:border-zinc-700/60 p-4.5 rounded-xl block transition shadow-sm hover:shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Folder className="w-4.5 h-4.5" style={{ color: proj.color || '#10b981' }} />
                        <span className="font-semibold text-sm text-zinc-200 group-hover:text-zinc-50 transition-colors">
                          {proj.name}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <div className="flex items-center gap-2 mt-4 text-[10px] text-zinc-500 font-semibold uppercase">
                      <span className="bg-zinc-200 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-850 px-2 py-0.5 rounded capitalize text-zinc-655 dark:text-zinc-400">
                        {proj.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Recent projects grid */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-zinc-500" />
              Recently Created Projects
            </h2>
            {recentProjects.length > 0 ? (
              <div className="space-y-2.5">
                {recentProjects.map(proj => (
                  <Link 
                    key={proj.id} 
                    href={`/project/${proj.id}`}
                    onClick={() => setActiveProjectId(proj.id)}
                    className="flex items-center justify-between bg-zinc-900/10 hover:bg-zinc-900/40 border border-zinc-900 hover:border-zinc-850 p-4 rounded-xl transition"
                  >
                    <div className="flex items-center gap-3">
                      <Folder className="w-5 h-5 shrink-0" style={{ color: proj.color || '#10b981' }} />
                      <div>
                        <h4 className="font-semibold text-sm text-zinc-200">{proj.name}</h4>
                        <p className="text-xs text-zinc-500 mt-0.5">{formatDate(proj.createdAt)}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase border border-zinc-800 bg-zinc-950 px-2 py-0.5 rounded capitalize">
                      {proj.status}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="bg-zinc-900/10 border border-zinc-900 rounded-xl p-8 text-center text-zinc-500 text-xs">
                No projects created yet. Click "New Project" to start organizing!
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Widgets Column */}
        <div className="space-y-6">
          {/* Quick Actions widget */}
          <div className="bg-zinc-900/20 border border-zinc-900 rounded-xl p-4.5 space-y-4">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => setDialogOpen(true)}
                className="flex flex-col items-center justify-center bg-zinc-950 border border-zinc-850 hover:bg-zinc-900/80 p-3 rounded-lg text-center gap-1.5 transition cursor-pointer hover:border-zinc-700/60"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span className="text-[10px] font-semibold text-zinc-300">Create Project</span>
              </button>
              <button 
                onClick={() => setCommandPaletteOpen(true)}
                className="flex flex-col items-center justify-center bg-zinc-950 border border-zinc-850 hover:bg-zinc-900/80 p-3 rounded-lg text-center gap-1.5 transition cursor-pointer hover:border-zinc-700/60"
              >
                <span className="text-xs font-bold text-indigo-400">⌘K</span>
                <span className="text-[10px] font-semibold text-zinc-300">Command Palette</span>
              </button>
              <button 
                onClick={handleExport}
                className="flex flex-col items-center justify-center bg-zinc-950 border border-zinc-850 hover:bg-zinc-900/80 p-3 rounded-lg text-center gap-1.5 transition cursor-pointer hover:border-zinc-700/60"
              >
                <Download className="w-4 h-4 text-amber-400" />
                <span className="text-[10px] font-semibold text-zinc-300">Backup DB</span>
              </button>
              <button 
                onClick={() => {
                  lockVault();
                  toast.success("Vault locked");
                }}
                className="flex flex-col items-center justify-center bg-zinc-950 border border-zinc-850 hover:bg-zinc-900/80 p-3 rounded-lg text-center gap-1.5 transition cursor-pointer hover:border-zinc-700/60"
              >
                <Lock className="w-4 h-4 text-red-400" />
                <span className="text-[10px] font-semibold text-zinc-300">Lock Vault</span>
              </button>
            </div>
          </div>

          {/* Upcoming expiries widget */}
          <div className="bg-zinc-900/20 border border-zinc-900 rounded-xl p-4.5 space-y-3">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              Upcoming Expiries (30d)
            </h3>
            {expiringItems && expiringItems.length > 0 ? (
              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                {expiringItems.map((item: any, i) => (
                  <Link 
                    key={i} 
                    href={`/project/${item.projectId}`}
                    onClick={() => setActiveProjectId(item.projectId)}
                    className="flex flex-col bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 transition text-xs"
                  >
                    <div className="flex items-center justify-between font-semibold text-amber-400">
                      <span>{item.type === 'ssl' ? 'SSL Expiring' : 'Domain Expiring'}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-zinc-200 mt-1">{item.name}</span>
                    <span className="text-[10px] text-zinc-500 mt-1 font-semibold">Expiry: {item.date.toLocaleDateString()}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-zinc-500 text-xs py-4 text-center">
                All certificates and domains are in good standing!
              </div>
            )}
          </div>

          {/* Recent activities log widget */}
          <div className="bg-zinc-900/20 border border-zinc-900 rounded-xl p-4.5 space-y-3">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <ActivityIcon className="w-4 h-4 text-emerald-500" />
              Recent Activity
            </h3>
            {activities.length > 0 ? (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {activities.map((act) => (
                  <div key={act.id} className="text-xs border-b border-zinc-900/60 pb-2.5 last:border-0 last:pb-0">
                    <p className="text-zinc-200 font-medium leading-relaxed">{act.details}</p>
                    <span className="text-[10px] text-zinc-500 block mt-1">
                      {formatDate(act.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-zinc-500 text-xs py-4 text-center">
                No recent activity logged.
              </div>
            )}
          </div>
        </div>
      </div>

      <ProjectDialog 
        isOpen={dialogOpen} 
        onClose={() => setDialogOpen(false)} 
        onSuccess={() => {}} 
      />
    </div>
  );
}
