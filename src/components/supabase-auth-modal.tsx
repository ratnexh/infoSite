import React, { useState } from 'react';
import { supabase, hasSupabaseConfigured } from '@/lib/supabase/client';
import { useSyncStore } from '@/store/sync-store';
import { X, Cloud, Lock, Mail, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface SupabaseAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SupabaseAuthModal({ isOpen, onClose }: SupabaseAuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasSupabaseConfigured()) {
      toast.error('Supabase URL/Key are not configured in your .env.local file.');
      return;
    }
    
    setIsLoading(true);
    setErrorMsg(null);

    try {
      if (isSignUp) {
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        if (data?.user?.identities?.length === 0) {
          toast.info('This email is already registered. Please login.');
          setIsSignUp(false);
        } else {
          toast.success('Registration successful! Check your email for validation link.');
          onClose();
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success('Successfully connected to cloud vault!');
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during authentication.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl relative z-10 p-6 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-850 pb-3 mb-4">
          <h4 className="font-bold text-zinc-100 flex items-center gap-2 text-sm">
            <Cloud className="w-4.5 h-4.5 text-emerald-400" />
            {isSignUp ? 'Setup Cloud Vault Backup' : 'Connect Cloud Vault'}
          </h4>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning if placeholder client used */}
        {!hasSupabaseConfigured() && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3 text-xs mb-4 flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <div>
              <strong>Credentials Missing:</strong> Supabase URL and Key must be added to your environment variables to enable cloud syncing.
            </div>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@example.com"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Vault Account Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="text-red-400 text-xs font-semibold bg-red-500/5 border border-red-500/15 p-2.5 rounded-lg flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !hasSupabaseConfigured()}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-600/30 text-emerald-950 font-bold py-2 px-4 rounded-lg text-xs flex items-center justify-center gap-2 cursor-pointer transition shadow-lg active:scale-[0.98]"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {isSignUp ? 'Creating Vault...' : 'Connecting...'}
              </>
            ) : (
              <>{isSignUp ? 'Create Cloud Account' : 'Authenticate & Sync'}</>
            )}
          </button>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorMsg(null);
              }}
              className="text-[10px] text-zinc-400 hover:text-emerald-400 underline transition cursor-pointer"
            >
              {isSignUp ? 'Already have a cloud vault? Sign In' : "Don't have an account? Sign Up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
