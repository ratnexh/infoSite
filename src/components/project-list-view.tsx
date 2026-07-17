'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/dexie-db';
import { useUIStore } from '@/store/ui-store';
import { Project, ProjectStatus } from '@/types';
import { 
  ProjectRepository, 
  ActivityRepository 
} from '@/lib/storage/repositories';
import { useSettingsStore } from '@/store/settings-store';
import { 
  Folder, 
  Star, 
  Pin, 
  Archive, 
  Trash2, 
  RotateCcw, 
  Plus, 
  LayoutGrid, 
  List as ListIcon, 
  Search,
  ArrowUpDown,
  FolderMinus,
  Sparkles,
  ExternalLink,
  Settings,
  MoreVertical,
  RefreshCw,
  Download,
  X,
  CheckSquare,
  Square
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ProjectListViewProps {
  presetFilter: 'active' | 'favorites' | 'archived' | 'deleted';
  title: string;
  description: string;
}

const GitHubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

export default function ProjectListView({ presetFilter, title, description }: ProjectListViewProps) {
  const { 
    searchTerm, 
    setSearchTerm,
    viewMode, 
    setViewMode, 
    sortBy, 
    setSortBy, 
    sortOrder, 
    toggleSortOrder,
    setActiveProjectId,
    setProjectDialogOpen
  } = useUIStore();

  const { currentRole } = useSettingsStore();

  // Local Filters
  const [localStatusFilter, setLocalStatusFilter] = useState<string>('all');
  const [localEnvFilter, setLocalEnvFilter] = useState<'all' | 'staging' | 'production'>('all');

  // Loading & Refreshing simulated states
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Bulk Selection states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dropdown states for each row index
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);

  // Trigger loading screen on mount
  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 700);
    return () => clearTimeout(t);
  }, []);

  // Live Query from IndexedDB
  const rawProjects = useLiveQuery(() => db.projects.toArray()) || [];

  // Compute stat aggregates
  const stats = useMemo(() => {
    const active = rawProjects.filter(p => !p.deletedAt && p.status !== 'archived');
    return {
      total: active.length,
      development: active.filter(p => p.status === 'development').length,
      production: active.filter(p => p.status === 'production').length,
      favorites: active.filter(p => p.isFavorite).length,
      archived: rawProjects.filter(p => !p.deletedAt && p.status === 'archived').length,
    };
  }, [rawProjects]);

  // Reset page when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, localStatusFilter, localEnvFilter, sortBy, sortOrder]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setIsLoading(true);
    setSelectedIds(new Set());
    setTimeout(() => {
      setIsRefreshing(false);
      setIsLoading(false);
      toast.success('Projects dashboard refreshed');
    }, 600);
  };

  // Filter and Sort project items
  const filteredProjects = useMemo(() => {
    let list = [...rawProjects];

    // 1. Preset tab filter
    if (presetFilter === 'active') {
      list = list.filter(p => !p.deletedAt && p.status !== 'archived');
    } else if (presetFilter === 'favorites') {
      list = list.filter(p => !p.deletedAt && p.isFavorite);
    } else if (presetFilter === 'archived') {
      list = list.filter(p => !p.deletedAt && p.status === 'archived');
    } else if (presetFilter === 'deleted') {
      list = list.filter(p => p.deletedAt !== null);
    }

    // 2. Local Status filter
    if (localStatusFilter !== 'all' && presetFilter === 'active') {
      list = list.filter(p => p.status === localStatusFilter);
    }

    // 3. Local Environment filter
    if (localEnvFilter !== 'all') {
      if (localEnvFilter === 'staging') {
        list = list.filter(p => p.url2);
      } else if (localEnvFilter === 'production') {
        list = list.filter(p => p.url3);
      }
    }

    // 4. Text Search
    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      list = list.filter(p => 
        p.name.toLowerCase().includes(query) ||
        (p.aka && p.aka.toLowerCase().includes(query)) ||
        (p.url2 && p.url2.toLowerCase().includes(query)) ||
        (p.url3 && p.url3.toLowerCase().includes(query))
      );
    }

    // 5. Apply sorting
    list.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'updatedAt') {
        comparison = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      } else if (sortBy === 'createdAt') {
        comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return sortOrder === 'asc' ? -comparison : comparison;
    });

    // Pinning priority for active view
    if (presetFilter === 'active') {
      list.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return 0;
      });
    }

    return list;
  }, [rawProjects, presetFilter, localStatusFilter, localEnvFilter, searchTerm, sortBy, sortOrder]);

  // Paginated partition
  const paginatedProjects = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredProjects.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredProjects, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(filteredProjects.length / rowsPerPage) || 1;

  // Bulk operation triggers
  const handleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleSelectAllOnPage = () => {
    const pageIds = paginatedProjects.map(p => p.id);
    const allSelected = pageIds.every(id => selectedIds.has(id));
    const next = new Set(selectedIds);

    if (allSelected) {
      pageIds.forEach(id => next.delete(id));
    } else {
      pageIds.forEach(id => next.add(id));
    }
    setSelectedIds(next);
  };

  const executeBulkFavorite = async () => {
    try {
      const ids = Array.from(selectedIds);
      await Promise.all(ids.map(id => {
        const proj = rawProjects.find(p => p.id === id);
        return ProjectRepository.update(id, { isFavorite: !proj?.isFavorite });
      }));
      toast.success('Updated favorite statuses');
      setSelectedIds(new Set());
    } catch {
      toast.error('Bulk favorite toggle failed');
    }
  };

  const executeBulkArchive = async () => {
    try {
      const ids = Array.from(selectedIds);
      await Promise.all(ids.map(id => {
        const proj = rawProjects.find(p => p.id === id);
        const nextStatus = proj?.status === 'archived' ? 'development' : 'archived';
        return ProjectRepository.update(id, { status: nextStatus as ProjectStatus });
      }));
      toast.success('Updated archive statuses');
      setSelectedIds(new Set());
    } catch {
      toast.error('Bulk archive operation failed');
    }
  };

  const executeBulkDelete = async () => {
    if (confirm(`Move ${selectedIds.size} projects to Trash?`)) {
      try {
        const ids = Array.from(selectedIds);
        await Promise.all(ids.map(id => ProjectRepository.softDelete(id)));
        toast.success('Projects moved to Trash');
        setSelectedIds(new Set());
      } catch {
        toast.error('Bulk deletion failed');
      }
    }
  };

  const executeBulkExport = async () => {
    try {
      const ids = Array.from(selectedIds);
      const exportList = rawProjects.filter(p => ids.includes(p.id));
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportList, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `site-vault-bulk-export.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success(`Exported ${selectedIds.size} projects backup JSON`);
      setSelectedIds(new Set());
    } catch {
      toast.error('Bulk export failed');
    }
  };

  // Toggle handlers for individual items
  const handleToggleFavorite = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await ProjectRepository.toggleFavorite(id);
    } catch {
      toast.error('Failed to toggle favorite');
    }
  };

  const handleTogglePinned = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await ProjectRepository.togglePinned(id);
    } catch {
      toast.error('Failed to toggle pinned');
    }
  };

  const handleSoftDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await ProjectRepository.softDelete(id);
      toast.success('Project moved to Trash');
    } catch {
      toast.error('Failed to delete project');
    }
  };

  const handleRestore = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await ProjectRepository.restore(id);
      toast.success('Project restored successfully');
    } catch {
      toast.error('Failed to restore project');
    }
  };

  const handleHardDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm('Are you absolutely sure? This will permanently delete this project.')) {
      try {
        await ProjectRepository.hardDelete(id);
        toast.success('Project permanently deleted');
      } catch {
        toast.error('Failed to delete project');
      }
    }
  };

  const handleArchive = async (e: React.MouseEvent, id: string, name: string, isArchived: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const newStatus = isArchived ? 'development' as ProjectStatus : 'archived' as ProjectStatus;
      await ProjectRepository.update(id, { status: newStatus });
      toast.success(isArchived ? `Restored "${name}"` : `Archived "${name}"`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleDuplicate = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await ProjectRepository.duplicate(id);
      toast.success('Project duplicated successfully');
    } catch {
      toast.error('Failed to duplicate project');
    }
  };

  // Mock Repository details
  const getMockRepo = (name: string) => {
    const clean = name.toLowerCase().replace(/\s+/g, '-');
    return {
      name: `github.com/ratnexh/${clean}`,
      shortName: `ratnexh/${clean}`,
      branch: 'main'
    };
  };

  // Mock Deployment info
  const getMockDeploy = (proj: Project) => {
    const hash = proj.id.slice(0, 7);
    if (proj.status === 'production') {
      return { status: 'Healthy', color: 'bg-emerald-500 text-emerald-400', hash, duration: '42s' };
    }
    if (proj.status === 'development') {
      return { status: 'Deploying', color: 'bg-blue-500 text-blue-400', hash, duration: '1m 15s' };
    }
    if (proj.status === 'testing') {
      return { status: 'Build Failed', color: 'bg-red-500 text-red-400', hash, duration: '24s' };
    }
    return { status: 'Offline', color: 'bg-zinc-700 text-zinc-500', hash, duration: '--' };
  };

  return (
    <div className="space-y-6">
      
      {/* Sticky Page Header */}
      <div className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-900 pb-5 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-55">{title}</h1>
          <p className="text-xs text-zinc-400 mt-1">{description}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setProjectDialogOpen(true)}
            className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold py-2 px-3.5 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            New Project
          </button>
        </div>
      </div>

      {/* Projects Aggregate Statistics Banner */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, border: 'border-zinc-900', text: 'text-zinc-400', active: true },
          { label: 'Development', value: stats.development, border: 'border-blue-950/20', text: 'text-blue-400', active: stats.development > 0 },
          { label: 'Production', value: stats.production, border: 'border-emerald-950/40', text: 'text-emerald-400', active: stats.production > 0 },
          { label: 'Favorites', value: stats.favorites, border: 'border-amber-950/20', text: 'text-amber-400', active: stats.favorites > 0 },
          { label: 'Archived', value: stats.archived, border: 'border-zinc-900', text: 'text-zinc-550', active: stats.archived > 0 }
        ].map((item, i) => (
          <div 
            key={i} 
            className={cn(
              "bg-zinc-900/10 border rounded-xl p-3 flex items-center justify-between shadow-sm transition hover:border-zinc-800/60",
              item.border,
              !item.active && "opacity-60"
            )}
          >
            <div className="space-y-0.5">
              <span className="text-[8px] font-bold text-zinc-550 uppercase tracking-wider">{item.label}</span>
              <span className="text-lg font-extrabold text-zinc-200 block leading-none">{item.value}</span>
            </div>
            <Folder className={cn("w-4 h-4", item.text)} />
          </div>
        ))}
      </div>

      {/* Toolbar Controls */}
      <div className="bg-zinc-900/20 border border-zinc-900 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-inner">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
          {/* Fuzzy Search */}
          <div className="relative flex-1 max-w-xs group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-550 group-focus-within:text-zinc-300 transition-colors" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search projects..."
              className="w-full bg-zinc-950 border border-zinc-855 rounded-lg pl-8.5 pr-3 py-1.5 text-zinc-200 text-[11px] placeholder-zinc-550 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition"
            />
          </div>

          {/* Tab Local status filter (only visible on active tab) */}
          {presetFilter === 'active' && (
            <select
              value={localStatusFilter}
              onChange={(e) => setLocalStatusFilter(e.target.value)}
              className="bg-zinc-950 border border-zinc-850 text-zinc-300 rounded-lg px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-500/30 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="development">Development</option>
              <option value="testing">Testing</option>
              <option value="staging">Staging</option>
              <option value="production">Production</option>
            </select>
          )}

          {/* Environment Filter */}
          <select
            value={localEnvFilter}
            onChange={(e) => setLocalEnvFilter(e.target.value as any)}
            className="bg-zinc-950 border border-zinc-855 text-zinc-300 rounded-lg px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-500/30 cursor-pointer"
          >
            <option value="all">All Environments</option>
            <option value="staging">Has Staging</option>
            <option value="production">Has Production</option>
          </select>
        </div>

        <div className="flex items-center gap-2 justify-between md:justify-end border-t md:border-t-0 border-zinc-900/60 pt-2.5 md:pt-0">
          {/* Sorting controls */}
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
            <button
              onClick={toggleSortOrder}
              className="p-1 bg-zinc-950 border border-zinc-855 text-zinc-400 hover:text-zinc-200 rounded-lg cursor-pointer transition"
              title={`Order: ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
            >
              <ArrowUpDown className="w-3 h-3" />
            </button>
          </div>

          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1.5 bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 rounded-lg transition cursor-pointer"
            title="Refresh database view"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
          </button>

          {/* View Toggles */}
          <div className="flex items-center border border-zinc-855 rounded-lg overflow-hidden bg-zinc-950">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-1.5 transition cursor-pointer hover:text-zinc-200",
                viewMode === 'grid' ? "bg-zinc-900 text-emerald-400" : "text-zinc-500"
              )}
              title="Grid Cards"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "p-1.5 transition cursor-pointer hover:text-zinc-200",
                viewMode === 'list' ? "bg-zinc-900 text-emerald-400" : "text-zinc-500"
              )}
              title="Table List"
            >
              <ListIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Contents Panel */}
      <div className="min-h-[350px]">
        {isLoading ? (
          /* Premium loading skeleton layout */
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(n => (
              <div key={n} className="bg-zinc-900/10 border border-zinc-900 rounded-xl p-4 flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-zinc-900" />
                  <div className="space-y-1.5">
                    <div className="w-28 h-3.5 bg-zinc-900 rounded" />
                    <div className="w-20 h-2.5 bg-zinc-900 rounded" />
                  </div>
                </div>
                <div className="w-36 h-3 bg-zinc-900 rounded hidden md:block" />
                <div className="w-16 h-4 bg-zinc-900 rounded" />
              </div>
            ))}
          </div>
        ) : filteredProjects.length > 0 ? (
          viewMode === 'grid' ? (
            /* Grid View Cards Redesign */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedProjects.map(proj => {
                const isSelected = selectedIds.has(proj.id);
                const repo = getMockRepo(proj.name);
                const dep = getMockDeploy(proj);
                const isProd = proj.status === 'production';
                const isStaging = proj.status === 'staging';

                return (
                  <div 
                    key={proj.id}
                    className={cn(
                      "group bg-zinc-900/10 hover:bg-zinc-900/30 border p-5 rounded-2xl flex flex-col justify-between shadow-sm transition-all duration-200 relative overflow-hidden",
                      isSelected ? "border-emerald-500/40 bg-emerald-500/[0.01]" : "border-zinc-900 hover:border-zinc-800/80"
                    )}
                  >
                    {/* Visual accent color bar */}
                    <div 
                      className="absolute top-0 left-0 right-0 h-[2px] opacity-75 group-hover:opacity-100" 
                      style={{ backgroundColor: proj.color || '#10b981' }}
                    />

                    <div>
                      {/* Title & Checkbox */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSelectRow(proj.id)}
                            className="text-zinc-650 hover:text-zinc-450 transition shrink-0 cursor-pointer animate-fade-in"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-zinc-800 group-hover:text-zinc-700" />
                            )}
                          </button>

                          <Link 
                            href={`/project/${proj.id}`}
                            onClick={() => setActiveProjectId(proj.id)}
                            className="flex items-center gap-1.5 font-bold text-sm text-zinc-200 hover:text-emerald-400 transition animate-fade-in"
                          >
                            <Folder className="w-4 h-4 shrink-0" style={{ color: proj.color || '#10b981' }} />
                            <span className="truncate max-w-[130px]">{proj.name}</span>
                          </Link>
                        </div>

                        {/* Favorite star */}
                        <button
                          onClick={(e) => handleToggleFavorite(e, proj.id)}
                          className={cn("p-0.5 rounded transition cursor-pointer", proj.isFavorite ? "text-amber-400" : "text-zinc-600 hover:text-zinc-400")}
                        >
                          <Star className={cn("w-3.5 h-3.5", proj.isFavorite && "fill-amber-400")} />
                        </button>
                      </div>

                      {/* Optional Alias Details */}
                      {proj.aka && (
                        <p className="text-[10px] text-zinc-550 font-medium mt-1 pl-[22px]">Alias: {proj.aka}</p>
                      )}

                      {/* Repository Link Details */}
                      <div className="mt-3.5 flex items-center gap-2 text-[10px] text-zinc-500 font-semibold bg-zinc-950/40 border border-zinc-900/60 p-2 rounded-xl">
                        <GitHubIcon className="w-3.5 h-3.5 text-zinc-450 shrink-0" />
                        <span className="truncate flex-1 text-zinc-350">{repo.shortName}</span>
                        <span className="text-[8px] bg-zinc-905 text-zinc-500 px-1 py-0.2 rounded font-mono shrink-0">main</span>
                      </div>

                      {/* Badges / Deploy Status */}
                      <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                        <span className={cn(
                          "text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded border leading-none shrink-0",
                          isProd ? "text-emerald-400 bg-emerald-500/5 border-emerald-500/15" :
                          isStaging ? "text-blue-400 bg-blue-500/5 border-blue-500/15" :
                          proj.status === 'archived' ? "text-zinc-500 bg-zinc-905 border-zinc-850" :
                          "text-sky-400 bg-sky-500/5 border-sky-500/15"
                        )}>
                          {proj.status}
                        </span>

                        <span className="flex items-center gap-1 text-[8px] font-bold text-zinc-400 bg-zinc-950 border border-zinc-900 px-1.5 py-0.5 rounded shrink-0">
                          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dep.color.split(' ')[0])} />
                          {dep.status}
                        </span>

                        {proj.url3 && (
                          <span className="text-[8px] font-extrabold text-emerald-400/90 bg-emerald-500/5 border border-emerald-500/10 px-1.5 py-0.5 rounded shrink-0">PROD</span>
                        )}
                        {proj.url2 && (
                          <span className="text-[8px] font-extrabold text-blue-400/90 bg-blue-500/5 border border-blue-500/10 px-1.5 py-0.5 rounded shrink-0">STAGE</span>
                        )}
                      </div>
                    </div>

                    {/* Footer Actions overlay */}
                    <div className="border-t border-zinc-900/60 pt-4 mt-5 flex items-center justify-between gap-2">
                      <span className="text-[9px] text-zinc-550 font-medium">
                        Updated {getRelativeTime(proj.updatedAt)}
                      </span>

                      {/* Inline Tools */}
                      <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                        {(proj.url3 || proj.url2) && (
                          <a 
                            href={proj.url3 || proj.url2}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 text-zinc-500 hover:text-zinc-200 border border-zinc-850 hover:border-zinc-700 bg-zinc-950 rounded-lg transition cursor-pointer"
                            title="Visit live site"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}

                        <Link
                          href={`/project/${proj.id}`}
                          onClick={() => setActiveProjectId(proj.id)}
                          className="p-1 text-zinc-500 hover:text-zinc-200 border border-zinc-850 hover:border-zinc-700 bg-zinc-950 rounded-lg transition"
                          title="Project details"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </Link>

                        {/* More triggers */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDropdownId(activeDropdownId === proj.id ? null : proj.id);
                            }}
                            className="p-1 text-zinc-500 hover:text-zinc-200 border border-zinc-850 bg-zinc-950 rounded-lg transition cursor-pointer"
                            title="More actions"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>

                          {activeDropdownId === proj.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setActiveDropdownId(null)} />
                              <div className="absolute right-0 bottom-full mb-1.5 z-50 w-36 bg-zinc-950 border border-zinc-850 rounded-xl p-1.5 shadow-2xl flex flex-col gap-0.5">
                                <button
                                  onClick={(e) => { handleDuplicate(e, proj.id); setActiveDropdownId(null); }}
                                  className="w-full text-left px-2 py-1.5 text-[10px] text-zinc-300 hover:text-zinc-100 hover:bg-zinc-900 rounded font-semibold transition cursor-pointer flex items-center gap-1.5"
                                >
                                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                                  Duplicate
                                </button>
                                <button
                                  onClick={(e) => { handleTogglePinned(e, proj.id); setActiveDropdownId(null); }}
                                  className="w-full text-left px-2 py-1.5 text-[10px] text-zinc-300 hover:text-zinc-100 hover:bg-zinc-900 rounded font-semibold transition cursor-pointer flex items-center gap-1.5"
                                >
                                  <Pin className="w-3.5 h-3.5 text-amber-400" />
                                  {proj.isPinned ? 'Unpin top' : 'Pin to top'}
                                </button>
                                <button
                                  onClick={(e) => { handleArchive(e, proj.id, proj.name, proj.status === 'archived'); setActiveDropdownId(null); }}
                                  className="w-full text-left px-2 py-1.5 text-[10px] text-zinc-300 hover:text-zinc-100 hover:bg-zinc-900 rounded font-semibold transition cursor-pointer flex items-center gap-1.5"
                                >
                                  <Archive className="w-3.5 h-3.5 text-zinc-450" />
                                  {proj.status === 'archived' ? 'Unarchive' : 'Archive'}
                                </button>
                                {currentRole === 'admin' && (
                                  <button
                                    onClick={(e) => { handleSoftDelete(e, proj.id); setActiveDropdownId(null); }}
                                    className="w-full text-left px-2 py-1.5 text-[10px] text-red-400 hover:bg-red-950/20 rounded font-semibold transition cursor-pointer flex items-center gap-1.5 border-t border-zinc-900/60 mt-1 pt-1.5"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                    Move to Trash
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Redesigned Projects List Table */
            <div className="bg-zinc-900/10 border border-zinc-900 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-950/40 border-b border-zinc-900 text-zinc-550 font-bold uppercase tracking-wider text-[9px]">
                      <th className="p-4 w-10 text-center">
                        <button
                          onClick={handleSelectAllOnPage}
                          className="text-zinc-600 hover:text-zinc-400 transition cursor-pointer"
                        >
                          {paginatedProjects.every(p => selectedIds.has(p.id)) ? (
                            <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Square className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </th>
                      <th className="p-4">Project</th>
                      <th className="p-4">Repository</th>
                      <th className="p-4">Environment</th>
                      <th className="p-4">Deployment</th>
                      <th className="p-4">Last Updated</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900/60">
                    {paginatedProjects.map(proj => {
                      const isSelected = selectedIds.has(proj.id);
                      const repo = getMockRepo(proj.name);
                      const dep = getMockDeploy(proj);
                      const isProd = proj.status === 'production';
                      const isStaging = proj.status === 'staging';

                      return (
                        <tr 
                          key={proj.id}
                          className={cn(
                            "hover:bg-zinc-900/30 group transition duration-150 animate-fade-in",
                            isSelected && "bg-emerald-500/[0.01]"
                          )}
                        >
                          {/* Selection Checkbox */}
                          <td className="p-4 text-center">
                            <button
                              onClick={() => handleSelectRow(proj.id)}
                              className="text-zinc-600 hover:text-zinc-400 transition cursor-pointer"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Square className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100" />
                              )}
                            </button>
                          </td>

                          {/* Project Details */}
                          <td className="p-4">
                            <div className="flex items-center gap-2.5">
                              <Folder className="w-4.5 h-4.5 shrink-0" style={{ color: proj.color || '#10b981' }} />
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <Link 
                                    href={`/project/${proj.id}`}
                                    onClick={() => setActiveProjectId(proj.id)}
                                    className="font-bold text-zinc-200 hover:text-emerald-400 transition"
                                  >
                                    {proj.name}
                                  </Link>
                                  {proj.isPinned && <Pin className="w-2.5 h-2.5 text-amber-500 fill-current shrink-0" />}
                                </div>
                                <span className="text-[10px] text-zinc-555 block font-medium mt-0.5">{proj.aka || 'No Alias Configured'}</span>
                              </div>

                              <button
                                onClick={(e) => handleToggleFavorite(e, proj.id)}
                                className={cn("p-0.5 rounded transition cursor-pointer opacity-0 group-hover:opacity-100", proj.isFavorite && "opacity-100 text-amber-400")}
                              >
                                <Star className={cn("w-3 h-3", proj.isFavorite && "fill-amber-400")} />
                              </button>
                            </div>
                          </td>

                          {/* Repository Details */}
                          <td className="p-4">
                            <div className="flex items-center gap-2 text-zinc-300 font-semibold max-w-[200px]">
                              <GitHubIcon className="w-3.5 h-3.5 text-zinc-450 shrink-0" />
                              <span className="truncate" title={repo.name}>{repo.shortName}</span>
                            </div>
                          </td>

                          {/* Environment Badge */}
                          <td className="p-4">
                            <span className={cn(
                              "text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded border leading-none shrink-0",
                              isProd ? "text-emerald-400 bg-emerald-500/5 border-emerald-500/15" :
                              isStaging ? "text-blue-400 bg-blue-500/5 border-blue-500/15" :
                              proj.status === 'archived' ? "text-zinc-505 bg-zinc-900 border-zinc-850" :
                              "text-sky-400 bg-sky-500/5 border-sky-500/15"
                            )}>
                              {proj.status}
                            </span>
                          </td>

                          {/* Deployment Status */}
                          <td className="p-4">
                            <div className="flex flex-col gap-0.5 text-[10px]">
                              <div className="flex items-center gap-1.5 font-bold">
                                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dep.color.split(' ')[0])} />
                                <span className="text-zinc-250">{dep.status}</span>
                              </div>
                              <span className="font-mono text-zinc-550 text-[9px] pl-3">hash: {dep.hash} • {dep.duration}</span>
                            </div>
                          </td>

                          {/* Last Updated */}
                          <td className="p-4">
                            <span className="text-zinc-400 font-medium" title={formatDate(proj.updatedAt)}>
                              {getRelativeTime(proj.updatedAt)}
                            </span>
                          </td>

                          {/* Actions Strip */}
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                              {currentRole !== 'viewer' && (
                                <>
                                  {presetFilter === 'deleted' ? (
                                    <>
                                      <button
                                        onClick={(e) => handleRestore(e, proj.id)}
                                        className="p-1 text-emerald-400 hover:bg-emerald-950/20 rounded cursor-pointer transition"
                                        title="Restore Project"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                      </button>
                                      {currentRole === 'admin' && (
                                        <button
                                          onClick={(e) => handleHardDelete(e, proj.id)}
                                          className="p-1 text-red-500 hover:bg-red-950/20 rounded cursor-pointer transition"
                                          title="Delete Permanently"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      {(proj.url3 || proj.url2) && (
                                        <a 
                                          href={proj.url3 || proj.url2}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="p-1 text-zinc-500 hover:text-zinc-200 border border-zinc-850 hover:border-zinc-700 bg-zinc-950 rounded-lg transition cursor-pointer"
                                          title="Visit live site"
                                        >
                                          <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                      )}

                                      <Link
                                        href={`/project/${proj.id}`}
                                        onClick={() => setActiveProjectId(proj.id)}
                                        className="p-1 text-zinc-500 hover:text-zinc-200 border border-zinc-850 hover:border-zinc-700 bg-zinc-950 rounded-lg transition"
                                        title="Project details"
                                      >
                                        <Settings className="w-3.5 h-3.5" />
                                      </Link>

                                      <div className="relative">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveDropdownId(activeDropdownId === proj.id ? null : proj.id);
                                          }}
                                          className="p-1 text-zinc-500 hover:text-zinc-200 border border-zinc-855 bg-zinc-950 rounded-lg transition cursor-pointer"
                                          title="More actions"
                                        >
                                          <MoreVertical className="w-3.5 h-3.5" />
                                        </button>

                                        {activeDropdownId === proj.id && (
                                          <>
                                            <div className="fixed inset-0 z-40" onClick={() => setActiveDropdownId(null)} />
                                            <div className="absolute right-0 top-full mt-1.5 z-50 w-36 bg-zinc-950 border border-zinc-850 rounded-xl p-1.5 shadow-2xl flex flex-col gap-0.5 text-left">
                                              <button
                                                onClick={(e) => { handleDuplicate(e, proj.id); setActiveDropdownId(null); }}
                                                className="w-full px-2 py-1.5 text-[10px] text-zinc-300 hover:text-zinc-100 hover:bg-zinc-900 rounded font-semibold transition cursor-pointer flex items-center gap-1.5"
                                              >
                                                <Sparkles className="w-3 h-3 text-indigo-400" />
                                                Duplicate
                                              </button>
                                              <button
                                                onClick={(e) => { handleTogglePinned(e, proj.id); setActiveDropdownId(null); }}
                                                className="w-full px-2 py-1.5 text-[10px] text-zinc-300 hover:text-zinc-100 hover:bg-zinc-900 rounded font-semibold transition cursor-pointer flex items-center gap-1.5"
                                              >
                                                <Pin className="w-3 h-3 text-amber-400" />
                                                {proj.isPinned ? 'Unpin top' : 'Pin to top'}
                                              </button>
                                              <button
                                                onClick={(e) => { handleArchive(e, proj.id, proj.name, proj.status === 'archived'); setActiveDropdownId(null); }}
                                                className="w-full px-2 py-1.5 text-[10px] text-zinc-300 hover:text-zinc-100 hover:bg-zinc-900 rounded font-semibold transition cursor-pointer flex items-center gap-1.5"
                                              >
                                                <Archive className="w-3 h-3 text-zinc-450" />
                                                {proj.status === 'archived' ? 'Unarchive' : 'Archive'}
                                              </button>
                                              {currentRole === 'admin' && (
                                                <button
                                                  onClick={(e) => { handleSoftDelete(e, proj.id); setActiveDropdownId(null); }}
                                                  className="w-full px-2 py-1.5 text-[10px] text-red-400 hover:bg-red-950/20 rounded font-semibold transition cursor-pointer flex items-center gap-1.5 border-t border-zinc-900/60 mt-1 pt-1.5"
                                                >
                                                  <Trash2 className="w-3 h-3 text-red-500" />
                                                  Move to Trash
                                                </button>
                                              )}
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : (
          /* Custom Empty State Illustration Notice */
          <div className="bg-zinc-900/10 border border-zinc-900 border-dashed rounded-2xl p-16 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-805 flex items-center justify-center text-zinc-550">
              <FolderMinus className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-zinc-300 mt-4 text-sm animate-fade-in">No projects cataloged</h3>
            <p className="text-zinc-555 text-xs mt-1.5 max-w-xs leading-relaxed animate-fade-in">
              {searchTerm 
                ? `No repository matches the filter parameter "${searchTerm}". Verify spelling and tags.`
                : 'Configure workspace environments and credentials to unlock full synchronization capabilities.'}
            </p>
            {presetFilter === 'active' && !searchTerm && (
              <button
                onClick={() => setDialogOpen(true)}
                className="mt-5 bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 text-zinc-300 font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition shadow-md"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                Add your first project
              </button>
            )}
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {!isLoading && filteredProjects.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-zinc-900/60 pt-4 text-xs">
          <div className="flex items-center gap-2 text-zinc-500 font-medium">
            <span>Show</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(parseInt(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-zinc-950 border border-zinc-850 text-zinc-300 rounded px-2 py-1 cursor-pointer focus:outline-none"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <span>projects per page</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1 bg-zinc-950 border border-zinc-850 rounded hover:bg-zinc-900 disabled:opacity-40 disabled:hover:bg-zinc-950 text-zinc-350 cursor-pointer disabled:cursor-not-allowed transition"
            >
              Previous
            </button>
            <span className="text-zinc-400 font-bold">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1 bg-zinc-950 border border-zinc-850 rounded hover:bg-zinc-900 disabled:opacity-40 disabled:hover:bg-zinc-950 text-zinc-350 cursor-pointer disabled:cursor-not-allowed transition"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Bulk Floating Overlay Action Bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className="fixed bottom-6 left-1/2 z-40 bg-zinc-900 border border-zinc-800 rounded-2xl py-3 px-5 shadow-2xl flex items-center gap-4 text-xs min-w-[320px] md:min-w-[480px] justify-between"
          >
            <span className="font-bold text-zinc-200 shrink-0">
              {selectedIds.size} selected
            </span>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={executeBulkFavorite}
                className="bg-zinc-950 border border-zinc-855 hover:bg-zinc-900 hover:text-amber-400 px-3 py-1.5 rounded-lg font-bold text-zinc-300 transition cursor-pointer flex items-center gap-1.5"
              >
                <Star className="w-3 h-3" />
                Favorite
              </button>
              <button
                onClick={executeBulkArchive}
                className="bg-zinc-950 border border-zinc-855 hover:bg-zinc-900 hover:text-zinc-100 px-3 py-1.5 rounded-lg font-bold text-zinc-300 transition cursor-pointer flex items-center gap-1.5"
              >
                <Archive className="w-3 h-3" />
                Archive
              </button>
              <button
                onClick={executeBulkExport}
                className="bg-zinc-955 border border-zinc-855 hover:bg-zinc-900 hover:text-zinc-100 px-3 py-1.5 rounded-lg font-bold text-zinc-300 transition cursor-pointer flex items-center gap-1.5"
              >
                <Download className="w-3 h-3" />
                Export
              </button>
              {currentRole === 'admin' && (
                <button
                  onClick={executeBulkDelete}
                  className="bg-red-955/20 border border-red-900/30 hover:bg-red-500 hover:text-red-955 px-3 py-1.5 rounded-lg font-bold text-red-400 transition cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
              )}
              <button
                onClick={() => setSelectedIds(new Set())}
                className="p-1.5 text-zinc-550 hover:text-zinc-300 transition cursor-pointer"
                title="Cancel selection"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

// Inline helper for formatting relative updates
const getRelativeTime = (dateInput: Date) => {
  const time = new Date(dateInput).getTime();
  const now = Date.now();
  const diff = now - time;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return dateInput.toLocaleDateString();
};
