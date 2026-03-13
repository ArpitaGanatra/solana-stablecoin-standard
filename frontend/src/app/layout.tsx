import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import WalletProvider from "@/contexts/WalletProvider";
import StablecoinProvider from "@/contexts/StablecoinProvider";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { ToastProvider } from "@/components/ToastProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SSS Token - Solana Stablecoin Standard",
  description:
    "Admin dashboard for managing Solana Stablecoin Standard tokens (SSS-1 & SSS-2)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} antialiased`}
      >
        <WalletProvider>
          <StablecoinProvider>
            {/* Background layers */}
            <div className="dotted-bg" />
            <div className="grain-overlay" />

            <div className="relative z-10 flex min-h-screen">
              <Sidebar />
              <div className="flex-1 flex flex-col">
                <Header />
                <main className="flex-1 p-6">{children}</main>
              </div>
            </div>
            <ToastProvider />
          </StablecoinProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
