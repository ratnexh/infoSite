'use client';

import React, { useState, useRef, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Folder, 
  Loader2, 
  Plus, 
  Copy, 
  ExternalLink, 
  Eye, 
  EyeOff, 
  Globe, 
  ChevronDown, 
  ChevronRight,
  User,
  Lock
} from 'lucide-react';
import { ProjectRepository } from '@/lib/storage/repositories';
import { useSettingsStore } from '@/store/settings-store';
import { Project, ProjectStatus } from '@/types';
import { toast } from 'sonner';
import { detectUrlLabel } from '@/lib/url-detect';

const projectSchema = z.object({
  name: z.string().min(1, 'Project Name is required').max(100),
  aka: z.string().max(100),
  status: z.enum(['development', 'testing', 'staging', 'production', 'archived']),
  color: z.string().min(4).max(7),
  docsUrls: z.array(z.string().url()),
  figmaUrls: z.array(z.string().url()),
  url2: z.string().url('Please enter a valid URL').or(z.string().length(0)),
  dashboardUrl2: z.string().url('Please enter a valid URL').or(z.string().length(0)),
  cred2Username: z.string().max(100),
  cred2Password: z.string(),
  url3: z.string().url('Please enter a valid URL').or(z.string().length(0)),
  dashboardUrl3: z.string().url('Please enter a valid URL').or(z.string().length(0)),
  cred3Username: z.string().max(100),
  cred3Password: z.string()
});

type ProjectFormValues = z.infer<typeof projectSchema>;

interface ProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingProject?: Project | null;
}

