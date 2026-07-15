/**
 * Save-settle moment (D3 — sprint §11, AMANAH motion verb "settle"): after a
 * successful save the dialog records the written row id here; the Activity
 * table consumes it and the row settles in with the 2s highlight. Module
 * store — survives router.refresh(), dies with the page, never persisted.
 * The freshness window keeps the moment honest: it only plays right after
 * the save, never on a later visit to the table.
 */

export const SETTLE_WINDOW_MS = 10_000;

/** Pure freshness rule — the highlight is only owed within the window. */
export function isSettleFresh(
  savedAt: number,
  now: number,
  windowMs: number = SETTLE_WINDOW_MS
): boolean {
  return now >= savedAt && now - savedAt <= windowMs;
}

let last: { id: string; at: number } | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const cb of listeners) cb();
}

export function markSettled(id: string, at: number = Date.now()): void {
  last = { id, at };
  emit();
}

export function clearSettled(): void {
  if (!last) return;
  last = null;
  emit();
}

export function subscribeSettled(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Snapshot for useSyncExternalStore — the id only while fresh. */
export function getSettledId(now: number = Date.now()): string | null {
  if (!last) return null;
  return isSettleFresh(last.at, now) ? last.id : null;
}
