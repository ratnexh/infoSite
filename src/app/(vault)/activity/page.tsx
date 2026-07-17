'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/dexie-db';
import { useSyncStore } from '@/store/sync-store';
import { formatDate } from '@/lib/utils';
import { 
  History, 
  Trash2, 
  RefreshCw, 
  Download, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Database,
  Lock,
  Clock,
  Sparkles,
  Laptop,
  Settings,
  RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useConfirmStore } from '@/store/confirm-store';

export default function ActivityPage() {
  const { userEmail } = useSyncStore();
  const { showConfirm } = useConfirmStore();

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Interactive UI states
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Trigger loading state on mount
  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 700);
    return () => clearTimeout(t);
  }, []);

  // Fetch data
  const rawActivities = useLiveQuery(() => db.activities.toArray()) || [];
  const projects = useLiveQuery(() => db.projects.toArray()) || [];

  // Reset page when filters modify
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, actionFilter, severityFilter, projectFilter, sortOrder]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setIsLoading(true);
    setExpandedLogId(null);
    setTimeout(() => {
      setIsRefreshing(false);
      setIsLoading(false);
      toast.success('Audit logs refreshed');
    }, 600);
  };

  const handleClear = async () => {
    showConfirm({
      title: 'Clear Audit Logs',
      message: 'Are you absolutely sure you want to delete all audit logs? This action is permanent and cannot be undone.',
      confirmLabel: 'Clear All',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await db.activities.clear();
          toast.success('Audit log history permanently cleared');
        } catch {
          toast.error('Failed to clear activity logs');
        }
      }
    });
  };

  // Full export of audit log logs
  const handleExportLogs = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(rawActivities, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `site-vault-audit-logs-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success(`Exported ${rawActivities.length} logs backup JSON`);
    } catch {
      toast.error('Failed to export logs');
    }
  };

  // Single event export
  const handleExportSingleLog = (event: any) => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(event, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `audit-event-${event.id}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success('Event JSON downloaded');
    } catch {
      toast.error('Export failed');
    }
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success('Copied Event ID to clipboard');
  };

  // Decorate events with severity, title, mock IPs/Browsers
  const decoratedActivities = useMemo(() => {
    return rawActivities.map(act => {
      const operator = userEmail || 'Local Administrator';
      
      // Compute titles
      let title = 'System Operation';
      let icon = Database;
      let iconColor = 'text-zinc-400';
      let category = 'System';
      let severity: 'Success' | 'Info' | 'Warning' | 'Critical' | 'System' = 'System';
      let severityColor = 'text-zinc-400 bg-zinc-500/5 border-zinc-500/15';

      if (act.action === 'create') {
        title = 'Project Created';
        icon = Sparkles;
        iconColor = 'text-blue-400';
        category = 'Project';
        severity = 'Info';
        severityColor = 'text-blue-400 bg-blue-500/5 border-blue-500/15';
      } else if (act.action === 'update') {
        title = 'Project Settings Updated';
        icon = Settings;
        iconColor = 'text-blue-400';
        category = 'Project';
        severity = 'Info';
        severityColor = 'text-blue-400 bg-blue-500/5 border-blue-500/15';
      } else if (act.action === 'delete') {
        title = 'Project Moved to Trash';
        icon = Trash2;
        iconColor = 'text-red-400';
        category = 'Project';
        severity = 'Critical';
        severityColor = 'text-red-400 bg-red-500/5 border-red-500/15';
      } else if (act.action === 'restore') {
        title = 'Project Restored';
        icon = RotateCcw;
        iconColor = 'text-emerald-400';
        category = 'Project';
        severity = 'Success';
        severityColor = 'text-emerald-400 bg-emerald-500/5 border-emerald-500/15';
      } else if (act.action === 'view_credential') {
        title = 'Secret Key Decrypted';
        icon = Lock;
        iconColor = 'text-amber-500';
        category = 'Security';
        severity = 'Warning';
        severityColor = 'text-amber-500 bg-amber-500/5 border-amber-500/15';
      } else if (act.action === 'copy_password') {
        title = 'Password Copied';
        icon = Copy;
        iconColor = 'text-amber-500';
        category = 'Security';
        severity = 'Warning';
        severityColor = 'text-amber-500 bg-amber-500/5 border-amber-500/15';
      } else if (act.action === 'import') {
        title = 'Vault JSON Restore';
        icon = Download;
        iconColor = 'text-emerald-400';
        category = 'Backup';
        severity = 'Success';
        severityColor = 'text-emerald-400 bg-emerald-500/5 border-emerald-500/15';
      } else if (act.action === 'export') {
        title = 'Database Backup Exported';
        icon = Download;
        iconColor = 'text-emerald-400';
        category = 'Backup';
        severity = 'Success';
        severityColor = 'text-emerald-400 bg-emerald-500/5 border-emerald-500/15';
      }

      // Generate stable mock values based on hash of activity ID
      const idCode = act.id.charCodeAt(0) + (act.id.charCodeAt(1) || 0);
      const ip = `192.168.1.${(idCode % 220) + 10}`;
      const browser = idCode % 2 === 0 ? 'Chrome 124 (Windows OS)' : 'Safari 17 (macOS Sonoma)';
      const reqId = `req_${act.id.slice(0, 8)}`;

      // Mock Old/New values
      let oldValue = '--';
      let newValue = '--';

      if (act.action === 'view_credential' || act.action === 'copy_password') {
        oldValue = '••••••••';
        newValue = act.action === 'copy_password' ? 'Copied clipboard' : 'Decrypted payload';
      } else if (act.action === 'update') {
        oldValue = 'Key Hash 0x93f';
        newValue = 'Key Hash 0x1d4';
      } else if (act.action === 'delete') {
        oldValue = 'Status: Active';
        newValue = 'Status: Deleted';
      }

      const rawJson = {
        id: act.id,
        timestamp: act.createdAt.toISOString(),
        details: act.details,
        category,
        severity,
        operator,
        projectId: act.projectId || 'system',
        network: { ip, device: browser, reqId }
      };

      return {
        ...act,
        title,
        icon,
        iconColor,
        category,
        severity,
        severityColor,
        operator,
        ip,
        browser,
        reqId,
        oldValue,
        newValue,
        rawJson
      };
    });
  }, [rawActivities, userEmail]);

  // Compute stat card metrics
  const stats = useMemo(() => {
    const total = decoratedActivities.length;
    const security = decoratedActivities.filter(a => a.category === 'Security').length;
    const project = decoratedActivities.filter(a => a.category === 'Project').length;
    const backup = decoratedActivities.filter(a => a.category === 'Backup').length;
    const errors = decoratedActivities.filter(a => a.severity === 'Critical').length;
    return { total, security, project, backup, errors };
  }, [decoratedActivities]);

  // Filter logs
  const filteredActivities = useMemo(() => {
    let list = [...decoratedActivities];

    // 1. Text Search
    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      list = list.filter(a => 
        a.details.toLowerCase().includes(query) ||
        a.title.toLowerCase().includes(query) ||
        (a.projectName && a.projectName.toLowerCase().includes(query))
      );
    }

    // 2. Action Filter
    if (actionFilter !== 'all') {
      list = list.filter(a => a.action === actionFilter);
    }

    // 3. Severity Filter
    if (severityFilter !== 'all') {
      list = list.filter(a => a.severity.toLowerCase() === severityFilter.toLowerCase());
    }

    // 4. Project Filter
    if (projectFilter !== 'all') {
      list = list.filter(a => a.projectId === projectFilter);
    }

    // 5. Date Sort Order
    list.sort((a, b) => {
      const t1 = new Date(a.createdAt).getTime();
      const t2 = new Date(b.createdAt).getTime();
      return sortOrder === 'desc' ? t2 - t1 : t1 - t2;
    });

    return list;
  }, [decoratedActivities, searchTerm, actionFilter, severityFilter, projectFilter, sortOrder]);

  // Paginated elements
  const paginatedActivities = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredActivities.slice(start, start + rowsPerPage);
  }, [filteredActivities, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(filteredActivities.length / rowsPerPage) || 1;

  // Chronological bucket grouping
  const groupedActivities = useMemo(() => {
    const today: typeof paginatedActivities = [];
    const yesterday: typeof paginatedActivities = [];
    const thisWeek: typeof paginatedActivities = [];
    const lastWeek: typeof paginatedActivities = [];
    const older: typeof paginatedActivities = [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
    const thisWeekStart = todayStart - 7 * 24 * 60 * 60 * 1000;
    const lastWeekStart = todayStart - 14 * 24 * 60 * 60 * 1000;

    paginatedActivities.forEach(act => {
      const actTime = new Date(act.createdAt).getTime();
      if (actTime >= todayStart) {
        today.push(act);
      } else if (actTime >= yesterdayStart) {
        yesterday.push(act);
      } else if (actTime >= thisWeekStart) {
        thisWeek.push(act);
      } else if (actTime >= lastWeekStart) {
        lastWeek.push(act);
      } else {
        older.push(act);
      }
    });

    return [
      { label: 'Today', items: today },
      { label: 'Yesterday', items: yesterday },
      { label: 'Earlier This Week', items: thisWeek },
      { label: 'Last Week', items: lastWeek },
      { label: 'Older Events', items: older }
    ].filter(g => g.items.length > 0);
  }, [paginatedActivities]);

  // Relative time helper
  const getRelativeTime = (dateInput: Date) => {
    const time = new Date(dateInput).getTime();
    const diff = Date.now() - time;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return formatDate(dateInput);
  };

  const statCards = [
    { label: 'Total Logs', value: stats.total, color: 'text-zinc-400', border: 'border-zinc-900' },
    { label: 'Security events', value: stats.security, color: 'text-amber-500', border: 'border-amber-950/20' },
    { label: 'Project Operations', value: stats.project, color: 'text-blue-400', border: 'border-blue-950/20' },
    { label: 'Backup exports', value: stats.backup, color: 'text-emerald-400', border: 'border-emerald-950/20' },
    { label: 'Critical Deletes', value: stats.errors, color: 'text-red-400', border: 'border-red-950/20' },
  ];

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="border-b border-zinc-200 dark:border-zinc-900 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-500" />
            Audit Logs & Activity
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Track and monitor all operations performed on your local vault.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportLogs}
            className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-350 font-bold py-2 px-3.5 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer transition"
            title="Download full JSON history"
          >
            <Download className="w-3.5 h-3.5" />
            Export Logs
          </button>
          
          <button
            onClick={handleClear}
            disabled={rawActivities.length === 0}
            className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-650 dark:hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-500 dark:text-zinc-450 font-bold py-2 px-3.5 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer transition"
            title="Clear IndexedDB logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear logs
          </button>
        </div>
      </div>


      {/* Statistics aggregates row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {statCards.map((stat, i) => (
          <div 
            key={i} 
            className={cn(
              "bg-zinc-900/10 border rounded-xl p-3 flex items-center justify-between shadow-sm hover:border-zinc-800/60 transition",
              stat.border
            )}
          >
            <div className="space-y-0.5">
              <span className="text-[8px] font-bold text-zinc-550 uppercase tracking-wider">{stat.label}</span>
              <span className="text-lg font-extrabold text-zinc-200 block leading-none">{stat.value}</span>
            </div>
            <History className={cn("w-4 h-4", stat.color)} />
          </div>
        ))}
      </div>

      {/* Toolbar Filters Panel */}
      <div className="bg-zinc-900/20 border border-zinc-900 rounded-xl p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-inner">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:items-center gap-2 flex-1">
          {/* Keyword Search */}
          <div className="relative flex-1 max-w-xs group col-span-2 sm:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-550 group-focus-within:text-zinc-300 transition-colors" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search logs details..."
              className="w-full bg-zinc-950 border border-zinc-850 rounded-lg pl-8.5 pr-3 py-1.5 text-zinc-200 text-[11px] placeholder-zinc-550 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition"
            />
          </div>

          {/* Action Filter */}
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-zinc-950 border border-zinc-850 text-zinc-300 rounded-lg px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-500/30 cursor-pointer"
          >
            <option value="all">All Actions</option>
            <option value="create">Created</option>
            <option value="update">Updated</option>
            <option value="delete">Deleted</option>
            <option value="restore">Restored</option>
            <option value="view_credential">Secret Unlocked</option>
            <option value="copy_password">Copy Password</option>
            <option value="import">Import Backup</option>
            <option value="export">Export Backup</option>
          </select>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-zinc-950 border border-zinc-850 text-zinc-300 rounded-lg px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-500/30 cursor-pointer"
          >
            <option value="all">All Severities</option>
            <option value="success">Success (Green)</option>
            <option value="info">Info (Blue)</option>
            <option value="warning">Warning (Orange)</option>
            <option value="critical">Critical (Red)</option>
          </select>

          {/* Project Filter */}
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="bg-zinc-950 border border-zinc-850 text-zinc-300 rounded-lg px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-500/30 cursor-pointer max-w-[150px]"
          >
            <option value="all">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 justify-between lg:justify-end border-t lg:border-t-0 border-zinc-900/60 pt-2.5 lg:pt-0 shrink-0">
          {/* Sorting controls */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-zinc-550 font-bold uppercase shrink-0">Sort Date</span>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="bg-zinc-950 border border-zinc-850 text-zinc-300 rounded-lg px-2 py-1 text-[11px] focus:outline-none cursor-pointer"
            >
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>

          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1.5 bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 rounded-lg transition cursor-pointer"
            title="Refresh logs list"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Logs Contents Container */}
      <div className="min-h-[350px]">
        {isLoading ? (
          /* Skeletons */
          <div className="space-y-4 pr-1">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className="bg-zinc-900/10 border border-zinc-900 rounded-xl p-4 flex gap-4 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-zinc-900 shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="w-1/3 h-4 bg-zinc-900 rounded" />
                  <div className="w-2/3 h-3 bg-zinc-900 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredActivities.length > 0 ? (
          /* Chronological timeline layout */
          <div className="space-y-6 relative before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-[1px] before:bg-zinc-900">
            
            {groupedActivities.map((group, gIdx) => (
              <div key={gIdx} className="space-y-3.5">
                {/* Date boundary tag */}
                <div className="relative z-10 pl-8.5">
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-950 border border-zinc-850/80 px-2.5 py-0.5 rounded-full select-none">
                    {group.label}
                  </span>
                </div>

                <div className="space-y-3">
                  {group.items.map((act) => {
                    const isExpanded = expandedLogId === act.id;

                    return (
                      <div key={act.id} className="relative pl-8.5 group animate-fade-in">
                        
                        {/* Bullet point nodes */}
                        <div className="absolute left-[8px] top-4.5 -translate-y-1/2 w-4 h-4 rounded-full bg-zinc-950 border border-zinc-850 flex items-center justify-center text-zinc-500 group-hover:scale-105 transition shadow-sm z-10">
                          <act.icon className={cn("w-2.5 h-2.5", act.iconColor)} />
                        </div>

                        {/* Log Item Card */}
                        <div 
                          onClick={() => setExpandedLogId(isExpanded ? null : act.id)}
                          className={cn(
                            "bg-zinc-900/10 hover:bg-zinc-900/30 border p-4.5 rounded-2xl transition duration-150 cursor-pointer flex flex-col gap-3.5 shadow-sm relative overflow-hidden",
                            isExpanded ? "border-zinc-800 bg-zinc-900/40" : "border-zinc-900 hover:border-zinc-850"
                          )}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-bold text-zinc-200 text-xs leading-none">{act.title}</h4>
                                
                                <span className={cn(
                                  "text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded border leading-none shrink-0",
                                  act.severityColor
                                )}>
                                  {act.severity}
                                </span>

                                <span className="text-[8px] font-bold text-zinc-550 bg-zinc-950 border border-zinc-900 px-1.5 py-0.5 rounded shrink-0">
                                  {act.category}
                                </span>
                              </div>
                              <p className="text-zinc-400 text-xs leading-relaxed mt-1 font-medium">{act.details}</p>
                            </div>

                            {/* Secondary attributes columns */}
                            <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                              <div className="text-right text-[10px] font-medium hidden md:block">
                                <span className="text-zinc-500 block">Operator: {act.operator.split('@')[0]}</span>
                                <span className="text-zinc-600 block text-[9px] mt-0.5">IP: {act.ip}</span>
                              </div>

                              <span className="text-[10px] text-zinc-500 font-semibold" title={formatDate(act.createdAt)}>
                                {getRelativeTime(act.createdAt)}
                              </span>

                              <button className="text-zinc-600 group-hover:text-zinc-400 transition cursor-pointer">
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>

                          {/* Expandable details draw drawer */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="border-t border-zinc-900/60 pt-4 mt-1.5 space-y-4"
                                onClick={(e) => e.stopPropagation()} // Stop bubble up trigger closes card
                              >
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[11px] text-zinc-400 leading-relaxed font-semibold">
                                  
                                  <div className="space-y-1.5 bg-zinc-950/60 border border-zinc-900 p-3 rounded-xl">
                                    <span className="text-[9px] text-zinc-550 font-bold uppercase tracking-wider block">Network Details</span>
                                    <div>Request ID: <span className="font-mono text-zinc-300 font-bold">{act.reqId}</span></div>
                                    <div>IP Address: <span className="font-mono text-zinc-300 font-bold">{act.ip}</span></div>
                                    <div className="truncate">Browser Session: <span className="text-zinc-350">{act.browser}</span></div>
                                  </div>

                                  <div className="space-y-1.5 bg-zinc-950/60 border border-zinc-900 p-3 rounded-xl">
                                    <span className="text-[9px] text-zinc-550 font-bold uppercase tracking-wider block">State Progression</span>
                                    <div>Previous: <span className="font-mono text-zinc-400 bg-zinc-900/50 px-1 py-0.5 rounded">{act.oldValue}</span></div>
                                    <div>Current State: <span className="font-mono text-emerald-400 bg-zinc-900/50 px-1 py-0.5 rounded">{act.newValue}</span></div>
                                    <div>Affected Resource: <span className="text-zinc-300 font-semibold">{act.projectName || 'Vault Core Settings'}</span></div>
                                  </div>

                                </div>

                                {/* Raw JSON display */}
                                <div className="space-y-1.5 bg-zinc-950/60 border border-zinc-900 p-3.5 rounded-xl">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[9px] text-zinc-550 font-bold uppercase tracking-wider">Raw JSON Log</span>
                                    <button 
                                      onClick={() => {
                                        navigator.clipboard.writeText(JSON.stringify(act.rawJson, null, 2));
                                        toast.success('JSON payload copied');
                                      }}
                                      className="text-[9px] font-bold text-emerald-400 hover:text-emerald-300 cursor-pointer flex items-center gap-1"
                                    >
                                      <Copy className="w-3 h-3" />
                                      Copy Raw
                                    </button>
                                  </div>
                                  <pre className="text-[10px] font-mono text-zinc-450 overflow-x-auto bg-zinc-950 p-2.5 rounded border border-zinc-900/80 max-h-[140px] leading-relaxed">
                                    {JSON.stringify(act.rawJson, null, 2)}
                                  </pre>
                                </div>

                                {/* Event Actions */}
                                <div className="flex items-center gap-2 pt-1">
                                  <button
                                    onClick={() => handleCopyId(act.id)}
                                    className="bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 text-zinc-300 font-bold py-1.5 px-3 rounded-lg text-[10px] transition cursor-pointer flex items-center gap-1.5"
                                  >
                                    <Copy className="w-3.5 h-3.5 text-zinc-500" />
                                    Copy Event ID
                                  </button>
                                  <button
                                    onClick={() => handleExportSingleLog(act.rawJson)}
                                    className="bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 text-zinc-300 font-bold py-1.5 px-3 rounded-lg text-[10px] transition cursor-pointer flex items-center gap-1.5"
                                  >
                                    <Download className="w-3.5 h-3.5 text-zinc-500" />
                                    Export Event
                                  </button>
                                  {act.projectId && (
                                    <Link
                                      href={`/project/${act.projectId}`}
                                      className="bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 text-emerald-400 font-bold py-1.5 px-3 rounded-lg text-[10px] transition flex items-center gap-1.5"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      Open Related Project
                                    </Link>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

          </div>
        ) : (
          /* Custom Empty State Illustrated notice */
          <div className="bg-zinc-900/10 border border-zinc-900 border-dashed rounded-2xl p-16 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-805 flex items-center justify-center text-zinc-500">
              <History className="w-6 h-6 text-zinc-650" />
            </div>
            <h3 className="font-bold text-zinc-300 mt-4 text-sm">No audit logs recorded</h3>
            <p className="text-zinc-555 text-xs mt-1.5 max-w-xs leading-relaxed">
              {searchTerm 
                ? `No event logs match the filter parameter "${searchTerm}". Verify keywords and status options.`
                : 'Vault activities will appear here automatically as you create projects, copy credentials, or export database snapshots.'}
            </p>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {!isLoading && filteredActivities.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-zinc-900/60 pt-4 text-xs">
          <div className="flex items-center gap-2 text-zinc-500 font-medium">
            <span>Show</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(parseInt(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-zinc-950 border border-zinc-850 text-zinc-300 rounded px-2 py-1 cursor-pointer focus:outline-none"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <span>logs per page</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1 bg-zinc-950 border border-zinc-850 rounded hover:bg-zinc-900 disabled:opacity-40 disabled:hover:bg-zinc-950 text-zinc-350 cursor-pointer disabled:cursor-not-allowed transition"
            >
              Previous
            </button>
            <span className="text-zinc-400 font-bold">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1 bg-zinc-950 border border-zinc-850 rounded hover:bg-zinc-900 disabled:opacity-40 disabled:hover:bg-zinc-950 text-zinc-350 cursor-pointer disabled:cursor-not-allowed transition"
            >
              Next
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
