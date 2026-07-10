"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { NAV_GROUPS } from "@/components/app/nav-config";
import { openCommandMenu } from "@/components/app/command-menu";

/**
 * Grouped navigation shell (D1b, Council IA §5).
 * Desktop: grouped sidebar with the PURITY spine visually distinct.
 * Mobile: slim top bar (brand + search); primary nav lives in the bottom
 * tab bar — the old hamburger drawer is retired (AMANAH §12.9).
 */
export function Sidebar({
  userName,
  userEmail,
}: {
  userName: string | null;
  userEmail: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Mobile top bar — brand + palette trigger only */}
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-sidebar px-4 lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <LogoMark className="h-6 w-6" />
          <span className="text-sm font-semibold text-sidebar-foreground">Humaid</span>
        </Link>
        <button
          onClick={openCommandMenu}
          className="rounded-md p-2 text-sidebar-muted hover:text-sidebar-foreground"
          aria-label="Search and commands"
        >
          <Search className="h-5 w-5" />
        </button>
      </div>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-sidebar lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-5">
          <LogoMark className="h-7 w-7" />
          <div className="leading-tight">
            <p className="text-sm font-semibold text-sidebar-foreground">Humaid</p>
            <p className="text-[11px] text-sidebar-muted">Wealth OS</p>
          </div>
        </div>

        {/* Command palette trigger */}
        <div className="px-3 pt-3">
          <button
            onClick={openCommandMenu}
            className="flex w-full items-center justify-between rounded-md border border-sidebar-border bg-sidebar-accent/40 px-3 py-1.5 text-sm text-sidebar-muted transition-colors hover:text-sidebar-foreground"
          >
            <span className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5" /> Search…
            </span>
            <kbd className="rounded border border-sidebar-border px-1.5 py-0.5 text-[10px]">
              Ctrl K
            </kbd>
          </button>
        </div>

        <nav className="flex flex-1 flex-col overflow-y-auto px-3 py-3" aria-label="Primary">
          {NAV_GROUPS.map((group, gi) => (
            <div
              key={group.label ?? `group-${gi}`}
              className={cn(
                "py-1.5",
                group.purity && "my-1.5 border-y border-sidebar-border/70 py-2.5",
                group.label === null && "mt-auto"
              )}
            >
              {group.label && (
                <p className="flex items-center gap-1.5 px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted/80">
                  {group.label}
                  {group.purity && <span aria-hidden>◆</span>}
                </p>
              )}
              {group.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
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
            </div>
          ))}
        </nav>

        <div className="border-t border-sidebar-border px-3 py-3">
          <div className="flex items-center justify-between gap-2 px-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {userName ?? "Trader"}
              </p>
              <p className="truncate text-xs text-sidebar-muted">{userEmail}</p>
            </div>
            <div className="flex shrink-0 items-center">
              <ThemeToggle className="rounded-md p-2 text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground" />
              <button
                onClick={handleSignOut}
                title="Sign out"
                className="rounded-md p-2 text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
