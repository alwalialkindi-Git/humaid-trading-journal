"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  BookOpenText,
  CalendarDays,
  Coins,
  Eye,
  LayoutDashboard,
  LogOut,
  Menu,
  PieChart,
  Settings,
  ShieldCheck,
  Banknote,
  Briefcase,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/logo";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/trades", label: "Trades Journal", icon: BookOpenText },
  { href: "/portfolio", label: "Portfolio", icon: PieChart },
  { href: "/holdings", label: "Holdings", icon: Briefcase },
  { href: "/dividends", label: "Dividends", icon: Banknote },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/watchlist", label: "Watchlist", icon: Eye },
  { href: "/shariah", label: "Shariah Filter", icon: ShieldCheck },
  { href: "/zakat", label: "Zakat", icon: Coins },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  userName,
  userEmail,
}: {
  userName: string | null;
  userEmail: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
      {NAV.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-white"
                : "text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="border-t border-sidebar-border px-3 py-3">
      <div className="flex items-center justify-between gap-2 px-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-sidebar-foreground">
            {userName ?? "Trader"}
          </p>
          <p className="truncate text-xs text-sidebar-muted">{userEmail}</p>
        </div>
        <button
          onClick={handleSignOut}
          title="Sign out"
          className="rounded-md p-2 text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-white"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-sidebar px-4 lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <LogoMark className="h-6 w-6" />
          <span className="text-sm font-semibold text-sidebar-foreground">
            Humaid Trading Journal
          </span>
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-md p-2 text-sidebar-foreground"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-sidebar">
            <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
              <span className="flex items-center gap-2">
                <LogoMark className="h-6 w-6" />
                <span className="text-sm font-semibold text-sidebar-foreground">
                  Humaid Trading Journal
                </span>
              </span>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-2 text-sidebar-muted"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
            {footer}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-sidebar lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-5">
          <LogoMark className="h-7 w-7" />
          <div className="leading-tight">
            <p className="text-sm font-semibold text-sidebar-foreground">
              Humaid
            </p>
            <p className="text-[11px] text-sidebar-muted">Trading Journal</p>
          </div>
        </div>
        {nav}
        {footer}
      </aside>
    </>
  );
}
