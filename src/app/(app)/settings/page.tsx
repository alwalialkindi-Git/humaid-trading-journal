import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServices } from "@/lib/services/runtime";
import type { BrokerRow } from "@/lib/services";
import type { Profile } from "@/lib/types";
import { PageHeader } from "@/components/app/page-header";
import { BrokersManager } from "@/components/settings/brokers-manager";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();

  if (!data) {
    throw new Error(
      "Profile not found. Make sure supabase/schema.sql (including the signup trigger) was applied before this account was created."
    );
  }

  // Brokers live in the ledger schema; tolerate a not-yet-migrated database.
  let brokers: BrokerRow[] = [];
  try {
    const services = await createServices(supabase);
    brokers = await services.brokers.list(user!.id);
  } catch {
    brokers = [];
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Settings"
        description="Profile, preferences, brokers, and your data."
      />
      <BrokersManager brokers={brokers} />
      <SettingsForm profile={data as Profile} email={user!.email ?? ""} />
    </div>
  );
}
