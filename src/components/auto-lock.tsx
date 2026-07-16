'use client';

import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '@/store/settings-store';
import { useSyncStore } from '@/store/sync-store';
import { supabase, hasSupabaseConfigured } from '@/lib/supabase/client';
import { SettingsRepository } from '@/lib/storage/repositories';
import { 
  base64ToArrayBuffer, 
  arrayBufferToBase64,
  deriveKeyFromPassword,
  generateSalt,
  createVerifier,
  verifyVerifier
} from '@/lib/crypto/web-crypto';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, Shield, ShieldCheck, KeyRound, Loader2, ArrowRight, Mail, AlertCircle, LogOut } from 'lucide-react';
import { toast } from 'sonner';

export default function AutoLock({ children }: { children: React.ReactNode }) {
  const {
    isSetup,
    isUnlocked,
    lockTimeout,
    isLoading,
    checkSetup,
    unlockVault,
    lockVault,
    updateActivity
  } = useSettingsStore();

  const { isAuthenticated, userEmail } = useSyncStore();

  // Form states
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize and check if vault exists
  useEffect(() => {
    checkSetup();
  }, [checkSetup]);

  // Monitor user activity to trigger lock
  useEffect(() => {
    if (!isUnlocked || lockTimeout === 0) return;

    let lastRecordedActivity = Date.now();

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastRecordedActivity > 5000) {
        lastRecordedActivity = now;
        updateActivity();
      }
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('scroll', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    const interval = setInterval(() => {
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

  // Handle Unlock for logged-in users on Lock Screen
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setIsDecrypting(true);
    setErrorMsg(null);
    await new Promise(r => setTimeout(r, 100));
    
    const success = await unlockVault(password);
    setIsDecrypting(false);

    if (success) {
      setPassword('');
      toast.success('Vault unlocked');
    } else {
      setErrorMsg('Invalid Master Password');
      toast.error('Invalid Master Password');
    }
  };

  // Combined Auth Sign In & Sign Up Handler
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasSupabaseConfigured()) {
      toast.error('Supabase URL/Key are not configured in your .env.local file.');
      return;
    }
    
    setIsDecrypting(true);
    setErrorMsg(null);
    await new Promise(r => setTimeout(r, 100));

    try {
      if (isSignUp) {
        // Validation
        if (password.length < 8) {
          throw new Error('Password must be at least 8 characters long');
        }
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }

        // Generate client-side salt and verifier using entered password
        const saltBytes = generateSalt();
        const saltBase64 = arrayBufferToBase64(saltBytes.buffer as ArrayBuffer);
        const key = await deriveKeyFromPassword(password, saltBytes);
        const verifier = await createVerifier(key);

        // Sign Up in Supabase and upload salt/verifier metadata
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              vault_salt: saltBase64,
              vault_verifier: verifier
            }
          }
        });

        if (error) throw error;

        // If email confirmation is required, Supabase might not log in immediately
        if (data?.user?.identities?.length === 0) {
          toast.info('This email is already registered. Please login.');
          setIsSignUp(false);
        } else if (!data?.session) {
          // If no session (awaiting email verification), store locally so it works immediately upon login
          await SettingsRepository.set('vault_salt', saltBase64);
          await SettingsRepository.set('vault_verifier', verifier);
          await checkSetup();
          toast.success('Registration successful! Please check your email to confirm your account.');
          setIsSignUp(false);
        } else {
          // Auto-logged in
          await SettingsRepository.set('vault_salt', saltBase64);
          await SettingsRepository.set('vault_verifier', verifier);
          await checkSetup();

          // Unlock store directly since we derived the key
          useSettingsStore.setState({
            isUnlocked: true,
            encryptionKey: key,
            lastActivity: Date.now()
          });

          toast.success('Registration successful & vault initialized!');
        }
      } else {
        // Sign In
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        const metadata = data.user?.user_metadata;
        if (metadata?.vault_salt && metadata?.vault_verifier) {
          const saltBytes = new Uint8Array(base64ToArrayBuffer(metadata.vault_salt));
          const key = await deriveKeyFromPassword(password, saltBytes);
          const isVerified = await verifyVerifier(metadata.vault_verifier, key);

          if (isVerified) {
            // Write to Dexie
            await SettingsRepository.set('vault_salt', metadata.vault_salt);
            await SettingsRepository.set('vault_verifier', metadata.vault_verifier);
            await checkSetup();

            // Unlock
            useSettingsStore.setState({
              isUnlocked: true,
              encryptionKey: key,
              lastActivity: Date.now()
            });

            toast.success('Welcome back! Vault unlocked and synced.');
          } else {
            throw new Error('Failed to verify vault encryption key. The password might be incorrect for this vault.');
          }
        } else {
          // User exists but has no vault. Let's initialize a new vault with their current login password.
          const saltBytes = generateSalt();
          const saltBase64 = arrayBufferToBase64(saltBytes.buffer as ArrayBuffer);
          const key = await deriveKeyFromPassword(password, saltBytes);
          const verifier = await createVerifier(key);

          // Update user metadata in Supabase
          const { error: updateError } = await supabase.auth.updateUser({
            data: {
              vault_salt: saltBase64,
              vault_verifier: verifier
            }
          });

          if (updateError) throw updateError;

          // Write locally
          await SettingsRepository.set('vault_salt', saltBase64);
          await SettingsRepository.set('vault_verifier', verifier);
          await checkSetup();

          // Unlock
          useSettingsStore.setState({
            isUnlocked: true,
            encryptionKey: key,
            lastActivity: Date.now()
          });

          toast.success('Vault successfully initialized and unlocked!');
        }
      }
    } catch (err: any) {
      console.error('Authentication Error:', err);
      setErrorMsg(err.message || 'An error occurred.');
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleSignOut = async () => {
    if (confirm('Are you sure you want to sign out? This will clear all local vault cache.')) {
      try {
        await supabase.auth.signOut();
        toast.success('Successfully logged out');
      } catch (err: any) {
        toast.error(err.message || 'Logout failed');
      }
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

  // 2. Unauthenticated onboarding/auth screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4 relative overflow-hidden select-none">
        {/* Glow ambient background effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-60 h-60 rounded-full bg-indigo-500/5 blur-3xl" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 p-8 rounded-2xl shadow-2xl relative z-10"
        >
          {/* Tabs */}
          <div className="flex border-b border-zinc-800 mb-6">
            <button
              type="button"
              className={`flex-1 pb-3 text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                !isSignUp ? 'text-emerald-400 border-b-2 border-emerald-500' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              onClick={() => {
                setIsSignUp(false);
                setErrorMsg(null);
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`flex-1 pb-3 text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                isSignUp ? 'text-emerald-400 border-b-2 border-emerald-500' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              onClick={() => {
                setIsSignUp(true);
                setErrorMsg(null);
              }}
            >
              Sign Up
            </button>
          </div>

          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-12 h-12 bg-emerald-950/40 border border-emerald-500/30 rounded-full flex items-center justify-center text-emerald-400 mb-3">
              {isSignUp ? <ShieldCheck className="w-5.5 h-5.5" /> : <Shield className="w-5.5 h-5.5" />}
            </div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-50">
              {isSignUp ? 'Create Developer Vault' : 'Unlock Your Vault'}
            </h1>
            <p className="text-zinc-400 text-xs mt-1.5 max-w-xs">
              {isSignUp 
                ? 'Sign up to create an encrypted cloud-synced developer repository.' 
                : 'Sign in to sync and decrypt your secure credentials.'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-10 pr-3.5 py-2.5 text-zinc-100 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500 transition"
                  placeholder="developer@example.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider">Account Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-10 pr-10 py-2.5 text-zinc-100 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500 transition"
                  placeholder="Password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {isSignUp && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-10 pr-3.5 py-2.5 text-zinc-100 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500 transition"
                    placeholder="Confirm password"
                    required
                  />
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="text-red-400 text-xs font-semibold bg-red-500/5 border border-red-500/15 p-2.5 rounded-lg flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={isDecrypting}
              className="w-full mt-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-600/50 text-emerald-950 font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/25 transition active:scale-[0.98]"
            >
              {isDecrypting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {isSignUp ? 'Create Cloud Account' : 'Authenticate & Decrypt'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center text-[10px] text-zinc-500 border-t border-zinc-800/80 pt-4 leading-relaxed">
            🛡️ <b>Client-Side Encrypted:</b> Your password is never sent to the server. All data is encrypted locally using the Web Crypto API before synchronizing.
          </div>
        </motion.div>
      </div>
    );
  }

  // 3. Lock Screen Overlay (Authenticated, but vault is currently locked)
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
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 bg-zinc-800/80 border border-zinc-700/50 rounded-full flex items-center justify-center text-zinc-300 mb-4 shadow-inner">
              <Lock className="w-5 h-5 text-indigo-400 animate-pulse" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-50">Vault is Locked</h1>
            <p className="text-zinc-400 text-xs mt-1.5">
              Enter your account password to decrypt the vault.
            </p>
            {userEmail && (
              <span className="text-[10px] font-semibold text-zinc-550 bg-zinc-950 border border-zinc-850 px-2 py-0.5 rounded mt-3">
                {userEmail}
              </span>
            )}
          </div>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div className="space-y-1.5">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 transition pr-10"
                  placeholder="Account Password"
                  autoFocus
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="text-red-400 text-xs font-semibold bg-red-500/5 border border-red-500/15 p-2 rounded-lg flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {errorMsg}
              </div>
            )}

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

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={handleSignOut}
              className="text-[10px] text-zinc-550 hover:text-red-400 flex items-center justify-center gap-1.5 mx-auto transition cursor-pointer font-bold"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out / Switch Account
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // 4. Main Application View (Vault is fully unlocked)
  return <>{children}</>;
}