export default function ProjectDialog({ isOpen, onClose, onSuccess, editingProject }: ProjectDialogProps) {
  const isEditing = !!editingProject;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { encryptionKey } = useSettingsStore();
  const colorPickerRef = useRef<HTMLInputElement>(null);

  // Card collapse states
  const [prodExpanded, setProdExpanded] = useState(true);
  const [stagingExpanded, setStagingExpanded] = useState(false);

  // Link input states
  const [docInput, setDocInput] = useState('');
  const [figmaInput, setFigmaInput] = useState('');

  // Password visibility states
  const [showPass2, setShowPass2] = useState(false);
  const [showPass3, setShowPass3] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors }
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: '',
      aka: '',
      status: 'development',
      color: '#10b981',
      docsUrls: [],
      figmaUrls: [],
      url2: '',
      dashboardUrl2: '',
      cred2Username: '',
      cred2Password: '',
      url3: '',
      dashboardUrl3: '',
      cred3Username: '',
      cred3Password: ''
    }
  });

  const selectedColor = watch('color') || '#10b981';
  const selectedStatus = watch('status') || 'development';
  const docsUrls = watch('docsUrls') || [];
  const figmaUrls = watch('figmaUrls') || [];
  const projectName = watch('name');

  const isFormValid = projectName?.trim().length > 0;

  const lastEditingIdRef = React.useRef<string | undefined | null>(undefined);

  React.useEffect(() => {
    if (isOpen) {
      const currentEditingId = editingProject?.id || null;
      if (lastEditingIdRef.current !== currentEditingId) {
        lastEditingIdRef.current = currentEditingId;
        reset({
          name: editingProject?.name || '',
          aka: editingProject?.aka || '',
          status: editingProject?.status || 'development',
          color: editingProject?.color || '#10b981',
          docsUrls: editingProject?.docsUrls || [],
          figmaUrls: editingProject?.figmaUrls || [],
          url2: editingProject?.url2 || '',
          dashboardUrl2: editingProject?.dashboardUrl2 || '',
          cred2Username: editingProject?.cred2Username || '',
          cred2Password: editingProject?.cred2Password || '',
          url3: editingProject?.url3 || '',
          dashboardUrl3: editingProject?.dashboardUrl3 || '',
          cred3Username: editingProject?.cred3Username || '',
          cred3Password: editingProject?.cred3Password || ''
        });
        setDocInput('');
        setFigmaInput('');
        setProdExpanded(true);
        setStagingExpanded(false);
      }
    }
  }, [isOpen, editingProject, reset]);

  const handleAddDoc = () => {
    if (!docInput.trim()) return;
    try {
      new URL(docInput.trim());
      setValue('docsUrls', [...docsUrls, docInput.trim()]);
      setDocInput('');
    } catch {
      toast.error('Invalid URL format. Please include https://');
    }
  };

  const handleAddFigma = () => {
    if (!figmaInput.trim()) return;
    try {
      new URL(figmaInput.trim());
      setValue('figmaUrls', [...figmaUrls, figmaInput.trim()]);
      setFigmaInput('');
    } catch {
      toast.error('Invalid URL format. Please include https://');
    }
  };

  const onSubmit = async (values: ProjectFormValues) => {
    setIsSubmitting(true);
    try {
      const projectData = {
        name: values.name,
        aka: values.aka,
        status: values.status,
        color: values.color,
        docsUrls: values.docsUrls,
        figmaUrls: values.figmaUrls,
        url2: values.url2,
        dashboardUrl2: values.dashboardUrl2,
        cred2Username: values.cred2Username,
        cred2Password: values.cred2Password,
        url3: values.url3,
        dashboardUrl3: values.dashboardUrl3,
        cred3Username: values.cred3Username,
        cred3Password: values.cred3Password
      };

      if (isEditing && editingProject) {
        await ProjectRepository.update(editingProject.id, projectData, encryptionKey);
        toast.success(`Project "${values.name}" updated successfully`);
      } else {
        await ProjectRepository.create(projectData, encryptionKey);
        toast.success(`Project "${values.name}" created successfully`);
      }
      lastEditingIdRef.current = undefined;
      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status pills configuration
  const statusOptions: { value: ProjectStatus; label: string }[] = [
    { value: 'development', label: 'Development' },
    { value: 'testing', label: 'Testing' },
    { value: 'staging', label: 'Staging' },
    { value: 'production', label: 'Production' },
    { value: 'archived', label: 'Archived' }
  ];

  // Embedded URL Input component
  const PremiumUrlInput = ({ 
    label, 
    value, 
    onChange, 
    placeholder,
    error 
  }: { 
    label: string; 
    value: string; 
    onChange: (val: string) => void; 
    placeholder: string;
    error?: string;
  }) => {
    const faviconUrl = useMemo(() => {
      if (!value) return null;
      try {
        const parsed = new URL(value);
        return `https://www.google.com/s2/favicons?sz=64&domain=${parsed.hostname}`;
      } catch {
        return null;
      }
    }, [value]);

    const isValidUrl = useMemo(() => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    }, [value]);

    const handleCopy = () => {
      if (!value) return;
      navigator.clipboard.writeText(value);
      toast.success('URL copied to clipboard');
    };

    return (
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{label}</label>
        <div className="relative flex items-center">
          <div className="absolute left-3 flex items-center justify-center pointer-events-none">
            {faviconUrl ? (
              <img 
                src={faviconUrl} 
                alt="" 
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} 
                className="w-4 h-4 rounded-sm object-contain"
              />
            ) : (
              <Globe className="w-4 h-4 text-zinc-500" />
            )}
          </div>

          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-20 py-2 text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition font-mono"
            placeholder={placeholder}
          />

          {isValidUrl && (
            <div className="absolute right-2.5 flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopy}
                className="p-1 hover:bg-zinc-850 rounded text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
                title="Copy URL"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 hover:bg-zinc-850 rounded text-zinc-400 hover:text-zinc-200 transition"
                title="Open link"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
        {error && <span className="text-[10px] text-red-400 font-medium">{error}</span>}
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 overflow-y-auto scrollbar-thin">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.div 
            initial={{ opacity: 0, scale: 0.98, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 15 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-4xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-2xl relative z-10 my-8 flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4.5 bg-zinc-900/50">
              <div className="flex items-center gap-2">
                <Folder className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-base text-zinc-50">
                  {isEditing ? 'Edit Project Config' : 'Create New Project'}
                </h3>
              </div>
              <button 
                onClick={onClose}
                className="text-zinc-500 hover:text-zinc-300 p-1.5 rounded hover:bg-zinc-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-6 space-y-6 bg-zinc-900/10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                
                {/* Left Column: Project Info & Assets */}
                <div className="space-y-6">
                  
                  {/* Card 1: Project Information */}
                  <div className="bg-zinc-950/20 border border-zinc-850 p-5 rounded-xl space-y-4">
                    <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider border-b border-zinc-850/60 pb-2">
                      Card 1 — Project Information
                    </h4>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Project Name *</label>
                      <input
                        type="text"
                        {...register('name')}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                        placeholder="e.g. My SaaS Dashboard"
                      />
                      {errors.name && (
                        <span className="text-[10px] text-red-400 font-medium block">{errors.name.message}</span>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">AKA (Alias / Codename)</label>
                      <input
                        type="text"
                        {...register('aka')}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                        placeholder="e.g. Apollo, Phoenix"
                      />
                    </div>

                    {/* Status pills selector */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Status</label>
                      <div className="flex flex-wrap gap-2 pt-0.5">
                        {statusOptions.map((opt) => {
                          const isSelected = selectedStatus === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setValue('status', opt.value)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border cursor-pointer select-none active:scale-[0.97] ${
                                isSelected 
                                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-sm' 
                                  : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Color picker + Badge */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Color Label</label>
                      <div className="flex items-center gap-3 pt-0.5">
                        <input
                          type="color"
                          ref={colorPickerRef}
                          value={selectedColor}
                          onChange={(e) => setValue('color', e.target.value)}
                          className="sr-only"
                        />
                        <button
                          type="button"
                          onClick={() => colorPickerRef.current?.click()}
                          className="w-8 h-8 rounded-full border border-zinc-800 flex items-center justify-center cursor-pointer transition hover:scale-105 active:scale-95 shadow-sm"
                          style={{ backgroundColor: selectedColor }}
                          title="Open Color Picker"
                        />
                        <span className="text-xs font-mono font-bold bg-zinc-950 border border-zinc-850 px-2.5 py-1 rounded-lg text-zinc-300">
                          {selectedColor.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Documentation & Assets */}
                  <div className="bg-zinc-950/20 border border-zinc-850 p-5 rounded-xl space-y-4">
                    <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider border-b border-zinc-850/60 pb-2">
                      Card 2 — Documentation & Assets
                    </h4>

                    {/* Documentation Link tags collector */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Documentation URLs</label>
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          value={docInput}
                          onChange={(e) => setDocInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddDoc(); } }}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-3 pr-10 py-2 text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                          placeholder="Paste any URL — Drive, Docs, Figma, GitHub…"
                        />
                        <button
                          type="button"
                          onClick={handleAddDoc}
                          className="absolute right-2 p-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/20 rounded cursor-pointer transition"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      {/* Detected label preview */}
                      {docInput && (() => { const det = detectUrlLabel(docInput); return det ? (
                        <p className="text-[10px] text-emerald-400 font-medium pl-0.5">
                          Detected: <span className="font-bold">{det.label}</span>
                        </p>
                      ) : null; })()}
                      
                      {/* Chips */}
                      {docsUrls.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1.5">
                          {docsUrls.map((url, idx) => {
                            const det = detectUrlLabel(url);
                            return (
                              <div key={idx} className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-850 pl-2 pr-1.5 py-1 rounded-lg text-[10px] text-zinc-300 max-w-full">
                                {det && (
                                  <span className="font-semibold text-zinc-200 shrink-0">{det.label}</span>
                                )}
                                <span className="truncate max-w-[180px] font-mono text-zinc-500">{url}</span>
                                <button
                                  type="button"
                                  onClick={() => setValue('docsUrls', docsUrls.filter((_, i) => i !== idx))}
                                  className="text-zinc-500 hover:text-zinc-300 p-0.5 rounded cursor-pointer transition shrink-0"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Figma Link tags collector */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Figma Links</label>
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          value={figmaInput}
                          onChange={(e) => setFigmaInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddFigma(); } }}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-3 pr-10 py-2 text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                          placeholder="Paste any design URL — Figma, Miro, Whimsical…"
                        />
                        <button
                          type="button"
                          onClick={handleAddFigma}
                          className="absolute right-2 p-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/20 rounded cursor-pointer transition"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      {/* Detected label preview */}
                      {figmaInput && (() => { const det = detectUrlLabel(figmaInput); return det ? (
                        <p className="text-[10px] text-emerald-400 font-medium pl-0.5">
                          Detected: <span className="font-bold">{det.label}</span>
                        </p>
                      ) : null; })()}
                      
                      {/* Chips */}
                      {figmaUrls.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1.5">
                          {figmaUrls.map((url, idx) => {
                            const det = detectUrlLabel(url);
                            return (
                              <div key={idx} className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-850 pl-2 pr-1.5 py-1 rounded-lg text-[10px] text-zinc-300 max-w-full">
                                {det && (
                                  <span className="font-semibold text-zinc-200 shrink-0">{det.label}</span>
                                )}
                                <span className="truncate max-w-[180px] font-mono text-zinc-500">{url}</span>
                                <button
                                  type="button"
                                  onClick={() => setValue('figmaUrls', figmaUrls.filter((_, i) => i !== idx))}
                                  className="text-zinc-500 hover:text-zinc-300 p-0.5 rounded cursor-pointer transition shrink-0"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column: Deployment Environments (Card 3) */}
                <div className="space-y-4">
                  <div className="bg-zinc-950/20 border border-zinc-850 p-5 rounded-xl space-y-4">
                    <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider border-b border-zinc-850/60 pb-2">
                      Card 3 — Deployment Environments
                    </h4>

                    {/* Production Collapsible Card */}
                    <div className="border border-zinc-800 rounded-xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setProdExpanded(!prodExpanded)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-950/40 hover:bg-zinc-950/60 transition cursor-pointer select-none text-xs font-bold text-zinc-300"
                      >
                        <span className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-emerald-500" />
                          Production (v3)
                        </span>
                        {prodExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>

                      <AnimatePresence initial={false}>
                        {prodExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="p-4 bg-zinc-900/10 border-t border-zinc-850 space-y-4.5"
                          >
                            <PremiumUrlInput
                              label="3.0 URL"
                              value={watch('url3') || ''}
                              onChange={(val) => setValue('url3', val)}
                              placeholder="https://v3.example.com"
                              error={errors.url3?.message}
                            />

                            <PremiumUrlInput
                              label="Dashboard URL"
                              value={watch('dashboardUrl3') || ''}
                              onChange={(val) => setValue('dashboardUrl3', val)}
                              placeholder="https://v3-dashboard.example.com"
                              error={errors.dashboardUrl3?.message}
                            />

                            <div className="border-t border-zinc-850 pt-4 space-y-3">
                              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide block">Credentials</span>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-1"><User className="w-3 h-3" /> Username</label>
                                  <div className="relative flex items-center">
                                    <input
                                      type="text"
                                      {...register('cred3Username')}
                                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-3 pr-10 py-1.5 text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                                      placeholder="admin"
                                    />
                                    {watch('cred3Username') && (
                                      <button
                                        type="button"
                                        onClick={() => { navigator.clipboard.writeText(watch('cred3Username') || ''); toast.success('Username copied'); }}
                                        className="absolute right-2 p-1 text-zinc-500 hover:text-zinc-300 rounded cursor-pointer"
                                        title="Copy Username"
                                      >
                                        <Copy className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-1"><Lock className="w-3 h-3" /> Password</label>
                                  <div className="relative flex items-center">
                                    <input
                                      type={showPass3 ? 'text' : 'password'}
                                      {...register('cred3Password')}
                                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-3 pr-16 py-1.5 text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition font-mono"
                                      placeholder="••••••••"
                                    />
                                    <div className="absolute right-2 flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => setShowPass3(!showPass3)}
                                        className="p-1 text-zinc-500 hover:text-zinc-300 rounded cursor-pointer"
                                        title={showPass3 ? 'Hide Password' : 'Show Password'}
                                      >
                                        {showPass3 ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                      </button>
                                      {watch('cred3Password') && (
                                        <button
                                          type="button"
                                          onClick={() => { navigator.clipboard.writeText(watch('cred3Password') || ''); toast.success('Password copied'); }}
                                          className="p-1 text-zinc-500 hover:text-zinc-300 rounded cursor-pointer"
                                          title="Copy Password"
                                        >
                                          <Copy className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Staging Collapsible Card */}
                    <div className="border border-zinc-800 rounded-xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setStagingExpanded(!stagingExpanded)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-950/40 hover:bg-zinc-950/60 transition cursor-pointer select-none text-xs font-bold text-zinc-300"
                      >
                        <span className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-emerald-500" />
                          Staging (v2)
                        </span>
                        {stagingExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>

                      <AnimatePresence initial={false}>
                        {stagingExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="p-4 bg-zinc-900/10 border-t border-zinc-850 space-y-4.5"
                          >
                            <PremiumUrlInput
                              label="2.0 URL"
                              value={watch('url2') || ''}
                              onChange={(val) => setValue('url2', val)}
                              placeholder="https://v2.example.com"
                              error={errors.url2?.message}
                            />

                            <PremiumUrlInput
                              label="Dashboard URL"
                              value={watch('dashboardUrl2') || ''}
                              onChange={(val) => setValue('dashboardUrl2', val)}
                              placeholder="https://v2-dashboard.example.com"
                              error={errors.dashboardUrl2?.message}
                            />

                            <div className="border-t border-zinc-850 pt-4 space-y-3">
                              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide block">Credentials</span>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-1"><User className="w-3 h-3" /> Username</label>
                                  <div className="relative flex items-center">
                                    <input
                                      type="text"
                                      {...register('cred2Username')}
                                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-3 pr-10 py-1.5 text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                                      placeholder="admin"
                                    />
                                    {watch('cred2Username') && (
                                      <button
                                        type="button"
                                        onClick={() => { navigator.clipboard.writeText(watch('cred2Username') || ''); toast.success('Username copied'); }}
                                        className="absolute right-2 p-1 text-zinc-500 hover:text-zinc-300 rounded cursor-pointer"
                                        title="Copy Username"
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-1"><Lock className="w-3 h-3" /> Password</label>
                                  <div className="relative flex items-center">
                                    <input
                                      type={showPass2 ? 'text' : 'password'}
                                      {...register('cred2Password')}
                                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-3 pr-16 py-1.5 text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition font-mono"
                                      placeholder="••••••••"
                                    />
                                    <div className="absolute right-2 flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => setShowPass2(!showPass2)}
                                        className="p-1 text-zinc-500 hover:text-zinc-300 rounded cursor-pointer"
                                        title={showPass2 ? 'Hide Password' : 'Show Password'}
                                      >
                                        {showPass2 ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                      </button>
                                      {watch('cred2Password') && (
                                        <button
                                          type="button"
                                          onClick={() => { navigator.clipboard.writeText(watch('cred2Password') || ''); toast.success('Password copied'); }}
                                          className="p-1 text-zinc-500 hover:text-zinc-300 rounded cursor-pointer"
                                          title="Copy Password"
                                        >
                                          <Copy className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                  </div>
                </div>

              </div>
            </form>

            {/* Sticky Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-zinc-800 px-6 py-4 bg-zinc-900/50 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold py-2 px-4.5 rounded-lg text-xs cursor-pointer transition select-none"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!isFormValid || isSubmitting}
                onClick={handleSubmit(onSubmit)}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-600/40 disabled:text-emerald-950/60 disabled:cursor-not-allowed text-emerald-950 font-bold py-2 px-5 rounded-lg text-xs cursor-pointer flex items-center gap-1.5 transition active:scale-[0.98] select-none"
              >
                {isSubmitting && <Loader2 className="w-3 h-3 animate-spin text-emerald-950" />}
                {isEditing ? 'Save Configuration' : 'Create Project'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
