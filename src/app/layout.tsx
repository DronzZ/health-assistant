import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import NavBar from "@/components/NavBar";

const sans = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "Vitals",
  description: "Personal health instrument console",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} dark`}>
      <body className="min-h-screen">
        <SessionProvider>
          <main className="relative z-10 mx-auto max-w-md px-4 pb-28 pt-5">{children}</main>
          <NavBar />
        </SessionProvider>
      </body>
    </html>
  );
}
