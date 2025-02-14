import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Header from "@/components/layout/Header";
import { SolanaWalletProvider } from "@/components/wallet/WalletProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KinKong - AI Trading Intelligence",
  description: "24/7 Superhuman Trading Intelligence for Solana AI Tokens",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
        <SolanaWalletProvider>
          <Header />
          <div className="pt-16">
            {children}
          </div>
        </SolanaWalletProvider>
      </body>
    </html>
  );
}
