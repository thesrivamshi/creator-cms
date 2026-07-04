import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { testProviderKey } from "@/lib/ai";
import { AIError, AI_ERROR_MESSAGES } from "@/lib/ai/types";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const provider = body?.provider;
  if (provider !== "anthropic" && provider !== "openai") {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

  try {
    await testProviderKey(supabase, user.id, provider);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AIError) {
      return NextResponse.json(
        { ok: false, code: err.code, error: AI_ERROR_MESSAGES[err.code] },
        { status: 200 } // the test "worked" — the result is the payload
      );
    }
    return NextResponse.json({ ok: false, code: "provider_down", error: "Test failed unexpectedly." });
  }
}
