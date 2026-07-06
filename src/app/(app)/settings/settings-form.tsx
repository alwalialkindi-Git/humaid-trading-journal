"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SUPPORTED_CURRENCIES } from "@/lib/format";
import type { Profile } from "@/lib/types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function SettingsForm({
  profile,
  email,
}: {
  profile: Profile;
  email: string;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [currency, setCurrency] = useState(profile.currency);
  const [nisabMethod, setNisabMethod] = useState(profile.nisab_method);
  const [riskPreference, setRiskPreference] = useState(profile.risk_preference);
  const [screeningPreference, setScreeningPreference] = useState(
    profile.screening_preference
  );
  const [hawlDate, setHawlDate] = useState(profile.hawl_date?.slice(0, 10) ?? "");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveMessage(null);
    setSaveError(null);

    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim() || null,
        currency,
        nisab_method: nisabMethod,
        risk_preference: riskPreference,
        screening_preference: screeningPreference,
        hawl_date: hawlDate || null,
      })
      .eq("id", profile.id);

    setSaving(false);
    if (error) {
      setSaveError(error.message);
      return;
    }
    setSaveMessage("Settings saved.");
    router.refresh();
  }

  /** Downloads all of the user's data as a single JSON file. */
  async function handleExport() {
    setExporting(true);
    const supabase = createClient();
    const tables = [
      "trades",
      "holdings",
      "dividends",
      "watchlist",
      "shariah_screenings",
      "zakat_records",
      "journal_notes",
    ] as const;

    const data: Record<string, unknown> = {
      exported_at: new Date().toISOString(),
      profile,
    };
    for (const table of tables) {
      const { data: rows } = await supabase
        .from(table)
        .select("*")
        .eq("user_id", profile.id);
      data[table] = rows ?? [];
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `humaid-journal-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>How you appear in the app</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={email} disabled />
              <p className="text-xs text-muted-foreground">
                Email changes are managed through your auth provider.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>Currency, zakat, and screening defaults</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Used for all values across the app. Default is AED.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Zakat nisab method</Label>
              <Select
                value={nisabMethod}
                onValueChange={(v) => setNisabMethod(v as Profile["nisab_method"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gold">Gold (85g)</SelectItem>
                  <SelectItem value="silver">Silver (595g)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Risk preference</Label>
              <Select
                value={riskPreference}
                onValueChange={(v) =>
                  setRiskPreference(v as Profile["risk_preference"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Conservative</SelectItem>
                  <SelectItem value="medium">Balanced</SelectItem>
                  <SelectItem value="high">Aggressive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Shariah screening preference</Label>
              <Select
                value={screeningPreference}
                onValueChange={setScreeningPreference}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard (AAOIFI-style)</SelectItem>
                  <SelectItem value="strict">Strict (lower thresholds)</SelectItem>
                  <SelectItem value="custom">Custom / my scholar&apos;s method</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Hawl date</Label>
              <Input
                type="date"
                value={hawlDate}
                onChange={(e) => setHawlDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The date your zakat year completes — used for dashboard
                reminders.
              </p>
            </div>
          </CardContent>
        </Card>

        {saveError && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {saveError}
          </p>
        )}
        {saveMessage && (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {saveMessage}
          </p>
        )}

        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save settings
        </Button>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Your data</CardTitle>
          <CardDescription>
            Export everything you&apos;ve recorded as JSON.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export all data
          </Button>
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-700">Danger zone</CardTitle>
          <CardDescription>
            Account deletion requires server-side confirmation and will be
            available in a future release. For now, contact support or delete
            your project data via export + manual removal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" disabled title="Coming soon">
            <Trash2 className="h-4 w-4" /> Delete account (coming soon)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
