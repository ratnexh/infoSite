'use client';

import React, { useState } from 'react';
import { Project, Hosting } from '@/types';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/dexie-db';
import { HostingRepository } from '@/lib/storage/repositories';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Server, Edit3, Save, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';

const hostingSchema = z.object({
  provider: z.string().max(100),
  ip: z.string().max(45), // support IPv6
  username: z.string().max(100),
  port: z.string().max(6),
  cdn: z.string().max(100),
  dnsProvider: z.string().max(100),
  notes: z.string().max(500)
});

type HostingFormValues = z.infer<typeof hostingSchema>;

export default function TabHosting({ project }: { project: Project }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Live Query hosting details
  const dbHosting = useLiveQuery(() => db.hosting.where('projectId').equals(project.id).first());

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<HostingFormValues>({
    resolver: zodResolver(hostingSchema)
  });

  // Populate form values when DB record loads
  React.useEffect(() => {
    if (dbHosting) {
      reset({
        provider: dbHosting.provider || '',
        ip: dbHosting.ip || '',
        username: dbHosting.username || '',
        port: dbHosting.port || '22',
        cdn: dbHosting.cdn || '',
        dnsProvider: dbHosting.dnsProvider || '',
        notes: dbHosting.notes || ''
      });
    }
  }, [dbHosting, reset]);

  const onSubmit = async (values: HostingFormValues) => {
    setIsSubmitting(true);
    try {
      await HostingRepository.save({
        projectId: project.id,
        ...values
      });
      toast.success('Hosting details saved successfully');
      setIsEditing(false);
    } catch {
      toast.error('Failed to save hosting configurations');
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelEdit = () => {
    setIsEditing(false);
    if (dbHosting) {
      reset({
        provider: dbHosting.provider || '',
        ip: dbHosting.ip || '',
        username: dbHosting.username || '',
        port: dbHosting.port || '22',
        cdn: dbHosting.cdn || '',
        dnsProvider: dbHosting.dnsProvider || '',
        notes: dbHosting.notes || ''
      });
    } else {
      reset({
        provider: '',
        ip: '',
        username: '',
        port: '22',
        cdn: '',
        dnsProvider: '',
        notes: ''
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Server & Hosting Details</h3>
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
          {/* Provider */}
          <div className="space-y-1 bg-zinc-900/10 border border-zinc-900 rounded-xl p-4.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Hosting Provider</label>
            {isEditing ? (
              <input
                type="text"
                {...register('provider')}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 mt-2 text-zinc-250 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                placeholder="e.g. AWS, Vercel, DigitalOcean"
              />
            ) : (
              <span className="font-bold text-sm text-zinc-200 mt-2 block h-6">
                {dbHosting?.provider || <span className="text-zinc-650 font-normal italic text-xs">Not configured</span>}
              </span>
            )}
          </div>

          {/* Server IP */}
          <div className="space-y-1 bg-zinc-900/10 border border-zinc-900 rounded-xl p-4.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Server IP Address</label>
            {isEditing ? (
              <input
                type="text"
                {...register('ip')}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 mt-2 text-zinc-250 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition font-mono"
                placeholder="e.g. 192.168.1.1"
              />
            ) : (
              <span className="font-bold text-sm text-zinc-200 mt-2 block h-6 font-mono select-all">
                {dbHosting?.ip || <span className="text-zinc-650 font-normal italic text-xs">Not configured</span>}
              </span>
            )}
          </div>

          {/* SSH Configuration */}
          <div className="space-y-1 bg-zinc-900/10 border border-zinc-900 rounded-xl p-4.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">SSH Connection</label>
            {isEditing ? (
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  {...register('username')}
                  className="w-2/3 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-250 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                  placeholder="Username"
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
                {dbHosting?.username ? `${dbHosting.username}:${dbHosting.port || '22'}` : (
                  <span className="text-zinc-650 font-normal italic text-xs">Not configured</span>
                )}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* CDN Provider */}
          <div className="space-y-1 bg-zinc-900/10 border border-zinc-900 rounded-xl p-4.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">CDN Network</label>
            {isEditing ? (
              <input
                type="text"
                {...register('cdn')}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 mt-2 text-zinc-250 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                placeholder="e.g. Cloudflare, CloudFront"
              />
            ) : (
              <span className="font-bold text-sm text-zinc-200 mt-2 block h-6">
                {dbHosting?.cdn || <span className="text-zinc-650 font-normal italic text-xs">Not configured</span>}
              </span>
            )}
          </div>

          {/* DNS Registrar */}
          <div className="space-y-1 bg-zinc-900/10 border border-zinc-900 rounded-xl p-4.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">DNS Provider</label>
            {isEditing ? (
              <input
                type="text"
                {...register('dnsProvider')}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 mt-2 text-zinc-250 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                placeholder="e.g. Route53, Namecheap, GoDaddy"
              />
            ) : (
              <span className="font-bold text-sm text-zinc-200 mt-2 block h-6">
                {dbHosting?.dnsProvider || <span className="text-zinc-650 font-normal italic text-xs">Not configured</span>}
              </span>
            )}
          </div>
        </div>

        {/* Server Notes */}
        <div className="bg-zinc-900/10 border border-zinc-900 rounded-xl p-4.5">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2.5 block">Infrastructure Notes</label>
          {isEditing ? (
            <textarea
              {...register('notes')}
              rows={3}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition resize-none"
              placeholder="e.g. Private keys required, SSL certificate renewed via certbot..."
            />
          ) : (
            <div className="text-xs text-zinc-300 leading-relaxed font-medium bg-zinc-950 border border-zinc-900 p-3.5 rounded-lg min-h-[50px]">
              {dbHosting?.notes ? (
                <p className="whitespace-pre-line">{dbHosting.notes}</p>
              ) : (
                <span className="text-zinc-600 italic">No notes recorded.</span>
              )}
            </div>
          )}
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
