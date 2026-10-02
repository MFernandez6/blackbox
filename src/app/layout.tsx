import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Cinzel } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";
import { themeInitScript } from "@/lib/theme-script";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BLACKBOX™ — Blackline Public Adjusters LLC",
  description: "Internal claims management — Blackline Public Adjusters LLC",
  applicationName: "BLACKBOX",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BLACKBOX",
  },
};

export const viewport: Viewport = {
  themeColor: "#05070b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${inter.variable} ${jetbrains.variable} ${cinzel.variable} bg-brand-navy text-brand-white antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
