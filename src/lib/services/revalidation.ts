/**
 * The ledger read-model routes — every transaction mutation revalidates ALL
 * of them (Bug 1/3: one financial truth everywhere, immediately).
 * Server actions iterate this list; tests assert its coverage.
 */
export const REVALIDATED_ROUTES = ["/portfolio", "/dashboard"] as const;
