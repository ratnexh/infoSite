'use client';

import React from 'react';
import { Project } from '@/types';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/dexie-db';
import { formatDate } from '@/lib/utils';
import { History, Activity as ActivityIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function TabActivity({ project }: { project: Project }) {
  // Live Query activity logs for this project specifically
  const logs = useLiveQuery(() => 
    db.activities
      .where('projectId')
      .equals(project.id)
      .reverse()
      .sortBy('createdAt')
  ) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Project History & Audit Log</h3>
      </div>

      <div className="bg-zinc-900/10 border border-zinc-900 rounded-xl p-6">
        <AnimatePresence mode="popLayout">
          {logs.length > 0 ? (
            <div className="space-y-4 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-900/80">
              {logs.map((log, idx) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15, delay: Math.min(idx * 0.02, 0.2) }}
                  className="flex gap-4 relative"
                >
                  {/* Timeline dot */}
                  <div className="w-7.5 h-7.5 rounded-full bg-zinc-950 border border-zinc-850 flex items-center justify-center text-zinc-500 z-10 shrink-0 shadow-sm">
                    <ActivityIcon className="w-3.5 h-3.5 text-zinc-500" />
                  </div>

                  {/* Log body */}
                  <div className="flex-1 bg-zinc-900/20 border border-zinc-900/60 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1 text-xs">
                      <p className="text-zinc-200 font-medium leading-relaxed">
                        {log.details}
                      </p>
                      <span className="text-[9px] font-bold text-zinc-550 uppercase tracking-wider">
                        Action: {log.action}
                      </span>
                    </div>

                    <span className="text-[10px] font-bold text-zinc-500 shrink-0 uppercase">
                      {formatDate(log.createdAt)}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-zinc-500 flex flex-col items-center justify-center">
              <History className="w-12 h-12 text-zinc-700 animate-pulse mb-3" />
              <h4 className="font-bold text-zinc-400">No logs found</h4>
              <p className="text-zinc-650 text-xs mt-1 max-w-xs leading-relaxed">
                Changes made to credentials, URLs, or notes will create audit records automatically.
              </p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
