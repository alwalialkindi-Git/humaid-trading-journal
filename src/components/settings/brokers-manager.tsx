"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Landmark, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import type { BrokerRow } from "@/lib/services";
import {
  createBrokerAction,
  deleteBrokerAction,
  updateBrokerAction,
} from "@/app/(app)/portfolio/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toaster";

const EMPTY = { name: "", country: "", account_number: "", account_currency: "AED", notes: "" };

export function BrokersManager({ brokers }: { brokers: BrokerRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BrokerRow | null>(null);
  const [deleting, setDeleting] = useState<BrokerRow | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(b: BrokerRow) {
    setEditing(b);
    setForm({
      name: b.name,
      country: b.country ?? "",
      account_number: b.account_number ?? "",
      account_currency: b.account_currency,
      notes: b.notes ?? "",
    });
    setError(null);
    setDialogOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const input = {
      name: form.name,
      country: form.country || null,
      account_number: form.account_number || null,
      account_currency: form.account_currency,
      notes: form.notes || null,
    };
    const res = editing
      ? await updateBrokerAction(editing.id, input)
      : await createBrokerAction(input);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setDialogOpen(false);
    toast(editing ? "Broker updated." : "Broker added.");
    router.refresh();
  }

  async function handleDelete() {
    if (!deleting) return;
    setBusy(true);
    const res = await deleteBrokerAction(deleting.id);
    setBusy(false);
    if (!res.ok) {
      toast(res.error, "error");
      return;
    }
    setDeleting(null);
    toast("Broker deleted — transactions keep their history.");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Brokers</CardTitle>
          <CardDescription>
            The accounts you trade through — attribute and filter transactions by broker.
          </CardDescription>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4" /> Add broker
        </Button>
      </CardHeader>
      <CardContent>
        {brokers.length === 0 ? (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Landmark className="h-4 w-4" />
            Add the brokers you trade through to attribute and filter your history.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {brokers.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell className="text-sm">{b.country ?? "—"}</TableCell>
                  <TableCell className="text-sm">
                    {b.account_number
                      ? `…${b.account_number.slice(-4)}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{b.account_currency}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Edit" onClick={() => openEdit(b)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        onClick={() => setDeleting(b)}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Add / edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : "Add broker"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4" noValidate>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="IBKR, Sarwa Trade, EFG…"
                />
              </div>
              <div className="space-y-1">
                <Label>Country</Label>
                <Input
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Account number</Label>
                <Input
                  value={form.account_number}
                  onChange={(e) => setForm({ ...form, account_number: e.target.value })}
                  placeholder="Your reference only"
                />
              </div>
              <div className="space-y-1">
                <Label>Account currency</Label>
                <Input
                  value={form.account_currency}
                  onChange={(e) =>
                    setForm({ ...form, account_currency: e.target.value.toUpperCase() })
                  }
                  maxLength={3}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Notes</Label>
                <Input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !form.name.trim()}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? "Save changes" : "Add broker"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete broker</DialogTitle>
            <DialogDescription>
              Delete {deleting?.name}? Transactions keep their history — they’ll simply
              show no broker.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={busy}>
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
