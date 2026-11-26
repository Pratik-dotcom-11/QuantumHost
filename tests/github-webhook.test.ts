import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyGitHubWebhookSignature } from "../src/lib/github/client";

describe("GitHub Webhook X-Hub-Signature-256 verification", () => {
  const secret = "qh_webhook_test_secret_987654";
  const payload = JSON.stringify({ ref: "refs/heads/main", repository: { full_name: "acme/app" } });

  it("accepts a valid HMAC-SHA256 signature", () => {
    const sig = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
    expect(verifyGitHubWebhookSignature(secret, payload, sig)).toBe(true);
  });

  it("rejects a modified payload", () => {
    const sig = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
    expect(verifyGitHubWebhookSignature(secret, `${payload} `, sig)).toBe(false);
  });

  it("rejects missing, malformed, or wrong-secret signatures", () => {
    const wrongSig = `sha256=${createHmac("sha256", "wrong").update(payload).digest("hex")}`;
    expect(verifyGitHubWebhookSignature(secret, payload, null)).toBe(false);
    expect(verifyGitHubWebhookSignature(secret, payload, "sha1=abc")).toBe(false);
    expect(verifyGitHubWebhookSignature(secret, payload, wrongSig)).toBe(false);
  });
});
