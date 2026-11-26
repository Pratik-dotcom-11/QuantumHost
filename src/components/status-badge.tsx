import { CheckCircle2, Clock, Loader2, ShieldAlert, XCircle, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function DeploymentStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "ready":
      return (
        <Badge variant="success">
          <CheckCircle2 className="h-3 w-3" />
          Ready
        </Badge>
      );
    case "building":
    case "uploading":
      return (
        <Badge variant="default">
          <Loader2 className="h-3 w-3 animate-spin" />
          {status === "uploading" ? "Uploading" : "Building"}
        </Badge>
      );
    case "queued":
      return (
        <Badge variant="warning">
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
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
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
