import Nav from "@/components/nav";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SettingsClient from "./settings-client";
import SignOutButton from "@/app/inbox/sign-out-button";

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("brand_guidelines, model_routes, capture_token")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: keys } = await supabase
    .from("api_keys")
    .select("provider, key_last4")
    .eq("user_id", user.id);

  return (
    <>
      <Nav active="/settings" />
      <main className="mx-auto max-w-3xl p-4 pb-24 sm:p-6">
        <h1 className="mb-6 text-2xl font-bold">Settings</h1>
        <SettingsClient
          initialKeys={keys ?? []}
          initialToken={profile?.capture_token ?? null}
          initialGuidelines={(profile?.brand_guidelines as Record<string, string>) ?? {}}
          initialRoutes={(profile?.model_routes as Record<string, { provider: string; model: string }>) ?? {}}
        />
        <div className="mt-10 flex items-center justify-between border-t border-neutral-200 pt-6">
          <span className="text-sm text-neutral-500">{user.email}</span>
          <SignOutButton />
        </div>
      </main>
    </>
  );
}
