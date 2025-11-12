/**
 * Container Deployments Component
 * Lists deployment history with rollback functionality
 */

import { useState } from "react";
import { RotateCcw, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import type { ContainerDeployment } from "@/types/container";

interface ContainerDeploymentsProps {
  deployments: ContainerDeployment[];
  currentDeploymentId?: string;
  onRollback: (deploymentId: string) => Promise<void>;
  isLoading?: boolean;
}

const formatDate = (date: string): string =>
  new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const getStatusIcon = (status: ContainerDeployment["status"]) => {
  switch (status) {
    case "running":
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case "failed":
      return <XCircle className="h-5 w-5 text-destructive" />;
    case "pending":
    case "building":
    case "deploying":
      return <Clock className="h-5 w-5 text-yellow-500" />;
    case "stopped":
      return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
    case "rolled_back":
      return <RotateCcw className="h-5 w-5 text-blue-500" />;
    default:
      return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
  }
};

const getStatusLabel = (status: ContainerDeployment["status"]): string => {
  switch (status) {
    case "running":
      return "Running";
    case "failed":
      return "Failed";
    case "pending":
      return "Pending";
    case "building":
      return "Building";
    case "deploying":
      return "Deploying";
    case "stopped":
      return "Stopped";
    case "rolled_back":
      return "Rolled Back";
    default:
      return status;
  }
};

export function ContainerDeployments({
  deployments,
  currentDeploymentId,
  onRollback,
  isLoading,
}: ContainerDeploymentsProps) {
  const [rollbackDialogOpen, setRollbackDialogOpen] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<ContainerDeployment | null>(
    null
  );
  const [rollbackLoading, setRollbackLoading] = useState(false);

  const handleRollbackClick = (deployment: ContainerDeployment) => {
    setSelectedDeployment(deployment);
    setRollbackDialogOpen(true);
  };

  const handleRollbackConfirm = async () => {
    if (!selectedDeployment) return;

    setRollbackLoading(true);
    try {
      await onRollback(selectedDeployment.id);
      toast.success("Rollback initiated successfully");
      setRollbackDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to rollback deployment");
    } finally {
      setRollbackLoading(false);
    }
  };

  if (deployments.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">No deployments found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Deployment History</h3>
            <p className="text-sm text-muted-foreground">
              View and manage deployment history
            </p>
          </div>
        </div>

        {/* Timeline */}
        <div className="relative space-y-4">
          {/* Timeline line */}
          <div className="absolute left-[21px] top-8 bottom-8 w-0.5 bg-border" />

          {deployments.map((deployment, index) => {
            const isActive = deployment.id === currentDeploymentId;
            const canRollback =
              !isActive &&
              deployment.status === "running" &&
              deployment.imageTag !== undefined;

            return (
              <Card
                key={deployment.id}
                className={`relative ${
                  isActive ? "border-primary ring-2 ring-primary" : ""
                }`}
              >
                {/* Timeline dot */}
                <div className="absolute left-[-29px] top-6 z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 border-border bg-card">
                  {getStatusIcon(deployment.status)}
                </div>

                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">
                          Deployment #{deployments.length - index}
                        </CardTitle>
                        {isActive && (
                          <Badge variant="default" className="text-xs">
                            Active
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {getStatusLabel(deployment.status)}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs font-mono">
                        {deployment.id}
                      </CardDescription>
                    </div>

                    {canRollback && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRollbackClick(deployment)}
                        disabled={isLoading || rollbackLoading}
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Rollback
                      </Button>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs">Image Tag</p>
                      <p className="font-mono text-xs">{deployment.imageTag}</p>
                    </div>

                    {deployment.deployedAt && (
                      <div className="space-y-1">
                        <p className="text-muted-foreground text-xs">Deployed At</p>
                        <p className="text-xs">{formatDate(deployment.deployedAt)}</p>
                      </div>
                    )}

                    {deployment.stoppedAt && (
                      <div className="space-y-1">
                        <p className="text-muted-foreground text-xs">Stopped At</p>
                        <p className="text-xs">{formatDate(deployment.stoppedAt)}</p>
                      </div>
                    )}

                    {deployment.publicUrl && (
                      <div className="space-y-1">
                        <p className="text-muted-foreground text-xs">Public URL</p>
                        <a
                          href={deployment.publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline truncate block"
                        >
                          {deployment.publicUrl}
                        </a>
                      </div>
                    )}

                    {deployment.workerId && (
                      <div className="space-y-1">
                        <p className="text-muted-foreground text-xs">Worker ID</p>
                        <p className="font-mono text-xs truncate">{deployment.workerId}</p>
                      </div>
                    )}
                  </div>

                  {deployment.deploymentLogs && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Deployment Logs</p>
                        <div className="bg-muted rounded p-3 max-h-40 overflow-y-auto">
                          <pre className="text-xs font-mono whitespace-pre-wrap">
                            {deployment.deploymentLogs}
                          </pre>
                        </div>
                      </div>
                    </>
                  )}

                  {deployment.buildLogs && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Build Logs</p>
                        <div className="bg-muted rounded p-3 max-h-40 overflow-y-auto">
                          <pre className="text-xs font-mono whitespace-pre-wrap">
                            {deployment.buildLogs}
                          </pre>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Rollback Confirmation Dialog */}
      <AlertDialog open={rollbackDialogOpen} onOpenChange={setRollbackDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Rollback</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to rollback to this deployment? This will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Stop the current deployment</li>
                <li>Start the selected deployment</li>
                <li>Update routing to the rolled-back version</li>
              </ul>
              {selectedDeployment && (
                <div className="mt-4 p-3 bg-muted rounded space-y-1 text-xs">
                  <p>
                    <span className="font-semibold">Deployment ID:</span>{" "}
                    {selectedDeployment.id}
                  </p>
                  <p>
                    <span className="font-semibold">Image Tag:</span>{" "}
                    {selectedDeployment.imageTag}
                  </p>
                  {selectedDeployment.deployedAt && (
                    <p>
                      <span className="font-semibold">Deployed:</span>{" "}
                      {formatDate(selectedDeployment.deployedAt)}
                    </p>
                  )}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rollbackLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRollbackConfirm}
              disabled={rollbackLoading}
              className="bg-primary"
            >
              {rollbackLoading ? "Rolling back..." : "Confirm Rollback"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
