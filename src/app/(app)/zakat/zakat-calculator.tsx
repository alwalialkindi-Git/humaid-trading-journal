"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  computeZakat,
  computePurification,
  NISAB_GOLD_GRAMS,
  NISAB_SILVER_GRAMS,
  ZAKAT_RATE,
} from "@/lib/zakat";
import { formatCurrency, formatDate } from "@/lib/format";
import type { NisabMethod, ZakatRecord } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
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
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Prefill {
  tradingCash: number;
  compliantStockValue: number;
  doubtfulStockValue: number;
  dividendsReceived: number;
  purificationFromDividends: number;
}

/** One numeric input with its fiqh explanation. */
const FIELD_HELP: Record<string, string> = {
  cashAtHome: "Physical cash you hold — it is fully zakatable.",
  bankCash: "Balances in current and savings accounts (exclude any interest earned; that must be given away entirely, not counted).",
  tradingCash: "Uninvested cash sitting in your brokerage account.",
  compliantStockValue:
    "Market value of Shariah-compliant stocks. For long-term holdings some scholars zakat only the zakatable assets ratio — the full market value is the safer, simpler position.",
  doubtfulStockValue:
    "Value of doubtful holdings you choose to include. Many scholars advise including them until you exit the position.",
  dividendsReceived:
    "Dividends still in your possession on the hawl date (already counted if left in bank cash — avoid double counting).",
  goldValue: "Market value of gold you own (jewellery rulings differ by madhhab).",
  silverValue: "Market value of silver you own.",
  businessInventory: "Resale value of trade goods if you run a business.",
  receivables: "Money owed to you that you realistically expect to collect.",
  immediateDebts:
    "Debts due now (this month's obligations, not the whole balance of a long-term loan).",
};

