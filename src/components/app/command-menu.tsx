"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Moon, Plus, Search, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALL_NAV_ITEMS } from "@/components/app/nav-config";
import { TransactionDialog } from "@/components/transactions/transaction-dialog";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { LucideIcon } from "lucide-react";

/**
 * Command palette (D1b — sprint §7). Hand-rolled on the Dialog primitive:
 * no new dependency, ARIA combobox/listbox, ⌘K / Ctrl+K.
 *
 * Closed action registry (≤15, AMANAH governance): Navigate (from the shared
 * nav config — the same items as the sidebar, no drift) + two actions.
 * "Add transaction" opens the SAME TransactionDialog used everywhere —
 * one primary action, several doors. The Assets section arrives with D2/D3
 * when palette→dialog hand-off is designed.
 */

const OPEN_EVENT = "htj:open-command-menu";

/** Any surface (sidebar, mobile top bar) can summon the palette. */
export function openCommandMenu() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

interface Command {
  id: string;
  group: "Actions" | "Navigate";
  label: string;
  icon: LucideIcon;
  keywords: string[];
  run: () => void;
}

export function CommandMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [txOpen, setTxOpen] = useState(false);
  const listboxId = useId();

  // Global keybinding + summon event
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      // D3 (§11) keyboard entry: N opens Add Transaction — never while
      // typing in a field or while any dialog is already open.
      if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === "n") {
        const el = e.target as HTMLElement | null;
        if (el && (el.isContentEditable || el.closest("input, textarea, select"))) {
          return;
        }
        if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
        e.preventDefault();
        setTxOpen(true);
      }
    }
    function onSummon() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onSummon);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onSummon);
    };
  }, []);

  const commands = useMemo<Command[]>(
    () => [
      {
        id: "add-transaction",
        group: "Actions",
        label: "Add transaction",
        icon: Plus,
        keywords: ["buy", "sell", "dividend", "deposit", "record", "new"],
        run: () => setTxOpen(true),
      },
      {
        id: "toggle-theme",
        group: "Actions",
        label: "Toggle light/dark theme",
        icon:
          typeof document !== "undefined" &&
          document.documentElement.dataset.theme === "dark"
            ? Sun
            : Moon,
        keywords: ["dark", "light", "night", "appearance"],
        run: () => {
          const el = document.documentElement;
          const next = el.dataset.theme === "dark" ? "light" : "dark";
          el.dataset.theme = next;
          try {
            localStorage.setItem("htj.theme", next);
          } catch {
            // session-only theme
          }
        },
      },
      ...ALL_NAV_ITEMS.map<Command>((item) => ({
        id: `nav-${item.href}`,
        group: "Navigate",
        label: item.label,
        icon: item.icon,
        keywords: item.keywords ?? [],
        run: () => router.push(item.href),
      })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, open] // re-derive theme icon each open
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.keywords.some((k) => k.includes(q))
    );
  }, [commands, query]);

  const groups = useMemo(() => {
    const order: Command["group"][] = ["Actions", "Navigate"];
    return order
      .map((g) => ({ group: g, items: filtered.filter((c) => c.group === g) }))
      .filter((g) => g.items.length > 0);
  }, [filtered]);

  function execute(command: Command) {
    setOpen(false);
    setQuery("");
    command.run();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const n = filtered.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (n === 0 ? 0 : (i + 1) % n));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (n === 0 ? 0 : (i - 1 + n) % n));
    } else if (e.key === "Enter" && filtered[activeIndex]) {
      e.preventDefault();
      execute(filtered[activeIndex]);
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
      >
        <DialogContent
          className="top-24 max-w-md -translate-y-0 gap-0 p-0"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">Search and commands</DialogTitle>
          <div className="flex items-center gap-2 border-b px-4">
            <Search className="h-4 w-4 shrink-0 text-ink-faint" />
            <input
              role="combobox"
              aria-expanded
              aria-controls={listboxId}
              aria-activedescendant={
                filtered[activeIndex] ? `${listboxId}-${filtered[activeIndex].id}` : undefined
              }
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Type a command or destination…"
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-ink-faint"
              autoFocus
            />
          </div>
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Commands"
            className="max-h-80 overflow-y-auto p-2"
          >
            {groups.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-ink-muted">
                Nothing matches “{query}”.
              </li>
            )}
            {groups.map(({ group, items }) => (
              <li key={group} role="presentation">
                <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-ink-faint">
                  {group}
                </p>
                <ul role="presentation">
                  {items.map((command) => {
                    const index = filtered.indexOf(command);
                    const active = index === activeIndex;
                    return (
                      <li
                        key={command.id}
                        id={`${listboxId}-${command.id}`}
                        role="option"
                        aria-selected={active}
                      >
                        <button
                          onClick={() => execute(command)}
                          onMouseEnter={() => setActiveIndex(index)}
                          className={cn(
                            "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm",
                            active ? "bg-accent text-accent-foreground" : "hover:bg-muted/60"
                          )}
                        >
                          <span className="flex items-center gap-2.5">
                            <command.icon className="h-4 w-4 text-ink-muted" />
                            {command.label}
                          </span>
                          {active && (
                            <CornerDownLeft className="h-3.5 w-3.5 text-ink-faint" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      <TransactionDialog open={txOpen} onOpenChange={setTxOpen} />
    </>
  );
}
