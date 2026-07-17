'use client';

import React, { useState } from 'react';
import { Project, ProjectUrl, UrlCategory } from '@/types';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/dexie-db';
import { UrlRepository } from '@/lib/storage/repositories';
import { useSettingsStore } from '@/store/settings-store';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Link as LinkIcon, 
  Plus, 
  X, 
  Copy, 
  ExternalLink, 
  Trash2, 
  Globe, 
  Wrench,
  GripVertical
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { detectUrlLabel } from '@/lib/url-detect';
import { useConfirmStore } from '@/store/confirm-store';

const urlSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  url: z.string().url('Please enter a valid URL (include http:// or https://)'),
  category: z.enum([
    'development', 'staging', 'production', 'documentation', 
    'api', 'cms', 'repository', 'design', 'analytics', 'monitoring', 'other'
  ])
});

type UrlFormValues = z.infer<typeof urlSchema>;

const CATEGORY_LABELS: Record<UrlCategory, string> = {
  production: 'Production Site',
  staging: 'Staging Environment',
  development: 'Dev Environment',
  documentation: 'Documentation',
  api: 'API docs',
  cms: 'Content Manager (CMS)',
  repository: 'Repository (GitHub/GitLab)',
  design: 'Figma / Design Files',
  analytics: 'Analytics Portal',
  monitoring: 'Monitoring / Alerts',
  other: 'Other Resource'
};

