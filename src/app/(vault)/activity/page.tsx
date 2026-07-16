'use client';

import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/dexie-db';
import { formatDate } from '@/lib/utils';
import { History, Trash2, ArrowLeft, Activity as ActivityIcon } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

export default function ActivityPage() {
  const activities = useLiveQuery(() => db.activities.orderBy('createdAt').reverse().toArray()) || [];

  const handleClear = async () => {
    if (confirm('Are you sure you want to clear your local activity history? This cannot be undone.')) {
      try {
        await db.activities.clear();
        toast.success('Activity logs cleared');
      } catch {
        toast.error('Failed to clear logs');
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-50 flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-500" />
            Audit Logs & Activity
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Track and monitor all operations performed on your local vault.
          </p>
        </div>

        {activities.length > 0 && (
          <button
            onClick={handleClear}
            className="border border-zinc-800 hover:border-red-900/40 text-zinc-400 hover:text-red-400 hover:bg-red-950/20 font-semibold py-2 px-3.5 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer transition active:scale-[0.98] shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Audit Logs
          </button>
        )}
      </div>

      {/* Activity Timeline List */}
      <div className="bg-zinc-900/10 border border-zinc-900 rounded-xl p-6">
        <AnimatePresence mode="popLayout">
          {activities.length > 0 ? (
            <div className="space-y-4 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-900/80">
              {activities.map((act, idx) => (
                <motion.div
                  key={act.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15, delay: Math.min(idx * 0.02, 0.2) }}
                  className="flex gap-4 relative"
                >
                  {/* Timeline dot */}
                  <div className="w-7.5 h-7.5 rounded-full bg-zinc-950 border border-zinc-850 flex items-center justify-center text-zinc-500 z-10 shrink-0 shadow-sm">
                    <ActivityIcon className="w-3.5 h-3.5 text-zinc-400" />
                  </div>

                  {/* Log body */}
                  <div className="flex-1 bg-zinc-900/20 border border-zinc-900/60 hover:border-zinc-850 p-4 rounded-xl transition flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm text-zinc-200 font-medium leading-relaxed">
                        {act.details}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-bold uppercase">
                        <span>Action: {act.action}</span>
                        {act.projectId && act.projectName && (
                          <>
                            <span>•</span>
                            <Link 
                              href={`/project/${act.projectId}`}
                              className="text-emerald-500 hover:underline flex items-center gap-0.5 capitalize normal-case font-semibold"
                            >
                              Go to {act.projectName}
                            </Link>
                          </>
                        )}
                      </div>
                    </div>

                    <span className="text-[10px] font-bold text-zinc-500 shrink-0 self-start sm:self-auto uppercase">
                      {formatDate(act.createdAt)}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center text-zinc-500 flex flex-col items-center justify-center">
              <History className="w-12 h-12 text-zinc-700 animate-pulse mb-3" />
              <h3 className="font-bold text-zinc-400">No Operations Recorded</h3>
              <p className="text-zinc-500 text-xs mt-1 max-w-xs leading-relaxed">
                Activity records are generated automatically as you build projects, save endpoints, copy credentials, or encrypt files.
              </p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
