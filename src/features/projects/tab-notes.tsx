'use client';

import React, { useState } from 'react';
import { Project } from '@/types';
import { ProjectRepository } from '@/lib/storage/repositories';
import ReactMarkdown from 'react-markdown';
import { 
  FileText, 
  Eye, 
  Edit3, 
  Save, 
  Loader2, 
  Info 
} from 'lucide-react';
import { toast } from 'sonner';

export default function TabNotes({ project, onRefresh }: { project: Project; onRefresh: () => void }) {
  const [activeMode, setActiveMode] = useState<'write' | 'preview'>('preview');
  const [notesText, setNotesText] = useState(project.notes || '');
  const [isSaving, setIsSaving] = useState(false);

  // Sync state when project notes updates
  React.useEffect(() => {
    setNotesText(project.notes || '');
  }, [project.notes]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await ProjectRepository.update(project.id, { notes: notesText });
      toast.success('Notes saved successfully');
      onRefresh();
    } catch {
      toast.error('Failed to save notes');
    } finally {
      setIsSaving(false);
    }
  };

  // Autosave when switching from write to preview mode
  const toggleMode = async (mode: 'write' | 'preview') => {
    if (activeMode === 'write' && mode === 'preview' && notesText !== project.notes) {
      setIsSaving(true);
      try {
        await ProjectRepository.update(project.id, { notes: notesText });
        onRefresh();
      } catch (e) {
        console.error(e);
      } finally {
        setIsSaving(false);
      }
    }
    setActiveMode(mode);
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs header toolbar */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
        <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg p-1">
          <button
            onClick={() => toggleMode('preview')}
            className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-1.5 cursor-pointer transition ${
              activeMode === 'preview' ? 'bg-zinc-900 text-zinc-50 border border-zinc-800/80' : 'text-zinc-550 hover:text-zinc-300'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Preview Notes
          </button>
          <button
            onClick={() => toggleMode('write')}
            className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-1.5 cursor-pointer transition ${
              activeMode === 'write' ? 'bg-zinc-900 text-zinc-50 border border-zinc-800/80' : 'text-zinc-550 hover:text-zinc-300'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            Write Markdown
          </button>
        </div>

        {activeMode === 'write' && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-600/50 text-emerald-950 font-bold py-1.5 px-3.5 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer transition active:scale-[0.98]"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Notes
          </button>
        )}
      </div>

      {/* Workspace Area */}
      <div className="min-h-[350px]">
        {activeMode === 'write' ? (
          <div className="relative">
            <textarea
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              placeholder="# Project Notes&#10;&#10;Write markdown documentation for your project environments here. Supports headers, code blocks, lists, and tables."
              className="w-full bg-zinc-950 border border-zinc-900 rounded-xl p-5 text-zinc-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-zinc-800 focus:border-zinc-800 transition min-h-[400px] resize-y scrollbar-thin"
            />
            <div className="absolute bottom-3 right-4 text-[10px] text-zinc-650 flex items-center gap-1">
              <Info className="w-3 h-3" /> Supports standard Markdown syntax
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900/10 border border-zinc-900 rounded-xl p-6.5 min-h-[400px] prose prose-invert max-w-none">
            {notesText.trim() ? (
              <ReactMarkdown
                components={{
                  h1: ({node, ...props}) => <h1 className="text-lg font-bold border-b border-zinc-900 pb-2 mb-4 mt-6 text-zinc-50 first:mt-0" {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-base font-bold mb-3 mt-5 text-zinc-100" {...props} />,
                  h3: ({node, ...props}) => <h3 className="text-sm font-bold mb-2.5 mt-4 text-zinc-200" {...props} />,
                  p: ({node, ...props}) => <p className="text-xs text-zinc-300 leading-relaxed mb-3.5" {...props} />,
                  ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 text-xs text-zinc-350 space-y-1.5" {...props} />,
                  ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-4 text-xs text-zinc-350 space-y-1.5" {...props} />,
                  li: ({node, ...props}) => <li className="leading-relaxed" {...props} />,
                  code: ({node, ...props}) => <code className="bg-zinc-950 px-1.5 py-0.5 border border-zinc-850 rounded text-[11px] font-mono text-emerald-400 font-bold" {...props} />,
                  pre: ({node, ...props}) => <pre className="bg-zinc-950 border border-zinc-850 p-4 rounded-xl overflow-x-auto text-[11px] font-mono text-zinc-300 mb-4 leading-normal" {...props} />,
                  table: ({node, ...props}) => <table className="w-full text-left text-xs border-collapse border border-zinc-850 rounded-lg overflow-hidden mb-4" {...props} />,
                  thead: ({node, ...props}) => <thead className="bg-zinc-900 border-b border-zinc-850 text-zinc-400 font-bold uppercase text-[9px]" {...props} />,
                  tbody: ({node, ...props}) => <tbody className="divide-y divide-zinc-900" {...props} />,
                  tr: ({node, ...props}) => <tr className="hover:bg-zinc-900/10" {...props} />,
                  th: ({node, ...props}) => <th className="p-3" {...props} />,
                  td: ({node, ...props}) => <td className="p-3 text-zinc-300" {...props} />,
                }}
              >
                {notesText}
              </ReactMarkdown>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 text-xs py-16">
                <FileText className="w-12 h-12 text-zinc-700 animate-pulse mb-3" />
                <h4 className="font-bold text-zinc-400">No notes written</h4>
                <p className="text-zinc-650 mt-1 max-w-xs leading-relaxed">
                  Click on "Write Markdown" to add developer resources, setup details, or server configurations.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
