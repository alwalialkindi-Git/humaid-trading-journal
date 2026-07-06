import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { PageHeader } from "@/components/app/page-header";
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Settings"
        description="Profile, preferences, and your data."
      />
      <SettingsForm profile={data as Profile} email={user!.email ?? ""} />
    </div>
  );
}
