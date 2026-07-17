import { create } from 'zustand';

export type ConfirmVariant = 'destructive' | 'warning' | 'info';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  variant?: ConfirmVariant;
}

interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  variant: ConfirmVariant;
  onConfirm: (() => void) | null;
  onCancel: (() => void) | null;
  showConfirm: (options: ConfirmOptions) => void;
  closeConfirm: () => void;
}

export const useConfirmStore = create<ConfirmState>((set) => ({
  isOpen: false,
  title: 'Are you sure?',
  message: '',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  variant: 'warning',
  onConfirm: null,
  onCancel: null,
  showConfirm: (options) => set({
    isOpen: true,
    title: options.title || 'Are you sure?',
    message: options.message,
    confirmLabel: options.confirmLabel || 'Confirm',
    cancelLabel: options.cancelLabel || 'Cancel',
    variant: options.variant || 'warning',
    onConfirm: options.onConfirm,
    onCancel: options.onCancel || null,
  }),
  closeConfirm: () => set({
    isOpen: false,
    onConfirm: null,
    onCancel: null,
  }),
}));
