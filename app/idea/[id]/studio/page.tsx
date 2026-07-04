import Nav from "@/components/nav";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import ScriptStudio from "./script-studio";

export const dynamic = "force-dynamic";

export default async function StudioPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: idea } = await supabase
    .from("ideas")
    .select("id, title, summary, transcript, suggested_brand, audio_path, status")
    .eq("id", params.id)
    .maybeSingle();
  if (!idea) notFound();

  // One script per idea in practice — reuse or create on first open.
  let { data: script } = await supabase
    .from("scripts")
    .select("id, hook, ending, notes")
    .eq("idea_id", idea.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!script) {
    const { data: created } = await supabase
      .from("scripts")
      .insert({ user_id: user.id, idea_id: idea.id })
      .select("id, hook, ending, notes")
      .single();
    script = created;
    // The idea has entered the scripted stage.
    if (idea.status === "captured" || idea.status === "reviewed") {
      await supabase.from("ideas").update({ status: "scripted" }).eq("id", idea.id);
    }
  }
  if (!script) notFound();

  const { data: parts } = await supabase
    .from("script_parts")
    .select("id, position, body, visual_kind, visual_text, visual_path")
    .eq("script_id", script.id)
    .order("position", { ascending: true });

  // Signed URLs for existing visuals + audio.
  const signed: Record<string, string> = {};
  for (const p of parts ?? []) {
    if (p.visual_path) {
      const { data } = await supabase.storage
        .from("visuals")
        .createSignedUrl(p.visual_path.replace(/^visuals\//, ""), 3600);
      if (data?.signedUrl) signed[p.id] = data.signedUrl;
    }
  }
  let audioUrl: string | null = null;
  if (idea.audio_path) {
    const { data } = await supabase.storage
      .from("audio")
      .createSignedUrl(idea.audio_path.replace(/^audio\//, ""), 3600);
    audioUrl = data?.signedUrl ?? null;
  }

  return (
    <>
      <Nav active="/inbox" />
      <main className="mx-auto max-w-3xl p-4 pb-32 sm:p-6">
        <ScriptStudio
          idea={idea}
          script={script}
          initialParts={parts ?? []}
          initialSignedUrls={signed}
          audioUrl={audioUrl}
          userId={user.id}
        />
      </main>
    </>
  );
}
