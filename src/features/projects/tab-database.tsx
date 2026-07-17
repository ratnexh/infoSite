'use client';

import React, { useState } from 'react';
import { Project, DatabaseInfo } from '@/types';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/dexie-db';
import { DatabaseRepository, ActivityRepository } from '@/lib/storage/repositories';
import { useSettingsStore } from '@/store/settings-store';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Database, Edit3, Save, Loader2, Eye, EyeOff, Copy } from 'lucide-react';
import { toast } from 'sonner';

const dbSchema = z.object({
  type: z.string().min(1, 'Database Type is required').max(50),
  host: z.string().max(200),
  port: z.string().max(6),
  username: z.string().max(100),
  password: z.string(),
  databaseName: z.string().max(100)
});

type DbFormValues = z.infer<typeof dbSchema>;

export default function TabDatabase({ project }: { project: Project }) {
  const { encryptionKey } = useSettingsStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPassVisible, setIsPassVisible] = useState(false);

  // Live Query DB details
  const dbInfo = useLiveQuery(async () => {
    const raw = await db.databases.where('projectId').equals(project.id).first();
    if (!raw) return null;
    if (!encryptionKey) return raw;
    return await DatabaseRepository.decrypt(raw, encryptionKey);
  }, [project.id, encryptionKey]) || null;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors }
  } = useForm<DbFormValues>({
    resolver: zodResolver(dbSchema)
  });

  // Load editing state from localStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const editing = localStorage.getItem(`database_is_editing_${project.id}`) === 'true';
      if (editing) setIsEditing(true);
    }
  }, [project.id]);

  // Save editing state to localStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`database_is_editing_${project.id}`, isEditing ? 'true' : 'false');
    }
  }, [isEditing, project.id]);

  const lastDbInfoIdRef = React.useRef<string | undefined | null>(undefined);

  React.useEffect(() => {
    if (isEditing) {
      const currentDbInfoId = dbInfo?.id || null;
      if (lastDbInfoIdRef.current !== currentDbInfoId) {
        lastDbInfoIdRef.current = currentDbInfoId;
        
        let initialData = {
          type: 'PostgreSQL',
          host: '',
          port: '',
          username: '',
          password: '',
          databaseName: ''
        };

        const saved = localStorage.getItem(`database_form_draft_${project.id}`);
        if (saved) {
          try {
            initialData = { ...initialData, ...JSON.parse(saved) };
          } catch {}
        } else if (dbInfo) {
          initialData = {
            type: dbInfo.type || 'PostgreSQL',
            host: dbInfo.host || '',
            port: dbInfo.port || '',
            username: dbInfo.username || '',
            password: dbInfo.password || '',
            databaseName: dbInfo.databaseName || ''
          };
        }
        reset(initialData);
      }
    } else {
      lastDbInfoIdRef.current = undefined;
      if (dbInfo) {
        reset({
          type: dbInfo.type || 'PostgreSQL',
          host: dbInfo.host || '',
          port: dbInfo.port || '',
          username: dbInfo.username || '',
          password: dbInfo.password || '',
          databaseName: dbInfo.databaseName || ''
        });
      }
    }
  }, [isEditing, dbInfo, reset, project.id]);

  // Persist form changes in real-time
  const formValues = watch();
  React.useEffect(() => {
    if (isEditing && typeof window !== 'undefined') {
      localStorage.setItem(`database_form_draft_${project.id}`, JSON.stringify(formValues));
    }
  }, [formValues, isEditing, project.id]);

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label} to clipboard`);
  };

  const onSubmit = async (values: DbFormValues) => {
    if (!encryptionKey) {
      toast.error('Vault key missing. Relock and unlock the vault.');
      return;
    }
    setIsSubmitting(true);
    try {
      await DatabaseRepository.save({
        projectId: project.id,
        ...values
      }, encryptionKey);
      toast.success('Database details saved successfully');
      localStorage.removeItem(`database_form_draft_${project.id}`);
      localStorage.removeItem(`database_is_editing_${project.id}`);
      lastDbInfoIdRef.current = undefined;
      setIsEditing(false);
      setIsPassVisible(false);
    } catch {
      toast.error('Failed to save database credentials');
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelEdit = () => {
    localStorage.removeItem(`database_form_draft_${project.id}`);
    localStorage.removeItem(`database_is_editing_${project.id}`);
    lastDbInfoIdRef.current = undefined;
    setIsEditing(false);
    setIsPassVisible(false);
    if (dbInfo) {
      reset({
        type: dbInfo.type,
        host: dbInfo.host,
        port: dbInfo.port,
        username: dbInfo.username,
        password: dbInfo.password || '',
        databaseName: dbInfo.databaseName
      });
    } else {
      reset({
        type: 'PostgreSQL',
        host: '',
        port: '',
        username: '',
        password: '',
        databaseName: ''
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Database Connection Parameters</h3>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 font-semibold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer transition"
          >
            <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
            Edit Details
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* DB Type */}
          <div className="space-y-1 bg-zinc-900/10 border border-zinc-900 rounded-xl p-4.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Database Engine</label>
            {isEditing ? (
              <select
                {...register('type')}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 mt-2 text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition cursor-pointer"
              >
                <option value="PostgreSQL">PostgreSQL</option>
                <option value="MySQL">MySQL</option>
                <option value="MongoDB">MongoDB</option>
                <option value="SQLite">SQLite</option>
                <option value="Redis">Redis</option>
                <option value="MariaDB">MariaDB</option>
                <option value="MS SQL Server">MS SQL Server</option>
              </select>
            ) : (
              <span className="font-bold text-sm text-zinc-200 mt-2 block h-6">
                {dbInfo?.type || <span className="text-zinc-650 font-normal italic text-xs">Not configured</span>}
              </span>
            )}
          </div>

          {/* Database Name */}
          <div className="space-y-1 bg-zinc-900/10 border border-zinc-900 rounded-xl p-4.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Database Name</label>
            {isEditing ? (
              <input
                type="text"
                {...register('databaseName')}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 mt-2 text-zinc-250 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                placeholder="e.g. acme_production"
              />
            ) : (
              <span className="font-bold text-sm text-zinc-200 mt-2 block h-6 font-mono select-all">
                {dbInfo?.databaseName || <span className="text-zinc-650 font-normal italic text-xs">Not configured</span>}
              </span>
            )}
          </div>

          {/* Host & Port */}
          <div className="space-y-1 bg-zinc-900/10 border border-zinc-900 rounded-xl p-4.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Host & Port</label>
            {isEditing ? (
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  {...register('host')}
                  className="w-2/3 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-250 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition font-mono"
                  placeholder="Host URL / IP"
                />
                <input
                  type="text"
                  {...register('port')}
                  className="w-1/3 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-250 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition font-mono text-center"
                  placeholder="Port"
                />
              </div>
            ) : (
              <span className="font-bold text-sm text-zinc-200 mt-2 block h-6 font-mono select-all">
                {dbInfo?.host ? `${dbInfo.host}:${dbInfo.port || ''}` : (
                  <span className="text-zinc-650 font-normal italic text-xs">Not configured</span>
                )}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Username */}
          <div className="space-y-1 bg-zinc-900/10 border border-zinc-900 rounded-xl p-4.5 group">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Connection Username</label>
            {isEditing ? (
              <input
                type="text"
                {...register('username')}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 mt-2 text-zinc-250 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                placeholder="e.g. postgres, admin"
              />
            ) : (
              <div className="flex justify-between items-center mt-2 h-6">
                <span className="font-bold text-sm text-zinc-200 font-mono select-all">
                  {dbInfo?.username || <span className="text-zinc-650 font-normal italic text-xs">Not configured</span>}
                </span>
                {dbInfo?.username && (
                  <button 
                    type="button"
                    onClick={() => handleCopy(dbInfo.username, 'Username')}
                    className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-zinc-350 transition cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Encrypted Password */}
          <div className="space-y-1 bg-zinc-900/10 border border-zinc-900 rounded-xl p-4.5 group">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Database Password</label>
            {isEditing ? (
              <input
                type="password"
                {...register('password')}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 mt-2 text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition font-mono"
                placeholder="Database Connection Password"
              />
            ) : (
              <div className="flex justify-between items-center mt-2 h-6">
                <span className="font-bold text-sm text-zinc-200 font-mono">
                  {dbInfo?.password ? (
                    isPassVisible ? dbInfo.password : '••••••••••••••••'
                  ) : (
                    <span className="text-zinc-650 font-normal italic text-xs">Not configured</span>
                  )}
                </span>
                {dbInfo?.password && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => setIsPassVisible(!isPassVisible)}
                      className="p-1 text-zinc-500 hover:text-zinc-350 transition cursor-pointer"
                    >
                      {isPassVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopy(dbInfo.password!, 'Password')}
                      className="p-1 text-zinc-500 hover:text-zinc-350 transition cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {isEditing && (
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={cancelEdit}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold py-2 px-4 rounded-lg text-xs cursor-pointer transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-600/50 text-emerald-950 font-bold py-2 px-4 rounded-lg text-xs cursor-pointer flex items-center gap-1.5 transition active:scale-[0.98]"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-950" />}
              <Save className="w-3.5 h-3.5" />
              Save Configuration
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
