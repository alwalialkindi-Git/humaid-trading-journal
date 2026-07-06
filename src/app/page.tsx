import Link from "next/link";
import {
  BarChart3,
  BookOpenText,
  CalendarDays,
  Coins,
  Eye,
  LineChart,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Logo, LogoMark } from "@/components/logo";
import { SHARIAH_DISCLAIMER } from "@/components/disclaimer";

const FEATURES = [
  {
    icon: BookOpenText,
    title: "Disciplined trade journal",
    description:
      "Log every trade with strategy, setup quality, emotions, and a mistake checklist — so you learn from patterns, not luck.",
  },
  {
    icon: Wallet,
    title: "Portfolio & holdings",
    description:
      "Track holdings, average cost, dividends, and cash in one calm view, with allocation by market, sector, and asset type.",
  },
  {
    icon: ShieldCheck,
    title: "Shariah screening",
    description:
      "Record compliance status, debt and interest ratios, purification percentages, and warning categories per asset.",
  },
  {
    icon: Coins,
    title: "Zakat calculator",
    description:
      "A complete zakat workflow for investors: nisab check, hawl tracking, detailed breakdown, and yearly records.",
  },
  {
    icon: BarChart3,
    title: "Honest analytics",
    description:
      "Win rate, profit factor, drawdown, strategy and emotion performance — numbers that tell you the truth about your trading.",
  },
  {
    icon: Sparkles,
    title: "Insights that coach you",
    description:
      "Rule-based insights surface repeated mistakes, concentration risk, and holdings that need Shariah review.",
  },
];

const AVOIDED = [
  "Margin",
  "Leverage",
  "Short selling",
  "CFDs",
  "Futures",
  "Options",
  "Interest-based products",
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/">
            <Logo textClassName="text-base" />
          </Link>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Start free</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="pattern-islamic border-b">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 py-20 text-center sm:px-6 sm:py-28">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
              <ShieldCheck className="h-3.5 w-3.5" />
              Built for halal-conscious traders and investors
            </span>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Trade with discipline.
              <br />
              <span className="text-emerald-700">Invest with a clear conscience.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Humaid Trading Journal is a private journal and portfolio
              tracker for Muslim traders — with Shariah screening, zakat
              calculation, and analytics that hold you accountable to your own
              plan.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/signup">Create your journal</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">I already have an account</Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Free to start · Your data stays yours · No interest-based products
            </p>
          </div>
        </section>

        {/* Dashboard preview mock */}
        <section className="border-b bg-secondary/40">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
            <div className="mx-auto max-w-4xl rounded-2xl border bg-card p-4 shadow-lg sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LogoMark className="h-6 w-6" />
                  <span className="text-sm font-medium">Dashboard preview</span>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                  Sample data
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Portfolio value", value: "AED 138,420" },
                  { label: "Total P&L", value: "+AED 9,140", green: true },
                  { label: "Win rate", value: "62%" },
                  { label: "Zakat estimate", value: "AED 3,460" },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border bg-background p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {s.label}
                    </p>
                    <p
                      className={`mt-1 text-lg font-semibold ${s.green ? "text-emerald-700" : ""}`}
                    >
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border bg-background p-3 sm:col-span-2">
                  <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                    Monthly P&L
                  </p>
                  <div className="flex h-24 items-end gap-2">
                    {[35, 55, 28, 70, 45, 62, 80, 40, 66, 52, 74, 90].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t bg-emerald-600/80"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border bg-background p-3">
                  <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                    Shariah status
                  </p>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span>Compliant</span>
                      <span className="font-medium text-emerald-700">4 holdings</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Needs review</span>
                      <span className="font-medium text-amber-700">1 holding</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Non-compliant</span>
                      <span className="font-medium text-muted-foreground">0</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight">
              Everything a mindful trader needs
            </h2>
            <p className="mt-3 text-muted-foreground">
              One quiet workspace for your journal, portfolio, screening, and
              zakat — without noise, hype, or riba.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title} className="border-border/80">
                <CardContent className="p-5">
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {f.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Shariah + Zakat section */}
        <section className="border-y bg-[#1d2b26] text-emerald-50">
          <div className="pattern-islamic-dark mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <div className="grid gap-10 lg:grid-cols-2">
              <div>
                <h2 className="text-3xl font-semibold tracking-tight">
                  Halal by design, not as an afterthought
                </h2>
                <p className="mt-4 leading-relaxed text-emerald-100/80">
                  The journal is built around spot ownership of real assets.
                  There is no place in it for products that scholars broadly
                  prohibit — and the app actively discourages them:
                </p>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {AVOIDED.map((item) => (
                    <li
                      key={item}
                      className="rounded-full border border-red-300/30 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-200"
                    >
                      ✕ {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-300/20 bg-white/5 p-5">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="h-6 w-6 text-emerald-300" />
                    <h3 className="font-semibold">Shariah screening records</h3>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-emerald-100/70">
                    Track debt ratio, interest income, cash &amp; receivables,
                    purification percentage, and business-activity warnings for
                    every asset you own or watch.
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-300/20 bg-white/5 p-5">
                  <div className="flex items-center gap-3">
                    <Coins className="h-6 w-6 text-amber-300" />
                    <h3 className="font-semibold">Zakat, done properly</h3>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-emerald-100/70">
                    Gold or silver nisab, hawl date reminders, a full breakdown
                    of zakatable assets, and a separate purification calculator
                    for mixed income.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Secondary features strip */}
        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-6 text-center sm:grid-cols-3">
            {[
              {
                icon: LineChart,
                title: "Equity curve & drawdown",
                text: "See your real risk, not just your wins.",
              },
              {
                icon: CalendarDays,
                title: "Trading calendar",
                text: "Green and red days at a glance, month by month.",
              },
              {
                icon: Eye,
                title: "Watchlist with intent",
                text: "Target prices, risk levels, and Shariah status before you buy.",
              },
            ].map((f) => (
              <div key={f.title} className="flex flex-col items-center">
                <f.icon className="h-6 w-6 text-emerald-700" />
                <h3 className="mt-3 font-medium">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="border-t bg-secondary/40">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 py-16 text-center sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Start journaling with intention today
            </h2>
            <p className="mt-3 max-w-xl text-muted-foreground">
              Five minutes to set up. A lifetime habit of disciplined, halal
              investing.
            </p>
            <Button size="lg" className="mt-6" asChild>
              <Link href="/signup">Create your free journal</Link>
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-background">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <Logo textClassName="text-sm" />
            <div className="flex gap-6 text-sm text-muted-foreground">
              <Link href="/login" className="hover:text-foreground">
                Log in
              </Link>
              <Link href="/signup" className="hover:text-foreground">
                Sign up
              </Link>
            </div>
          </div>
          <p className="mt-6 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            {SHARIAH_DISCLAIMER} Nothing on this platform is investment advice.
            Past performance does not guarantee future results.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            © {new Date().getFullYear()} Humaid Trading Journal
          </p>
        </div>
      </footer>
    </div>
  );
}
