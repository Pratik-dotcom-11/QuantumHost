"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function QuickDeployButton({
  projectId,
  projectName,
  branch,
  disabled,
}: {
  projectId: string;
  projectName: string;
  branch: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleQuickDeploy() {
    setLoading(true);
    try {
      const res = await fetch("/api/deployments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          branch,
          environment: "production",
        }),
      });
      const json = (await res.json()) as {
        deployment?: { id: string; deployment_number: number };
        deploymentId?: string;
        error?: string;
      };

      if (!res.ok) {
        toast({
          title: `Deploy failed for ${projectName}`,
          description: json.error || "Unable to enqueue deployment job.",
          variant: "error",
        });
        if (json.deploymentId) {
          router.push(`/deployments/${json.deploymentId}`);
        }
        return;
      }

      toast({
        title: `Queued ${projectName} #${json.deployment?.deployment_number ?? ""}`,
        description: `Build dispatched to isolated worker for branch ${branch}.`,
        variant: "success",
      });
      if (json.deployment?.id) {
        router.push(`/deployments/${json.deployment.id}`);
      }
    } catch (err) {
      toast({
        title: "Deployment request error",
        description: err instanceof Error ? err.message : "Network error",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      onClick={handleQuickDeploy}
      disabled={disabled || loading}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
      Deploy
    </Button>
  );
}
