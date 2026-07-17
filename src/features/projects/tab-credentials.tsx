'use client';

import React, { useState } from 'react';
import { Project, Credential } from '@/types';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/dexie-db';
import { CredentialRepository, ActivityRepository } from '@/lib/storage/repositories';
import { useSettingsStore } from '@/store/settings-store';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  KeyRound, 
  Plus, 
  X, 
  Copy, 
  Eye, 
  EyeOff, 
  Trash2, 
  Wrench, 
  Sparkles,
  Info,
  User,
  Mail,
  Lock,
  Compass,
  GripVertical
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const credSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  username: z.string().max(100),
  email: z.string().max(100),
  password: z.string(),
  apiKey: z.string(),
  secret: z.string(),
  notes: z.string().max(500)
});

type CredFormValues = z.infer<typeof credSchema>;

function generateSecurePassword(length = 16): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=';
  let password = '';
  if (typeof window !== 'undefined' && window.crypto) {
    const randomValues = new Uint8Array(length);
    window.crypto.getRandomValues(randomValues);
    for (let i = 0; i < length; i++) {
      password += charset[randomValues[i] % charset.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }
  }
  return password;
}

export default function TabCredentials({ project }: { project: Project }) {
  const { encryptionKey, currentRole } = useSettingsStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCred, setEditingCred] = useState<Credential | null>(null);

  // Drag states
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({});

  // Live Query credentials sorted
  const creds = useLiveQuery(
    () => CredentialRepository.getByProjectId(project.id, encryptionKey || undefined),
    [project.id, encryptionKey]
  ) || [];

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors }
  } = useForm<CredFormValues>({
    resolver: zodResolver(credSchema),
    defaultValues: {
      title: '',
      username: '',
      email: '',
      password: '',
      apiKey: '',
      secret: '',
      notes: ''
    }
  });

  const formPassword = watch('password');

  // Load modal open state from localStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const open = localStorage.getItem(`credentials_modal_open_${project.id}`) === 'true';
      if (open) setModalOpen(true);
    }
  }, [project.id]);

  // Save modal open state to localStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`credentials_modal_open_${project.id}`, modalOpen ? 'true' : 'false');
    }
  }, [modalOpen, project.id]);

  // Load editing credential from localStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedId = localStorage.getItem(`credentials_editing_id_${project.id}`);
      if (savedId && creds.length > 0) {
        const found = creds.find(c => c.id === savedId);
        if (found) setEditingCred(found);
      }
    }
  }, [creds, project.id]);

  // Save editing credential ID to localStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      if (editingCred) {
        localStorage.setItem(`credentials_editing_id_${project.id}`, editingCred.id);
      } else {
        localStorage.removeItem(`credentials_editing_id_${project.id}`);
      }
    }
  }, [editingCred, project.id]);

  const lastEditingIdRef = React.useRef<string | undefined | null>(undefined);

  React.useEffect(() => {
    if (modalOpen) {
      const currentEditingId = editingCred?.id || null;
      if (lastEditingIdRef.current !== currentEditingId) {
        lastEditingIdRef.current = currentEditingId;
        
        let initialData = {
          title: '',
          username: '',
          email: '',
          password: '',
          apiKey: '',
          secret: '',
          notes: ''
        };

        if (!currentEditingId) {
          const saved = localStorage.getItem(`credentials_form_draft_${project.id}`);
          if (saved) {
            try {
              initialData = { ...initialData, ...JSON.parse(saved) };
            } catch {}
          }
        } else {
          initialData = {
            title: editingCred?.title || '',
            username: editingCred?.username || '',
            email: editingCred?.email || '',
            password: editingCred?.password || '',
            apiKey: editingCred?.apiKey || '',
            secret: editingCred?.secret || '',
            notes: editingCred?.notes || ''
          };
        }
        reset(initialData);
      }
    }
  }, [modalOpen, editingCred, reset, project.id]);

  // Persist form changes in real-time
  const formValues = watch();
  React.useEffect(() => {
    if (modalOpen && !editingCred && typeof window !== 'undefined') {
      localStorage.setItem(`credentials_form_draft_${project.id}`, JSON.stringify(formValues));
    }
  }, [formValues, modalOpen, editingCred, project.id]);

  const toggleVisibility = (key: string) => {
    if (currentRole === 'viewer') {
      toast.error('Viewer role is not authorized to decrypt passwords or API keys');
      return;
    }
    setVisibleFields(prev => ({ ...prev, [key]: !prev[key] }));
    if (!visibleFields[key]) {
      const fieldName = key.split('-')[1] || 'credential';
      ActivityRepository.log(project.id, 'view_credential', `Viewed sensitive field "${fieldName}"`);
    }
  };

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    if (currentRole === 'viewer') {
      toast.error('Viewer role is not authorized to copy passwords or API keys');
      return;
    }
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label} to clipboard`);
    if (label.toLowerCase().includes('password')) {
      ActivityRepository.log(project.id, 'copy_password', 'Copied credentials password to clipboard');
    }
  };

  const handleGenerateInForm = () => {
    const newPass = generateSecurePassword();
    setValue('password', newPass);
    toast.success('Generated strong password');
  };

  const onSubmit = async (values: CredFormValues) => {
    if (!encryptionKey) {
      toast.error('Vault key missing. Please relock and unlock the vault.');
      return;
    }

    try {
      await CredentialRepository.save({
        id: editingCred?.id,
        projectId: project.id,
        ...values
      }, encryptionKey);

      localStorage.removeItem(`credentials_form_draft_${project.id}`);
      localStorage.removeItem(`credentials_editing_id_${project.id}`);
      localStorage.removeItem(`credentials_modal_open_${project.id}`);
      lastEditingIdRef.current = undefined;
      toast.success(editingCred ? 'Credentials saved' : 'Credentials created');
      setModalOpen(false);
      setEditingCred(null);
    } catch (e) {
      toast.error('Failed to save credentials');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete these credentials permanently?')) {
      try {
        await CredentialRepository.delete(id, project.id);
        toast.success('Credentials deleted');
      } catch {
        toast.error('Failed to delete credentials');
      }
    }
  };

  // Drag logic handlers
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
      const draggedItem = creds[draggedIndex];
      const targetItem = creds[dropIndex];
      if (draggedItem && targetItem) {
        try {
          await CredentialRepository.swap(draggedItem.id, targetItem.id, project.id);
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
      {/* Tab Header */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Access Credentials</h3>
        {currentRole !== 'viewer' && (
          <button
            onClick={() => {
              setEditingCred(null);
              setModalOpen(true);
            }}
            className="bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 font-semibold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer transition"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            Add Credentials
          </button>
        )}
      </div>

      {creds.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {creds.map((cred, index) => {
            const passKey = `${cred.id}-password`;
            const apiValKey = `${cred.id}-apiKey`;
            const secretValKey = `${cred.id}-secret`;
            
            const isPassVisible = visibleFields[passKey] || false;
            const isApiVisible = visibleFields[apiValKey] || false;
            const isSecretVisible = visibleFields[secretValKey] || false;

            return (
              <div 
                key={cred.id} 
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
                {/* Title and Action Buttons */}
                <div className="flex items-center justify-between border-b border-zinc-900/60 pb-3">
                  <h4 className="font-bold text-sm text-zinc-200 flex items-center gap-1.5">
                    {currentRole !== 'viewer' && (
                      <GripVertical className="w-3.5 h-3.5 text-zinc-655 dark:text-zinc-600 shrink-0 select-none cursor-grab active:cursor-grabbing" />
                    )}
                    <KeyRound className="w-4 h-4 text-emerald-400" />
                    {cred.title}
                  </h4>
                  {currentRole !== 'viewer' && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setEditingCred(cred);
                          setModalOpen(true);
                        }}
                        className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 rounded transition cursor-pointer"
                        title="Edit Credentials"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(cred.id)}
                        className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-950/20 rounded transition cursor-pointer"
                        title="Delete Credentials"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Credential rows details */}
                <div className="space-y-2.5 text-xs">
                  {/* Username row */}
                  {cred.username && (
                    <div className="flex items-center justify-between group/row">
                      <span className="text-zinc-500 font-semibold flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Username</span>
                      <div className="flex items-center gap-1.5 max-w-[60%]">
                        <span className="text-zinc-300 font-bold truncate block select-all">{cred.username}</span>
                        <button 
                          onClick={() => handleCopy(cred.username || '', 'Username')}
                          className="opacity-0 group-hover/row:opacity-100 p-0.5 text-zinc-500 hover:text-zinc-300 rounded cursor-pointer transition"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Email row */}
                  {cred.email && (
                    <div className="flex items-center justify-between group/row">
                      <span className="text-zinc-500 font-semibold flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Email</span>
                      <div className="flex items-center gap-1.5 max-w-[60%]">
                        <span className="text-zinc-300 font-bold truncate block select-all">{cred.email}</span>
                        <button 
                          onClick={() => handleCopy(cred.email || '', 'Email')}
                          className="opacity-0 group-hover/row:opacity-100 p-0.5 text-zinc-500 hover:text-zinc-300 rounded cursor-pointer transition"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Password row */}
                  {cred.password && (
                    <div className="flex items-center justify-between group/row">
                      <span className="text-zinc-500 font-semibold flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Password</span>
                      <div className="flex items-center gap-1.5 max-w-[60%]">
                        <span className="text-zinc-300 font-mono font-bold truncate block select-all">
                          {isPassVisible ? cred.password : '••••••••'}
                        </span>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                          <button 
                            onClick={() => toggleVisibility(passKey)}
                            className="p-0.5 text-zinc-500 hover:text-zinc-300 rounded cursor-pointer"
                          >
                            {isPassVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                          <button 
                            onClick={() => handleCopy(cred.password || '', 'Password')}
                            className="p-0.5 text-zinc-500 hover:text-zinc-300 rounded cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* API Key row */}
                  {cred.apiKey && (
                    <div className="flex items-center justify-between group/row">
                      <span className="text-zinc-500 font-semibold flex items-center gap-1.5"><Compass className="w-3.5 h-3.5" /> API Key</span>
                      <div className="flex items-center gap-1.5 max-w-[60%]">
                        <span className="text-zinc-300 font-mono font-bold truncate block select-all">
                          {isApiVisible ? cred.apiKey : '••••••••'}
                        </span>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                          <button 
                            onClick={() => toggleVisibility(apiValKey)}
                            className="p-0.5 text-zinc-500 hover:text-zinc-300 rounded cursor-pointer"
                          >
                            {isApiVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                          <button 
                            onClick={() => handleCopy(cred.apiKey || '', 'API Key')}
                            className="p-0.5 text-zinc-500 hover:text-zinc-300 rounded cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Secret row */}
                  {cred.secret && (
                    <div className="flex items-center justify-between group/row">
                      <span className="text-zinc-500 font-semibold flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-purple-400" /> Secret Key</span>
                      <div className="flex items-center gap-1.5 max-w-[60%]">
                        <span className="text-zinc-300 font-mono font-bold truncate block select-all">
                          {isSecretVisible ? cred.secret : '••••••••'}
                        </span>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                          <button 
                            onClick={() => toggleVisibility(secretValKey)}
                            className="p-0.5 text-zinc-500 hover:text-zinc-300 rounded cursor-pointer"
                          >
                            {isSecretVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                          <button 
                            onClick={() => handleCopy(cred.secret || '', 'Secret')}
                            className="p-0.5 text-zinc-500 hover:text-zinc-300 rounded cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Notes if present */}
                {cred.notes && (
                  <div className="border-t border-zinc-900/60 pt-3 mt-1.5 flex items-start gap-1.5 text-[11px] text-zinc-500 font-medium">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <p className="line-clamp-2">{cred.notes}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-zinc-900/10 border border-zinc-900 border-dashed rounded-xl p-12 text-center text-zinc-500 text-xs">
          No credentials saved. Lock security key setup matches credentials repository.
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
                  <KeyRound className="w-4.5 h-4.5 text-emerald-500" />
                  {editingCred ? 'Edit Access Credentials' : 'Add Access Credentials'}
                </h4>
                <button onClick={() => setModalOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Title / Name *</label>
                    <input
                      type="text"
                      {...register('title')}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                      placeholder="e.g. AWS Console, Stripe API"
                    />
                    {errors.title && <span className="text-[10px] text-red-400">{errors.title.message}</span>}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Username / ID</label>
                    <input
                      type="text"
                      {...register('username')}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                      placeholder="admin"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Email</label>
                    <input
                      type="text"
                      {...register('email')}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                      placeholder="admin@example.com"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Password</label>
                      <button 
                        type="button" 
                        onClick={handleGenerateInForm}
                        className="text-[9px] text-emerald-400 font-bold hover:underline flex items-center gap-0.5"
                      >
                        <Sparkles className="w-2.5 h-2.5" /> Generate
                      </button>
                    </div>
                    <input
                      type="text"
                      {...register('password')}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-250 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition font-mono"
                      placeholder="Enter password or generate"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">API Key / Client ID</label>
                    <input
                      type="text"
                      {...register('apiKey')}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition font-mono"
                      placeholder="sk_live_..."
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Secret Key / Token</label>
                    <input
                      type="text"
                      {...register('secret')}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-250 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition font-mono"
                      placeholder="secret_token..."
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Notes / Usage details</label>
                  <textarea
                    {...register('notes')}
                    rows={2}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition resize-none"
                    placeholder="Enter any usage details, renewal cycles, or specific scopes..."
                  />
                  {errors.notes && <span className="text-[10px] text-red-400">{errors.notes.message}</span>}
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
                    {editingCred ? 'Save Changes' : 'Create Credentials'}
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
