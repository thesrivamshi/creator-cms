"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setState("error");
    } else {
      setState("sent");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="mb-2 text-3xl font-bold">Creator CMS</h1>
        <p className="mb-8 text-neutral-500">
          Sign in with a magic link — no password.
        </p>

        {state === "sent" ? (
          <div className="rounded-xl border border-green-300 bg-green-50 p-5 text-green-900">
            <p className="font-medium">Check your email</p>
            <p className="mt-1 text-sm">
              We sent a sign-in link to <strong>{email}</strong>. Open it on
              this device.
            </p>
            <button
              className="btn-secondary mt-4"
              onClick={() => setState("idle")}
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={sendMagicLink} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <button
              type="submit"
              disabled={state === "sending"}
              className="btn-primary w-full disabled:opacity-50"
            >
              {state === "sending" ? "Sending…" : "Send magic link"}
            </button>
            {error && (
              <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
