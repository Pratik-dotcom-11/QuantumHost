import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  isValidRepoFullName,
  verifyGitHubWebhookSignature,
} from "../src/lib/github/client";
import { evaluateGitHubWebhookEvent } from "../src/lib/github/webhook";

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

describe("GitHub repository identifier validation", () => {
  it("accepts valid owner/repo strings", () => {
    expect(isValidRepoFullName("Pratik-dotcom-11/QuantumHost")).toBe(true);
    expect(isValidRepoFullName("vercel/next.js")).toBe(true);
  });

  it("rejects traversal and malformed repository identifiers", () => {
    expect(isValidRepoFullName("../secret/repo")).toBe(false);
    expect(isValidRepoFullName("owner/repo/extra")).toBe(false);
    expect(isValidRepoFullName("https://github.com/owner/repo")).toBe(false);
    expect(isValidRepoFullName("just-repo")).toBe(false);
  });
});

describe("GitHub Webhook event evaluation", () => {
  it("creates production deployment on push to default branch and preview on feature branch", () => {
    const prod = evaluateGitHubWebhookEvent(
      "push",
      {
        ref: "refs/heads/main",
        after: "abc1234",
        repository: { full_name: "Pratik-dotcom-11/QuantumHost" },
        head_commit: { id: "abc1234", message: "Ship landing page", author: { username: "Pratik-dotcom-11" } },
      },
      "main"
    );
    expect(prod).toMatchObject({
      action: "deploy",
      environment: "production",
      branch: "main",
      commitSha: "abc1234",
    });

    const prev = evaluateGitHubWebhookEvent(
      "push",
      {
        ref: "refs/heads/feat/ui",
        after: "def5678",
        repository: { full_name: "Pratik-dotcom-11/QuantumHost" },
      },
      "main"
    );
    expect(prev).toMatchObject({
      action: "deploy",
      environment: "preview",
      branch: "feat/ui",
    });
  });

  it("ignores deleted branches, tag pushes, and external fork pull requests", () => {
    expect(
      evaluateGitHubWebhookEvent("push", {
        ref: "refs/heads/old",
        deleted: true,
        repository: { full_name: "a/b" },
      }).action
    ).toBe("ignore");

    expect(
      evaluateGitHubWebhookEvent("push", {
        ref: "refs/tags/v1.0.0",
        repository: { full_name: "a/b" },
      }).action
    ).toBe("ignore");

    expect(
      evaluateGitHubWebhookEvent("pull_request", {
        action: "opened",
        repository: { full_name: "org/app" },
        pull_request: {
          number: 4,
          head: { ref: "patch-1", sha: "111", repo: { full_name: "fork-user/app" } },
        },
      }).action
    ).toBe("ignore");
  });

  it("creates preview deployment for same-repo pull_request events and detects installation removal", () => {
    const pr = evaluateGitHubWebhookEvent("pull_request", {
      action: "synchronize",
      repository: { full_name: "org/app" },
      pull_request: {
        number: 12,
        title: "Update header",
        head: { ref: "feat/header", sha: "999abc", repo: { full_name: "org/app" } },
        user: { login: "alice" },
      },
    });
    expect(pr).toMatchObject({
      action: "deploy",
      environment: "preview",
      branch: "feat/header",
      commitSha: "999abc",
    });

    const revoked = evaluateGitHubWebhookEvent("installation", {
      action: "deleted",
      installation: { id: 55123 },
    });
    expect(revoked).toEqual({
      action: "installation_revoke",
      installationId: 55123,
      reason: "Installation deleted",
    });
  });
});
