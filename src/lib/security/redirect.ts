/**
 * Browser-safe helper to prevent Open Redirect vulnerabilities (e.g. `//evil.com`, `/\evil.com`).
 */
export function sanitizeRelativeRedirectPath(
  rawNext: string | null | undefined,
  fallback = "/dashboard"
): string {
  if (!rawNext) return fallback;
  const trimmed = rawNext.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return fallback;
  }
  try {
    const parsed = new URL(trimmed, "https://quantumhost.local");
    if (parsed.origin !== "https://quantumhost.local") {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
