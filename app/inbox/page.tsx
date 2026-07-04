import Link from "next/link";
import Nav from "@/components/nav";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NoteComposer from "./note-composer";
import VoiceRecorder from "./voice-recorder";
import { BrandChip, StatusChip } from "@/components/chips";

export const dynamic = "force-dynamic";

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

  const { data: ideas } = await supabase
    .from("ideas")
    .select("id, title, summary, pillar, suggested_brand, status, source_type, created_at")
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <>
      <Nav active="/inbox" />
      <main className="mx-auto max-w-3xl p-4 pb-28 sm:p-6">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Idea Inbox</h1>
        </header>

        <div className="space-y-3">
          <VoiceRecorder />
          <NoteComposer />
        </div>

        {!ideas || ideas.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
            <p className="text-lg font-medium">No ideas yet</p>
            <p className="mt-2 text-sm text-neutral-500">
              Share a YouTube / Instagram / Twitter link from your iPad using the
              iOS Shortcut, or jot a note above. Shortcut setup:{" "}
              <a
                className="underline"
                href="https://github.com/thesrivamshi/creator-cms/blob/main/docs/ios-shortcut.md"
              >
                docs/ios-shortcut.md
              </a>
              .
            </p>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {ideas.map((idea) => (
              <li key={idea.id}>
                <Link
                  href={`/idea/${idea.id}`}
                  className="block rounded-2xl border border-neutral-200 bg-white p-4 transition-colors active:bg-neutral-50"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <StatusChip status={idea.status} />
                    <BrandChip brand={idea.suggested_brand} />
                    {idea.pillar && (
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                        {idea.pillar}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-neutral-400">
                      {idea.source_type}
                    </span>
                  </div>
                  <p className="font-medium leading-snug">{idea.title ?? "Untitled"}</p>
                  {idea.summary && (
                    <p className="mt-1 line-clamp-2 text-sm text-neutral-500">
                      {idea.summary}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
