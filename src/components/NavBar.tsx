"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Today", icon: "🏠" },
  { href: "/food", label: "Food", icon: "🍽️" },
  { href: "/body", label: "Body", icon: "📊" },
  { href: "/sleep", label: "Sleep", icon: "😴" },
  { href: "/fitness", label: "Fitness", icon: "⚡" },
  { href: "/workouts", label: "Lifts", icon: "🏋️" },
  { href: "/running", label: "Run", icon: "🏃" },
];

export default function NavBar() {
  const path = usePathname();

  return (
    <nav className="sticky top-0 z-50 bg-zinc-950/95 backdrop-blur border-b border-zinc-800">
      <div className="max-w-2xl mx-auto px-2 flex overflow-x-auto gap-1 py-2 scrollbar-hide">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`flex flex-col items-center px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              path === n.href
                ? "bg-blue-600 text-white"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800"
            }`}
          >
            <span className="text-base">{n.icon}</span>
            <span>{n.label}</span>
          </Link>
        ))}
        <Link
          href="/progress"
          className={`flex flex-col items-center px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            path === "/progress" ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
          }`}
        >
          <span className="text-base">📸</span>
          <span>Photos</span>
        </Link>
        <Link
          href="/bloodwork"
          className={`flex flex-col items-center px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            path === "/bloodwork" ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
          }`}
        >
          <span className="text-base">🩸</span>
          <span>Blood</span>
        </Link>
        <Link
          href="/meal-plan"
          className={`flex flex-col items-center px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            path === "/meal-plan" ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
          }`}
        >
          <span className="text-base">📋</span>
          <span>Plan</span>
        </Link>
      </div>
    </nav>
  );
}
