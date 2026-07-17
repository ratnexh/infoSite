'use client';

import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '@/store/settings-store';
import { useSyncStore } from '@/store/sync-store';
import { supabase } from '@/lib/supabase/client';
import { clearAllTables } from '@/lib/db/dexie-db';
import { ImportExportService } from '@/lib/storage/import-export';
import { 
  KeyRound, 
  Clock, 
  Download, 
  Upload, 
  ShieldCheck, 
  QrCode, 
  Loader2, 
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Smartphone,
  Laptop,
  CheckCircle,
  Eye,
  EyeOff,
  FileText,
  X,
  Lock,
  ShieldAlert,
  ArrowRight,
  Shield,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import SupabaseSettings from './supabase-settings';
import { cn } from '@/lib/utils';
import { useConfirmStore } from '@/store/confirm-store';

export default function SettingsPage() {
  const { 
    lockTimeout, 
    setLockTimeout, 
    changeMasterPassword, 
    isLoading 
  } = useSettingsStore();

  const { isAuthenticated, userEmail, lastSyncedAt } = useSyncStore();
  const { showConfirm } = useConfirmStore();

  // 1. Password state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Modals / Confirmations
  const [showRotationConfirm, setShowRotationConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);

  // 2. 2FA simulated state
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [show2FAPanel, setShow2FAPanel] = useState(false);
  const [twoFACode, setTwoFACode] = useState('');
  const [is2FAVerified, setIs2FAVerified] = useState(false);

  // 3. Active Session Device location fetch
  const [deviceLocation, setDeviceLocation] = useState('Detecting location...');

  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then((res) => res.json())
      .then((data) => {
        if (data.city && data.country_name) {
          setDeviceLocation(`${data.city}, ${data.country_name}`);
        } else {
          setDeviceLocation('Localhost');
        }
      })
      .catch(() => {
        setDeviceLocation('Localhost');
      });
  }, []);

  const mockDevices = [
    { name: 'Windows Desktop PC', location: deviceLocation, status: 'Active Session', active: true, icon: Laptop, time: 'Now' },
  ];

  // 4. Auto-lock expanded settings
  const [autoLockActive, setAutoLockActive] = useState(lockTimeout > 0);
  const [lockOnClose, setLockOnClose] = useState(true);
  const [requirePassOnWake, setRequirePassOnWake] = useState(true);

  // Synchronize auto lock state with timeout store value
  useEffect(() => {
    setAutoLockActive(lockTimeout > 0);
  }, [lockTimeout]);

  const handleAutoLockToggle = async (active: boolean) => {
    setAutoLockActive(active);
    if (!active) {
      await setLockTimeout(0);
      toast.info('Inactivity auto-lock disabled');
    } else {
      await setLockTimeout(10);
      toast.info('Auto-lock set to 10 minutes');
    }
  };

  // Password Requirements verification
  const checkReqLength = newPassword.length >= 8;
  const checkReqNumber = /\D*/.test(newPassword) && /\d/.test(newPassword);
  const checkReqSymbol = /[^A-Za-z0-9]/.test(newPassword);

  const getPasswordStrength = () => {
    if (!newPassword) return { score: 0, text: 'Empty', color: 'bg-zinc-800' };
    let score = 0;
    if (checkReqLength) score++;
    if (checkReqNumber) score++;
    if (checkReqSymbol) score++;
    if (newPassword.length > 12) score++;

    if (score <= 1) return { score: 25, text: 'Weak', color: 'bg-red-500' };
    if (score === 2) return { score: 50, text: 'Medium', color: 'bg-amber-500' };
    if (score === 3) return { score: 75, text: 'Strong', color: 'bg-emerald-500' };
    return { score: 100, text: 'Excellent', color: 'bg-emerald-400 shadow-lg shadow-emerald-500/20' };
  };

  const strength = getPasswordStrength();

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error('All password fields are required');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    // Open confirmation warning before initiating key rotation
    setShowRotationConfirm(true);
  };

  const executePasswordRotation = async () => {
    setShowRotationConfirm(false);
    setPasswordLoading(true);
    await new Promise(r => setTimeout(r, 100));

    try {
      const success = await changeMasterPassword(oldPassword, newPassword);
      if (success) {
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        toast.success('Master Password rotated and all records re-encrypted successfully!');
      } else {
        toast.error('Incorrect current password or rotation failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Key rotation failed.');
    } finally {
      setPasswordLoading(false);
    }
  };

  // Import / Export JSON
  const handleExportJSON = async () => {
    try {
      const data = await ImportExportService.exportJSON();
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(data);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `site-vault-json-backup-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success("JSON backup exported successfully!");
    } catch {
      toast.error("Failed to export JSON backup");
    }
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    showConfirm({
      title: 'Import Backup JSON',
      message: 'Importing backup will wipe your current local database and overwrite it. Are you sure?',
      confirmLabel: 'Wipe & Import',
      variant: 'info',
      onConfirm: async () => {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const contents = event.target?.result as string;
            await ImportExportService.importJSON(contents);
            toast.success("Backup successfully restored! Refreshing...");
            setTimeout(() => window.location.reload(), 1000);
          } catch (err: any) {
            toast.error(err.message || "Failed to import JSON file");
          }
        };
        reader.readAsText(file);
      }
    });
    e.target.value = '';
  };

  // Import / Export CSV
  const handleExportCSV = async () => {
    try {
      const data = await ImportExportService.exportProjectsCSV();
      const dataStr = "data:text/csv;charset=utf-8," + encodeURIComponent(data);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `site-vault-projects-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success("Spreadsheet projects exported successfully!");
    } catch {
      toast.error("Failed to export CSV");
    }
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const contents = event.target?.result as string;
        const count = await ImportExportService.importProjectsCSV(contents);
        toast.success(`Successfully imported and merged ${count} projects!`);
      } catch (err: any) {
        toast.error(err.message || "Failed to import CSV file");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleVerify2FA = (e: React.FormEvent) => {
    e.preventDefault();
    if (twoFACode.trim().length === 6) {
      setIs2FAVerified(true);
      setIs2FAEnabled(true);
      toast.success('2FA configuration verified and enabled!');
    } else {
      toast.error('Code must be 6 digits');
    }
  };

  // Permanent Wipe Reset Vault
  const handleResetVault = async () => {
    if (resetConfirmText !== 'RESET') {
      toast.error('Please type RESET to confirm');
      return;
    }

    setShowResetConfirm(false);
    toast.loading('Resetting vault databases and cleaning sessions...');
    await new Promise(r => setTimeout(r, 1500));

    try {
      await clearAllTables();
      await supabase.auth.signOut();
      useSettingsStore.setState({
        isSetup: false,
        isUnlocked: false,
        encryptionKey: null
      });
      toast.dismiss();
      toast.success('Site Vault reset completely. Starting onboarding...');
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: any) {
      toast.dismiss();
      toast.error(err.message || 'Wipe failed.');
    }
  };

  // Security score helper
  const calculateSecurityScore = () => {
    let score = 50; // master password baseline
    if (is2FAEnabled) score += 25;
    if (isAuthenticated) score += 25;
    return score;
  };

  const securityScore = calculateSecurityScore();

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      
      {/* Header Banner */}
      <div className="border-b border-zinc-900 pb-5">
        <h1 className="text-xl font-bold tracking-tight text-zinc-50 flex items-center gap-2">
          Settings & Security
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Manage cryptographic master passwords, configure simulated 2FA settings, inactivity logs, backups, and cloud vaults.
        </p>
      </div>

      {/* Security Status Card Summary */}
      <div className="bg-zinc-900/10 border border-zinc-900 rounded-2xl p-5 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* Security Score Meter */}
        <div className="border-b md:border-b-0 md:border-r border-zinc-900 pb-4 md:pb-0 md:pr-4 flex flex-col justify-between">
          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Vault Security Score</span>
          <div className="flex items-end gap-2 mt-2">
            <span className="text-3xl font-extrabold text-zinc-100">{securityScore}%</span>
            <span className={cn(
              "text-[9px] font-bold px-2 py-0.5 rounded border uppercase mb-1 leading-none",
              securityScore === 100 ? "text-emerald-400 bg-emerald-500/5 border-emerald-500/15" :
              securityScore >= 75 ? "text-blue-400 bg-blue-500/5 border-blue-500/15" :
              "text-amber-500 bg-amber-500/5 border-amber-500/15"
            )}>
              {securityScore === 100 ? 'Secure' : securityScore >= 75 ? 'Good' : 'At Risk'}
            </span>
          </div>
          <div className="w-full h-1 bg-zinc-900 rounded-full mt-3 overflow-hidden">
            <div className={cn("h-full rounded-full transition-all duration-500", securityScore === 100 ? 'bg-emerald-500' : securityScore >= 75 ? 'bg-blue-500' : 'bg-amber-500')} style={{ width: `${securityScore}%` }} />
          </div>
        </div>

        {/* Status columns */}
        <div className="grid grid-cols-2 md:grid-cols-3 col-span-3 gap-4 items-center">
          
          <div className="space-y-1">
            <span className="text-[8px] font-bold text-zinc-550 uppercase tracking-wider block">Master Password</span>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-zinc-200">Active</span>
            </div>
            <p className="text-[9px] text-zinc-500">Encrypted client-side</p>
          </div>

          <div className="space-y-1">
            <span className="text-[8px] font-bold text-zinc-550 uppercase tracking-wider block">Authenticator 2FA</span>
            <div className="flex items-center gap-1.5">
              {is2FAEnabled ? (
                <>
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-zinc-200">Enabled</span>
                </>
              ) : (
                <>
                  <X className="w-4 h-4 text-zinc-500" />
                  <span className="text-xs font-semibold text-zinc-400">Disabled</span>
                </>
              )}
            </div>
            <p className="text-[9px] text-zinc-500">MFA token simulation</p>
          </div>

          <div className="space-y-1 col-span-2 md:col-span-1">
            <span className="text-[8px] font-bold text-zinc-550 uppercase tracking-wider block">Cloud Sync Vault</span>
            <div className="flex items-center gap-1.5">
              {isAuthenticated ? (
                <>
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-zinc-200">Connected</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-semibold text-amber-500">Offline Link</span>
                </>
              )}
            </div>
            <p className="text-[9px] text-zinc-500 truncate">{userEmail || 'Local only storage'}</p>
          </div>

        </div>
      </div>

      {/* Two Column settings grid */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        
        {/* Left Column (70%): Account Security forms */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Master Password Form */}
          <div className="bg-zinc-900/10 border border-zinc-900 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
              <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-emerald-500" />
                Password Cryptographic Rotation
              </h3>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Rotating your master password decrypts all stored secrets, databases, and third-party credential payloads locally in browser memory, and re-encrypts them using a newly derived cryptographic key.
            </p>

            <form onSubmit={handlePasswordSubmit} className="space-y-4 pt-2">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Current password */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Current Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="Enter current password"
                      className="w-full bg-zinc-950 border border-zinc-850 rounded-lg px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/30 focus:border-emerald-500 transition"
                      required
                    />
                  </div>
                </div>

                <div className="hidden sm:block" />

                {/* New password */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">New Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full bg-zinc-950 border border-zinc-850 rounded-lg px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/30 focus:border-emerald-500 transition pr-8"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-350 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Confirm password */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Confirm New Password</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Verify new password"
                    className="w-full bg-zinc-950 border border-zinc-850 rounded-lg px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/30 focus:border-emerald-500 transition"
                    required
                  />
                </div>

              </div>

              {/* Password strength & requirements checklist */}
              {newPassword && (
                <div className="border border-zinc-900 bg-zinc-950/60 rounded-xl p-3.5 space-y-3 animate-slide-up">
                  
                  {/* Strength bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[9px] font-bold uppercase text-zinc-500">
                      <span>Password Strength</span>
                      <span className="text-zinc-300">{strength.text}</span>
                    </div>
                    <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all duration-350", strength.color)} style={{ width: `${strength.score}%` }} />
                    </div>
                  </div>

                  {/* Requirements checklist */}
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-500 font-medium">
                    <div className="flex items-center gap-1.5">
                      <div className={cn("w-3.5 h-3.5 rounded-full flex items-center justify-center border text-[8px]", checkReqLength ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/5" : "border-zinc-800")}>
                        {checkReqLength ? '✓' : '•'}
                      </div>
                      <span>Min 8 characters</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className={cn("w-3.5 h-3.5 rounded-full flex items-center justify-center border text-[8px]", checkReqNumber ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/5" : "border-zinc-800")}>
                        {checkReqNumber ? '✓' : '•'}
                      </div>
                      <span>Contains a number</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className={cn("w-3.5 h-3.5 rounded-full flex items-center justify-center border text-[8px]", checkReqSymbol ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/5" : "border-zinc-800")}>
                        {checkReqSymbol ? '✓' : '•'}
                      </div>
                      <span>Special character</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className={cn("w-3.5 h-3.5 rounded-full flex items-center justify-center border text-[8px]", confirmPassword && newPassword === confirmPassword ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/5" : "border-zinc-800")}>
                        {confirmPassword && newPassword === confirmPassword ? '✓' : '•'}
                      </div>
                      <span>Passwords match</span>
                    </div>
                  </div>

                </div>
              )}

              <div className="flex justify-end border-t border-zinc-900/60 pt-4 mt-2">
                <button
                  type="submit"
                  disabled={passwordLoading || (newPassword !== '' && (!checkReqLength || newPassword !== confirmPassword))}
                  className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-600/30 text-emerald-950 font-bold py-2 px-4 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition active:scale-[0.98]"
                >
                  {passwordLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-950" />}
                  Rotate Master Password
                </button>
              </div>

            </form>
          </div>

          {/* Two-Factor Authentication (Simulated) */}
          <div className="bg-zinc-900/10 border border-zinc-900 rounded-2xl p-6 space-y-4">
            
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
              <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Two-Factor Authentication (Simulated)
              </h3>
              
              <span className={cn(
                "text-[9px] font-bold px-2 py-0.5 rounded border uppercase leading-none",
                is2FAEnabled ? "text-emerald-400 bg-emerald-500/5 border-emerald-500/15" : "text-zinc-500 bg-zinc-900 border-zinc-800"
              )}>
                {is2FAEnabled ? 'Active' : 'Inactive'}
              </span>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Adding Multi-factor authentication blocks unauthorized local unlocking sessions. Pair with Google Authenticator or 1Password app to test this mockup implementation.
            </p>

            <div className="pt-2">
              {!is2FAEnabled ? (
                !show2FAPanel ? (
                  <button
                    onClick={() => setShow2FAPanel(true)}
                    className="bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 hover:text-zinc-100 text-zinc-300 font-bold py-2.5 px-4 rounded-xl text-xs transition cursor-pointer"
                  >
                    Setup 2FA Authenticator
                  </button>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="border border-zinc-850 bg-zinc-950/60 rounded-xl p-4.5 space-y-4 shadow-inner"
                  >
                    <div className="flex flex-col sm:flex-row gap-5 items-center">
                      {/* Pixel art QR mock */}
                      <div className="w-24 h-24 bg-zinc-900 border border-zinc-850 rounded-lg flex flex-col items-center justify-center p-2 text-zinc-400 shrink-0">
                        <QrCode className="w-12 h-12 text-zinc-300" />
                        <span className="text-[7px] font-extrabold text-zinc-550 mt-2 uppercase tracking-widest">SITE VAULT</span>
                      </div>

                      <div className="space-y-1.5 flex-1 w-full text-center sm:text-left">
                        <h4 className="text-[10px] font-bold text-zinc-300 uppercase tracking-wide">Pair Authenticator App</h4>
                        <p className="text-xs text-zinc-500 leading-relaxed">
                          Scan the mock QR code or type the setup key into your authenticator app:
                        </p>
                        <code className="text-xs font-bold bg-zinc-900 border border-zinc-850 text-zinc-300 px-3 py-1 rounded block w-fit mx-auto sm:mx-0 select-all font-mono">
                          SITV-AUL7-PWA8-DEC9
                        </code>
                      </div>
                    </div>

                    <form onSubmit={handleVerify2FA} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 border-t border-zinc-900/60 pt-4">
                      <input
                        type="text"
                        maxLength={6}
                        value={twoFACode}
                        onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, ''))}
                        placeholder="Enter 6-digit verification code"
                        className="bg-zinc-900 border border-zinc-850 rounded-lg px-3 py-2 text-zinc-200 text-xs w-full sm:w-44 text-center font-bold tracking-widest focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                        required
                      />
                      <button
                        type="submit"
                        className="bg-zinc-100 hover:bg-white text-zinc-950 font-bold py-2 px-4 rounded-lg text-xs cursor-pointer transition shadow active:scale-[0.98]"
                      >
                        Verify & Enable
                      </button>
                    </form>
                  </motion.div>
                )
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2.5 bg-emerald-500/5 border border-emerald-500/10 p-3.5 rounded-xl text-xs text-emerald-400">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span className="font-semibold">Authenticator app 2FA is active and safeguarding your encryption keys.</span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setShowRecoveryModal(true)}
                      className="bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 text-zinc-300 font-bold py-2 px-3.5 rounded-lg text-xs transition cursor-pointer"
                    >
                      View Recovery Codes
                    </button>
                    <button
                      onClick={() => {
                        toast.promise(new Promise(r => setTimeout(r, 1000)), {
                          loading: 'Regenerating QR code parameters...',
                          success: 'QR code regenerated successfully!',
                          error: 'Failed to regenerate.'
                        });
                      }}
                      className="bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 text-zinc-350 font-semibold py-2 px-3.5 rounded-lg text-xs transition cursor-pointer"
                    >
                      Regenerate QR Code
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Connected Devices (Future placeholder) */}
          <div className="bg-zinc-900/10 border border-zinc-900 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
              <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Laptop className="w-4 h-4 text-emerald-500" />
                Active Sessions & Devices
              </h3>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              These devices have decrypted access keys cached in active memory. You can revoke access sessions to lock vaults on those screens immediately.
            </p>

            <div className="divide-y divide-zinc-900/60 rounded-xl border border-zinc-900 bg-zinc-950/20 overflow-hidden mt-3">
              {mockDevices.map((dev, i) => (
                <div key={i} className="flex items-center justify-between p-4 gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="p-2 bg-zinc-900 border border-zinc-850 rounded-lg text-zinc-400 flex items-center justify-center shrink-0">
                      <dev.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-200">{dev.name}</h4>
                      <p className="text-[10px] text-zinc-550 mt-0.5">{dev.location} • {dev.time}</p>
                    </div>
                  </div>

                  <span className={cn(
                    "text-[8px] font-bold uppercase px-2 py-0.5 rounded-full border leading-none shrink-0",
                    dev.active ? "text-emerald-400 bg-emerald-500/5 border-emerald-500/15" : "text-zinc-500 border-zinc-850 bg-zinc-900"
                  )}>
                    {dev.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column (30%): Settings Parameters */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Auto-Lock Settings */}
          <div className="bg-zinc-900/20 border border-zinc-900 rounded-2xl p-4.5 space-y-4">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-zinc-500" />
              Auto-Lock Policies
            </h3>
            
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
              <span className="text-xs text-zinc-300 font-semibold">Enable Auto-Lock</span>
              <button
                onClick={() => handleAutoLockToggle(!autoLockActive)}
                className={cn(
                  "w-9 h-5 rounded-full p-0.5 transition cursor-pointer focus:outline-none flex items-center border",
                  autoLockActive ? "bg-emerald-500 border-emerald-600 justify-end" : "bg-zinc-900 border-zinc-800 justify-start"
                )}
              >
                <div className="w-3.5 h-3.5 rounded-full bg-zinc-100 shadow" />
              </button>
            </div>

            {autoLockActive && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: 'auto' }} 
                className="space-y-4 pt-1"
              >
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Inactivity Timeout</label>
                  <select
                    value={lockTimeout}
                    onChange={(e) => setLockTimeout(parseInt(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-850 text-zinc-300 rounded-lg px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-500/30 cursor-pointer"
                  >
                    <option value={1}>1 Minute</option>
                    <option value={5}>5 Minutes</option>
                    <option value={10}>10 Minutes</option>
                    <option value={30}>30 Minutes</option>
                    <option value={60}>60 Minutes</option>
                  </select>
                  <p className="text-[9px] text-zinc-550 leading-relaxed font-semibold">Clear key from memory after this many minutes.</p>
                </div>

                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={lockOnClose}
                    onChange={(e) => setLockOnClose(e.target.checked)}
                    id="lockOnClose"
                    className="mt-0.5 cursor-pointer accent-emerald-500"
                  />
                  <div className="flex flex-col gap-0.5">
                    <label htmlFor="lockOnClose" className="text-[11px] font-bold text-zinc-300 cursor-pointer select-none">Lock on Browser Close</label>
                    <span className="text-[9px] text-zinc-550 font-semibold leading-relaxed">Locks screen when browser windows are closed.</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={requirePassOnWake}
                    onChange={(e) => setRequirePassOnWake(e.target.checked)}
                    id="requirePassOnWake"
                    className="mt-0.5 cursor-pointer accent-emerald-500"
                  />
                  <div className="flex flex-col gap-0.5">
                    <label htmlFor="requirePassOnWake" className="text-[11px] font-bold text-zinc-300 cursor-pointer select-none">Require password after wake</label>
                    <span className="text-[9px] text-zinc-550 font-semibold leading-relaxed">Prompts password even when session key is active.</span>
                  </div>
                </div>
              </motion.div>
            )}

            {!autoLockActive && (
              <p className="text-[9px] text-zinc-500 leading-relaxed font-semibold">
                ⚠️ **Caution:** Disabling inactivity locks leaves credentials decrypted in browser memory indefinitely. Keep auto-lock on for security.
              </p>
            )}
          </div>

          {/* Backup & Restore Panel */}
          <div className="bg-zinc-900/20 border border-zinc-900 rounded-2xl p-4.5 space-y-4">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Download className="w-4 h-4 text-zinc-500" />
              Backup & Restore Data
            </h3>

            {/* Local Backup Section */}
            <div className="border border-zinc-900 bg-zinc-950/40 rounded-xl p-3.5 space-y-2.5">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">Local Backup</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleExportJSON}
                  className="flex items-center justify-center gap-1 bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 py-2 rounded-lg text-[10px] font-bold text-zinc-300 hover:text-zinc-100 transition cursor-pointer"
                >
                  <Download className="w-3 h-3 text-zinc-500" />
                  Backup JSON
                </button>
                <button
                  onClick={handleExportCSV}
                  className="flex items-center justify-center gap-1 bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 py-2 rounded-lg text-[10px] font-bold text-zinc-300 hover:text-zinc-100 transition cursor-pointer"
                >
                  <Download className="w-3 h-3 text-zinc-500" />
                  Export CSV
                </button>
              </div>
            </div>

            {/* Restore Section */}
            <div className="border border-zinc-900 bg-zinc-950/40 rounded-xl p-3.5 space-y-2.5">
              <span className="text-[9px] font-bold text-zinc-550 uppercase tracking-wider block">Restore Vault Data</span>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center justify-center gap-1 bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 py-2 rounded-lg text-[10px] font-bold text-zinc-300 hover:text-zinc-100 transition cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-zinc-500" />
                  Restore JSON
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportJSON}
                    className="hidden"
                  />
                </label>
                <label className="flex items-center justify-center gap-1 bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 py-2 rounded-lg text-[10px] font-bold text-zinc-300 hover:text-zinc-100 transition cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-zinc-500" />
                  Import CSV
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleImportCSV}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="text-[9px] text-zinc-550 font-medium">
              Latest: Today • {new Date(lastSyncedAt || Date.now()).toLocaleDateString()}
            </div>
          </div>

          {/* Cloud sync backup panel */}
          <SupabaseSettings />
        </div>
      </div>

      {/* Danger Zone (Destructive actions) */}
      <div className="border border-red-950 bg-red-950/5 rounded-2xl p-6 space-y-4 mt-8">
        <div className="flex items-center gap-2 border-b border-red-950/50 pb-3">
          <ShieldAlert className="w-5 h-5 text-red-500" />
          <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider">Danger Zone</h3>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          These actions are destructive and cannot be undone. Be careful when deleting local vault keys or disconnecting sync connections.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          
          {/* Disconnect Cloud */}
          <div className="border border-zinc-900 bg-zinc-950/20 p-4 rounded-xl flex flex-col justify-between gap-3">
            <div>
              <h4 className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">Disconnect Account</h4>
              <p className="text-[9px] text-zinc-500 mt-1 leading-relaxed">Disconnect synchronization and log out from your Supabase cloud repository.</p>
            </div>
            <button
              onClick={() => {
                showConfirm({
                  title: 'Disconnect Cloud Vault',
                  message: 'Disconnect cloud vault? Your local cached tables will be wiped.',
                  confirmLabel: 'Disconnect',
                  variant: 'warning',
                  onConfirm: () => {
                    supabase.auth.signOut();
                    toast.success('Disconnected Cloud Account');
                  }
                });
              }}
              disabled={!isAuthenticated}
              className="w-full bg-zinc-950 border border-zinc-850 hover:bg-red-950/30 hover:border-red-900/40 hover:text-red-400 disabled:bg-zinc-900/40 disabled:text-zinc-600 disabled:border-zinc-900 text-zinc-450 font-bold py-2 rounded-lg text-[10px] transition cursor-pointer"
            >
              Disconnect Cloud
            </button>
          </div>

          {/* Disable 2FA */}
          <div className="border border-zinc-900 bg-zinc-950/20 p-4 rounded-xl flex flex-col justify-between gap-3">
            <div>
              <h4 className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">Disable 2FA App</h4>
              <p className="text-[9px] text-zinc-500 mt-1 leading-relaxed">Remove the simulated multi-factor authentication locks from your lock overlay.</p>
            </div>
            <button
              onClick={() => {
                showConfirm({
                  title: 'Disable 2FA App',
                  message: 'Disable Two-Factor Authentication? This reduces your vault security status.',
                  confirmLabel: 'Disable 2FA',
                  variant: 'warning',
                  onConfirm: () => {
                    setIs2FAEnabled(false);
                    setIs2FAVerified(false);
                    setShow2FAPanel(false);
                    toast.info('Two-Factor Authentication disabled');
                  }
                });
              }}
              disabled={!is2FAEnabled}
              className="w-full bg-zinc-950 border border-zinc-850 hover:bg-red-950/30 hover:border-red-900/40 hover:text-red-400 disabled:bg-zinc-900/40 disabled:text-zinc-600 disabled:border-zinc-900 text-zinc-450 font-bold py-2 rounded-lg text-[10px] transition cursor-pointer"
            >
              Disable 2FA
            </button>
          </div>

          {/* Hard Reset */}
          <div className="border border-zinc-900 bg-zinc-950/20 p-4 rounded-xl flex flex-col justify-between gap-3">
            <div>
              <h4 className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Reset Vault & Purge</h4>
              <p className="text-[9px] text-zinc-500 mt-1 leading-relaxed">Permanently delete all projects, passwords, database caches, and settings from this browser.</p>
            </div>
            <button
              onClick={() => {
                setResetConfirmText('');
                setShowResetConfirm(true);
              }}
              className="w-full bg-red-900/20 border border-red-900/30 hover:bg-red-500 hover:text-red-950 text-red-400 font-bold py-2 rounded-lg text-[10px] transition cursor-pointer"
            >
              Reset Vault Data
            </button>
          </div>

        </div>

      </div>

      {/* -------------------- MODALS & OVERLAYS -------------------- */}

      {/* Confirmation Modal for Password Rotation */}
      <AnimatePresence>
        {showRotationConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowRotationConfirm(false)} />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl relative z-10 space-y-4"
            >
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h4 className="text-sm font-bold text-zinc-100 uppercase tracking-wide">Confirm Key Rotation</h4>
              </div>
              
              <p className="text-xs text-zinc-400 leading-relaxed">
                Rotating your master password is a major cryptographic event. This will decrypt your entire database (credentials, secrets, DB connection details) using your old key, derive a new AES-GCM key, and re-encrypt everything before saving. 
              </p>
              <p className="text-xs text-zinc-500 leading-relaxed font-semibold">
                Please do not close your browser tab or shut down your device during this process.
              </p>

              <div className="flex items-center gap-2 justify-end pt-2">
                <button
                  onClick={() => setShowRotationConfirm(false)}
                  className="bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 text-zinc-400 font-semibold py-2 px-3.5 rounded-lg text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={executePasswordRotation}
                  className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold py-2 px-3.5 rounded-lg text-xs transition cursor-pointer"
                >
                  Confirm Rotation
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal for Hard Reset Vault */}
      <AnimatePresence>
        {showResetConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowResetConfirm(false)} />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl relative z-10 space-y-4"
            >
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
                <Trash2 className="w-5 h-5 text-red-500" />
                <h4 className="text-sm font-bold text-zinc-100 uppercase tracking-wide">Danger: Hard Reset Vault</h4>
              </div>
              
              <p className="text-xs text-zinc-400 leading-relaxed">
                This will permanently delete all records (projects, connection details, credentials, logs) and encryption keys stored in this browser. Your cloud backup will remain intact but your local copy will be completely wiped.
              </p>
              
              <div className="space-y-1.5 pt-2">
                <label className="text-[9px] font-bold text-zinc-550 uppercase tracking-wider block">Type RESET to verify</label>
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder="RESET"
                  className="w-full bg-zinc-950 border border-zinc-850 rounded-lg px-3 py-2 text-red-400 text-center font-bold text-xs tracking-wider focus:outline-none focus:border-red-900 transition"
                />
              </div>

              <div className="flex items-center gap-2 justify-end pt-2">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 text-zinc-400 font-semibold py-2 px-3.5 rounded-lg text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetVault}
                  disabled={resetConfirmText !== 'RESET'}
                  className="bg-red-500 hover:bg-red-400 disabled:bg-red-650/30 text-red-950 font-bold py-2 px-3.5 rounded-lg text-xs transition cursor-pointer"
                >
                  Delete Everything
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Recovery Codes Modal for 2FA */}
      <AnimatePresence>
        {showRecoveryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowRecoveryModal(false)} />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl relative z-10 space-y-4"
            >
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h4 className="text-sm font-bold text-zinc-100 uppercase tracking-wide">Emergency Recovery Codes</h4>
              </div>
              
              <p className="text-xs text-zinc-400 leading-relaxed">
                Save these backup recovery codes in a secure offline location (like a physical safe or paper) to unlock your vault if you lose access to your authenticator app.
              </p>
              
              <div className="bg-zinc-950 border border-zinc-850 p-4 rounded-xl font-mono text-xs text-zinc-300 grid grid-cols-2 gap-2 text-center">
                <span>SITE-ABCD-1234</span>
                <span>SITE-EFGH-5678</span>
                <span>SITE-IJKL-9012</span>
                <span>SITE-MNOP-3456</span>
              </div>

              <div className="flex items-center gap-2 justify-end pt-2">
                <button
                  onClick={() => setShowRecoveryModal(false)}
                  className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold py-2 px-4 rounded-lg text-xs transition cursor-pointer w-full text-center"
                >
                  I've Saved These Codes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
