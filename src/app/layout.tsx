import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { BrandingProvider } from "@/components/app/branding-provider";
import { ChunkErrorRecovery } from "@/components/app/chunk-error-recovery";
import { PWAInstaller } from "@/components/app/pwa-installer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Static default metadata. BrandingProvider overrides document.title at
  // runtime with the value from the pengaturan table (currently
  // "Universitas Nias Raya"), so this static title is mainly for SEO / OG
  // tags / no-JS fallback. We keep it in sync with the DB value.
  title: "SIM KKN & PLP — Universitas Nias Raya",
  description: "Sistem Informasi Manajemen Kuliah Kerja Nyata & Praktik Lapangan Persekolahan. Platform terintegrasi untuk pengelolaan KKN, PLP 1, dan PLP 2.",
  keywords: ["KKN", "PLP", "Universitas Nias Raya", "Sistem Informasi", "Manajemen"],
  applicationName: "SIM KKN & PLP",
  authors: [{ name: "Universitas Nias Raya" }],
  creator: "Universitas Nias Raya",
  publisher: "Universitas Nias Raya",
  // ── PWA manifest ─────────────────────────────────────────────────────
  // Enables "Add to Home Screen" on Android and "Install" prompt in
  // Chrome/Edge. The manifest.json in /public declares icons (192/512,
  // maskable variants), theme color, display mode (standalone), and
  // app shortcuts (Dashboard / Absensi / Persuratan).
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "SIM KKN",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  // Single canonical icon entry. Previously this was an array of two SVGs
  // which produced TWO <link rel="icon"> tags in <head>; browsers picked
  // whichever they preferred and the BrandingProvider only updated the
  // first one, so the stale graduation-cap SVG kept showing as favicon.
  // Now we ship ONE local PNG (the Universitas Nias Raya logo) so the
  // favicon is correct from the very first HTML render, no JS required.
  // BrandingProvider still overrides this href at runtime if an admin
  // sets a custom logo_url / favicon_url via Pengaturan.
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png", sizes: "64x64" },
      { url: "/icons/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/icons/favicon-16.png", type: "image/png", sizes: "16x16" },
    ],
    shortcut: [{ url: "/favicon.png", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    title: "SIM KKN & PLP — Universitas Nias Raya",
    description: "Platform terintegrasi untuk pengelolaan KKN, PLP 1, dan PLP 2.",
    type: "website",
    locale: "id_ID",
    siteName: "SIM KKN & PLP",
  },
  twitter: {
    card: "summary",
    title: "SIM KKN & PLP — Universitas Nias Raya",
    description: "Platform terintegrasi untuk pengelolaan KKN, PLP 1, dan PLP 2.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ChunkErrorRecovery />
        <BrandingProvider />
        {children}
        <PWAInstaller />
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}

// ── Viewport / theme color (Next.js 16 requires this in a separate export) ──
// themeColor tints the Android status bar / task switcher when the app is
// installed as a PWA. Matches the app's primary gradient (teal-700).
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0e7490" },
    { media: "(prefers-color-scheme: dark)", color: "#0e7490" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};
