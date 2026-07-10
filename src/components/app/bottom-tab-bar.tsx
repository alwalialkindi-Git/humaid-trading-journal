"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coins, LayoutDashboard, MoreHorizontal, PieChart, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_GROUPS } from "@/components/app/nav-config";
import { ThemeToggle } from "@/components/theme-toggle";
import { TransactionDialog } from "@/components/transactions/transaction-dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";

/**
 * Mobile bottom navigation (D1b — sprint §7): Home · Wealth · + · Zakat ·
 * More. The center + opens the same TransactionDialog as everywhere else
 * (replaces the FAB — AMANAH §12.9, one pattern per job).
 */

const PRIMARY_TABS = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/portfolio", label: "Wealth", icon: PieChart },
] as const;

const SECONDARY_TABS = [{ href: "/zakat", label: "Zakat", icon: Coins }] as const;

const PRIMARY_HREFS = new Set<string>([
  ...PRIMARY_TABS.map((t) => t.href),
  ...SECONDARY_TABS.map((t) => t.href),
]);

export function BottomTabBar() {
  const pathname = usePathname();
  const [txOpen, setTxOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const moreItems = NAV_GROUPS.flatMap((g) => g.items).filter(
    (item) => !PRIMARY_HREFS.has(item.href)
  );
  const moreActive = moreItems.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );

  function tabClass(active: boolean) {
    return cn(
      "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium",
      active ? "text-brand" : "text-ink-muted"
    );
  }

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-surface-raised pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <div className="flex items-stretch">
          {PRIMARY_TABS.map((tab) => {
            const active =
              pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={tabClass(active)}
              >
                <tab.icon className="h-5 w-5" />
                {tab.label}
              </Link>
            );
          })}

          {/* Center action — the one raised element */}
          <div className="flex flex-1 items-center justify-center">
            <button
              onClick={() => setTxOpen(true)}
              aria-label="Add transaction"
              className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>

          {SECONDARY_TABS.map((tab) => {
            const active =
              pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={tabClass(active)}
              >
                <tab.icon className="h-5 w-5" />
                {tab.label}
              </Link>
            );
          })}

          <button
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            className={tabClass(moreActive)}
          >
            <MoreHorizontal className="h-5 w-5" />
            More
          </button>
        </div>
      </nav>

      {/* More — remaining destinations + theme */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent title="More">
          <div className="p-3">
            <ul>
              {moreItems.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium",
                        active ? "bg-accent text-accent-foreground" : "hover:bg-muted/60"
                      )}
                    >
                      <item.icon className="h-4 w-4 text-ink-muted" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="mt-2 flex items-center justify-between border-t px-3 pt-3">
              <span className="text-sm text-ink-muted">Theme</span>
              <ThemeToggle className="rounded-md border p-2 text-ink-muted hover:text-ink" />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <TransactionDialog open={txOpen} onOpenChange={setTxOpen} />
    </>
  );
}
