"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; icon: React.ReactNode };

const I = {
  today: (
    <path d="M3 12h3l2 5 4-12 2 7h4" />
  ),
  food: (
    <>
      <path d="M5 3v8a2 2 0 0 0 4 0V3M7 11v10M17 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4 2.5-1 2.5-4-1-5-2.5-5ZM17 16v5" />
    </>
  ),
  training: (
    <>
      <path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" />
    </>
  ),
  sleep: (
    <path d="M20 14.5A8 8 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z" />
  ),
  body: (
    <>
      <circle cx="12" cy="6" r="2.4" />
      <path d="M12 9v7M8 12l4-1 4 1M9 21l3-5 3 5" />
    </>
  ),
};

const NAV: Item[] = [
  { href: "/", label: "Today", icon: I.today },
  { href: "/food", label: "Fuel", icon: I.food },
  { href: "/workouts", label: "Train", icon: I.training },
  { href: "/sleep", label: "Sleep", icon: I.sleep },
  { href: "/body", label: "Body", icon: I.body },
];

export default function NavBar() {
  const path = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50">
      <div className="mx-auto max-w-md px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        <div className="glass flex items-stretch justify-between gap-1 rounded-2xl px-1.5 py-1.5">
          {NAV.map((n) => {
            const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-label={n.label}
                className={`group relative flex flex-1 flex-col items-center gap-1 rounded-xl py-2 transition-colors ${
                  active ? "text-ink" : "text-faint hover:text-muted"
                }`}
              >
                <span
                  className={`pointer-events-none absolute inset-0 rounded-xl bg-good/10 transition-opacity ${
                    active ? "opacity-100" : "opacity-0"
                  }`}
                />
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`relative h-[22px] w-[22px] transition-transform ${active ? "scale-105" : ""}`}
                >
                  {n.icon}
                </svg>
                <span className="relative text-[10px] font-medium tracking-wide">{n.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
