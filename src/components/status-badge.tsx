import { CheckCircle2, Clock, Loader2, ShieldAlert, XCircle, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const ACTIVE_LABELS: Record<string, string> = {
  initializing: "Initializing",
  cloning: "Cloning",
  analyzing: "Analyzing",
  building: "Building",
  uploading: "Uploading",
  deploying: "Deploying",
  verifying: "Verifying",
};

export function DeploymentStatusBadge({ status }: { status: string }) {
  if (status in ACTIVE_LABELS) {
    return (
      <Badge variant="default" className="relative overflow-hidden">
        <span
          aria-hidden="true"
          className="mr-0.5 inline-block h-1.5 w-1.5 rounded-full bg-[#f4ba4a] animate-ping"
        />
        <Loader2 className="h-3 w-3 animate-spin" />
        {ACTIVE_LABELS[status]}
      </Badge>
    );
  }

  switch (status) {
    case "ready":
      return (
        <Badge variant="success">
          <CheckCircle2 className="h-3 w-3" />
          Ready
        </Badge>
      );
    case "queued":
      return (
        <Badge variant="warning">
          <span
            aria-hidden="true"
            className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse"
          />
          <Clock className="h-3 w-3" />
          Queued
        </Badge>
      );
    case "cancelled":
      return (
        <Badge variant="secondary">
          <Ban className="h-3 w-3" />
          Cancelled
        </Badge>
      );
    case "failed":
    default:
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3" />
          Failed
        </Badge>
      );
  }
}

export function UptimeStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "up":
      return (
        <Badge variant="success">
          <span className="relative flex h-2 w-2 items-center justify-center">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-65 animate-ping" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          Operational
        </Badge>
      );
    case "degraded":
      return (
        <Badge variant="warning">
          <ShieldAlert className="h-3 w-3" />
          Degraded
        </Badge>
      );
    case "down":
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3" />
          Down
        </Badge>
      );
    default:
      return <Badge variant="secondary">Pending</Badge>;
  }
}
