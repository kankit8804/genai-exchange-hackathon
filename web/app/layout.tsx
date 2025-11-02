// web/app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "./components/Navbar";
import { AuthProvider } from "@/lib/firebase/AuthContext";
import { ReactNode } from "react";

import NotificationContainer from "@/app/components/NotificationsContainer";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Orbit AI",
  description: "AI Test Case Generator",
};

// Minimal declaration for process.env so this compiles in DOM-only contexts.
declare const process: { env: Record<string, string | undefined> };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <AuthProvider>
          <Navbar />

          {/* Mount global notification container */}
          <NotificationContainer />

          {children}
        </AuthProvider>

        {/* Expose API base (optional) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.API_BASE=${JSON.stringify((process.env.NEXT_PUBLIC_API_BASE_URL || "https://orbit-api-938180057345.us-central1.run.app").replace(/\/+$/, ""))};`,
          }}
        />
      </body>
    </html>
  );
}
