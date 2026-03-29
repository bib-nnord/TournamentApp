import "./globals.css";
import AiAssistant from "@/components/AiAssistant";
import Navbar from "@/components/Navbar";
import StoreProvider from "@/components/StoreProvider";
import Toaster from "@/components/Toaster";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tournament App", 
  description: "NextJs Tournament App ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased`}
      >
        <StoreProvider>
          <Navbar />
          {children}
          <Toaster />
          <AiAssistant />
        </StoreProvider>
      </body>
    </html>
  );
}
