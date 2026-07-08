import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // Phase 5: Holdings and Dividends merged into the ledger-backed
    // Portfolio page; the old trade entry form is replaced by the global
    // Add Transaction dialog.
    return [
      { source: "/holdings", destination: "/portfolio?tab=positions", permanent: true },
      { source: "/dividends", destination: "/portfolio?tab=history&type=dividend", permanent: true },
      { source: "/trades/new", destination: "/portfolio", permanent: true },
    ];
  },
};

export default nextConfig;
