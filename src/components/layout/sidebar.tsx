'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUIStore } from '@/store/ui-store';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/dexie-db';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
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
  ShieldCheck,
  LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const pathname = usePathname();

  const handleSignOut = async () => {
    if (confirm('Are you sure you want to sign out? This will disconnect cloud sync and clear all local vault cache.')) {
      try {
        await supabase.auth.signOut();
        toast.success('Successfully logged out');
      } catch (err: any) {
        toast.error(err.message || 'Logout failed');
      }
    }
  };

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
        "h-screen bg-zinc-100/50 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-900 flex flex-col transition-all duration-300 shrink-0 select-none relative z-45",
        sidebarOpen ? "w-64" : "w-16"
      )}
    >
      {/* Brand Header */}
      <div className={cn("h-14 border-b border-zinc-200 dark:border-zinc-900 flex items-center justify-between", sidebarOpen ? "px-4" : "px-2")}>
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
      <nav className={cn("flex-1 py-4 space-y-1 overflow-y-auto scrollbar-thin", sidebarOpen ? "px-3.5" : "px-2")}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link 
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center rounded-lg text-sm font-medium transition cursor-pointer group",
                sidebarOpen ? "px-2.5 py-2" : "p-2.5 justify-center w-10 h-10 mx-auto",
                isActive 
                  ? "bg-zinc-200/80 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 border border-zinc-350/50 dark:border-zinc-800/80" 
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/50 dark:hover:bg-zinc-900/40 border border-transparent"
              )}
              title={!sidebarOpen ? item.name : undefined}
            >
              <item.icon className={cn(
                "w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-105",
                isActive ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-450 group-hover:text-zinc-700 dark:group-hover:text-zinc-300"
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

      {/* Sidebar Footer with Sign Out and Toggle */}
      <div className={cn("mt-auto border-t border-zinc-200 dark:border-zinc-900 flex flex-col gap-1.5 shrink-0", sidebarOpen ? "p-3" : "p-2")}>
        <button
          onClick={handleSignOut}
          className={cn(
            "flex items-center rounded-lg text-xs font-semibold transition cursor-pointer text-zinc-500 hover:text-red-400 hover:bg-red-500/5 dark:hover:bg-red-950/10 border border-transparent w-full",
            sidebarOpen ? "px-2.5 py-2" : "p-2.5 justify-center w-10 h-10 mx-auto"
          )}
          title="Sign Out"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {sidebarOpen && <span className="ml-3 truncate animate-fade-in">Sign Out</span>}
        </button>

        {!sidebarOpen && (
          <button 
            onClick={toggleSidebar} 
            className="text-zinc-500 hover:text-zinc-350 p-2.5 hover:bg-zinc-200/50 dark:hover:bg-zinc-900/60 border border-transparent rounded transition cursor-pointer flex justify-center w-10 h-10 mx-auto mt-0.5"
            title="Expand Sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
}
