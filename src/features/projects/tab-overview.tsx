'use client';

import React from 'react';
import { Project } from '@/types';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/dexie-db';
import { useSettingsStore } from '@/store/settings-store';
import { 
  Calendar, 
  Edit3, 
  Link as LinkIcon, 
  KeyRound, 
  Database, 
  Paperclip, 
  CheckCircle,
  Archive,
  Play,
  ExternalLink,
  Copy,
  Eye,
  EyeOff,
  LayoutTemplate,
  Fingerprint,
  Wrench
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import ProjectDialog from '@/components/project-dialog';
import { toast } from 'sonner';
import { ProjectRepository } from '@/lib/storage/repositories';

interface TabOverviewProps {
  project: Project;
  onRefresh: () => void;
}

export default function TabOverview({ project, onRefresh }: TabOverviewProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [showPass2, setShowPass2] = React.useState(false);
  const [showPass3, setShowPass3] = React.useState(false);
  const { currentRole, encryptionKey } = useSettingsStore();
  const colorInputRef = React.useRef<HTMLInputElement>(null);

  // Live query related stats
  const urlCount = useLiveQuery(() => db.urls.where('projectId').equals(project.id).count()) || 0;
  const credCount = useLiveQuery(() => db.credentials.where('projectId').equals(project.id).count()) || 0;
  const dbCount = useLiveQuery(() => db.databases.where('projectId').equals(project.id).count()) || 0;
  const fileCount = useLiveQuery(() => db.attachments.where('projectId').equals(project.id).count()) || 0;

  const stats = [
    { label: 'URLs', value: urlCount, icon: LinkIcon, color: 'text-indigo-400' },
    { label: 'Credentials', value: credCount, icon: KeyRound, color: 'text-emerald-400' },
    { label: 'Database', value: dbCount, icon: Database, color: 'text-amber-400' },
    { label: 'Attachments', value: fileCount, icon: Paperclip, color: 'text-blue-400' }
  ];


  const handleCopy = (text?: string, label = 'Text') => {
    if (!text) return;
    if (currentRole === 'viewer' && label.toLowerCase().includes('password')) {
      toast.error('Permission Denied: Viewers cannot copy credentials passwords');
      return;
    }
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const getStatusIcon = (status: Project['status']) => {
    switch (status) {
      case 'development': return <Play className="w-3.5 h-3.5 text-zinc-400" />;
      case 'testing': return <Wrench className="w-3.5 h-3.5 text-amber-400" />;
      case 'staging': return <CheckCircle className="w-3.5 h-3.5 text-blue-400 animate-pulse" />;
      case 'production': return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
      case 'archived': return <Archive className="w-3.5 h-3.5 text-zinc-500" />;
    }
  };

  // Safe checks for array properties
  const docsList = project.docsUrls || [];
  const figmaList = project.figmaUrls || [];

  return (
    <div className="space-y-6">
      {/* Top Banner Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Launchpad Quick Assets */}
        <div className="md:col-span-2 bg-zinc-900/10 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-5.5 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-900 pb-3">
            <div className="flex items-center gap-2">
              <LayoutTemplate className="w-4 h-4 text-emerald-500" />
              <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Primary Assets Launchpad</h3>
            </div>
            <button
              onClick={() => setDialogOpen(true)}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-250 hover:bg-zinc-100 dark:hover:bg-zinc-850 px-2.5 py-1.5 rounded transition cursor-pointer border border-zinc-250 dark:border-zinc-800"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit Assets
            </button>
          </div>

          <div className="space-y-3.5 pt-1 overflow-y-auto max-h-[280px] pr-1.5 scrollbar-thin">
            {/* Docs Links */}
            {docsList.map((url, index) => (
              <div key={`doc-${index}`} className="flex items-center justify-between gap-4 p-2.5 rounded-lg bg-zinc-100/50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900">
                <div className="min-w-0">
                  <span className="text-[10px] font-black text-zinc-450 dark:text-zinc-500 uppercase block tracking-wider">Docs Link {docsList.length > 1 ? `#${index + 1}` : ''}</span>
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate block mt-0.5 select-all">
                    {url || <span className="text-zinc-450 dark:text-zinc-650 font-normal italic">Empty URL link</span>}
                  </span>
                </div>
                {url && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button 
                      onClick={() => handleCopy(url, 'Docs Link')}
                      className="p-1.5 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition cursor-pointer"
                      title="Copy Link"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <a 
                      href={url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-1.5 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition"
                      title="Launch Docs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>
            ))}
            {docsList.length === 0 && (
              <div className="text-[10px] text-zinc-400 dark:text-zinc-500 italic p-1 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg text-center">No docs links configured.</div>
            )}

            {/* Figma URLs */}
            {figmaList.map((url, index) => (
              <div key={`figma-${index}`} className="flex items-center justify-between gap-4 p-2.5 rounded-lg bg-zinc-100/50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900">
                <div className="min-w-0">
                  <span className="text-[10px] font-black text-zinc-450 dark:text-zinc-500 uppercase block tracking-wider">Figma Design {figmaList.length > 1 ? `#${index + 1}` : ''}</span>
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate block mt-0.5 select-all">
                    {url || <span className="text-zinc-450 dark:text-zinc-650 font-normal italic">Empty URL link</span>}
                  </span>
                </div>
                {url && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button 
                      onClick={() => handleCopy(url, 'Figma Link')}
                      className="p-1.5 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition cursor-pointer"
                      title="Copy Link"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <a 
                      href={url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-1.5 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition"
                      title="Launch Figma"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>
            ))}
            {figmaList.length === 0 && (
              <div className="text-[10px] text-zinc-400 dark:text-zinc-500 italic p-1 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg text-center">No Figma mockup links configured.</div>
            )}
          </div>
        </div>

        {/* Metadata Card */}
        <div className="bg-zinc-900/10 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-5.5 space-y-4 flex flex-col justify-between">
          <h3 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Metadata</h3>
          
          <div className="space-y-3.5 my-auto">
            {project.aka && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500 font-semibold flex items-center gap-1.5">
                  <Fingerprint className="w-4 h-4 text-emerald-500" /> AKA
                </span>
                <span className="text-zinc-700 dark:text-zinc-350 font-bold select-all">{project.aka}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500 font-semibold flex items-center gap-1.5">
                {getStatusIcon(project.status)} Status
              </span>
              <span className="text-zinc-750 dark:text-zinc-250 capitalize font-bold bg-zinc-200 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-850 px-2 py-0.5 rounded text-[10px]">
                {project.status}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500 font-semibold flex items-center gap-1.5">
                <Calendar className="w-4 h-4" /> Created
              </span>
              <span className="text-zinc-700 dark:text-zinc-400 font-medium">{formatDate(project.createdAt).split(',')[0]}</span>
            </div>
          </div>

          <div className="border-t border-zinc-200 dark:border-zinc-900 pt-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
              <span>Color Index:</span>
              <span 
                className="w-3.5 h-3.5 rounded-full border border-zinc-350 dark:border-white/10 cursor-pointer hover:scale-105 transition-transform" 
                style={{ backgroundColor: project.color }} 
                onClick={() => colorInputRef.current?.click()}
                title="Choose color"
              />
              <span className="font-mono text-zinc-700 dark:text-zinc-300">{project.color}</span>
            </div>

            <input 
              type="color" 
              ref={colorInputRef}
              value={project.color || '#10b981'}
              onChange={async (e) => {
                const newColor = e.target.value;
                try {
                  await ProjectRepository.update(project.id, { color: newColor }, encryptionKey);
                  onRefresh();
                  toast.success('Project color updated successfully!');
                } catch {
                  toast.error('Failed to update color');
                }
              }}
              className="hidden"
            />

            <button
              onClick={() => colorInputRef.current?.click()}
              className="text-[10px] font-bold text-emerald-500 hover:text-emerald-400 cursor-pointer transition uppercase"
            >
              Edit
            </button>
          </div>
        </div>
      </div>

      {/* Deployment Environments Credentials Rows */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* v2.0 Deployment */}
        <div className="bg-zinc-900/10 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-5.5 space-y-4">
          <h3 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-900 pb-2">v2.0 Deployment Environment</h3>
          
          <div className="space-y-3 text-xs">
            {/* 2.0 Site URL */}
            <div className="flex items-center justify-between bg-zinc-100/50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 p-2.5 rounded-lg">
              <div className="min-w-0">
                <span className="text-[9px] text-zinc-500 uppercase font-black tracking-wide">Environment URL</span>
                <span className="block font-bold text-zinc-800 dark:text-zinc-200 truncate mt-0.5">
                  {project.url2 || <span className="font-normal italic text-zinc-400 dark:text-zinc-650">Not deployed</span>}
                </span>
              </div>
              {project.url2 && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <button 
                    onClick={() => handleCopy(project.url2, '2.0 URL')}
                    className="p-1 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-900 rounded cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <a 
                    href={project.url2} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-1 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-900 rounded"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>

            {/* 2.0 Dashboard URL */}
            <div className="flex items-center justify-between bg-zinc-100/50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 p-2.5 rounded-lg">
              <div className="min-w-0">
                <span className="text-[9px] text-zinc-500 uppercase font-black tracking-wide">Dashboard URL</span>
                <span className="block font-bold text-zinc-800 dark:text-zinc-200 truncate mt-0.5">
                  {project.dashboardUrl2 || <span className="font-normal italic text-zinc-400 dark:text-zinc-650">Not configured</span>}
                </span>
              </div>
              {project.dashboardUrl2 && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <button 
                    onClick={() => handleCopy(project.dashboardUrl2, '2.0 Dashboard URL')}
                    className="p-1 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-900 rounded cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <a 
                    href={project.dashboardUrl2} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-1 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-900 rounded"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="bg-zinc-100/50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 p-2 rounded-lg relative group">
                <span className="text-[9px] text-zinc-500 uppercase font-black tracking-wide block">Username / Email</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200 block mt-0.5 truncate select-all">
                  {project.cred2Username || '—'}
                </span>
                {project.cred2Username && (
                  <button
                    onClick={() => handleCopy(project.cred2Username, '2.0 Username')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 opacity-0 group-hover:opacity-100 transition rounded hover:bg-zinc-200 dark:hover:bg-zinc-900 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="bg-zinc-100/50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 p-2 rounded-lg relative group">
                <span className="text-[9px] text-zinc-500 uppercase font-black tracking-wide block">Password</span>
                <div className="flex items-center justify-between gap-1.5 mt-0.5">
                  <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 block truncate">
                    {currentRole === 'viewer' 
                      ? '••••••••' 
                      : showPass2 
                        ? (project.cred2Password || '—') 
                        : (project.cred2Password ? '••••••••' : '—')}
                  </span>
                  {project.cred2Password && currentRole !== 'viewer' && (
                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition absolute right-2 top-1/2 -translate-y-1/2 bg-zinc-100 dark:bg-zinc-950 pl-2">
                      <button
                        onClick={() => setShowPass2(!showPass2)}
                        className="p-1 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 rounded hover:bg-zinc-200 dark:hover:bg-zinc-900 cursor-pointer"
                        title={showPass2 ? 'Hide Password' : 'Show Password'}
                      >
                        {showPass2 ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                      <button
                        onClick={() => handleCopy(project.cred2Password, '2.0 Password')}
                        className="p-1 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 rounded hover:bg-zinc-200 dark:hover:bg-zinc-900 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* v3.0 Deployment */}
        <div className="bg-zinc-900/10 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-5.5 space-y-4">
          <h3 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-900 pb-2">v3.0 Deployment Environment</h3>
          
          <div className="space-y-3 text-xs">
            {/* 3.0 Site URL */}
            <div className="flex items-center justify-between bg-zinc-100/50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 p-2.5 rounded-lg">
              <div className="min-w-0">
                <span className="text-[9px] text-zinc-500 uppercase font-black tracking-wide">Environment URL</span>
                <span className="block font-bold text-zinc-800 dark:text-zinc-200 truncate mt-0.5">
                  {project.url3 || <span className="font-normal italic text-zinc-400 dark:text-zinc-650">Not deployed</span>}
                </span>
              </div>
              {project.url3 && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <button 
                    onClick={() => handleCopy(project.url3, '3.0 URL')}
                    className="p-1 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-900 rounded cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <a 
                    href={project.url3} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-1 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-900 rounded"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>

            {/* 3.0 Dashboard URL */}
            <div className="flex items-center justify-between bg-zinc-100/50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 p-2.5 rounded-lg">
              <div className="min-w-0">
                <span className="text-[9px] text-zinc-500 uppercase font-black tracking-wide">Dashboard URL</span>
                <span className="block font-bold text-zinc-800 dark:text-zinc-200 truncate mt-0.5">
                  {project.dashboardUrl3 || <span className="font-normal italic text-zinc-400 dark:text-zinc-650">Not configured</span>}
                </span>
              </div>
              {project.dashboardUrl3 && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <button 
                    onClick={() => handleCopy(project.dashboardUrl3, '3.0 Dashboard URL')}
                    className="p-1 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-900 rounded cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <a 
                    href={project.dashboardUrl3} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-1 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-900 rounded"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="bg-zinc-100/50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 p-2 rounded-lg relative group">
                <span className="text-[9px] text-zinc-500 uppercase font-black tracking-wide block">Username / Email</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200 block mt-0.5 truncate select-all">
                  {project.cred3Username || '—'}
                </span>
                {project.cred3Username && (
                  <button
                    onClick={() => handleCopy(project.cred3Username, '3.0 Username')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 opacity-0 group-hover:opacity-100 transition rounded hover:bg-zinc-200 dark:hover:bg-zinc-900 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="bg-zinc-100/50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 p-2 rounded-lg relative group">
                <span className="text-[9px] text-zinc-500 uppercase font-black tracking-wide block">Password</span>
                <div className="flex items-center justify-between gap-1.5 mt-0.5">
                  <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 block truncate">
                    {currentRole === 'viewer' 
                      ? '••••••••' 
                      : showPass3 
                        ? (project.cred3Password || '—') 
                        : (project.cred3Password ? '••••••••' : '—')}
                  </span>
                  {project.cred3Password && currentRole !== 'viewer' && (
                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition absolute right-2 top-1/2 -translate-y-1/2 bg-zinc-100 dark:bg-zinc-950 pl-2">
                      <button
                        onClick={() => setShowPass3(!showPass3)}
                        className="p-1 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 rounded hover:bg-zinc-200 dark:hover:bg-zinc-900 cursor-pointer"
                        title={showPass3 ? 'Hide Password' : 'Show Password'}
                      >
                        {showPass3 ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                      <button
                        onClick={() => handleCopy(project.cred3Password, '3.0 Password')}
                        className="p-1 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 rounded hover:bg-zinc-200 dark:hover:bg-zinc-900 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-zinc-900/10 border border-zinc-250 dark:border-zinc-800 p-4.5 flex items-center justify-between rounded-xl">
            <div>
              <span className="text-[10px] font-bold text-zinc-500 tracking-wider uppercase block">{stat.label}</span>
              <span className="text-2xl font-black text-zinc-700 dark:text-zinc-200 mt-1 block">{stat.value}</span>
            </div>
            <div className={`p-2.5 bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-zinc-250 dark:border-zinc-850 ${stat.color}`}>
              <stat.icon className="w-4.5 h-4.5" />
            </div>
          </div>
        ))}
      </div>

      <ProjectDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={onRefresh}
        editingProject={project}
      />
    </div>
  );
}
