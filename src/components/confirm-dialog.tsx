'use client';

import React, { useEffect } from 'react';
import { useConfirmStore } from '@/store/confirm-store';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2, HelpCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ConfirmDialog() {
  const {
    isOpen,
    title,
    message,
    confirmLabel,
    cancelLabel,
    variant,
    onConfirm,
    onCancel,
    closeConfirm,
  } = useConfirmStore();

  // Keyboard accessibility: Escape to close/cancel, Enter to confirm
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        if (onCancel) onCancel();
        closeConfirm();
      } else if (e.key === 'Enter') {
        if (onConfirm) onConfirm();
        closeConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onConfirm, onCancel, closeConfirm]);

  const handleCancelClick = () => {
    if (onCancel) onCancel();
    closeConfirm();
  };

  const handleConfirmClick = () => {
    if (onConfirm) onConfirm();
    closeConfirm();
  };

  // Variant helper settings
  const variantConfig = {
    destructive: {
      icon: Trash2,
      iconClass: 'text-red-500 bg-red-500/10 dark:bg-red-500/5 border-red-500/20',
      confirmBtnClass: 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20',
    },
    warning: {
      icon: AlertTriangle,
      iconClass: 'text-amber-500 bg-amber-500/10 dark:bg-amber-500/5 border-amber-500/20',
      confirmBtnClass: 'bg-amber-500 hover:bg-amber-600 text-zinc-950 shadow-amber-500/10',
    },
    info: {
      icon: HelpCircle,
      iconClass: 'text-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/5 border-emerald-500/20',
      confirmBtnClass: 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20',
    },
  };

  const currentVariant = variantConfig[variant] || variantConfig.warning;
  const IconComponent = currentVariant.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCancelClick}
            className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm"
          />

          {/* Dialog Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', duration: 0.28 }}
            className="w-full max-w-sm bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5.5 shadow-2xl relative z-10 space-y-4"
          >
            {/* Close Button */}
            <button
              onClick={handleCancelClick}
              className="absolute right-4 top-4 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 rounded-lg transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            {/* Header Content */}
            <div className="flex items-start gap-3.5">
              <div className={cn("p-2 border rounded-xl flex items-center justify-center shrink-0 shadow-sm", currentVariant.iconClass)}>
                <IconComponent className="w-4.5 h-4.5" />
              </div>
              <div className="space-y-1.5 pr-4 flex-1">
                <h3 className="text-sm font-semibold tracking-wide text-zinc-900 dark:text-zinc-50 leading-tight">
                  {title}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-normal">
                  {message}
                </p>
              </div>
            </div>

            {/* Actions Grid */}
            <div className="flex items-center gap-2 justify-end pt-1">
              <button
                onClick={handleCancelClick}
                className="bg-transparent border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 text-zinc-650 dark:text-zinc-400 font-semibold py-1.5 px-3.5 rounded-lg text-xs transition cursor-pointer"
              >
                {cancelLabel}
              </button>
              <button
                onClick={handleConfirmClick}
                className={cn(
                  "font-bold py-1.5 px-3.5 rounded-lg text-xs transition cursor-pointer shadow-md hover:shadow-lg active:scale-[0.98]",
                  currentVariant.confirmBtnClass
                )}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
