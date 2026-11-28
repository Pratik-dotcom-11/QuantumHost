export interface WebhookDeploymentDecision {
  action: "deploy" | "ignore" | "installation_revoke";
  reason?: string;
  repoFullName?: string;
  branch?: string;
  environment?: "production" | "preview";
  commitSha?: string | null;
  commitMessage?: string | null;
  author?: string | null;
  installationId?: number;
}

interface RawWebhookPayload {
  action?: string;
  deleted?: boolean;
  ref?: string;
  after?: string;
  repository?: {
    full_name?: string;
  };
  head_commit?: {
    id?: string;
    message?: string;
    author?: {
      name?: string;
      username?: string;
    };
  };
  pusher?: {
    name?: string;
  };
  pull_request?: {
    number?: number;
    title?: string;
    head?: {
      ref?: string;
      sha?: string;
      repo?: {
        full_name?: string;
      };
    };
    user?: {
      login?: string;
    };
  };
  installation?: {
    id?: number;
  };
  sender?: {
    login?: string;
  };
}

export function evaluateGitHubWebhookEvent(
  event: string | null,
  payload: RawWebhookPayload,
  defaultBranch?: string
): WebhookDeploymentDecision {
  if (event === "installation") {
    const installationId = payload.installation?.id;
    if (
      installationId &&
      (payload.action === "deleted" || payload.action === "suspend")
    ) {
      return {
        action: "installation_revoke",
        installationId,
        reason: `Installation ${payload.action}`,
      };
    }
    return { action: "ignore", reason: `Unhandled installation action: ${payload.action ?? "unknown"}` };
  }

  if (event === "push") {
    const repoFullName = payload.repository?.full_name;
    if (!repoFullName) {
      return { action: "ignore", reason: "Missing repository full_name" };
    }
    if (payload.deleted) {
      return { action: "ignore", reason: "Branch deletion push ignored" };
    }
    if (!payload.ref?.startsWith("refs/heads/")) {
      return { action: "ignore", reason: "Non-branch ref push ignored" };
    }
    const branch = payload.ref.slice("refs/heads/".length);
    if (!branch) {
      return { action: "ignore", reason: "Empty branch name" };
    }

    const environment = defaultBranch && branch === defaultBranch ? "production" : "preview";
    return {
      action: "deploy",
      repoFullName,
      branch,
      environment,
      commitSha: payload.head_commit?.id || payload.after || null,
      commitMessage: payload.head_commit?.message?.slice(0, 200) || null,
      author:
        payload.head_commit?.author?.username ||
        payload.head_commit?.author?.name ||
        payload.pusher?.name ||
        null,
    };
  }

  if (event === "pull_request") {
    const repoFullName = payload.repository?.full_name;
    const pr = payload.pull_request;
    if (!repoFullName || !pr) {
      return { action: "ignore", reason: "Missing repository or pull_request payload" };
    }
    if (!["opened", "synchronize", "reopened"].includes(payload.action ?? "")) {
      return { action: "ignore", reason: `Ignored pull_request action: ${payload.action ?? "unknown"}` };
    }
    // Only build PR heads originating in the target repository (never execute arbitrary untrusted fork PR code)
    if (pr.head?.repo?.full_name && pr.head.repo.full_name !== repoFullName) {
      return { action: "ignore", reason: "External fork pull request ignored for build isolation" };
    }
    const branch = pr.head?.ref;
    if (!branch) {
      return { action: "ignore", reason: "Missing pull request head branch" };
    }
    return {
      action: "deploy",
      repoFullName,
      branch,
      environment: "preview",
      commitSha: pr.head?.sha || null,
      commitMessage: pr.title ? `PR #${pr.number ?? ""}: ${pr.title}`.slice(0, 200) : null,
      author: pr.user?.login || payload.sender?.login || null,
    };
  }

  return { action: "ignore", reason: `Unsupported event: ${event ?? "none"}` };
}
