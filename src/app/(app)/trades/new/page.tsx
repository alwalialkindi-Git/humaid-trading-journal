import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { TradeForm } from "../trade-form";

export const metadata: Metadata = { title: "New Trade" };

export default function NewTradePage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Log a trade"
        description="Record the facts and the feelings — both matter."
      />
      <TradeForm trade={null} />
    </div>
  );
}
