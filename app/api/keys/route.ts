import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto";

const PROVIDERS = ["anthropic", "openai"] as const;

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("api_keys")
    .select("provider, key_last4, created_at")
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: "Failed to load keys" }, { status: 500 });
  return NextResponse.json({ keys: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const provider = body?.provider as string;
  const key = body?.key as string;

  if (!PROVIDERS.includes(provider as (typeof PROVIDERS)[number])) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }
  if (typeof key !== "string" || key.trim().length < 20) {
    return NextResponse.json({ error: "That doesn't look like an API key" }, { status: 400 });
  }

  const trimmed = key.trim();
  const { error } = await supabase.from("api_keys").upsert(
    {
      user_id: user.id,
      provider,
      key_ciphertext: encrypt(trimmed),
      key_last4: trimmed.slice(-4),
    },
    { onConflict: "user_id,provider" }
  );

  if (error) return NextResponse.json({ error: "Failed to save key" }, { status: 500 });
  return NextResponse.json({ ok: true, last4: trimmed.slice(-4) });
}

export async function DELETE(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const provider = new URL(request.url).searchParams.get("provider");
  if (!PROVIDERS.includes(provider as (typeof PROVIDERS)[number])) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

  const { error } = await supabase
    .from("api_keys")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", provider);

  if (error) return NextResponse.json({ error: "Failed to remove key" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
