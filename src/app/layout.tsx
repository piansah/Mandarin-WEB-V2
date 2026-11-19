/* (c) 2026 Piansah - Mandarin Journey learning. All rights reserved. */
/* 
   layout.tsx -- Root Layout */

import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ServiceWorkerProvider } from "@/components/service-worker-provider"
import { HanziFontProvider } from "@/components/hanzi-font-provider";
import { ReactQueryProvider } from "@/components/query-provider";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Journey Learning - Belajar Bahasa Selangkah Demi Selangkah",
  description: "Platform belajar bahasa modern — dimulai dari Mandarin HSK 3.0, dengan lebih banyak bahasa segera menyusul.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.svg",
    apple: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Journey Learning",
  },
};

import { Toaster } from "@/components/ui/sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Long+Cang&family=Ma+Shan+Zheng&family=Noto+Sans+SC:wght@400;500&family=Noto+Serif+SC:wght@400&family=Poppins:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <Script id="initial-theme" strategy="beforeInteractive">
          {`try {
            var theme = localStorage.getItem("theme") || "system";
            var dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
            var root = document.documentElement;
            root.classList.remove("light", "dark");
            root.classList.add(dark ? "dark" : "light");
            root.style.colorScheme = dark ? "dark" : "light";
          } catch (_) {}`}
        </Script>
      </head>
      <body
        className="antialiased min-h-screen bg-background font-sans overflow-x-hidden"
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ReactQueryProvider>
            <HanziFontProvider>
              <TooltipProvider>
                <ServiceWorkerProvider>
                  {children}
                </ServiceWorkerProvider>
              </TooltipProvider>
            </HanziFontProvider>
          </ReactQueryProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}

