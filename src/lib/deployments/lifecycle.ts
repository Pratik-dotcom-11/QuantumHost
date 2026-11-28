import type { DeploymentStatus } from "@/types/database";

export const TERMINAL_DEPLOYMENT_STATES: readonly DeploymentStatus[] = [
  "ready",
  "failed",
  "cancelled",
];

export const ACTIVE_DEPLOYMENT_STATES: readonly DeploymentStatus[] = [
  "queued",
  "initializing",
  "cloning",
  "analyzing",
  "building",
  "uploading",
  "deploying",
  "verifying",
];

const VALID_TRANSITIONS: Record<DeploymentStatus, readonly DeploymentStatus[]> = {
  queued: ["initializing", "building", "failed", "cancelled"],
  initializing: ["cloning", "building", "failed", "cancelled"],
  cloning: ["analyzing", "building", "failed", "cancelled"],
  analyzing: ["building", "uploading", "failed", "cancelled"],
  building: ["uploading", "failed", "cancelled"],
  uploading: ["deploying", "ready", "failed", "cancelled"],
  deploying: ["verifying", "ready", "failed", "cancelled"],
  verifying: ["ready", "failed", "cancelled"],
  ready: [],
  failed: [],
  cancelled: [],
};

export function isTerminalDeploymentStatus(status: string): boolean {
  return (TERMINAL_DEPLOYMENT_STATES as readonly string[]).includes(status);
}

export function isActiveDeploymentStatus(status: string): boolean {
  return (ACTIVE_DEPLOYMENT_STATES as readonly string[]).includes(status);
}

export function canTransitionDeploymentStatus(
  from: DeploymentStatus,
  to: DeploymentStatus
): boolean {
  if (from === to) return true;
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertDeploymentTransition(
  from: DeploymentStatus,
  to: DeploymentStatus
): void {
  if (!canTransitionDeploymentStatus(from, to)) {
    throw new Error(`Invalid deployment state transition: ${from} -> ${to}`);
  }
}
