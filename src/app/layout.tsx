import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Humaid Trading Journal — Halal Trading & Portfolio Analytics",
    template: "%s · Humaid Trading Journal",
  },
  description:
    "Track trades, analyze performance, screen for Shariah compliance, and calculate zakat — a trading journal built for Muslim investors.",
};

/**
 * Theme boot — runs before paint to avoid a flash of the wrong theme.
 * Default is light (D1a decision: system-follow deferred until legacy pages
 * lose their hardcoded light tints); user preference persists in htj.theme.
 */
const THEME_INIT = `try{var t=localStorage.getItem("htj.theme");document.documentElement.dataset.theme=t==="dark"?"dark":"light"}catch(e){document.documentElement.dataset.theme="light"}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // lang/dir set here so future Arabic support only needs to flip these two
  // attributes (dir="rtl") based on the user's locale.
  return (
    <html
      lang="en"
      dir="ltr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
