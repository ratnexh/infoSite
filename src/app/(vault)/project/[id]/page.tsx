'use client';

import React, { useState, use } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/dexie-db';
import { ProjectRepository } from '@/lib/storage/repositories';
import { useUIStore } from '@/store/ui-store';
import { useSettingsStore } from '@/store/settings-store';
import { 
  Folder, 
  Star, 
  Pin, 
  Archive, 
  ArrowLeft, 
  Sparkles,
  Link2,
  KeyRound,
  Server,
  Database as DbIcon,
  Puzzle,
  Users,
  FileText,
  Paperclip,
  History,
  Info,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

// Import sub tab components
import TabOverview from '@/features/projects/tab-overview';
import TabUrls from '@/features/projects/tab-urls';
import TabCredentials from '@/features/projects/tab-credentials';
import TabHosting from '@/features/projects/tab-hosting';
import TabDatabase from '@/features/projects/tab-database';
import TabServices from '@/features/projects/tab-services';
import TabContacts from '@/features/projects/tab-contacts';
import TabNotes from '@/features/projects/tab-notes';
import TabFiles from '@/features/projects/tab-files';
import TabActivity from '@/features/projects/tab-activity';

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const router = useRouter();

  const { activeProjectTab, setActiveProjectTab, setActiveProjectId } = useUIStore();
  const { encryptionKey } = useSettingsStore();

  // Live query project details
  const project = useLiveQuery(async () => {
    const raw = await db.projects.get(projectId);
    if (!raw) return raw;
    return await ProjectRepository.decrypt(raw, encryptionKey);
  }, [projectId, encryptionKey]);

  if (project === undefined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-zinc-550 text-xs">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-500 mb-2" />
        <span>Loading project vault...</span>
      </div>
    );
  }

  if (project === null) {
    return (
      <div className="bg-zinc-900/10 border border-zinc-900 rounded-xl p-16 text-center max-w-md mx-auto my-12 space-y-4">
        <h3 className="font-bold text-zinc-300">Project Not Found</h3>
        <p className="text-zinc-500 text-xs leading-relaxed">
          The requested project does not exist, was permanently deleted, or is stored in a different local vault profile.
        </p>
        <Link 
          href="/dashboard"
          className="inline-flex items-center gap-1 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 font-semibold py-2 px-4 rounded-lg text-xs cursor-pointer transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
        </Link>
      </div>
    );
  }

  const handleToggleFavorite = async () => {
    try {
      await ProjectRepository.toggleFavorite(project.id);
    } catch {
      toast.error('Failed to update favorite status');
    }
  };

  const handleTogglePinned = async () => {
    try {
      await ProjectRepository.togglePinned(project.id);
    } catch {
      toast.error('Failed to update pin status');
    }
  };

  const handleArchive = async () => {
    try {
      const newStatus = project.status === 'archived' ? 'development' : 'archived';
      await ProjectRepository.update(project.id, { status: newStatus });
      toast.success(project.status === 'archived' ? 'Project active' : 'Project archived');
    } catch {
      toast.error('Failed to archive project');
    }
  };

  const handleDuplicate = async () => {
    try {
      const dup = await ProjectRepository.duplicate(project.id);
      toast.success('Project duplicated successfully');
      router.push(`/project/${dup.id}`);
    } catch {
      toast.error('Failed to duplicate project');
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Info },
    { id: 'urls', label: 'URLs', icon: Link2 },
    { id: 'credentials', label: 'Credentials', icon: KeyRound },
    { id: 'hosting', label: 'Hosting', icon: Server },
    { id: 'database', label: 'Database', icon: DbIcon },
    { id: 'services', label: 'Services', icon: Puzzle },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'notes', label: 'Notes', icon: FileText },
    { id: 'files', label: 'Files', icon: Paperclip },
    { id: 'activity', label: 'Activity', icon: History }
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Back link & Actions header bar */}
      <div className="flex items-center justify-between">
        <Link 
          href="/projects"
          onClick={() => setActiveProjectId(null)}
          className="text-zinc-500 hover:text-zinc-350 text-xs font-semibold flex items-center gap-1.5 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Projects
        </Link>

        <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-900 rounded-lg p-1.5">
          <button
            onClick={handleTogglePinned}
            className={`p-1.5 rounded cursor-pointer transition ${project.isPinned ? 'text-amber-400 hover:text-amber-300' : 'text-zinc-550 hover:text-zinc-350'}`}
            title={project.isPinned ? 'Unpin Project' : 'Pin Project'}
          >
            <Pin className="w-3.5 h-3.5 fill-current" />
          </button>
          
          <button
            onClick={handleToggleFavorite}
            className={`p-1.5 rounded cursor-pointer transition ${project.isFavorite ? 'text-amber-400 hover:text-amber-300' : 'text-zinc-550 hover:text-zinc-350'}`}
            title={project.isFavorite ? 'Remove Favorite' : 'Mark Favorite'}
          >
            <Star className={`w-3.5 h-3.5 ${project.isFavorite ? 'fill-current' : ''}`} />
          </button>

          <button
            onClick={handleDuplicate}
            className="p-1.5 text-zinc-500 hover:text-zinc-350 rounded cursor-pointer transition"
            title="Duplicate Project"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleArchive}
            className={`p-1.5 rounded cursor-pointer transition ${project.status === 'archived' ? 'text-emerald-400 hover:text-emerald-350' : 'text-zinc-550 hover:text-zinc-350'}`}
            title={project.status === 'archived' ? 'Restore Project' : 'Archive Project'}
          >
            <Archive className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Hero title block */}
      <div className="flex items-start gap-4">
        <div 
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border border-white/5"
          style={{ backgroundColor: `${project.color}15`, borderColor: `${project.color}40` }}
        >
          <Folder className="w-6 h-6" style={{ color: project.color }} />
        </div>

        <div className="min-w-0">
          <h1 className="text-xl font-extrabold text-zinc-100 flex items-center gap-2.5 flex-wrap">
            {project.name}
            {project.aka && (
              <span className="text-sm font-medium text-zinc-500 dark:text-zinc-500 tracking-normal shrink-0">
                ({project.aka})
              </span>
            )}
            {project.status === 'archived' && (
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-900 border border-zinc-850 px-1.5 py-0.5 rounded leading-none shrink-0">
                ARCHIVED
              </span>
            )}
          </h1>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1">{project.status}</p>
        </div>
      </div>

      {/* Custom scrollable horizontal Tab strip */}
      <div className="border-b border-zinc-900 overflow-x-auto scrollbar-none flex">
        <div className="flex space-x-5 py-1">
          {tabs.map((tab) => {
            const isActive = activeProjectTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveProjectTab(tab.id)}
                className={`py-2 border-b-2 font-semibold text-xs transition cursor-pointer flex items-center gap-1.5 outline-none whitespace-nowrap ${
                  isActive 
                    ? 'border-emerald-500 text-zinc-100' 
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab panel viewport */}
      <div className="pt-4">
        {activeProjectTab === 'overview' && (
          <TabOverview project={project} onRefresh={() => {}} />
        )}
        {activeProjectTab === 'urls' && (
          <TabUrls project={project} />
        )}
        {activeProjectTab === 'credentials' && (
          <TabCredentials project={project} />
        )}
        {activeProjectTab === 'hosting' && (
          <TabHosting project={project} />
        )}
        {activeProjectTab === 'database' && (
          <TabDatabase project={project} />
        )}
        {activeProjectTab === 'services' && (
          <TabServices project={project} />
        )}
        {activeProjectTab === 'contacts' && (
          <TabContacts project={project} />
        )}
        {activeProjectTab === 'notes' && (
          <TabNotes project={project} onRefresh={() => {}} />
        )}
        {activeProjectTab === 'files' && (
          <TabFiles project={project} />
        )}
        {activeProjectTab === 'activity' && (
          <TabActivity project={project} />
        )}
      </div>
    </div>
  );
}

// Simple loader helper
function Loader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={className} {...props}>
      <div className="w-4 h-4 rounded-full border-2 border-zinc-700 border-t-emerald-500 animate-spin" />
    </div>
  );
}
