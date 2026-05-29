import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import NavBar from "@/components/NavBar";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Health Assistant",
  description: "Personal health tracking dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${geist.className} bg-zinc-950 text-white min-h-screen`}>
        <SessionProvider>
          <NavBar />
          <main className="max-w-2xl mx-auto px-4 pb-24 pt-4">{children}</main>
        </SessionProvider>
      </body>
    </html>
  );
}
