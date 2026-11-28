import { NextResponse } from "next/server";
import { checkGitHubAuthStatus } from "@/lib/auth/github-provider";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fresh = url.searchParams.get("fresh") === "1";

  const status = await checkGitHubAuthStatus(fresh, url.origin);
  return NextResponse.json(status, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
