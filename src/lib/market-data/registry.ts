import type { MarketDataProvider } from "./types";
import { YahooProvider } from "./providers/yahoo";
import { MockProvider } from "./providers/mock";
import { TwelveDataProvider } from "./providers/twelvedata";
import { EODHDProvider } from "./providers/eodhd";

/**
 * Provider registry. The active provider is chosen by the server-side env
 * var MARKET_DATA_PROVIDER (yahoo | twelvedata | eodhd | mock); default is
 * yahoo, and anything unknown falls back to mock with a logged warning so a
 * typo can never take the app down.
 *
 * SERVER-SIDE ONLY: never import this from a client component.
 */

const instances: Partial<Record<string, MarketDataProvider>> = {};

function instantiate(id: string): MarketDataProvider {
  switch (id) {
    case "yahoo":
      return new YahooProvider();
    case "twelvedata":
      return new TwelveDataProvider();
    case "eodhd":
      return new EODHDProvider();
    case "mock":
      return new MockProvider();
    default:
      console.warn(
        `Unknown MARKET_DATA_PROVIDER "${id}" — falling back to mock provider.`
      );
      return new MockProvider();
  }
}

export function getProvider(id?: string): MarketDataProvider {
  const key = id ?? process.env.MARKET_DATA_PROVIDER ?? "yahoo";
  if (!instances[key]) instances[key] = instantiate(key);
  return instances[key]!;
}

export function getFallbackProvider(): MarketDataProvider {
  if (!instances["mock"]) instances["mock"] = new MockProvider();
  return instances["mock"]!;
}
