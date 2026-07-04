import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SignOutButton from "./sign-out-button";

export default async function InboxPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Ensure the profile row exists (first login).
  await supabase
    .from("profiles")
    .upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Idea Inbox</h1>
        <SignOutButton />
      </header>

      <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
        <p className="text-lg font-medium">You&apos;re in — M0 complete.</p>
        <p className="mt-2 text-neutral-500">
          Signed in as <strong>{user.email}</strong>. Idea capture arrives in
          M2.
        </p>
      </div>
    </main>
  );
}
