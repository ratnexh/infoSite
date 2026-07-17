'use client';

import React, { useCallback, useState } from 'react';
import { Project, Attachment } from '@/types';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/dexie-db';
import { AttachmentRepository } from '@/lib/storage/repositories';
import { useDropzone } from 'react-dropzone';
import { 
  Paperclip, 
  UploadCloud, 
  FileText, 
  FileImage, 
  File, 
  Trash2, 
  Download, 
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { formatBytes, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useConfirmStore } from '@/store/confirm-store';

export default function TabFiles({ project }: { project: Project }) {
  const { showConfirm } = useConfirmStore();
  const [isUploading, setIsUploading] = useState(false);

  // Live Query files (excludes binary data to load list quickly)
  const filesList = useLiveQuery(() => AttachmentRepository.getByProjectId(project.id)) || [];

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    setIsUploading(true);
    let uploadedCount = 0;
    
    try {
      for (const file of acceptedFiles) {
        // Enforce maximum size (e.g. 15MB to prevent IndexedDB bloat)
        if (file.size > 15 * 1024 * 1024) {
          toast.warning(`File "${file.name}" exceeds 15MB limit`);
          continue;
        }
        
        await AttachmentRepository.save({
          projectId: project.id,
          name: file.name,
          type: file.type,
          size: file.size,
          data: file // Dexie natively supports File / Blob storage
        });
        uploadedCount++;
      }
      if (uploadedCount > 0) {
        toast.success(`Successfully uploaded ${uploadedCount} file(s)`);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to upload file(s)');
    } finally {
      setIsUploading(false);
    }
  }, [project.id]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 15 * 1024 * 1024, // 15MB
    accept: {
      'image/*': [],
      'application/pdf': [],
      'text/plain': [],
      'application/msword': [],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [],
      'application/vnd.ms-excel': [],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [],
      'application/zip': [],
      'application/x-zip-compressed': []
    }
  });

  const handleDownload = async (fileId: string, name: string) => {
    try {
      const fullFile = await AttachmentRepository.getFile(fileId);
      if (!fullFile) {
        toast.error('File not found');
        return;
      }
      
      const blob = fullFile.data instanceof Blob 
        ? fullFile.data 
        : new Blob([fullFile.data], { type: fullFile.type });
        
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download file');
    }
  };

  const handleDelete = async (fileId: string) => {
    showConfirm({
      title: 'Delete File Permanently',
      message: 'Are you sure you want to delete this file permanently? This action cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await AttachmentRepository.delete(fileId, project.id);
          toast.success('File deleted successfully');
        } catch {
          toast.error('Failed to delete file');
        }
      }
    });
  };

  const getFileIcon = (mime: string) => {
    if (mime.startsWith('image/')) return <FileImage className="w-5 h-5 text-emerald-400" />;
    if (mime === 'application/pdf') return <FileText className="w-5 h-5 text-red-400" />;
    return <File className="w-5 h-5 text-zinc-400" />;
  };

  // Detect duplicate file names
  const nameCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of filesList) {
      const key = f.name?.trim().toLowerCase() || '';
      if (key) counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [filesList]);
  const hasDuplicates = Object.values(nameCounts).some(n => n > 1);

  const handleDeduplicate = async () => {
    const seen = new Set<string>();
    const toDelete: string[] = [];
    for (const f of filesList) {
      const key = f.name?.trim().toLowerCase() || '';
      if (seen.has(key)) {
        toDelete.push(f.id);
      } else {
        seen.add(key);
      }
    }
    try {
      await Promise.all(toDelete.map(id => AttachmentRepository.delete(id, project.id)));
      toast.success(`Removed ${toDelete.length} duplicate file${toDelete.length !== 1 ? 's' : ''}`);
    } catch {
      toast.error('Failed to remove duplicates');
    }
  };

  return (
    <div className="space-y-6">
      {/* Duplicate Warning Banner */}
      {hasDuplicates && (
        <div className="flex items-center justify-between gap-3 bg-amber-950/30 border border-amber-500/40 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-xs text-amber-300 font-medium">
              Duplicate files detected — only one copy should exist.
            </p>
          </div>
          <button
            onClick={handleDeduplicate}
            className="text-xs font-bold text-amber-400 hover:text-amber-300 border border-amber-500/50 hover:border-amber-400 px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap"
          >
            Remove Duplicates
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Project Files & Attachments</h3>
      </div>

      {/* Drag & Drop Area */}
      <div 
        {...getRootProps()} 
        className={`border-2 border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center cursor-pointer transition select-none ${
          isDragActive 
            ? 'border-emerald-500 bg-emerald-500/5' 
            : 'border-zinc-800 bg-zinc-900/5 hover:border-zinc-700/60'
        }`}
      >
        <input {...getInputProps()} />
        {isUploading ? (
          <>
            <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-3" />
            <span className="text-xs text-zinc-400 font-semibold">Encrypting and saving file...</span>
          </>
        ) : (
          <>
            <UploadCloud className={`w-10 h-10 mb-3 transition-colors ${isDragActive ? 'text-emerald-400' : 'text-zinc-500'}`} />
            <span className="text-xs text-zinc-300 font-bold">
              {isDragActive ? 'Drop files here...' : 'Drag & drop files here, or click to browse'}
            </span>
            <span className="text-[10px] text-zinc-550 mt-1.5 font-medium">
              Supports Images, PDFs, and Documents (Max 15MB)
            </span>
          </>
        )}
      </div>

      {/* Files List */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Uploaded Documents ({filesList.length})</h4>
        
        {filesList.length > 0 ? (
          <div className="bg-zinc-900/10 border border-zinc-900 rounded-xl overflow-hidden divide-y divide-zinc-900/65 shadow-sm">
            <AnimatePresence mode="popLayout">
              {filesList.map((file) => (
                <motion.div 
                  key={file.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="p-4 flex items-center justify-between gap-4 hover:bg-zinc-900/20 group text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {getFileIcon(file.type)}
                    <div className="min-w-0">
                      <h5 className="font-bold text-zinc-200 truncate pr-4">{file.name}</h5>
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        {formatBytes(file.size)} • Uploaded {formatDate(file.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleDownload(file.id, file.name)}
                      className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 rounded transition cursor-pointer"
                      title="Download File"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(file.id)}
                      className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-950/20 rounded transition cursor-pointer"
                      title="Delete File"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="bg-zinc-900/10 border border-zinc-900 rounded-xl p-8 text-center text-zinc-650 text-xs">
            No files attached yet. Drag a PDF or mock layout here to secure it locally.
          </div>
        )}
      </div>
    </div>
  );
}
