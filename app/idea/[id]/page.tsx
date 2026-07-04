import Nav from "@/components/nav";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import IdeaEditor from "./idea-editor";

export const dynamic = "force-dynamic";

export default async function IdeaPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: idea } = await supabase
    .from("ideas")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!idea) notFound();

  // Signed URL for the original voice recording (kept permanently — M3).
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
      <main className="mx-auto max-w-3xl p-4 pb-28 sm:p-6">
        <IdeaEditor idea={idea} audioUrl={audioUrl} />
      </main>
    </>
  );
}
