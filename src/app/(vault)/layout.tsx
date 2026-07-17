'use client';

import React from 'react';
import Sidebar from '@/components/layout/sidebar';
import TopNav from '@/components/layout/top-nav';
import ProjectDialog from '@/components/project-dialog';
import { useUIStore } from '@/store/ui-store';

export default function VaultLayout({ children }: { children: React.ReactNode }) {
  const { projectDialogOpen, setProjectDialogOpen } = useUIStore();

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header navigation bar */}
        <TopNav />

        {/* Dynamic page content */}
        <main className="flex-1 overflow-y-auto bg-zinc-100/40 dark:bg-zinc-950/20 p-6 scrollbar-thin">
          <div className="max-w-7xl mx-auto w-full h-full">
            {children}
          </div>
        </main>
      </div>

      {/* Global persistent project creation dialog */}
      <ProjectDialog 
        isOpen={projectDialogOpen} 
        onClose={() => setProjectDialogOpen(false)} 
        onSuccess={() => {}} 
      />
    </div>
  );
}
