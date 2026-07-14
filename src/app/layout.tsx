import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PlayerRegistrationModal from "@/components/PlayerRegistrationModal";
import SettingsButton from "@/components/SettingsButton";
import SelfPlayerTopBar from "@/components/SelfPlayerTopBar";
import { SelfPlayerProvider } from "@/components/SelfPlayerProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "欠席連絡アプリ",
  description: "選手の欠席連絡・出欠管理を行うアプリです。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        <SelfPlayerProvider>
          <SelfPlayerTopBar />
          <div className="relative">
            {children}
            <PlayerRegistrationModal />
            <SettingsButton />
          </div>
        </SelfPlayerProvider>
      </body>
    </html>
  );
}
