import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { BrandingProvider } from "@/components/app/branding-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SIM KKN & PLP — Universitas Nusantara Jaya",
  description: "Sistem Informasi Manajemen Kuliah Kerja Nyata & Praktik Lapangan Persekolahan. Platform terintegrasi untuk pengelolaan KKN, PLP 1, dan PLP 2.",
  keywords: ["KKN", "PLP", "Universitas", "Sistem Informasi", "Manajemen"],
  icons: {
    icon: "/logo.svg",
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
        <BrandingProvider />
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
