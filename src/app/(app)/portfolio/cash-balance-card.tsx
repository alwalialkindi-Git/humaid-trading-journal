"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CashBalanceCard({
  cashBalance,
  currency,
}: {
  cashBalance: number;
  currency: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(cashBalance));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Enter a valid non-negative amount.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Session expired. Please log in again.");
      setBusy(false);
      return;
    }
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ cash_balance: amount })
      .eq("id", user.id);
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Cash balance</CardTitle>
          <CardDescription>Trading account cash, tracked manually</CardDescription>
        </div>
        {!editing && (
          <Button variant="ghost" size="icon" onClick={() => setEditing(true)} title="Edit">
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <form onSubmit={handleSave} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cash">Cash balance ({currency})</Label>
              <Input
                id="cash"
                type="number"
                step="any"
                min="0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  setValue(String(cashBalance));
                  setError(null);
                }}
                disabled={busy}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-3xl font-semibold tracking-tight">
            {formatCurrency(cashBalance, currency)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
