import type { Metadata } from "next";
import { Noto_Sans_SC, Poppins, Ma_Shan_Zheng, ZCOOL_XiaoWei, Long_Cang } from "next/font/google";
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

const maShanZheng = Ma_Shan_Zheng({
  variable: "--font-ma-shan-zheng",
  subsets: ["latin"],
  weight: ["400"],
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

const longCang = Long_Cang({
  variable: "--font-long-cang",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
  adjustFontFallback: false,
});


export const metadata: Metadata = {
  title: "木 Journey - Mandarin HSK 3.0",
  description: "Platform kursus Mandarin modern — HSK 3.0",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.svg",
    apple: "/icon-192.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "木 Journey",
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
        className={`${poppins.variable} ${notoSansSC.variable} ${maShanZheng.variable} ${zcoolXiaoWei.variable} ${longCang.variable} antialiased min-h-screen bg-background font-sans`}
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

