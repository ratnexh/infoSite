'use client';

import React, { useState } from 'react';
import { Project, Contact, ContactRole } from '@/types';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/dexie-db';
import { ContactRepository } from '@/lib/storage/repositories';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useSettingsStore } from '@/store/settings-store';
import { 
  Users, 
  Plus, 
  X, 
  Trash2, 
  Wrench, 
  Mail, 
  Phone, 
  Info,
  UserCheck,
  GripVertical,
  Copy
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Please enter a valid email').or(z.string().length(0)),
  phone: z.string().max(20),
  role: z.enum(['client', 'developer', 'designer', 'pm', 'support']),
  notes: z.string().max(300)
});

type ContactFormValues = z.infer<typeof contactSchema>;

const ROLE_LABELS: Record<ContactRole, string> = {
  client: 'Client Contact',
  developer: 'Developer',
  designer: 'Designer',
  pm: 'Project Manager (PM)',
  support: 'Support / DevOps'
};

export default function TabContacts({ project }: { project: Project }) {
  const { currentRole } = useSettingsStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  // Drag-and-drop states
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Live Query contacts sorted
  const contacts = useLiveQuery(() => ContactRepository.getByProjectId(project.id), [project.id]) || [];

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors }
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      role: 'developer',
      notes: ''
    }
  });

  // Load modal open state from localStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const open = localStorage.getItem(`contacts_modal_open_${project.id}`) === 'true';
      if (open) setModalOpen(true);
    }
  }, [project.id]);

  // Save modal open state to localStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`contacts_modal_open_${project.id}`, modalOpen ? 'true' : 'false');
    }
  }, [modalOpen, project.id]);

  // Load editing contact from localStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedId = localStorage.getItem(`contacts_editing_id_${project.id}`);
      if (savedId && contacts.length > 0) {
        const found = contacts.find(c => c.id === savedId);
        if (found) setEditingContact(found);
      }
    }
  }, [contacts, project.id]);

  // Save editing contact ID to localStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      if (editingContact) {
        localStorage.setItem(`contacts_editing_id_${project.id}`, editingContact.id);
      } else {
        localStorage.removeItem(`contacts_editing_id_${project.id}`);
      }
    }
  }, [editingContact, project.id]);

  const lastEditingIdRef = React.useRef<string | undefined | null>(undefined);

  React.useEffect(() => {
    if (modalOpen) {
      const currentEditingId = editingContact?.id || null;
      if (lastEditingIdRef.current !== currentEditingId) {
        lastEditingIdRef.current = currentEditingId;
        
        let initialData: ContactFormValues = {
          name: '',
          email: '',
          phone: '',
          role: 'developer',
          notes: ''
        };

        if (!currentEditingId) {
          const saved = localStorage.getItem(`contacts_form_draft_${project.id}`);
          if (saved) {
            try {
              initialData = { ...initialData, ...JSON.parse(saved) };
            } catch {}
          }
        } else {
          initialData = {
            name: editingContact?.name || '',
            email: editingContact?.email || '',
            phone: editingContact?.phone || '',
            role: editingContact?.role || 'developer',
            notes: editingContact?.notes || ''
          };
        }
        reset(initialData);
      }
    }
  }, [modalOpen, editingContact, reset, project.id]);

  // Persist form changes in real-time
  const formValues = watch();
  React.useEffect(() => {
    if (modalOpen && !editingContact && typeof window !== 'undefined') {
      localStorage.setItem(`contacts_form_draft_${project.id}`, JSON.stringify(formValues));
    }
  }, [formValues, modalOpen, editingContact, project.id]);

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label} to clipboard`);
  };

  const onSubmit = async (values: ContactFormValues) => {
    try {
      await ContactRepository.save({
        id: editingContact?.id,
        projectId: project.id,
        ...values
      });
      localStorage.removeItem(`contacts_form_draft_${project.id}`);
      localStorage.removeItem(`contacts_editing_id_${project.id}`);
      localStorage.removeItem(`contacts_modal_open_${project.id}`);
      lastEditingIdRef.current = undefined;
      toast.success(editingContact ? 'Contact details updated' : 'Contact stakeholder added');
      setModalOpen(false);
      setEditingContact(null);
    } catch {
      toast.error('Failed to save contact');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this contact stakeholder?')) {
      try {
        await ContactRepository.delete(id, project.id);
        toast.success('Contact deleted');
      } catch {
        toast.error('Failed to delete contact');
      }
    }
  };

  // Drag Handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      const draggedItem = contacts[draggedIndex];
      const targetItem = contacts[dropIndex];
      if (draggedItem && targetItem) {
        try {
          await ContactRepository.swap(draggedItem.id, targetItem.id, project.id);
        } catch {
          toast.error('Failed to swap positions');
        }
      }
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Stakeholders & Contacts</h3>
        <button
          onClick={() => {
            setEditingContact(null);
            setModalOpen(true);
          }}
          className="bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 font-semibold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer transition"
        >
          <Plus className="w-3.5 h-3.5 text-emerald-400" />
          Add Contact
        </button>
      </div>

      {contacts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {contacts.map((c, index) => (
            <div 
              key={c.id} 
              draggable={currentRole !== 'viewer'}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`bg-zinc-900/10 border p-5 rounded-xl flex flex-col justify-between gap-4 group transition-all duration-200 ${
                currentRole !== 'viewer' ? 'cursor-grab active:cursor-grabbing' : ''
              } ${
                draggedIndex === index ? 'opacity-40 border-dashed border-zinc-700 bg-zinc-950/20' : 
                dragOverIndex === index ? 'border-emerald-500 border-dashed scale-[1.02] shadow-[0_0_15px_rgba(16,185,129,0.15)] bg-emerald-950/5' : 
                'border-zinc-900'
              }`}
            >
              {/* Header card */}
              <div className="flex items-center justify-between border-b border-zinc-900/60 pb-3">
                <h4 className="font-bold text-sm text-zinc-200 flex items-center gap-1.5 capitalize">
                  {currentRole !== 'viewer' && (
                    <GripVertical className="w-3.5 h-3.5 text-zinc-600 shrink-0 select-none cursor-grab active:cursor-grabbing" />
                  )}
                  <UserCheck className="w-4 h-4 text-indigo-400" />
                  {c.name}
                </h4>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {currentRole !== 'viewer' && (
                    <>
                      <button
                        onClick={() => {
                          setEditingContact(c);
                          setModalOpen(true);
                        }}
                        className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 rounded transition cursor-pointer"
                        title="Edit Contact"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-950/20 rounded transition cursor-pointer"
                        title="Delete Contact"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Body contact items */}
              <div className="space-y-2.5 text-xs">
                {/* Role Row */}
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 font-semibold flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Project Role</span>
                  <span className="text-zinc-250 font-bold bg-zinc-950 border border-zinc-850 px-2 py-0.5 rounded text-[10px]">
                    {ROLE_LABELS[c.role]}
                  </span>
                </div>

                {/* Email Row */}
                {c.email && (
                  <div className="flex items-center justify-between group/row">
                    <span className="text-zinc-500 font-semibold flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Email Address</span>
                    <div className="flex items-center gap-1.5 max-w-[65%]">
                      <span className="text-zinc-300 font-mono truncate select-all">{c.email}</span>
                      <button 
                        onClick={() => handleCopy(c.email, 'Email')}
                        className="opacity-0 group-hover/row:opacity-100 p-0.5 text-zinc-500 hover:text-zinc-300 rounded cursor-pointer transition"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Phone Row */}
                {c.phone && (
                  <div className="flex items-center justify-between group/row">
                    <span className="text-zinc-500 font-semibold flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Phone / Contact</span>
                    <div className="flex items-center gap-1.5 max-w-[65%]">
                      <span className="text-zinc-300 truncate select-all">{c.phone}</span>
                      <button 
                        onClick={() => handleCopy(c.phone, 'Phone')}
                        className="opacity-0 group-hover/row:opacity-100 p-0.5 text-zinc-500 hover:text-zinc-300 rounded cursor-pointer transition"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Notes if present */}
              {c.notes && (
                <div className="border-t border-zinc-900/60 pt-3 mt-1 flex items-start gap-1.5 text-[11px] text-zinc-500 font-medium">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <p className="line-clamp-2">{c.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-zinc-900/10 border border-zinc-900 border-dashed rounded-xl p-12 text-center text-zinc-500 text-xs">
          No contact stakeholders recorded for this project yet.
        </div>
      )}

      {/* Dialog Modaler */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-2xl relative z-10 p-6"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
                <h4 className="font-bold text-zinc-100 flex items-center gap-1.5 text-sm">
                  <Users className="w-4.5 h-4.5 text-emerald-500" />
                  {editingContact ? 'Edit Contact Info' : 'Add Contact Info'}
                </h4>
                <button onClick={() => setModalOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Contact Name *</label>
                    <input
                      type="text"
                      {...register('name')}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                      placeholder="e.g. John Doe"
                    />
                    {errors.name && <span className="text-[10px] text-red-400">{errors.name.message}</span>}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Project Role</label>
                    <select
                      {...register('role')}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                    >
                      <option value="developer">Developer</option>
                      <option value="designer">Designer</option>
                      <option value="pm">Project Manager (PM)</option>
                      <option value="client">Client Contact</option>
                      <option value="support">Support / DevOps</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Email Address</label>
                    <input
                      type="text"
                      {...register('email')}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                      placeholder="john@example.com"
                    />
                    {errors.email && <span className="text-[10px] text-red-400">{errors.email.message}</span>}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Phone Number</label>
                    <input
                      type="text"
                      {...register('phone')}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                      placeholder="+1 (555) 000-0000"
                    />
                    {errors.phone && <span className="text-[10px] text-red-400">{errors.phone.message}</span>}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Stakeholder Notes</label>
                  <textarea
                    {...register('notes')}
                    rows={3}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition resize-none"
                    placeholder="Enter any contact schedules, timezone differences, secondary emails..."
                  />
                  {errors.notes && <span className="text-[10px] text-red-400">{errors.notes.message}</span>}
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-zinc-800 pt-4 mt-6">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="bg-zinc-850 hover:bg-zinc-800 text-zinc-300 font-semibold py-2 px-4 rounded-lg text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold py-2 px-4 rounded-lg text-xs cursor-pointer"
                  >
                    {editingContact ? 'Save Changes' : 'Create Contact'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
