import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Providers } from "./providers";
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
  title: "Kong Invest - AI Investment Intelligence",
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
      <head>
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "qi1box1hqq");
          `}
        </Script>
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased min-h-screen flex flex-col`}>
        <Providers>
          <Header />
          <div className="pt-16 flex-grow">
            {children}
          </div>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
