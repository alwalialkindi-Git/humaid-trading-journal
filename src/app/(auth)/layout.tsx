import Link from "next/link";
import { Logo } from "@/components/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="pattern-islamic flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <Link href="/" className="mb-8">
        <Logo textClassName="text-lg" />
      </Link>
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        {children}
      </div>
      <p className="mt-6 max-w-md text-center text-xs text-muted-foreground">
        For personal tracking and education only — not investment advice and
        not a fatwa.
      </p>
    </div>
  );
}
