import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/env";
import { formatUuidFromCompact, parseHostingHost } from "@/lib/hosting/urls";
import { createPublicServerClient } from "@/lib/supabase/admin";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/projects",
  "/deployments",
  "/domains",
  "/monitoring",
  "/usage",
  "/settings",
];

const AUTH_PAGES = ["/login", "/register"];

async function rewriteTenantHost(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/sites/") ||
    pathname.startsWith("/d/")
  ) {
    return null;
  }

  const { appUrl } = getPublicEnv();
  const parsed = parseHostingHost({
    hostHeader: request.headers.get("host"),
    appUrl,
  });

  if (parsed.kind === "control-plane") {
    return null;
  }

  const suffixPath = pathname === "/" ? "" : pathname;

  if (parsed.kind === "production-slug") {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = `/sites/${parsed.slug}${suffixPath}`;
    return NextResponse.rewrite(rewriteUrl);
  }

  if (parsed.kind === "preview-prefix") {
    const fullUuid = formatUuidFromCompact(parsed.deploymentIdPrefix);
    let targetId: string | null = fullUuid;

    if (!targetId) {
      const supabase = createPublicServerClient();
      const { data: route } = await supabase
        .from("published_routes")
        .select("active_deployment_id")
        .eq("slug", parsed.slug)
        .maybeSingle();

      if (
        route?.active_deployment_id &&
        route.active_deployment_id.replace(/-/g, "").startsWith(parsed.deploymentIdPrefix)
      ) {
        targetId = route.active_deployment_id;
      }
    }

    if (!targetId) {
      const missingUrl = request.nextUrl.clone();
      missingUrl.pathname = `/sites/__not_found__`;
      return NextResponse.rewrite(missingUrl);
    }

    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = `/d/${targetId}${suffixPath}`;
    return NextResponse.rewrite(rewriteUrl);
  }

  // Verified custom domain lookup against published_routes (RLS permits only active & verified)
  const supabase = createPublicServerClient();
  const { data: customRoute } = await supabase
    .from("published_routes")
    .select("slug, active_deployment_id")
    .contains("verified_domains", [parsed.domain])
    .maybeSingle();

  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = customRoute?.slug
    ? `/sites/${customRoute.slug}${suffixPath}`
    : `/sites/__unconfigured__`;
  return NextResponse.rewrite(rewriteUrl);
}

export async function proxy(request: NextRequest) {
  const hostRewrite = await rewriteTenantHost(request);
  if (hostRewrite) {
    return hostRewrite;
  }

  let supabaseResponse = NextResponse.next({ request });
  const { supabaseUrl, supabasePublishableKey } = getPublicEnv();

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refresh auth token and verify JWT claims locally
  const { data } = await supabase.auth.getClaims();
  const hasClaims = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isProtected && !hasClaims) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (AUTH_PAGES.includes(pathname) && hasClaims) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
