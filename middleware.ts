import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files and images.
     * API capture routes do their own token auth (see docs/04-capture-flows.md).
     */
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|api/capture).*)",
  ],
};
