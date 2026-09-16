import type { Metadata } from "next";
import { Noto_Sans_SC, Poppins, ZCOOL_XiaoWei } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ServiceWorkerProvider } from "@/components/service-worker-provider"
import { HanziFontProvider } from "@/components/hanzi-font-provider";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const notoSansSC = Noto_Sans_SC({
  variable: "--font-noto-sans-sc",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  adjustFontFallback: false,
});

const zcoolXiaoWei = ZCOOL_XiaoWei({
  variable: "--font-zcool-xiao-wei",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
  adjustFontFallback: false,
});


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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body
        className={`${poppins.variable} ${notoSansSC.variable} ${zcoolXiaoWei.variable} antialiased min-h-screen bg-background font-sans overflow-x-hidden`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <HanziFontProvider>
            <TooltipProvider>
              <ServiceWorkerProvider>
                {children}
              </ServiceWorkerProvider>
            </TooltipProvider>
          </HanziFontProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

