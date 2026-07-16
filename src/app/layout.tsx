import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import AutoLock from "@/components/auto-lock";
import CommandPalette from "@/components/command-palette";
import PWARegister from "@/components/pwa-register";
import SyncInitializer from "@/components/sync-initializer";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Site Vault - Offline Developer Vault",
  description: "Secure, local-first dashboard for organizing projects, credentials, hosting, databases, and third-party integrations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          disableTransitionOnChange
        >
          <SyncInitializer />
          <AutoLock>
            {children}
            <CommandPalette />
            <PWARegister />
          </AutoLock>
          <Toaster 
            position="bottom-right" 
            theme="dark" 
            closeButton 
            richColors 
            toastOptions={{
              className: 'bg-zinc-900 border border-zinc-800 text-zinc-100 shadow-2xl rounded-xl'
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
