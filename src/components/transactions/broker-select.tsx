"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import type { BrokerRow } from "@/lib/services";
import { createBrokerAction } from "@/app/(app)/portfolio/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Broker dropdown with inline creation (§8.5 path B). Optional by design. */
export function BrokerSelect({
  brokers,
  value,
  onChange,
  onBrokerCreated,
}: {
  brokers: BrokerRow[];
  value: string | null;
  onChange: (brokerId: string | null) => void;
  onBrokerCreated: (broker: BrokerRow) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState("AED");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    setError(null);
    setBusy(true);
    const res = await createBrokerAction({
      name,
      country: country || null,
      account_currency: currency,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onBrokerCreated(res.data);
    onChange(res.data.id);
    setCreating(false);
    setName("");
    setCountry("");
  }

  if (creating) {
    return (
      <div className="space-y-2 rounded-md border bg-muted/30 p-3">
        <p className="text-xs font-medium">New broker</p>
        <div className="grid grid-cols-2 gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Broker name *"
            aria-label="Broker name"
          />
          <Input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Country"
            aria-label="Broker country"
          />
          <Input
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            maxLength={3}
            placeholder="Currency"
            aria-label="Account currency"
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={handleCreate} disabled={busy || !name.trim()}>
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Add
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label>Broker (optional)</Label>
      <Select
        value={value ?? "none"}
        onValueChange={(v) => {
          if (v === "__new__") setCreating(true);
          else onChange(v === "none" ? null : v);
        }}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No broker</SelectItem>
          {brokers.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {b.name}
              {b.country ? ` · ${b.country}` : ""}
            </SelectItem>
          ))}
          <SelectItem value="__new__">
            <span className="flex items-center gap-1.5 text-primary">
              <Plus className="h-3.5 w-3.5" /> New broker…
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
