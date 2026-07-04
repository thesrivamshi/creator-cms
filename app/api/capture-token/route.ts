import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomToken } from "@/lib/crypto";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("profiles")
    .select("capture_token")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({ token: data?.capture_token ?? null });
}

// Generate or rotate the capture token (used by the iOS Shortcut as a Bearer header).
export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = randomToken(32);
  const { error } = await supabase
    .from("profiles")
    .upsert({ user_id: user.id, capture_token: token }, { onConflict: "user_id" });

  if (error) return NextResponse.json({ error: "Failed to rotate token" }, { status: 500 });
  return NextResponse.json({ token });
}
