/**
 * Container Service Detail Component
 * Shows detailed service information, deployment status, metrics, and configuration
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Play,
  Square,
  RotateCcw,
  RefreshCw,
  ExternalLink,
  Settings,
  GitBranch,
  Package,
  Activity,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Status } from "@/components/ui/status";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ContainerService, ContainerDeployment } from "@/types/container";
import { formatCurrency } from "@/lib/formatters";

interface ContainerServiceDetailProps {
  service: ContainerService;
  currentDeployment?: ContainerDeployment;
  onAction: (action: "start" | "stop" | "restart" | "rebuild") => void;
  onUpdate: () => void;
  isLoading?: boolean;
}

const statusLabel = (status: ContainerService["status"]): string => {
  switch (status) {
    case "running":
      return "Running";
    case "stopped":
      return "Stopped";
    case "pending":
      return "Pending";
    case "building":
      return "Building";
    case "deploying":
      return "Deploying";
    case "failed":
      return "Failed";
    case "deleted":
      return "Deleted";
    default:
      return status;
  }
};

const getStatusVariant = (status: ContainerService["status"]) => {
  switch (status) {
    case "running":
      return "running";
    case "stopped":
      return "stopped";
    case "pending":
      return "provisioning";
    case "building":
      return "loading";
    case "deploying":
      return "loading";
    case "failed":
      return "error";
    case "deleted":
      return "offline";
    default:
      return "offline";
  }
};

const formatDate = (date: string): string =>
  new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatMemory = (mb: number): string => {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)} GB`;
  }
  return `${mb} MB`;
};

const calculateMonthlyCost = (service: ContainerService): number => {
  const cpuCost = service.resourceLimits.cpuCores * 0.01 * 730;
  const memoryCost = (service.resourceLimits.memoryMb / 1024) * 0.005 * 730;
  const storageCost = service.resourceLimits.diskGb * 0.000137 * 730;
  return cpuCost + memoryCost + storageCost;
};

export function ContainerServiceDetail({
  service,
  currentDeployment,
  onAction,
  onUpdate,
  isLoading,
}: ContainerServiceDetailProps) {
  const [actionLoading, setActionLoading] = useState(false);

  const handleAction = async (action: "start" | "stop" | "restart" | "rebuild") => {
    setActionLoading(true);
    try {
      await onAction(action);
      toast.success(`Service ${action} initiated successfully`);
    } catch (error: any) {
      toast.error(error.message || `Failed to ${action} service`);
    } finally {
      setActionLoading(false);
    }
  };

  const isRunning = service.status === "running";
  const isStopped = service.status === "stopped";
  const isTransitioning = ["pending", "building", "deploying"].includes(service.status);
  const monthlyCost = calculateMonthlyCost(service);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{service.name}</h1>
            <Status
              variant={getStatusVariant(service.status)}
              label={statusLabel(service.status)}
              showPing={service.status !== "stopped"}
              animated={service.status === "building"}
            />
          </div>
          <p className="text-sm text-muted-foreground font-mono">{service.slug}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {isRunning && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleAction("stop")}
                disabled={actionLoading || isLoading}
              >
                <Square className="h-4 w-4 mr-2" />
                Stop
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAction("restart")}
                disabled={actionLoading || isLoading}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Restart
              </Button>
            </>
          )}
          {isStopped && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleAction("start")}
              disabled={actionLoading || isLoading || isTransitioning}
            >
              <Play className="h-4 w-4 mr-2" />
              Start
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction("rebuild")}
            disabled={actionLoading || isLoading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Rebuild
          </Button>
          <Button variant="outline" size="sm" onClick={onUpdate}>
            <Settings className="h-4 w-4 mr-2" />
            Configure
          </Button>
        </div>
      </div>

      {/* Quick Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{statusLabel(service.status)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Monthly Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(monthlyCost)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(monthlyCost / 730)}/hour
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Resources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              <p>{service.resourceLimits.cpuCores} CPU cores</p>
              <p>{formatMemory(service.resourceLimits.memoryMb)}</p>
              <p>{service.resourceLimits.diskGb} GB storage</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Created
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{formatDate(service.createdAt)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Public URL */}
      {service.publicUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              Public URL
            </CardTitle>
          </CardHeader>
          <CardContent>
            <a
              href={service.publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-mono text-sm"
            >
              {service.publicUrl}
            </a>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">
            <Package className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="deployment">
            <GitBranch className="h-4 w-4 mr-2" />
            Deployment
          </TabsTrigger>
          <TabsTrigger value="metrics">
            <Activity className="h-4 w-4 mr-2" />
            Metrics
          </TabsTrigger>
          <TabsTrigger value="logs">
            <FileText className="h-4 w-4 mr-2" />
            Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>Service configuration and settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Source</p>
                  {service.gitRepository ? (
                    <div className="space-y-1">
                      <p className="text-sm font-mono truncate">{service.gitRepository}</p>
                      <p className="text-xs text-muted-foreground">
                        Branch: {service.gitBranch}
                      </p>
                    </div>
                  ) : service.templateId ? (
                    <Badge variant="outline">Template Deployment</Badge>
                  ) : (
                    <Badge variant="outline">{service.buildConfig.environmentType}</Badge>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Build Type</p>
                  <Badge variant="outline">{service.buildConfig.environmentType}</Badge>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Environment Variables
                </p>
                {Object.keys(service.environmentVars).length > 0 ? (
                  <div className="space-y-1">
                    {Object.entries(service.environmentVars).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between p-2 bg-muted rounded text-xs font-mono"
                      >
                        <span className="font-semibold">{key}</span>
                        <span className="text-muted-foreground truncate max-w-[200px]">
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No environment variables set</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Current Deployment */}
          {currentDeployment && (
            <Card>
              <CardHeader>
                <CardTitle>Current Deployment</CardTitle>
                <CardDescription>Active deployment information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Deployment ID</p>
                    <p className="text-sm font-mono">{currentDeployment.id}</p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Image Tag</p>
                    <p className="text-sm font-mono">{currentDeployment.imageTag}</p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Deployed At</p>
                    <p className="text-sm">
                      {currentDeployment.deployedAt
                        ? formatDate(currentDeployment.deployedAt)
                        : "N/A"}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Status</p>
                    <Badge variant="outline">{currentDeployment.status}</Badge>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/containers/${service.id}/deployments`}>
                      View All Deployments
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="deployment">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Deployment history will be displayed here
              </p>
              <Button variant="outline" size="sm" className="mt-4" asChild>
                <Link to={`/containers/${service.id}/deployments`}>
                  View Deployment History
                </Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Resource metrics will be displayed here
              </p>
              <Button variant="outline" size="sm" className="mt-4" asChild>
                <Link to={`/containers/${service.id}/metrics`}>View Detailed Metrics</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Service logs will be displayed here
              </p>
              <Button variant="outline" size="sm" className="mt-4" asChild>
                <Link to={`/containers/${service.id}/logs`}>View Full Logs</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
