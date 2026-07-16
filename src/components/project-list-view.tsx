'use client';

import React, { useState } from 'react';
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
  List, 
  Search,
  ArrowUpDown,
  CornerDownRight,
  FolderMinus,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import ProjectDialog from '@/components/project-dialog';
import { toast } from 'sonner';

interface ProjectListViewProps {
  presetFilter: 'active' | 'favorites' | 'archived' | 'deleted';
  title: string;
  description: string;
}

export default function ProjectListView({ presetFilter, title, description }: ProjectListViewProps) {
  const { 
    searchTerm, 
    viewMode, 
    setViewMode, 
    sortBy, 
    setSortBy, 
    sortOrder, 
    toggleSortOrder,
    setActiveProjectId
  } = useUIStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const { currentRole } = useSettingsStore();

  // Live Query from IndexedDB
  const rawProjects = useLiveQuery(() => db.projects.toArray()) || [];

  // Filter logic
  const filteredProjects = React.useMemo(() => {
    let list = [...rawProjects];

    // 1. Apply Preset Section Filter
    if (presetFilter === 'active') {
      list = list.filter(p => !p.deletedAt && p.status !== 'archived');
    } else if (presetFilter === 'favorites') {
      list = list.filter(p => !p.deletedAt && p.isFavorite);
    } else if (presetFilter === 'archived') {
      list = list.filter(p => !p.deletedAt && p.status === 'archived');
    } else if (presetFilter === 'deleted') {
      list = list.filter(p => p.deletedAt !== null);
    }

    // 2. Apply Fuzzy Search
    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      list = list.filter(p => 
        p.name.toLowerCase().includes(query) ||
        (p.aka && p.aka.toLowerCase().includes(query)) ||
        (p.dashboardUrl2 && p.dashboardUrl2.toLowerCase().includes(query)) ||
        (p.dashboardUrl3 && p.dashboardUrl3.toLowerCase().includes(query)) ||
        (p.url2 && p.url2.toLowerCase().includes(query)) ||
        (p.url3 && p.url3.toLowerCase().includes(query))
      );
    }

    // 3. Apply Sorting
    list.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'updatedAt') {
        comparison = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      } else if (sortBy === 'createdAt') {
        comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      
      // Since default comparison puts newest first for dates:
      // If ascending order is requested, invert the comparison result
      return sortOrder === 'asc' ? -comparison : comparison;
    });

    // Pinned projects float to top if viewing active ones
    if (presetFilter === 'active') {
      list.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return 0;
      });
    }

    return list;
  }, [rawProjects, presetFilter, searchTerm, sortBy, sortOrder]);

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
    if (confirm('Are you absolutely sure? This will permanently delete the project and all stored credentials/details.')) {
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
      toast.success(isArchived ? `Restored "${name}" from archives` : `Archived "${name}"`);
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

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-50">{title}</h1>
          <p className="text-xs text-zinc-400 mt-1">{description}</p>
        </div>

        {presetFilter === 'active' && currentRole !== 'viewer' && (
          <button
            onClick={() => setDialogOpen(true)}
            className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-semibold py-2 px-3.5 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition active:scale-[0.98] shrink-0"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        )}
      </div>

      {/* Toolbar Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/10 border border-zinc-900 p-3 rounded-xl">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span>Showing <b>{filteredProjects.length}</b> projects</span>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Sorting Field */}
          <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg p-1">
            <button
              onClick={() => setSortBy('name')}
              className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded cursor-pointer transition ${
                sortBy === 'name' ? 'bg-zinc-850 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Name
            </button>
            <button
              onClick={() => setSortBy('updatedAt')}
              className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded cursor-pointer transition ${
                sortBy === 'updatedAt' ? 'bg-zinc-850 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Updated
            </button>
            <button
              onClick={() => setSortBy('createdAt')}
              className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded cursor-pointer transition ${
                sortBy === 'createdAt' ? 'bg-zinc-850 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Created
            </button>
          </div>

          {/* Sort Order Toggle */}
          <button
            onClick={toggleSortOrder}
            className="bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-200 p-2 rounded-lg cursor-pointer transition"
            title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg p-1 shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded cursor-pointer transition ${
                viewMode === 'grid' ? 'bg-zinc-850 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded cursor-pointer transition ${
                viewMode === 'list' ? 'bg-zinc-850 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Projects Presentation Grid / List */}
      <AnimatePresence mode="popLayout">
        {filteredProjects.length > 0 ? (
          viewMode === 'grid' ? (
            <div 
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
            >
              {filteredProjects.map((proj, idx) => (
                <div
                  key={proj.id}
                  className="group bg-zinc-900/40 hover:bg-zinc-900/60 border border-zinc-800/85 hover:border-zinc-700/85 rounded-xl p-5 shadow-sm hover:shadow-md flex flex-col justify-between min-h-[170px] relative transition-all duration-200 animate-slide-up"
                  style={{ 
                    animationDelay: `${Math.min(idx * 0.05, 0.3)}s`,
                    animationFillMode: 'both'
                  }}
                >
                  <div>
                    {/* Header line */}
                    <div className="flex items-start justify-between gap-3">
                      <Link 
                        href={`/project/${proj.id}`}
                        onClick={() => setActiveProjectId(proj.id)}
                        className="flex items-center gap-2 group/title"
                      >
                        <Folder className="w-5 h-5 shrink-0" style={{ color: proj.color || '#10b981' }} />
                        <span className="font-bold text-sm text-zinc-200 group-hover/title:text-zinc-50 transition-colors">
                          {proj.name}
                        </span>
                      </Link>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {presetFilter !== 'deleted' && (
                          <>
                            <button
                              onClick={(e) => handleTogglePinned(e, proj.id)}
                              className={`p-1.5 rounded hover:bg-zinc-800 transition cursor-pointer ${proj.isPinned ? 'text-amber-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                              title={proj.isPinned ? 'Unpin' : 'Pin to Top'}
                            >
                              <Pin className="w-3.5 h-3.5 fill-current" />
                            </button>
                            <button
                              onClick={(e) => handleToggleFavorite(e, proj.id)}
                              className={`p-1.5 rounded hover:bg-zinc-800 transition cursor-pointer ${proj.isFavorite ? 'text-amber-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                              title={proj.isFavorite ? 'Remove Favorite' : 'Mark Favorite'}
                            >
                              <Star className={`w-3.5 h-3.5 ${proj.isFavorite ? 'fill-current' : ''}`} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Quick Access Badges */}
                    <div className="flex flex-wrap gap-1.5 mt-3 min-h-[24px]">
                      {/* Docs Links */}
                      {(proj.docsUrls || []).map((url, i) => (
                        url && (
                          <a 
                            key={`doc-${i}`}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-650 dark:text-blue-400 border border-blue-500/25 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 transition"
                            title={`Open Documentation ${i + 1}`}
                          >
                            Docs{i > 0 ? ` #${i + 1}` : ''}
                          </a>
                        )
                      ))}

                      {/* Figma URLs */}
                      {(proj.figmaUrls || []).map((url, i) => (
                        url && (
                          <a 
                            key={`figma-${i}`}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-650 dark:text-purple-400 border border-purple-500/25 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 transition"
                            title={`Open Figma Layout ${i + 1}`}
                          >
                            Figma{i > 0 ? ` #${i + 1}` : ''}
                          </a>
                        )
                      ))}

                      {/* 2.0 URLs */}
                      {proj.url2 && (
                        <a 
                          href={proj.url2}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700/60 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 transition"
                          title="Open 2.0 Site"
                        >
                          v2.0
                        </a>
                      )}
                      {proj.dashboardUrl2 && (
                        <a 
                          href={proj.dashboardUrl2}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 transition"
                          title="Open 2.0 Dashboard"
                        >
                          v2.0 Dash
                        </a>
                      )}

                      {/* 3.0 URLs */}
                      {proj.url3 && (
                        <a 
                          href={proj.url3}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700/60 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 transition"
                          title="Open 3.0 Site"
                        >
                          v3.0
                        </a>
                      )}
                      {proj.dashboardUrl3 && (
                        <a 
                          href={proj.dashboardUrl3}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 transition"
                          title="Open 3.0 Dashboard"
                        >
                          v3.0 Dash
                        </a>
                      )}
                      {!(proj.docsUrls && proj.docsUrls.length > 0) && !(proj.figmaUrls && proj.figmaUrls.length > 0) && !proj.url2 && !proj.dashboardUrl2 && !proj.url3 && !proj.dashboardUrl3 && (
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-600 font-semibold italic">No links configured</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 pt-3.5 border-t border-zinc-200 dark:border-zinc-900/60 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-bold uppercase">
                      <span className="bg-zinc-200 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-850/80 px-2 py-0.5 rounded capitalize">
                        {proj.status}
                      </span>
                    </div>

                    {/* Quick action buttons */}
                    <div className="flex items-center gap-0.5">
                      {currentRole !== 'viewer' && (
                        <>
                          {presetFilter === 'deleted' ? (
                            <>
                              <button
                                onClick={(e) => handleRestore(e, proj.id)}
                                className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/20 rounded cursor-pointer transition"
                                title="Restore Project"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                              {currentRole === 'admin' && (
                                <button
                                  onClick={(e) => handleHardDelete(e, proj.id)}
                                  className="p-1.5 text-red-500 hover:text-red-400 hover:bg-red-950/20 rounded cursor-pointer transition"
                                  title="Delete Permanently"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              <button
                                onClick={(e) => handleDuplicate(e, proj.id)}
                                className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded cursor-pointer transition opacity-0 group-hover:opacity-100"
                                title="Duplicate"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => handleArchive(e, proj.id, proj.name, proj.status === 'archived')}
                                className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded cursor-pointer transition opacity-0 group-hover:opacity-100"
                                title={proj.status === 'archived' ? 'Unarchive' : 'Archive'}
                              >
                                <Archive className="w-3.5 h-3.5" />
                              </button>
                              {currentRole === 'admin' && (
                                <button
                                  onClick={(e) => handleSoftDelete(e, proj.id)}
                                  className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-950/20 rounded cursor-pointer transition opacity-0 group-hover:opacity-100"
                                  title="Move to Trash"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* List / Table Presentation */
            <div 
              className="bg-zinc-900/35 border border-zinc-800/80 rounded-xl overflow-hidden shadow-sm"
            >
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-900/30 border-b border-zinc-200 dark:border-zinc-900 text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-4">Name</th>
                    <th className="p-4">Deployment Links</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Updated</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/60">
                  {filteredProjects.map((proj, idx) => (
                    <tr 
                      key={proj.id}
                      className="hover:bg-zinc-900/20 group animate-fade-in"
                      style={{ 
                        animationDelay: `${Math.min(idx * 0.03, 0.25)}s`,
                        animationFillMode: 'both'
                      }}
                    >
                      <td className="p-4">
                        <Link 
                          href={`/project/${proj.id}`}
                          onClick={() => setActiveProjectId(proj.id)}
                          className="flex items-center gap-2.5 font-bold text-zinc-200 hover:text-zinc-50 transition-colors"
                        >
                          <Folder className="w-4 h-4 shrink-0" style={{ color: proj.color || '#10b981' }} />
                          <span>{proj.name}</span>
                          {proj.isPinned && <Pin className="w-3 h-3 text-amber-500 fill-current" />}
                        </Link>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1.5">
                          {/* Docs Links */}
                          {(proj.docsUrls || []).map((url, i) => (
                            url && (
                              <a 
                                key={`doc-${i}`}
                                href={url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-[9px] font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 dark:text-blue-400 border border-blue-500/25 px-1.5 py-0.5 rounded transition uppercase animate-fade-in"
                                title={`Docs Link ${i + 1}`}
                              >
                                Docs{i > 0 ? ` #${i + 1}` : ''}
                              </a>
                            )
                          ))}

                          {/* Figma Links */}
                          {(proj.figmaUrls || []).map((url, i) => (
                            url && (
                              <a 
                                key={`figma-${i}`}
                                href={url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-[9px] font-bold bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 dark:text-purple-400 border border-purple-500/25 px-1.5 py-0.5 rounded transition uppercase animate-fade-in"
                                title={`Figma Link ${i + 1}`}
                              >
                                Figma{i > 0 ? ` #${i + 1}` : ''}
                              </a>
                            )
                          ))}

                          {/* 2.0 links */}
                          {proj.url2 && (
                            <a 
                              href={proj.url2} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-[9px] font-bold bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700/60 px-1.5 py-0.5 rounded transition uppercase"
                              title="2.0 Site"
                            >
                              v2.0
                            </a>
                          )}
                          {proj.dashboardUrl2 && (
                            <a 
                              href={proj.dashboardUrl2} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-[9px] font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 border border-emerald-500/25 px-1.5 py-0.5 rounded transition uppercase"
                              title="2.0 Dashboard"
                            >
                              v2.0 Dash
                            </a>
                          )}

                          {/* 3.0 links */}
                          {proj.url3 && (
                            <a 
                              href={proj.url3} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-[9px] font-bold bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700/60 px-1.5 py-0.5 rounded transition uppercase"
                              title="3.0 Site"
                            >
                              v3.0
                            </a>
                          )}
                          {proj.dashboardUrl3 && (
                            <a 
                              href={proj.dashboardUrl3} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-[9px] font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 border border-emerald-500/25 px-1.5 py-0.5 rounded transition uppercase"
                              title="3.0 Dashboard"
                            >
                              v3.0 Dash
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="capitalize bg-zinc-900 border border-zinc-850 px-2 py-0.5 rounded text-[10px] text-zinc-400 font-semibold">
                          {proj.status}
                        </span>
                      </td>
                      <td className="p-4 text-zinc-500">{formatDate(proj.updatedAt)}</td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {currentRole !== 'viewer' && (
                            <>
                              {presetFilter === 'deleted' ? (
                                  <>
                                    <button
                                      onClick={(e) => handleRestore(e, proj.id)}
                                      className="p-1 text-emerald-400 hover:bg-emerald-950/20 rounded cursor-pointer transition"
                                      title="Restore"
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
                                  <button
                                    onClick={(e) => handleDuplicate(e, proj.id)}
                                    className="p-1 text-zinc-500 hover:text-zinc-355 hover:bg-zinc-800 rounded cursor-pointer transition"
                                    title="Duplicate"
                                  >
                                    <Sparkles className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={(e) => handleArchive(e, proj.id, proj.name, proj.status === 'archived')}
                                    className="p-1 text-zinc-500 hover:text-zinc-355 hover:bg-zinc-800 rounded cursor-pointer transition"
                                    title={proj.status === 'archived' ? 'Unarchive' : 'Archive'}
                                  >
                                    <Archive className="w-3.5 h-3.5" />
                                  </button>
                                  {currentRole === 'admin' && (
                                    <button
                                      onClick={(e) => handleSoftDelete(e, proj.id)}
                                      className="p-1 text-zinc-500 hover:text-red-400 hover:bg-red-950/20 rounded cursor-pointer transition"
                                      title="Delete"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* Empty State */
          <div className="bg-zinc-900/35 border border-zinc-800/80 border-dashed rounded-xl p-16 flex flex-col items-center justify-center text-center">
            <FolderMinus className="w-12 h-12 text-zinc-600 animate-pulse" />
            <h3 className="font-bold text-zinc-300 mt-4">No Projects Found</h3>
            <p className="text-zinc-500 text-xs mt-1.5 max-w-xs leading-relaxed">
              {searchTerm ? `We couldn't find any projects matching "${searchTerm}". Try resetting search filter.` : "No projects cataloged under this tab yet."}
            </p>
            {presetFilter === 'active' && !searchTerm && (
              <button
                onClick={() => setDialogOpen(true)}
                className="mt-5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-850 text-zinc-200 font-semibold py-2 px-4 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer transition"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                Add your first project
              </button>
            )}
          </div>
        )}
      </AnimatePresence>

      <ProjectDialog 
        isOpen={dialogOpen} 
        onClose={() => setDialogOpen(false)} 
        onSuccess={() => {}} 
      />
    </div>
  );
}
