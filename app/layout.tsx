import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Providers } from "./providers";
import NotificationListener from "@/components/NotificationListener";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: 'swap',
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: 'swap',
  variable: '--font-jetbrains',
});

export const metadata: Metadata = {
  title: "SwarmTrade - AI Trading Intelligence",
  description: "24/7 Superhuman Trading Intelligence for Solana AI Tokens",
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon.png', type: 'image/png' }
    ],
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased min-h-screen flex flex-col`}>
        <Providers>
          <Header />
          <div className="pt-16 flex-grow">
            {children}
          </div>
          <Footer />
          <NotificationListener />
        </Providers>
      </body>
    </html>
  );
}
