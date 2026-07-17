'use client';

import React, { useState } from 'react';
import { Project, Service } from '@/types';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/dexie-db';
import { ServiceRepository } from '@/lib/storage/repositories';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useSettingsStore } from '@/store/settings-store';
import { 
  Puzzle, 
  Plus, 
  X, 
  Trash2, 
  Wrench, 
  Globe, 
  Mail, 
  Info,
  ExternalLink,
  GripVertical
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const serviceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  url: z.string().url('Please enter a valid URL (include http:// or https://)').or(z.string().length(0)),
  email: z.string().max(100),
  notes: z.string().max(500)
});

type ServiceFormValues = z.infer<typeof serviceSchema>;

const PRESET_SERVICES = [
  'Stripe',
  'Firebase',
  'Supabase',
  'AWS',
  'Cloudflare',
  'Vercel',
  'Netlify',
  'Sentry',
  'PostHog',
  'Google Analytics',
  'Google Search Console'
];

export default function TabServices({ project }: { project: Project }) {
  const { currentRole } = useSettingsStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  // Drag-and-drop states
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Live Query services sorted
  const services = useLiveQuery(() => ServiceRepository.getByProjectId(project.id), [project.id]) || [];

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors }
  } = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: 'Stripe',
      url: '',
      email: '',
      notes: ''
    }
  });

  // Load modal open state from localStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const open = localStorage.getItem(`services_modal_open_${project.id}`) === 'true';
      if (open) setModalOpen(true);
    }
  }, [project.id]);

  // Save modal open state to localStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`services_modal_open_${project.id}`, modalOpen ? 'true' : 'false');
    }
  }, [modalOpen, project.id]);

  // Load editing service from localStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedId = localStorage.getItem(`services_editing_id_${project.id}`);
      if (savedId && services.length > 0) {
        const found = services.find(s => s.id === savedId);
        if (found) setEditingService(found);
      }
    }
  }, [services, project.id]);

  // Save editing service ID to localStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      if (editingService) {
        localStorage.setItem(`services_editing_id_${project.id}`, editingService.id);
      } else {
        localStorage.removeItem(`services_editing_id_${project.id}`);
      }
    }
  }, [editingService, project.id]);

  const lastEditingIdRef = React.useRef<string | undefined | null>(undefined);

  React.useEffect(() => {
    if (modalOpen) {
      const currentEditingId = editingService?.id || null;
      if (lastEditingIdRef.current !== currentEditingId) {
        lastEditingIdRef.current = currentEditingId;
        
        let initialData = {
          name: 'Stripe',
          url: '',
          email: '',
          notes: ''
        };

        if (!currentEditingId) {
          const saved = localStorage.getItem(`services_form_draft_${project.id}`);
          if (saved) {
            try {
              initialData = { ...initialData, ...JSON.parse(saved) };
            } catch {}
          }
        } else {
          initialData = {
            name: editingService?.name || 'Stripe',
            url: editingService?.url || '',
            email: editingService?.email || '',
            notes: editingService?.notes || ''
          };
        }
        reset(initialData);
      }
    }
  }, [modalOpen, editingService, reset, project.id]);

  // Persist form changes in real-time
  const formValues = watch();
  React.useEffect(() => {
    if (modalOpen && !editingService && typeof window !== 'undefined') {
      localStorage.setItem(`services_form_draft_${project.id}`, JSON.stringify(formValues));
    }
  }, [formValues, modalOpen, editingService, project.id]);

  const onSubmit = async (values: ServiceFormValues) => {
    try {
      await ServiceRepository.save({
        id: editingService?.id,
        projectId: project.id,
        ...values
      });
      localStorage.removeItem(`services_form_draft_${project.id}`);
      localStorage.removeItem(`services_editing_id_${project.id}`);
      localStorage.removeItem(`services_modal_open_${project.id}`);
      lastEditingIdRef.current = undefined;
      toast.success(editingService ? 'Service updated' : 'Service integration added');
      setModalOpen(false);
      setEditingService(null);
    } catch {
      toast.error('Failed to save service');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Remove this service integration?')) {
      try {
        await ServiceRepository.delete(id, project.id);
        toast.success('Service deleted');
      } catch {
        toast.error('Failed to delete service');
      }
    }
  };

  // Drag Handlers
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
      const draggedItem = services[draggedIndex];
      const targetItem = services[dropIndex];
      if (draggedItem && targetItem) {
        try {
          await ServiceRepository.swap(draggedItem.id, targetItem.id, project.id);
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

  const handleSelectPreset = (name: string) => {
    setValue('name', name);
    const defaults: Record<string, string> = {
      Stripe: 'https://dashboard.stripe.com',
      Vercel: 'https://vercel.com/dashboard',
      Netlify: 'https://app.netlify.com',
      Sentry: 'https://sentry.io',
      Cloudflare: 'https://dash.cloudflare.com',
      Firebase: 'https://console.firebase.google.com',
      Supabase: 'https://supabase.com/dashboard',
      AWS: 'https://console.aws.amazon.com'
    };
    if (defaults[name]) {
      setValue('url', defaults[name]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Integrations & Services</h3>
        <button
          onClick={() => {
            setEditingService(null);
            setModalOpen(true);
          }}
          className="bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 font-semibold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer transition"
        >
          <Plus className="w-3.5 h-3.5 text-emerald-400" />
          Add Integration
        </button>
      </div>

      {services.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {services.map((svc, index) => (
            <div 
              key={svc.id} 
              draggable={currentRole !== 'viewer'}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`bg-zinc-900/10 border p-5 rounded-xl flex flex-col justify-between gap-4 group transition-all duration-200 ${
                currentRole !== 'viewer' ? 'cursor-grab active:cursor-grabbing' : ''
              } ${
                draggedIndex === index ? 'opacity-40 border-dashed border-zinc-700 bg-zinc-950/20' : 
                dragOverIndex === index ? 'border-emerald-500 border-dashed scale-[1.02] shadow-[0_0_15px_rgba(16,185,129,0.15)] bg-emerald-950/5' : 
                'border-zinc-900'
              }`}
            >
              {/* Header block */}
              <div className="flex items-center justify-between border-b border-zinc-900/60 pb-3">
                <h4 className="font-bold text-sm text-zinc-250 flex items-center gap-1.5 capitalize">
                  {currentRole !== 'viewer' && (
                    <GripVertical className="w-3.5 h-3.5 text-zinc-600 shrink-0 select-none cursor-grab active:cursor-grabbing" />
                  )}
                  <Puzzle className="w-4 h-4 text-emerald-400" />
                  {svc.name}
                </h4>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {currentRole !== 'viewer' && (
                    <>
                      <button
                        onClick={() => {
                          setEditingService(svc);
                          setModalOpen(true);
                        }}
                        className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 rounded transition cursor-pointer"
                        title="Edit Service"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(svc.id)}
                        className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-950/20 rounded transition cursor-pointer"
                        title="Delete Service"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Body details */}
              <div className="space-y-2 text-xs">
                {svc.url && (
                  <div className="flex items-center justify-between group/row">
                    <span className="text-zinc-500 font-semibold flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-indigo-400 animate-pulse" /> Console URL
                    </span>
                    <a
                      href={svc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-500 hover:underline flex items-center gap-1 font-mono truncate max-w-[65%]"
                    >
                      {svc.url}
                      <ExternalLink className="w-3 h-3 text-emerald-500 inline-block" />
                    </a>
                  </div>
                )}

                {svc.email && (
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 font-semibold flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-indigo-400 animate-pulse" /> Email / Owner
                    </span>
                    <span className="text-zinc-350 select-all">{svc.email}</span>
                  </div>
                )}
              </div>

              {/* Notes if present */}
              {svc.notes && (
                <div className="border-t border-zinc-900/60 pt-3 mt-1 flex items-start gap-1.5 text-[11px] text-zinc-500 font-medium">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <p className="line-clamp-2">{svc.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-zinc-900/10 border border-zinc-900 border-dashed rounded-xl p-12 text-center text-zinc-500 text-xs">
          No services/integrations recorded.
        </div>
      )}

      {/* Dialog Modaler */}
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
              className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-2xl relative z-10 p-6"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
                <h4 className="font-bold text-zinc-100 flex items-center gap-1.5 text-sm">
                  <Puzzle className="w-4.5 h-4.5 text-emerald-500" />
                  {editingService ? 'Edit Integration Settings' : 'Add Integration Settings'}
                </h4>
                <button onClick={() => setModalOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Presets */}
              {!editingService && (
                <div className="mb-4">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide block mb-1.5">Quick Presets</span>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_SERVICES.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handleSelectPreset(p)}
                        className="bg-zinc-950 border border-zinc-850 hover:border-zinc-700 text-zinc-300 text-[10px] py-1 px-2.5 rounded-lg cursor-pointer transition active:scale-[0.98]"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Service Name *</label>
                    <input
                      type="text"
                      {...register('name')}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                      placeholder="Stripe, Firebase, Sentry"
                    />
                    {errors.name && <span className="text-[10px] text-red-400">{errors.name.message}</span>}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Registered Email / Owner</label>
                    <input
                      type="text"
                      {...register('email')}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                      placeholder="owner@example.com"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Console Link / Dashboard URL</label>
                  <input
                    type="text"
                    {...register('url')}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition font-mono"
                    placeholder="https://console.example.com"
                  />
                  {errors.url && <span className="text-[10px] text-red-400">{errors.url.message}</span>}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Integration Notes / API Keys info</label>
                  <textarea
                    {...register('notes')}
                    rows={3}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition resize-none"
                    placeholder="Enter any usage details, payment modes, linked cards info, etc..."
                  />
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
                    {editingService ? 'Save Changes' : 'Create Integration'}
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