export function ZakatCalculator({
  currency,
  defaultNisabMethod,
  defaultHawlDate,
  prefill,
  records,
}: {
  currency: string;
  defaultNisabMethod: NisabMethod;
  defaultHawlDate: string;
  prefill: Prefill;
  records: ZakatRecord[];
}) {
  const router = useRouter();
  const [nisabMethod, setNisabMethod] = useState<NisabMethod>(defaultNisabMethod);
  const [hawlDate, setHawlDate] = useState(defaultHawlDate.slice(0, 10));
  const [goldPrice, setGoldPrice] = useState("");
  const [silverPrice, setSilverPrice] = useState("");
  const [values, setValues] = useState({
    cashAtHome: "",
    bankCash: "",
    tradingCash: String(prefill.tradingCash || ""),
    compliantStockValue: String(prefill.compliantStockValue || ""),
    doubtfulStockValue: "",
    dividendsReceived: String(prefill.dividendsReceived || ""),
    goldValue: "",
    silverValue: "",
    businessInventory: "",
    receivables: "",
    immediateDebts: "",
  });

  // Purification section (separate from zakat)
  const [purifBase, setPurifBase] = useState(
    String(prefill.dividendsReceived || "")
  );
  const [purifPct, setPurifPct] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const num = (s: string) => {
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const result = useMemo(
    () =>
      computeZakat({
        cashAtHome: num(values.cashAtHome),
        bankCash: num(values.bankCash),
        tradingCash: num(values.tradingCash),
        compliantStockValue: num(values.compliantStockValue),
        doubtfulStockValue: num(values.doubtfulStockValue),
        dividendsReceived: num(values.dividendsReceived),
        goldValue: num(values.goldValue),
        silverValue: num(values.silverValue),
        businessInventory: num(values.businessInventory),
        receivables: num(values.receivables),
        immediateDebts: num(values.immediateDebts),
        nisabMethod,
        goldPricePerGram: num(goldPrice),
        silverPricePerGram: num(silverPrice),
      }),
    [values, nisabMethod, goldPrice, silverPrice]
  );

  const purificationAmount = computePurification(num(purifBase), num(purifPct));
  const nisabPriceMissing =
    nisabMethod === "gold" ? num(goldPrice) <= 0 : num(silverPrice) <= 0;

  function set(key: keyof typeof values, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaveError("Session expired. Please log in again.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("zakat_records").insert({
      user_id: user.id,
      hawl_date: hawlDate || new Date().toISOString().slice(0, 10),
      nisab_method: nisabMethod,
      gold_price_per_gram: num(goldPrice),
      silver_price_per_gram: num(silverPrice),
      cash_at_home: num(values.cashAtHome),
      bank_cash: num(values.bankCash),
      trading_cash: num(values.tradingCash),
      compliant_stock_value: num(values.compliantStockValue),
      doubtful_stock_value: num(values.doubtfulStockValue),
      dividends_received: num(values.dividendsReceived),
      gold_value: num(values.goldValue),
      silver_value: num(values.silverValue),
      business_inventory: num(values.businessInventory),
      receivables: num(values.receivables),
      immediate_debts: num(values.immediateDebts),
      zakatable_total: result.zakatableAssets,
      nisab_threshold: result.nisabThreshold,
      zakat_due: result.zakatDue,
      purification_amount: purificationAmount,
      notes: null,
    });

    setSaving(false);
    if (error) {
      setSaveError(error.message);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  function handleExport() {
    const lines = [
      "HUMAID TRADING JOURNAL — ZAKAT SUMMARY",
      `Generated: ${new Date().toLocaleDateString("en-GB")}`,
      `Hawl date: ${hawlDate || "not set"}`,
      `Nisab method: ${nisabMethod}`,
      "",
      "BREAKDOWN",
      ...result.breakdown.map(
        (b) => `${b.label.padEnd(38)} ${formatCurrency(b.value, currency)}`
      ),
      "",
      `Zakatable assets: ${formatCurrency(result.zakatableAssets, currency)}`,
      `Nisab threshold:  ${formatCurrency(result.nisabThreshold, currency)}`,
      `Zakat due (2.5%): ${formatCurrency(result.zakatDue, currency)}`,
      "",
      "PURIFICATION (separate from zakat)",
      `Base amount:      ${formatCurrency(num(purifBase), currency)}`,
      `Percentage:       ${num(purifPct)}%`,
      `Purification due: ${formatCurrency(purificationAmount, currency)}`,
      "",
      "This summary is for personal tracking and educational purposes only.",
      "It does not provide a fatwa. Consult a qualified Shariah advisor.",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zakat-summary-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Static help, plus a live hint showing the user's actual doubtful-holdings
  // value so they can decide how much of it to include.
  const helpFor = (key: keyof typeof values): string => {
    if (key === "doubtfulStockValue" && prefill.doubtfulStockValue > 0) {
      return `${FIELD_HELP[key]} Your doubtful holdings are currently worth ${formatCurrency(prefill.doubtfulStockValue, currency)}.`;
    }
    return FIELD_HELP[key];
  };

  const inputField = (key: keyof typeof values, label: string) => (
    <div className="space-y-1.5" key={key}>
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type="number"
        step="any"
        min="0"
        value={values[key]}
        onChange={(e) => set(key, e.target.value)}
        placeholder="0"
      />
      <p className="text-xs leading-relaxed text-muted-foreground">
        {helpFor(key)}
      </p>
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Inputs */}
      <div className="space-y-6 lg:col-span-3">
        <Card>
          <CardHeader>
            <CardTitle>Hawl &amp; nisab</CardTitle>
            <CardDescription>
              Zakat is due when your wealth stays above nisab for one lunar
              year (hawl).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Hawl date</Label>
              <Input
                type="date"
                value={hawlDate}
                onChange={(e) => setHawlDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The date your zakat year completes.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Nisab method</Label>
              <Select
                value={nisabMethod}
                onValueChange={(v) => setNisabMethod(v as NisabMethod)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gold">Gold ({NISAB_GOLD_GRAMS}g)</SelectItem>
                  <SelectItem value="silver">
                    Silver ({NISAB_SILVER_GRAMS}g)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Silver gives a lower threshold — the more cautious choice for
                the poor&apos;s benefit.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Gold price per gram ({currency})</Label>
              <Input
                type="number"
                step="any"
                min="0"
                value={goldPrice}
                onChange={(e) => setGoldPrice(e.target.value)}
                placeholder="e.g. 295"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Silver price per gram ({currency})</Label>
              <Input
                type="number"
                step="any"
                min="0"
                value={silverPrice}
                onChange={(e) => setSilverPrice(e.target.value)}
                placeholder="e.g. 3.65"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Zakatable assets</CardTitle>
            <CardDescription>
              Values from your portfolio are prefilled — adjust anything before
              calculating.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            {inputField("cashAtHome", "Cash at home")}
            {inputField("bankCash", "Bank cash")}
            {inputField("tradingCash", "Trading account cash")}
            {inputField("compliantStockValue", "Compliant stocks (market value)")}
            {inputField("doubtfulStockValue", "Doubtful stocks to include")}
            {inputField("dividendsReceived", "Dividends received")}
            {inputField("goldValue", "Gold value")}
            {inputField("silverValue", "Silver value")}
            {inputField("businessInventory", "Business inventory")}
            {inputField("receivables", "Receivables expected")}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Deductions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            {inputField("immediateDebts", "Immediate debts due")}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Purification calculator</CardTitle>
            <CardDescription>
              Separate from zakat: the impermissible portion of dividends or
              gains is given entirely to charity.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Dividends or gains ({currency})</Label>
              <Input
                type="number"
                step="any"
                min="0"
                value={purifBase}
                onChange={(e) => setPurifBase(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Purification percentage %</Label>
              <Input
                type="number"
                step="any"
                min="0"
                max="100"
                value={purifPct}
                onChange={(e) => setPurifPct(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                From your screening records (e.g. the company&apos;s interest
                income share). Your recorded dividends imply about{" "}
                {formatCurrency(prefill.purificationFromDividends, currency)}.
              </p>
            </div>
            <div className="rounded-lg bg-amber-50 px-4 py-3 sm:col-span-2">
              <p className="text-sm text-amber-900">
                Purification due:{" "}
                <strong>{formatCurrency(purificationAmount, currency)}</strong>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Result panel */}
      <div className="space-y-6 lg:col-span-2">
        <Card className="lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle>Result</CardTitle>
            <CardDescription>Updates as you type</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {result.breakdown
                .filter((b) => b.value !== 0)
                .map((b) => (
                  <div
                    key={b.label}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted-foreground">{b.label}</span>
                    <span
                      className={b.value < 0 ? "text-red-600" : "font-medium"}
                    >
                      {formatCurrency(b.value, currency)}
                    </span>
                  </div>
                ))}
              {result.breakdown.every((b) => b.value === 0) && (
                <p className="text-sm text-muted-foreground">
                  Enter values to see the breakdown.
                </p>
              )}
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Zakatable assets</span>
              <span className="font-semibold">
                {formatCurrency(result.zakatableAssets, currency)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Nisab ({nisabMethod === "gold" ? `${NISAB_GOLD_GRAMS}g gold` : `${NISAB_SILVER_GRAMS}g silver`})
              </span>
              <span>
                {nisabPriceMissing
                  ? "enter metal price"
                  : formatCurrency(result.nisabThreshold, currency)}
              </span>
            </div>

            <div
              className={`rounded-xl px-4 py-4 text-center ${
                nisabPriceMissing
                  ? "bg-muted"
                  : result.isDue
                    ? "bg-emerald-50"
                    : "bg-muted"
              }`}
            >
              {nisabPriceMissing ? (
                <p className="text-sm text-muted-foreground">
                  Enter the {nisabMethod} price per gram to check nisab.
                </p>
              ) : result.isDue ? (
                <>
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                    Zakat due ({(ZAKAT_RATE * 100).toFixed(1)}%)
                  </p>
                  <p className="mt-1 text-3xl font-semibold text-emerald-800">
                    {formatCurrency(result.zakatDue, currency)}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">Below nisab</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Your zakatable wealth is under the threshold — no zakat is
                    due this hawl.
                  </p>
                </>
              )}
            </div>

            {saveError && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {saveError}
              </p>
            )}
            {saved && (
              <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Record saved for this hawl.
              </p>
            )}

            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save record
              </Button>
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4" /> Export
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle>Zakat history</CardTitle>
            <CardDescription>Saved records by hawl</CardDescription>
          </CardHeader>
          <CardContent>
            {records.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No records yet — save your first calculation above.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hawl</TableHead>
                    <TableHead className="text-right">Zakatable</TableHead>
                    <TableHead className="text-right">Zakat due</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">
                        {formatDate(r.hawl_date)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCurrency(r.zakatable_total, currency)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(r.zakat_due, currency)}
                      </TableCell>
                      <TableCell>
                        {r.zakat_due > 0 ? (
                          <Badge variant="success">Due</Badge>
                        ) : (
                          <Badge variant="neutral">Below nisab</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
