import Nav from "@/components/nav";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CalendarClient from "./calendar-client";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Solo-user data volumes are tiny — load everything and navigate client-side.
  const { data: variants } = await supabase
    .from("variants")
    .select("id, idea_id, platform, hook, body, status, posted_url")
    .order("created_at", { ascending: false })
    .limit(300);

  const { data: slots } = await supabase
    .from("schedule")
    .select("id, variant_id, slot_at, done")
    .order("slot_at", { ascending: true })
    .limit(500);

  return (
    <>
      <Nav active="/calendar" />
      <main className="mx-auto max-w-5xl p-4 pb-28 sm:p-6">
        <CalendarClient
          initialVariants={variants ?? []}
          initialSlots={slots ?? []}
          userId={user.id}
        />
      </main>
    </>
  );
}
