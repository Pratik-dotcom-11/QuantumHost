import { NextResponse } from "next/server";

const UUID_V4_OR_GENERAL_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string | null | undefined): boolean {
  if (!value) return false;
  return UUID_V4_OR_GENERAL_REGEX.test(value.trim());
}

export function invalidUuidResponse(label = "resource"): NextResponse {
  return NextResponse.json(
    { error: `Invalid ${label} ID format. Expected a valid UUID.` },
    { status: 400 }
  );
}
