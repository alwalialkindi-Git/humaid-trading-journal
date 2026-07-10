import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/app/sidebar";
import { BottomTabBar } from "@/components/app/bottom-tab-bar";
import { CommandMenu } from "@/components/app/command-menu";
import { ToastProvider } from "@/components/ui/toaster";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The proxy already guards these routes; this is defense in depth.
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  return (
    <ToastProvider>
      <div className="min-h-screen bg-background">
        <Sidebar
          userName={profile?.full_name ?? null}
          userEmail={user.email ?? ""}
        />
        {/* pb-24 keeps content clear of the mobile bottom tab bar */}
        <main className="pb-24 lg:pb-0 lg:pl-60">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
        <BottomTabBar />
        <CommandMenu />
      </div>
    </ToastProvider>
  );
}
