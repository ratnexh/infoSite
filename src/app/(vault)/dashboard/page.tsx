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
  Download,
  Search,
  Grid,
  List,
  Upload,
  ShieldCheck,
  Archive,
  Globe,
  Code,
  GitBranch,
  ArrowUpRight,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useConfirmStore } from '@/store/confirm-store';

export default function DashboardPage() {
  const [envFilter, setEnvFilter] = useState<'all' | 'staging' | 'production'>('all');
  
  const { 
    setCommandPaletteOpen, 
    setActiveProjectId, 
    viewMode, 
    setViewMode, 
    searchTerm, 
    setSearchTerm, 
    statusFilter, 
    setStatusFilter,
    sortBy,
    setSortBy,
    setProjectDialogOpen
  } = useUIStore();
  
  const { lockVault } = useSettingsStore();
  const { showConfirm } = useConfirmStore();

  // 1. Live queries for stats & data
  const projects = useLiveQuery(() => db.projects.toArray()) || [];
  const activeProjects = projects.filter(p => !p.deletedAt);
  
  const totalCount = activeProjects.length;
  const devCount = activeProjects.filter(p => p.status === 'development').length;
  const prodCount = activeProjects.filter(p => p.status === 'production').length;
  const favCount = activeProjects.filter(p => p.isFavorite).length;
  const archivedCount = activeProjects.filter(p => p.status === 'archived').length;

  // 2. Live queries for activity logs
  const activities = useLiveQuery(() => db.activities.orderBy('createdAt').reverse().limit(10).toArray()) || [];

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
  }).filter(Boolean).flat().filter(Boolean) as Array<{ type: 'domain' | 'ssl'; name: string; date: Date; projectId: string }>;

  // Filter and Sort projects
  const filteredProjects = activeProjects
    .filter(p => {
      // Text Search
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(query);
        const matchesAka = p.aka?.toLowerCase().includes(query) ?? false;
        if (!matchesName && !matchesAka) return false;
      }
      
      // Status Filter
      if (statusFilter && statusFilter !== 'all') {
        if (statusFilter === 'favorites') {
          if (!p.isFavorite) return false;
        } else if (statusFilter === 'archived') {
          if (p.status !== 'archived') return false;
        } else if (statusFilter === 'deleted') {
          return false; // activeProjects are not deleted
        } else {
          if (p.status !== statusFilter) return false;
        }
      }
      
      // Environment Filter
      if (envFilter !== 'all') {
        if (envFilter === 'staging' && !p.url2) return false;
        if (envFilter === 'production' && !p.url3) return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'updatedAt') {
        comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      } else if (sortBy === 'createdAt') {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      
      // Default to descending for times, ascending for name
      const order = sortBy === 'name' ? 'asc' : 'desc';
      return order === 'asc' ? comparison : -comparison;
    });

  // DB Backup JSON Export
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

  // DB Backup JSON Restore
  const handleRestoreJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    showConfirm({
      title: 'Import Backup JSON',
      message: 'Importing backup will wipe your current database and overwrite it. Are you sure?',
      confirmLabel: 'Wipe & Import',
      variant: 'info',
      onConfirm: async () => {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const contents = event.target?.result as string;
            const backupData = JSON.parse(contents);
            if (!backupData.data) throw new Error('Invalid backup file structure.');
            
            const { ImportExportService } = await import('@/lib/storage/import-export');
            await ImportExportService.importJSON(contents);
            toast.success("Database backup restored successfully!");
            setTimeout(() => window.location.reload(), 1000);
          } catch (err: any) {
            toast.error(err.message || "Failed to restore JSON file");
          }
        };
        reader.readAsText(file);
      }
    });
    e.target.value = '';
  };

  const triggerRestoreUpload = () => {
    document.getElementById('restore-db-input')?.click();
  };

  const handleMockDeploy = (projectName: string) => {
    toast.promise(new Promise(resolve => setTimeout(resolve, 2000)), {
      loading: `Triggering deployment for ${projectName}...`,
      success: `Successfully deployed ${projectName} to production!`,
      error: 'Deployment failed.'
    });
  };

  const handleGlobalDeploy = () => {
    toast.promise(new Promise(resolve => setTimeout(resolve, 2500)), {
      loading: 'Initiating global deployment for all production projects...',
      success: 'All production pipelines completed successfully!',
      error: 'Global deployment failed.'
    });
  };

  // Group activities chronologically
  const groupActivitiesByDate = (items: typeof activities) => {
    const today: typeof activities = [];
    const yesterday: typeof activities = [];
    const earlier: typeof activities = [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

    items.forEach(act => {
      const actTime = new Date(act.createdAt).getTime();
      if (actTime >= todayStart) {
        today.push(act);
      } else if (actTime >= yesterdayStart) {
        yesterday.push(act);
      } else {
        earlier.push(act);
      }
    });

    return { today, yesterday, earlier };
  };

  const groupedActivities = groupActivitiesByDate(activities);

  // Helper for generating initials-based team avatars
  const getAvatarData = (projectName: string) => {
    const letters = projectName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const colors = [
      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      'bg-blue-500/10 text-blue-400 border-blue-500/20',
      'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      'bg-purple-500/10 text-purple-400 border-purple-500/20',
      'bg-amber-500/10 text-amber-400 border-amber-500/20'
    ];
    const colorIndex = letters.charCodeAt(0) % colors.length;
    return { letters, colorClass: colors[colorIndex] };
  };

  // Helper to format relative time
  const getRelativeTime = (dateInput: Date) => {
    const time = new Date(dateInput).getTime();
    const now = Date.now();
    const diff = now - time;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return formatDate(dateInput);
  };

  const statCards = [
    { label: 'Total Projects', value: totalCount, trend: 'Active repos', icon: Folder, border: 'border-zinc-900', text: 'text-zinc-400' },
    { label: 'Development', value: devCount, trend: 'Working environments', icon: Code, border: 'border-blue-950/20', text: 'text-blue-400' },
    { label: 'Production', value: prodCount, trend: '100% operational', icon: Globe, border: 'border-emerald-950/40', text: 'text-emerald-400' },
    { label: 'Favorites', value: favCount, trend: 'Quick access keys', icon: Star, border: 'border-amber-950/20', text: 'text-amber-400' },
    { label: 'Archived', value: archivedCount, trend: 'Cold storage', icon: Archive, border: 'border-zinc-900', text: 'text-zinc-550' }
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-50 flex items-center gap-1.5">
            Dashboard
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </h1>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Local time: {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            id="restore-db-input"
            accept=".json"
            className="hidden"
            onChange={handleRestoreJSON}
          />
          <button
            onClick={() => setProjectDialogOpen(true)}
            className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold py-2 px-3 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-md hover:shadow-emerald-500/10 transition active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            New Project
          </button>
        </div>
      </div>

      {/* Redesigned Statistics Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        {statCards.map((stat, i) => (
          <div 
            key={i} 
            className={cn(
              "bg-zinc-900/30 backdrop-blur border rounded-xl p-4 flex flex-col justify-between min-h-[100px] shadow-sm transition hover:border-zinc-800/80 group",
              stat.border
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-zinc-500 tracking-wider uppercase">{stat.label}</span>
              <stat.icon className={cn("w-4 h-4 transition-transform group-hover:scale-105", stat.text)} />
            </div>
            <div className="mt-2.5">
              <span className="text-2xl font-extrabold text-zinc-100">{stat.value}</span>
              <p className="text-[9px] text-zinc-550 mt-1 font-semibold">{stat.trend}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid Layout (70/30) */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        
        {/* Left Column (70%): Projects Focused */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* Filters Toolbar */}
          <div className="bg-zinc-900/20 border border-zinc-900 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-inner">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
              {/* Search */}
              <div className="relative flex-1 max-w-xs group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-550 group-focus-within:text-zinc-300 transition-colors" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter by name..."
                  className="w-full bg-zinc-950 border border-zinc-850 rounded-lg pl-8.5 pr-3 py-1.5 text-zinc-200 text-[11px] placeholder-zinc-550 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 focus:border-emerald-500/40 transition"
                />
              </div>

              {/* Status Select */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-zinc-950 border border-zinc-850 text-zinc-300 rounded-lg px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-500/30 cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="development">Development</option>
                <option value="testing">Testing</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
                <option value="favorites">Favorites</option>
                <option value="archived">Archived</option>
              </select>

              {/* Environment Filter */}
              <select
                value={envFilter}
                onChange={(e) => setEnvFilter(e.target.value as any)}
                className="bg-zinc-950 border border-zinc-850 text-zinc-300 rounded-lg px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-500/30 cursor-pointer"
              >
                <option value="all">All Environments</option>
                <option value="staging">Has Staging</option>
                <option value="production">Has Production</option>
              </select>
            </div>

            <div className="flex items-center gap-2 justify-between md:justify-end border-t md:border-t-0 border-zinc-900/60 pt-2.5 md:pt-0">
              {/* Sort By */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-500 font-bold uppercase shrink-0">Sort By</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-zinc-950 border border-zinc-850 text-zinc-300 rounded-lg px-2 py-1 text-[11px] focus:outline-none cursor-pointer"
                >
                  <option value="updatedAt">Updated</option>
                  <option value="createdAt">Created</option>
                  <option value="name">Name</option>
                </select>
              </div>

              {/* Grid/List View Toggles */}
              <div className="flex items-center border border-zinc-850 rounded-lg overflow-hidden bg-zinc-950">
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    "p-1.5 transition cursor-pointer hover:text-zinc-200",
                    viewMode === 'grid' ? "bg-zinc-900 text-emerald-400" : "text-zinc-500"
                  )}
                  title="Grid View"
                >
                  <Grid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    "p-1.5 transition cursor-pointer hover:text-zinc-200",
                    viewMode === 'list' ? "bg-zinc-900 text-emerald-400" : "text-zinc-500"
                  )}
                  title="List View"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Projects Content list */}
          {filteredProjects.length > 0 ? (
            viewMode === 'grid' ? (
              /* Grid Layout */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredProjects.map(proj => {
                  const avatar = getAvatarData(proj.name);
                  const isProd = proj.status === 'production';
                  const isStaging = proj.status === 'staging';
                  return (
                    <div 
                      key={proj.id} 
                      className="group bg-zinc-900/10 hover:bg-zinc-900/40 border border-zinc-900 hover:border-zinc-800/80 p-5 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow-md transition duration-250 relative overflow-hidden"
                    >
                      {/* Accent color bar */}
                      <div 
                        className="absolute top-0 left-0 right-0 h-[2px] opacity-70 group-hover:opacity-100 transition-opacity" 
                        style={{ backgroundColor: proj.color || '#10b981' }}
                      />

                      {/* Header info */}
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/project/${proj.id}`}
                            onClick={() => setActiveProjectId(proj.id)}
                            className="flex items-center gap-2 group/title"
                          >
                            <Folder className="w-5 h-5 shrink-0 transition-transform group-hover/title:scale-105" style={{ color: proj.color || '#10b981' }} />
                            <span className="font-bold text-sm text-zinc-200 group-hover:text-emerald-400 transition-colors truncate max-w-[160px]">
                              {proj.name}
                            </span>
                          </Link>

                          {/* Favorite indicator */}
                          {proj.isFavorite && (
                            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                          )}
                        </div>

                        {/* Subtitle / git / avatars */}
                        <div className="flex items-center gap-1.5 mt-2.5">
                          <span className={cn(
                            "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border leading-none shrink-0",
                            isProd ? "text-emerald-400 bg-emerald-500/5 border-emerald-500/15" :
                            isStaging ? "text-blue-400 bg-blue-500/5 border-blue-500/15" :
                            proj.status === 'testing' ? "text-indigo-400 bg-indigo-500/5 border-indigo-500/15" :
                            proj.status === 'archived' ? "text-zinc-500 bg-zinc-900 border-zinc-800" :
                            "text-sky-400 bg-sky-500/5 border-sky-500/15"
                          )}>
                            {proj.status}
                          </span>

                          <span className="flex items-center gap-0.5 text-[9px] font-bold text-zinc-550 bg-zinc-950 border border-zinc-900 px-1.5 py-0.5 rounded shrink-0">
                            <GitBranch className="w-2.5 h-2.5" />
                            {isProd ? 'main' : proj.status === 'staging' ? 'staging' : 'dev'}
                          </span>

                          {proj.url3 && (
                            <span className="text-[9px] font-bold text-emerald-400/90 bg-emerald-500/5 border border-emerald-500/10 px-1.5 py-0.5 rounded shrink-0">PROD</span>
                          )}
                          {proj.url2 && (
                            <span className="text-[9px] font-bold text-blue-400/90 bg-blue-500/5 border border-blue-500/10 px-1.5 py-0.5 rounded shrink-0">STAGE</span>
                          )}
                        </div>
                      </div>

                      {/* Footer Section */}
                      <div className="border-t border-zinc-900/60 pt-4 mt-5 flex items-center justify-between gap-2">
                        {/* Team Avatar & updated info */}
                        <div className="flex items-center gap-2">
                          <div className={cn("w-6 h-6 rounded-full border flex items-center justify-center text-[9px] font-bold select-none shrink-0", avatar.colorClass)}>
                            {avatar.letters}
                          </div>
                          <span className="text-[9px] text-zinc-550 font-medium">
                            Updated {getRelativeTime(proj.updatedAt)}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                          {(proj.url3 || proj.url2) && (
                            <a 
                              href={proj.url3 || proj.url2}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 text-zinc-500 hover:text-zinc-200 border border-zinc-850 hover:border-zinc-700 bg-zinc-950 rounded-lg transition cursor-pointer"
                              title="Visit live site"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}

                          <Link
                            href={`/project/${proj.id}`}
                            onClick={() => setActiveProjectId(proj.id)}
                            className="p-1 text-zinc-500 hover:text-zinc-200 border border-zinc-850 hover:border-zinc-700 bg-zinc-950 rounded-lg transition"
                            title="Project details"
                          >
                            <Settings className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* List Layout */
              <div className="bg-zinc-900/10 border border-zinc-900 rounded-2xl divide-y divide-zinc-900/60 overflow-hidden shadow-sm">
                {filteredProjects.map(proj => {
                  const avatar = getAvatarData(proj.name);
                  const isProd = proj.status === 'production';
                  const isStaging = proj.status === 'staging';
                  return (
                    <div 
                      key={proj.id} 
                      className="group flex flex-col sm:flex-row sm:items-center justify-between p-4.5 gap-4 hover:bg-zinc-900/30 transition duration-200"
                    >
                      <div className="flex items-center gap-3.5 flex-1 min-w-0">
                        {/* Avatar */}
                        <div className={cn("w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 select-none", avatar.colorClass)}>
                          {avatar.letters}
                        </div>

                        {/* Name & metadata */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              href={`/project/${proj.id}`}
                              onClick={() => setActiveProjectId(proj.id)}
                              className="font-bold text-sm text-zinc-200 hover:text-emerald-400 transition truncate"
                            >
                              {proj.name}
                            </Link>

                            <span className={cn(
                              "text-[8px] font-extrabold uppercase px-1 rounded border leading-none shrink-0",
                              isProd ? "text-emerald-400 bg-emerald-500/5 border-emerald-500/15" :
                              isStaging ? "text-blue-400 bg-blue-500/5 border-blue-500/15" :
                              proj.status === 'archived' ? "text-zinc-500 bg-zinc-900 border-zinc-800" :
                              "text-sky-400 bg-sky-500/5 border-sky-500/15"
                            )}>
                              {proj.status}
                            </span>
                            
                            <span className="flex items-center gap-0.5 text-[8px] font-extrabold text-zinc-500 bg-zinc-950 border border-zinc-900 px-1 py-0.5 rounded shrink-0">
                              <GitBranch className="w-2.5 h-2.5" />
                              {isProd ? 'main' : isStaging ? 'staging' : 'dev'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-zinc-550 font-medium">
                            <span>Updated {getRelativeTime(proj.updatedAt)}</span>
                            <span>•</span>
                            <span className="truncate max-w-[180px]">{proj.aka || 'No Alias'}</span>
                          </div>
                        </div>
                      </div>

                      {/* List Actions */}
                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        {(proj.url3 || proj.url2) && (
                          <a 
                            href={proj.url3 || proj.url2}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-zinc-500 hover:text-zinc-200 border border-zinc-850 hover:border-zinc-700 bg-zinc-950 rounded-lg transition cursor-pointer"
                            title="Visit live environment"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}

                        <Link
                          href={`/project/${proj.id}`}
                          onClick={() => setActiveProjectId(proj.id)}
                          className="p-1.5 text-zinc-500 hover:text-zinc-200 border border-zinc-850 hover:border-zinc-700 bg-zinc-950 rounded-lg transition"
                          title="Project settings"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* Empty State */
            <div className="bg-zinc-900/10 border border-zinc-900 rounded-2xl p-10 text-center flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                <Folder className="w-5 h-5" />
              </div>
              <h3 className="text-zinc-300 font-bold text-sm">No projects found</h3>
              <p className="text-zinc-500 text-xs max-w-xs leading-relaxed">
                {searchTerm || statusFilter !== 'all' || envFilter !== 'all'
                  ? 'No repositories match your active search filters. Try clearing some selections.'
                  : 'Start organizing your developer vault by creating your very first workspace project.'}
              </p>
              {(searchTerm || statusFilter !== 'all' || envFilter !== 'all') ? (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                    setEnvFilter('all');
                  }}
                  className="mt-2 text-xs font-semibold text-emerald-400 hover:text-emerald-300 cursor-pointer"
                >
                  Clear all filters
                </button>
              ) : (
                <button
                  onClick={() => setProjectDialogOpen(true)}
                  className="mt-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-200 border border-zinc-750 font-semibold py-1.5 px-3.5 rounded-lg text-xs transition cursor-pointer"
                >
                  Create Project
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right Column (30%): Actions, Expiries & Activity */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Quick Actions Panel */}
          <div className="bg-zinc-900/20 border border-zinc-900 rounded-2xl p-4.5 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Quick Actions</h3>
            
            <div className="flex flex-col gap-2">
              {/* Primary */}
              <button 
                onClick={() => setProjectDialogOpen(true)}
                className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold py-2.5 px-4 rounded-xl text-xs transition cursor-pointer shadow-md"
              >
                <Plus className="w-4 h-4" />
                Create New Project
              </button>
              
              {/* Secondaries */}
              <button 
                onClick={handleExport}
                className="w-full flex items-center justify-between bg-zinc-950 hover:bg-zinc-900/60 border border-zinc-850 p-2.5 rounded-xl text-[11px] font-semibold text-zinc-300 transition cursor-pointer group"
              >
                <span className="flex items-center gap-2">
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  Backup Local Database
                </span>
                <ArrowUpRight className="w-3 h-3 text-zinc-550 group-hover:text-zinc-300 transition-colors" />
              </button>

              <button 
                onClick={triggerRestoreUpload}
                className="w-full flex items-center justify-between bg-zinc-950 hover:bg-zinc-900/60 border border-zinc-850 p-2.5 rounded-xl text-[11px] font-semibold text-zinc-300 transition cursor-pointer group"
              >
                <span className="flex items-center gap-2">
                  <Upload className="w-3.5 h-3.5 text-indigo-400" />
                  Restore JSON Backup
                </span>
                <ArrowUpRight className="w-3 h-3 text-zinc-550 group-hover:text-zinc-300 transition-colors" />
              </button>

              <button 
                onClick={() => setCommandPaletteOpen(true)}
                className="w-full flex items-center justify-between bg-zinc-950 hover:bg-zinc-900/60 border border-zinc-850 p-2.5 rounded-xl text-[11px] font-semibold text-zinc-300 transition cursor-pointer group"
              >
                <span className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-red-400" />
                  Command Palette
                </span>
                <span className="text-[10px] text-zinc-550 font-bold bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">⌘K</span>
              </button>
            </div>
          </div>

          {/* Upcoming Expiries Panel */}
          <div className="bg-zinc-900/20 border border-zinc-900 rounded-2xl p-4.5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                SSL & Domain Expiries
              </h3>
            </div>
            
            {expiringItems.length > 0 ? (
              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                <div className="text-[10px] text-amber-400 font-bold bg-amber-500/5 border border-amber-500/10 p-2.5 rounded-xl flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>Warning: {expiringItems.length} SSL keys/domains expire within 30 days!</span>
                </div>
                {expiringItems.map((item, i) => (
                  <Link 
                    key={i} 
                    href={`/project/${item.projectId}`}
                    onClick={() => setActiveProjectId(item.projectId)}
                    className="flex flex-col bg-zinc-950 hover:bg-zinc-900/80 border border-zinc-850 rounded-xl p-3 transition text-xs group"
                  >
                    <div className="flex items-center justify-between font-bold text-zinc-200">
                      <span className="text-amber-400 font-semibold">{item.type === 'ssl' ? 'SSL Key' : 'Domain'}</span>
                      <ExternalLink className="w-3 h-3 text-zinc-550 group-hover:text-zinc-350 transition-colors" />
                    </div>
                    <span className="text-zinc-300 font-semibold mt-1 truncate">{item.name}</span>
                    <span className="text-[10px] text-zinc-550 mt-1 font-semibold">Expires: {item.date.toLocaleDateString()}</span>
                  </Link>
                ))}
              </div>
            ) : (
              /* Collapsed / Minimal Healthy State */
              <div className="bg-emerald-500/5 border border-emerald-500/15 p-3 rounded-xl flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-450 shrink-0" />
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                  100% SECURE — ALL DOMAINS SAFE
                </span>
              </div>
            )}
          </div>

          {/* Timeline Recent Activity Panel */}
          <div className="bg-zinc-900/20 border border-zinc-900 rounded-2xl p-4.5 space-y-4">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <ActivityIcon className="w-3.5 h-3.5 text-emerald-500" />
              Activity Timeline
            </h3>

            {activities.length > 0 ? (
              <div className="relative pl-3 space-y-4 max-h-[360px] overflow-y-auto pr-1">
                {/* Vertical timeline line */}
                <div className="absolute left-[5px] top-2 bottom-2 w-[1px] bg-zinc-800" />

                {/* TODAY */}
                {groupedActivities.today.length > 0 && (
                  <div className="space-y-3">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-950 border border-zinc-900 px-2 py-0.5 rounded-full relative -left-[14px]">Today</span>
                    {groupedActivities.today.map((act) => (
                      <div key={act.id} className="relative pl-4 text-xs group">
                        {/* Timeline point */}
                        <div className="absolute -left-[11px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-zinc-950 shadow group-hover:scale-110 transition-transform" />
                        <p className="text-zinc-200 font-semibold leading-relaxed">{act.details}</p>
                        <span className="text-[9px] text-zinc-550 block mt-0.5">{getRelativeTime(act.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* YESTERDAY */}
                {groupedActivities.yesterday.length > 0 && (
                  <div className="space-y-3 mt-4">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-950 border border-zinc-900 px-2 py-0.5 rounded-full relative -left-[14px]">Yesterday</span>
                    {groupedActivities.yesterday.map((act) => (
                      <div key={act.id} className="relative pl-4 text-xs group">
                        <div className="absolute -left-[11px] top-1 w-2.5 h-2.5 rounded-full bg-blue-500 border border-zinc-950 shadow group-hover:scale-110 transition-transform" />
                        <p className="text-zinc-200 font-semibold leading-relaxed">{act.details}</p>
                        <span className="text-[9px] text-zinc-550 block mt-0.5">{getRelativeTime(act.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* EARLIER */}
                {groupedActivities.earlier.length > 0 && (
                  <div className="space-y-3 mt-4">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-950 border border-zinc-900 px-2 py-0.5 rounded-full relative -left-[14px]">Earlier</span>
                    {groupedActivities.earlier.map((act) => (
                      <div key={act.id} className="relative pl-4 text-xs group">
                        <div className="absolute -left-[11px] top-1 w-2.5 h-2.5 rounded-full bg-zinc-650 border border-zinc-950 shadow group-hover:scale-110 transition-transform" />
                        <p className="text-zinc-200 font-semibold leading-relaxed font-medium">{act.details}</p>
                        <span className="text-[9px] text-zinc-550 block mt-0.5">{getRelativeTime(act.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-zinc-550 text-xs py-4 text-center">
                No recent activity logged.
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
