'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUIStore } from '@/store/ui-store';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/dexie-db';
import { 
  LayoutDashboard, 
  Folder, 
  Star, 
  Archive, 
  History, 
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const pathname = usePathname();

  // Reactive project counts
  const projects = useLiveQuery(() => db.projects.toArray()) || [];
  const activeCount = projects.filter(p => !p.deletedAt && p.status !== 'archived').length;
  const favoriteCount = projects.filter(p => !p.deletedAt && p.isFavorite).length;
  const archivedCount = projects.filter(p => !p.deletedAt && p.status === 'archived').length;

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Projects', href: '/projects', icon: Folder, count: activeCount },
    { name: 'Favorites', href: '/favorites', icon: Star, count: favoriteCount },
    { name: 'Archived', href: '/archived', icon: Archive, count: archivedCount },
    { name: 'Activity', href: '/activity', icon: History },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <aside 
      className={cn(
        "h-screen bg-zinc-100/50 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-900 flex flex-col transition-all duration-300 shrink-0 select-none relative z-20",
        sidebarOpen ? "w-64" : "w-16"
      )}
    >
      {/* Brand Header */}
      <div className="h-14 border-b border-zinc-200 dark:border-zinc-900 flex items-center px-4 justify-between">
        {sidebarOpen ? (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-emerald-500/10 border border-emerald-500/35 rounded flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm tracking-wide text-zinc-800 dark:text-zinc-100">SITE VAULT</span>
          </div>
        ) : (
          <div className="w-full flex justify-center">
            <div className="w-6 h-6 bg-emerald-500/10 border border-emerald-500/35 rounded flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
        )}

        {sidebarOpen && (
          <button 
            onClick={toggleSidebar} 
            className="text-zinc-500 hover:text-zinc-300 p-1 hover:bg-zinc-250 dark:hover:bg-zinc-900 rounded transition cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-3.5 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link 
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center rounded-lg px-2.5 py-2 text-sm font-medium transition cursor-pointer group",
                isActive 
                  ? "bg-zinc-200/80 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 border border-zinc-350/50 dark:border-zinc-800/80" 
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/50 dark:hover:bg-zinc-900/40 border border-transparent"
              )}
            >
              <item.icon className={cn(
                "w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-105",
                isActive ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-555 group-hover:text-zinc-600 dark:group-hover:text-zinc-400"
              )} />
              
              {sidebarOpen && (
                <span className="ml-3 animate-fade-in truncate flex-1">{item.name}</span>
              )}
              
              {sidebarOpen && typeof item.count === 'number' && item.count > 0 && (
                <span className="ml-auto text-[10px] bg-zinc-250 dark:bg-zinc-900 border border-zinc-350/60 dark:border-zinc-800 text-zinc-650 dark:text-zinc-400 font-bold px-2 py-0.5 rounded-full">
                  {item.count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer Toggle when closed */}
      {!sidebarOpen && (
        <div className="h-12 border-t border-zinc-200 dark:border-zinc-900 flex items-center justify-center">
          <button 
            onClick={toggleSidebar} 
            className="text-zinc-500 hover:text-zinc-300 p-1 hover:bg-zinc-250 dark:hover:bg-zinc-900 rounded transition cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </aside>
  );
}
