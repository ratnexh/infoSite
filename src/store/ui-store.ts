import { create } from 'zustand';
import { ProjectStatus } from '@/types';

interface UIState {
  sidebarOpen: boolean;
  viewMode: 'grid' | 'list';
  activeProjectId: string | null;
  searchTerm: string;
  statusFilter: ProjectStatus | 'all' | 'favorites' | 'archived' | 'deleted';
  sortBy: 'name' | 'updatedAt' | 'createdAt';
  sortOrder: 'asc' | 'desc';
  commandPaletteOpen: boolean;
  activeProjectTab: string;
  projectDialogOpen: boolean;
  
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setViewMode: (mode: 'grid' | 'list') => void;
  setActiveProjectId: (id: string | null) => void;
  setSearchTerm: (term: string) => void;
  setStatusFilter: (filter: ProjectStatus | 'all' | 'favorites' | 'archived' | 'deleted') => void;
  setSortBy: (field: 'name' | 'updatedAt' | 'createdAt') => void;
  toggleSortOrder: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setActiveProjectTab: (tab: string) => void;
  setProjectDialogOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  viewMode: 'grid',
  activeProjectId: null,
  searchTerm: '',
  statusFilter: 'all',
  sortBy: 'updatedAt',
  sortOrder: 'desc',
  commandPaletteOpen: false,
  activeProjectTab: 'overview',
  projectDialogOpen: false,

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setActiveProjectId: (id) => set({ activeProjectId: id, activeProjectTab: 'overview' }), // Reset to overview on change
  setSearchTerm: (term) => set({ searchTerm: term }),
  setStatusFilter: (filter) => set({ statusFilter: filter }),
  setSortBy: (field) => set({ sortBy: field }),
  toggleSortOrder: () => set((state) => ({ sortOrder: state.sortOrder === 'asc' ? 'desc' : 'asc' })),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setActiveProjectTab: (tab) => set({ activeProjectTab: tab }),
  setProjectDialogOpen: (open) => set({ projectDialogOpen: open }),
}));
