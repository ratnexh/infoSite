'use client';

import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '@/store/settings-store';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Eye, EyeOff, Shield, ShieldCheck, KeyRound, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export default function AutoLock({ children }: { children: React.ReactNode }) {
  const {
    isSetup,
    isUnlocked,
    lockTimeout,
    isLoading,
    checkSetup,
    setupVault,
    unlockVault,
    lockVault,
    updateActivity
  } = useSettingsStore();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);

  // Initialize and check if vault exists
  useEffect(() => {
    checkSetup();
  }, [checkSetup]);

  // Monitor user activity to trigger lock
  useEffect(() => {
    if (!isUnlocked || lockTimeout === 0) return;

    // Local throttle tracker to prevent updating Zustand on every frame
    let lastRecordedActivity = Date.now();

    const handleActivity = () => {
      const now = Date.now();
      // Only fire a state update once every 5 seconds
      if (now - lastRecordedActivity > 5000) {
        lastRecordedActivity = now;
        updateActivity();
      }
    };

    // Register activity listeners
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('scroll', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    // Lock checker loop (runs every 5 seconds)
    const interval = setInterval(() => {
      // Read state directly from store ref to avoid subscribing this component to frequent re-renders
      const currentLastActivity = useSettingsStore.getState().lastActivity;
      const idleTime = Date.now() - currentLastActivity;
      const timeoutMs = lockTimeout * 60 * 1000;
      
      if (idleTime >= timeoutMs) {
        lockVault();
        toast.info('Vault locked due to inactivity');
      }
    }, 5000);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      clearInterval(interval);
    };
  }, [isUnlocked, lockTimeout, updateActivity, lockVault]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setIsDecrypting(true);
    // Give UI a tiny beat to animate loading
    await new Promise(r => setTimeout(r, 100));
    
    const success = await unlockVault(password);
    setIsDecrypting(false);

    if (success) {
      setPassword('');
      toast.success('Vault unlocked');
    } else {
      toast.error('Invalid Master Password');
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      toast.error('Please enter a password');
      return;
    }
    if (password.length < 8) {
      toast.error('Master Password must be at least 8 characters long');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsDecrypting(true);
    try {
      await setupVault(password);
      setPassword('');
      setConfirmPassword('');
      toast.success('Vault successfully created!');
    } catch (err) {
      toast.error('Failed to create vault');
    } finally {
      setIsDecrypting(false);
    }
  };

  // 1. Sleek loading screen during startup checks
  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-100">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-4" />
        <p className="text-sm font-medium tracking-wide text-zinc-400">Loading Secure Vault...</p>
      </div>
    );
  }

  // 2. Onboarding Setup Screen (No Master Password set up yet)
  if (!isSetup) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4 relative overflow-hidden select-none">
        {/* Glow ambient background effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-60 h-60 rounded-full bg-blue-500/5 blur-3xl" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 p-8 rounded-2xl shadow-2xl relative z-10"
        >
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-14 h-14 bg-emerald-950/40 border border-emerald-500/30 rounded-full flex items-center justify-center text-emerald-400 mb-4">
              <Shield className="w-6 h-6 animate-pulse" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Create Local Vault</h1>
            <p className="text-zinc-400 text-sm mt-2 max-w-xs">
              Configure a Master Password. All data is encrypted locally using the Web Crypto API before storing.
            </p>
          </div>

          <form onSubmit={handleSetup} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 tracking-wide uppercase">Master Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500 transition pr-10"
                  placeholder="Min 8 characters"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 tracking-wide uppercase">Confirm Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500 transition"
                placeholder="Confirm password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isDecrypting}
              className="w-full mt-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-600/50 text-emerald-950 font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/25 transition active:scale-[0.98]"
            >
              {isDecrypting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating Keys...
                </>
              ) : (
                <>
                  Create Vault
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center text-xs text-zinc-500 border-t border-zinc-800/80 pt-4">
            ⚠️ <b>Important:</b> There is no backend. If you forget your Master Password, your data cannot be recovered.
          </div>
        </motion.div>
      </div>
    );
  }

  // 3. Lock Screen Overlay (Master Password exists, but vault is currently locked)
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4 relative overflow-hidden select-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-indigo-500/5 blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-60 h-60 rounded-full bg-emerald-500/5 blur-3xl" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 p-8 rounded-2xl shadow-2xl relative z-10"
        >
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-14 h-14 bg-zinc-800/80 border border-zinc-700/50 rounded-full flex items-center justify-center text-zinc-300 mb-4 shadow-inner">
              <Lock className="w-5 h-5 text-indigo-400 animate-pulse" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-50">Vault is Locked</h1>
            <p className="text-zinc-400 text-xs mt-1.5">
              Enter your Master Password to unlock Site Vault.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div className="space-y-1.5">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 transition pr-10"
                  placeholder="Master Password"
                  autoFocus
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isDecrypting}
              className="w-full bg-zinc-100 hover:bg-white disabled:bg-zinc-300/50 text-zinc-950 font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition shadow-md active:scale-[0.98]"
            >
              {isDecrypting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-900" />
                  Unlocking...
                </>
              ) : (
                <>
                  Unlock Vault
                  <KeyRound className="w-4 h-4 text-zinc-700" />
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  // 4. Main Application View (Vault is fully unlocked)
  return <>{children}</>;
}