export default function TabUrls({ project }: { project: Project }) {
  const { currentRole } = useSettingsStore();
  const { showConfirm } = useConfirmStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUrl, setEditingUrl] = useState<ProjectUrl | null>(null);

  // Drag and drop states
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Live Query URLs
  const urls = useLiveQuery(() => UrlRepository.getByProjectId(project.id), [project.id]) || [];

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors }
  } = useForm<UrlFormValues>({
    resolver: zodResolver(urlSchema),
    defaultValues: {
      title: '',
      url: '',
      category: 'production'
    }
  });

  const watchedUrl = watch('url');

  // Load modal open state from localStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const open = localStorage.getItem(`urls_modal_open_${project.id}`) === 'true';
      if (open) setModalOpen(true);
    }
  }, [project.id]);

  // Save modal open state to localStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`urls_modal_open_${project.id}`, modalOpen ? 'true' : 'false');
    }
  }, [modalOpen, project.id]);

  // Load editing URL from localStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedId = localStorage.getItem(`urls_editing_id_${project.id}`);
      if (savedId && urls.length > 0) {
        const found = urls.find(u => u.id === savedId);
        if (found) setEditingUrl(found);
      }
    }
  }, [urls, project.id]);

  // Save editing URL ID to localStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      if (editingUrl) {
        localStorage.setItem(`urls_editing_id_${project.id}`, editingUrl.id);
      } else {
        localStorage.removeItem(`urls_editing_id_${project.id}`);
      }
    }
  }, [editingUrl, project.id]);

  const lastEditingIdRef = React.useRef<string | undefined | null>(undefined);

  React.useEffect(() => {
    if (modalOpen) {
      const currentEditingId = editingUrl?.id || null;
      if (lastEditingIdRef.current !== currentEditingId) {
        lastEditingIdRef.current = currentEditingId;
        
        let initialData: UrlFormValues = {
          title: '',
          url: '',
          category: 'production'
        };

        if (!currentEditingId) {
          const saved = localStorage.getItem(`urls_form_draft_${project.id}`);
          if (saved) {
            try {
              initialData = { ...initialData, ...JSON.parse(saved) };
            } catch {}
          }
        } else {
          initialData = {
            title: editingUrl?.title || '',
            url: editingUrl?.url || '',
            category: editingUrl?.category || 'production'
          };
        }
        reset(initialData);
      }
    }
  }, [modalOpen, editingUrl, reset, project.id]);

  // Persist form changes in real-time
  const formValues = watch();
  React.useEffect(() => {
    if (modalOpen && !editingUrl && typeof window !== 'undefined') {
      localStorage.setItem(`urls_form_draft_${project.id}`, JSON.stringify(formValues));
    }
  }, [formValues, modalOpen, editingUrl, project.id]);

  // Auto-detect title and category from URL
  React.useEffect(() => {
    if (!watchedUrl || editingUrl) return;
    const det = detectUrlLabel(watchedUrl);
    if (det) {
      setValue('title', det.label);
      // Map detected category to the form's category enum
      const catMap: Record<string, UrlFormValues['category']> = {
        'documentation': 'documentation',
        'design': 'design',
        'dev-environment': 'development',
        'dashboard': 'monitoring',
        'other-resource': 'other',
      };
      setValue('category', catMap[det.category] ?? 'other');
    }
  }, [watchedUrl, editingUrl, setValue]);

  const handleCopy = (urlText: string) => {
    navigator.clipboard.writeText(urlText);
    toast.success('Copied URL to clipboard');
  };

  const onSubmit = async (values: UrlFormValues) => {
    try {
      await UrlRepository.save({
        id: editingUrl?.id,
        projectId: project.id,
        ...values
      });
      localStorage.removeItem(`urls_form_draft_${project.id}`);
      localStorage.removeItem(`urls_editing_id_${project.id}`);
      localStorage.removeItem(`urls_modal_open_${project.id}`);
      lastEditingIdRef.current = undefined;
      toast.success(editingUrl ? 'URL updated' : 'URL added');
      setModalOpen(false);
      setEditingUrl(null);
    } catch {
      toast.error('Failed to save URL');
    }
  };

  const handleDelete = async (id: string) => {
    showConfirm({
      title: 'Delete URL',
      message: 'Are you sure you want to delete this URL? This action is permanent.',
      confirmLabel: 'Delete',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await UrlRepository.delete(id, project.id);
          toast.success('URL deleted');
        } catch {
          toast.error('Failed to delete URL');
        }
      }
    });
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      const draggedItem = urls[draggedIndex];
      const targetItem = urls[dropIndex];
      if (draggedItem && targetItem) {
        try {
          await UrlRepository.swap(draggedItem.id, targetItem.id, project.id);
        } catch {
          toast.error('Failed to swap positions');
        }
      }
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Associated Project Links</h3>
        <button
          onClick={() => {
            setEditingUrl(null);
            setModalOpen(true);
          }}
          className="bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 font-semibold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer transition"
        >
          <Plus className="w-3.5 h-3.5 text-emerald-400" />
          Add URL
        </button>
      </div>

      {urls.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {urls.map((urlItem, index) => (
            <div 
              key={urlItem.id} 
              draggable={currentRole !== 'viewer'}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`bg-zinc-900/10 border p-4.5 rounded-xl flex items-center justify-between gap-4 group transition-all duration-200 ${
                currentRole !== 'viewer' ? 'cursor-grab active:cursor-grabbing' : ''
              } ${
                draggedIndex === index ? 'opacity-40 border-dashed border-zinc-700 bg-zinc-950/20' : 
                dragOverIndex === index ? 'border-emerald-500 border-dashed scale-[1.02] shadow-[0_0_15px_rgba(16,185,129,0.15)] bg-emerald-950/5' : 
                'border-zinc-900'
              }`}
            >
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {currentRole !== 'viewer' && (
                    <GripVertical className="w-3.5 h-3.5 text-zinc-600 shrink-0 select-none cursor-grab active:cursor-grabbing" />
                  )}
                  <Globe className="w-4 h-4 text-indigo-400 shrink-0" />
                  <h4 className="font-bold text-xs text-zinc-200 truncate">{urlItem.title}</h4>
                  <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider bg-zinc-950 border border-zinc-850 px-1.5 py-0.5 rounded shrink-0">
                    {CATEGORY_LABELS[urlItem.category]}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 truncate hover:text-zinc-400 select-all font-mono pl-5.5">
                  {urlItem.url}
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleCopy(urlItem.url)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 rounded transition cursor-pointer"
                  title="Copy URL"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <a
                  href={urlItem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 rounded transition flex items-center justify-center"
                  title="Open Link"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                {currentRole !== 'viewer' && (
                  <>
                    <button
                      onClick={() => {
                        setEditingUrl(urlItem);
                        setModalOpen(true);
                      }}
                      className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 rounded transition cursor-pointer"
                      title="Edit"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(urlItem.id)}
                      className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-950/20 rounded transition cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-zinc-900/10 border border-zinc-900 border-dashed rounded-xl p-12 text-center text-zinc-500 text-xs">
          No URLs recorded for this project yet.
        </div>
      )}

      {/* URL Modaler Setup */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-2xl relative z-10 p-6"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
                <h4 className="font-bold text-zinc-100 flex items-center gap-1.5 text-sm">
                  <LinkIcon className="w-4.5 h-4.5 text-emerald-500" />
                  {editingUrl ? 'Edit Associated URL' : 'Add Associated URL'}
                </h4>
                <button onClick={() => setModalOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Link Title</label>
                  <input
                    type="text"
                    {...register('title')}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                    placeholder="e.g. Repository, Production UI"
                  />
                  {errors.title && <span className="text-[10px] text-red-400">{errors.title.message}</span>}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">URL Link</label>
                  <input
                    type="text"
                    {...register('url')}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition font-mono"
                    placeholder="https://example.com"
                  />
                  {errors.url && <span className="text-[10px] text-red-400">{errors.url.message}</span>}
                  {!editingUrl && watchedUrl && (() => { const det = detectUrlLabel(watchedUrl); return det ? (
                    <p className="text-[10px] text-emerald-400 font-medium">
                      Detected: <span className="font-bold">{det.label}</span> — title and category auto-filled
                    </p>
                  ) : null; })()}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Category</label>
                  <select
                    {...register('category')}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                  >
                    <option value="production">Production Site</option>
                    <option value="staging">Staging Environment</option>
                    <option value="development">Dev Environment</option>
                    <option value="documentation">Documentation</option>
                    <option value="api">API docs</option>
                    <option value="cms">Content Manager (CMS)</option>
                    <option value="repository">Repository (GitHub/GitLab)</option>
                    <option value="design">Figma / Design Files</option>
                    <option value="analytics">Analytics Portal</option>
                    <option value="monitoring">Monitoring / Alerts</option>
                    <option value="other">Other Resource</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-zinc-800 pt-4 mt-6">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="bg-zinc-850 hover:bg-zinc-800 text-zinc-300 font-semibold py-2 px-4 rounded-lg text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold py-2 px-4 rounded-lg text-xs cursor-pointer"
                  >
                    {editingUrl ? 'Save Changes' : 'Add URL'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
