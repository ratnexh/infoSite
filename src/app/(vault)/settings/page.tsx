'use client';

import React, { useState } from 'react';
import { useSettingsStore } from '@/store/settings-store';
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
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import SupabaseSettings from './supabase-settings';

export default function SettingsPage() {
  const { 
    lockTimeout, 
    setLockTimeout, 
    changeMasterPassword, 
    isLoading 
  } = useSettingsStore();

  // 1. Password state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // 2. 2FA simulated state
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [show2FAPanel, setShow2FAPanel] = useState(false);
  const [twoFACode, setTwoFACode] = useState('');
  const [is2FAVerified, setIs2FAVerified] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
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

    setPasswordLoading(true);
    // Tiny beat for state render
    await new Promise(r => setTimeout(r, 100));

    const success = await changeMasterPassword(oldPassword, newPassword);
    setPasswordLoading(false);

    if (success) {
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Master Password rotated and all records re-encrypted successfully!');
    } else {
      toast.error('Incorrect current password or rotation failed');
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
      toast.error("Failed to export backup");
    }
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (confirm('Importing backup will wipe your current database and overwrite it. Are you sure?')) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const contents = event.target?.result as string;
          await ImportExportService.importJSON(contents);
          toast.success("Backup successfully restored! Refreshing page details...");
          setTimeout(() => window.location.reload(), 1000);
        } catch (err: any) {
          toast.error(err.message || "Failed to import JSON file");
        }
      };
      reader.readAsText(file);
    }
    // Clear input
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

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {/* Header Banner */}
      <div className="border-b border-zinc-900 pb-5">
        <h1 className="text-xl font-bold tracking-tight text-zinc-50 flex items-center gap-2">
          Settings & Safety
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Rotate keys, select inactivity locks, and configure backup data.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Settings forms */}
        <div className="lg:col-span-2 space-y-6">
          {/* Master Password Form */}
          <div className="bg-zinc-900/10 border border-zinc-900 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-zinc-300 flex items-center gap-2">
              <KeyRound className="w-4.5 h-4.5 text-emerald-500" />
              Rotate Master Password
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Updating your Master Password triggers a cryptographic rotation. All stored passwords, secrets, and API keys are decrypted using the old key and re-saved with a new derived CryptoKey.
            </p>

            <form onSubmit={handlePasswordChange} className="space-y-3 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Current Password"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                  required
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New Password (Min 8)"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                  required
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm New Password"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                  required
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-600/50 text-emerald-950 font-bold py-2 px-3.5 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition active:scale-[0.98]"
                >
                  {passwordLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-950" />}
                  Rotate Secret Key
                </button>
              </div>
            </form>
          </div>

          {/* Simulated 2FA Setting Card */}
          <div className="bg-zinc-900/10 border border-zinc-900 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-zinc-300 flex items-center gap-2">
              <ShieldCheck className="w-4.5 h-4.5 text-emerald-500" />
              Two-Factor Authentication (Simulated 2FA)
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Secure your vault access by pairing it with an authenticator app (such as Google Authenticator or 1Password) using a mock implementation.
            </p>

            <div className="pt-2">
              {!is2FAEnabled ? (
                !show2FAPanel ? (
                  <button
                    onClick={() => setShow2FAPanel(true)}
                    className="border border-zinc-800 hover:border-zinc-700 bg-zinc-950 text-zinc-300 hover:text-zinc-100 font-semibold py-2 px-3.5 rounded-lg text-xs transition cursor-pointer"
                  >
                    Setup 2FA Authenticator
                  </button>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="border border-zinc-800 bg-zinc-950 rounded-xl p-4.5 space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row gap-5 items-center">
                      {/* Pixel art QR mock */}
                      <div className="w-24 h-24 bg-zinc-900 border border-zinc-850 rounded-lg flex flex-col items-center justify-center p-2 text-zinc-400 shrink-0">
                        <QrCode className="w-12 h-12 text-zinc-300" />
                        <span className="text-[8px] font-bold text-zinc-500 mt-2 uppercase tracking-wide">SITE VAULT</span>
                      </div>

                      <div className="space-y-1.5 flex-1">
                        <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wide">Pair Authenticator App</h4>
                        <p className="text-[11px] text-zinc-500 leading-relaxed">
                          Scan the QR code or manually enter the key into your authenticator app:
                        </p>
                        <code className="text-xs font-bold bg-zinc-900 text-zinc-300 px-2 py-0.5 border border-zinc-850 rounded block w-fit select-all">
                          SITV-AUL7-PWA8-DEC9
                        </code>
                      </div>
                    </div>

                    <form onSubmit={handleVerify2FA} className="flex items-center gap-2 pt-2">
                      <input
                        type="text"
                        maxLength={6}
                        value={twoFACode}
                        onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, ''))}
                        placeholder="Enter 6-digit Code"
                        className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-200 text-xs w-40 text-center font-bold tracking-widest focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                        required
                      />
                      <button
                        type="submit"
                        className="bg-zinc-200 hover:bg-white text-zinc-950 font-bold py-1.5 px-3.5 rounded-lg text-xs cursor-pointer transition"
                      >
                        Verify & Enable
                      </button>
                    </form>
                  </motion.div>
                )
              ) : (
                <div className="flex items-center justify-between bg-emerald-950/20 border border-emerald-900/40 p-4 rounded-xl text-xs">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-zinc-200 font-medium">Authenticator 2FA is active and enabled on this device.</span>
                  </div>
                  <button
                    onClick={() => {
                      setIs2FAEnabled(false);
                      setIs2FAVerified(false);
                      setShow2FAPanel(false);
                      setTwoFACode('');
                      toast.info('2FA disabled');
                    }}
                    className="text-[10px] text-red-400 hover:text-red-300 font-bold uppercase cursor-pointer"
                  >
                    Disable
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar settings columns */}
        <div className="space-y-6">
          {/* Security lock timeout configuration */}
          <div className="bg-zinc-900/20 border border-zinc-900 rounded-xl p-4.5 space-y-4">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-zinc-500" />
              Auto-Lock Settings
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Wipes the encryption key from browser memory automatically if you are inactive.
            </p>

            <div className="pt-1.5 space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Inactivity Timeout</label>
              <select
                value={lockTimeout}
                onChange={(e) => setLockTimeout(parseInt(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-2 text-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition cursor-pointer"
              >
                <option value={1}>1 Minute (Fast Test)</option>
                <option value={5}>5 Minutes</option>
                <option value={10}>10 Minutes (Default)</option>
                <option value={30}>30 Minutes</option>
                <option value={60}>60 Minutes</option>
                <option value={0}>Never Auto-Lock (Caution)</option>
              </select>
            </div>
          </div>

          {/* Backup exports / imports card */}
          <div className="bg-zinc-900/20 border border-zinc-900 rounded-xl p-4.5 space-y-4">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Download className="w-4 h-4 text-zinc-500" />
              Import & Export Data
            </h3>

            {/* JSON panel */}
            <div className="space-y-2 border-b border-zinc-900 pb-3">
              <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">JSON Database Backup</h4>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleExportJSON}
                  className="flex items-center justify-center gap-1.5 bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 p-2.5 rounded-lg text-[10px] font-bold text-zinc-300 hover:text-zinc-100 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-zinc-500" />
                  Backup Vault
                </button>
                <label className="flex items-center justify-center gap-1.5 bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 p-2.5 rounded-lg text-[10px] font-bold text-zinc-300 hover:text-zinc-100 transition cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-zinc-500" />
                  Restore JSON
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportJSON}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* CSV panel */}
            <div className="space-y-2 pt-1">
              <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">CSV Spreadsheet Backup</h4>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleExportCSV}
                  className="flex items-center justify-center gap-1.5 bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 p-2.5 rounded-lg text-[10px] font-bold text-zinc-300 hover:text-zinc-100 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-zinc-500" />
                  Export CSV
                </button>
                <label className="flex items-center justify-center gap-1.5 bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 p-2.5 rounded-lg text-[10px] font-bold text-zinc-300 hover:text-zinc-100 transition cursor-pointer">
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

            <div className="bg-zinc-950 border border-zinc-900 p-3 rounded-lg text-[10px] leading-relaxed text-zinc-500 flex gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span>
                <b>Note:</b> Restoring a JSON file overwrites your local database. Backup your current data before importing.
              </span>
            </div>
          </div>

          {/* Cloud sync backup panel */}
          <SupabaseSettings />
        </div>
      </div>
    </div>
  );
}
