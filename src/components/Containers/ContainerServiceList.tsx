/**
 * Container Service List Component
 * Displays all container services with status, resource usage, and quick actions
 */

import { useMemo, useCallback, useState } from "react";
import { Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import {
  MoreHorizontal,
  Play,
  Square,
  RotateCcw,
  Trash2,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Status } from "@/components/ui/status";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ContainerService } from "@/types/container";
import { formatCurrency } from "@/lib/formatters";

interface ContainerServiceListProps {
  services: ContainerService[];
  isLoading?: boolean;
  onAction: (
    serviceId: string,
    action: "start" | "stop" | "restart" | "rebuild" | "delete"
  ) => void;
  onRefresh?: () => void;
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
  // Pricing: CPU $0.01/core-hour, Memory $0.005/GB-hour, Storage $0.000137/GB-hour
  const cpuCost = service.resourceLimits.cpuCores * 0.01 * 730; // 730 hours/month
  const memoryCost = (service.resourceLimits.memoryMb / 1024) * 0.005 * 730;
  const storageCost = service.resourceLimits.diskGb * 0.000137 * 730;
  return cpuCost + memoryCost + storageCost;
};

export function ContainerServiceList({
  services,
  isLoading,
  onAction,
  onRefresh,
}: ContainerServiceListProps) {
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const handleAction = useCallback(
    async (
      serviceId: string,
      action: "start" | "stop" | "restart" | "rebuild" | "delete"
    ) => {
      setActionLoading((prev) => ({ ...prev, [serviceId]: true }));
      try {
        await onAction(serviceId, action);
      } finally {
        setActionLoading((prev) => ({ ...prev, [serviceId]: false }));
      }
    },
    [onAction]
  );

  const columns = useMemo<ColumnDef<ContainerService>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Service",
        cell: ({ row }) => {
          const service = row.original;
          const showPing = ["running", "building", "deploying"].includes(
            service.status
          );

          return (
            <div className="space-y-2 min-w-[200px]">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to={`/containers/${service.id}`}
                  className="font-medium text-foreground text-sm sm:text-base hover:underline truncate max-w-[150px] sm:max-w-none"
                >
                  {service.name}
                </Link>
                <Status
                  variant={getStatusVariant(service.status)}
                  label={statusLabel(service.status)}
                  showPing={showPing}
                  animated={service.status === "building"}
                />
              </div>
              {(service.status === "building" || service.status === "deploying") && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{statusLabel(service.status)}</span>
                  </div>
                  <Progress value={service.status === "building" ? 50 : 75} className="h-1.5" />
                </div>
              )}
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="font-mono text-xs">{service.slug}</span>
                {service.publicUrl && (
                  <a
                    href={service.publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span>View</span>
                  </a>
                )}
              </div>
            </div>
          );
        },
        meta: {
          className: "sticky left-0 bg-card z-10 min-w-[200px] border-r border-border",
        },
      },
      {
        id: "resources",
        header: "Resources",
        cell: ({ row }) => {
          const { resourceLimits } = row.original;
          return (
            <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs min-w-[180px]">
              <div>
                <div className="text-muted-foreground text-xs">CPU</div>
                <div className="font-medium text-foreground text-xs">
                  {resourceLimits.cpuCores} {resourceLimits.cpuCores === 1 ? "core" : "cores"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Memory</div>
                <div className="font-medium text-foreground text-xs">
                  {formatMemory(resourceLimits.memoryMb)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Storage</div>
                <div className="font-medium text-foreground text-xs">
                  {resourceLimits.diskGb} GB
                </div>
              </div>
            </div>
          );
        },
        meta: {
          className: "min-w-[180px]",
        },
      },
      {
        id: "source",
        header: "Source",
        cell: ({ row }) => {
          const service = row.original;
          return (
            <div className="space-y-1 text-xs min-w-[150px]">
              {service.gitRepository ? (
                <>
                  <div className="text-muted-foreground text-xs">Git Repository</div>
                  <div className="font-medium text-foreground text-xs truncate max-w-[200px]">
                    {service.gitRepository}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    Branch: {service.gitBranch}
                  </div>
                </>
              ) : service.templateId ? (
                <>
                  <div className="text-muted-foreground text-xs">Template</div>
                  <Badge variant="outline" className="text-xs">
                    Template Deployment
                  </Badge>
                </>
              ) : (
                <>
                  <div className="text-muted-foreground text-xs">Custom</div>
                  <Badge variant="outline" className="text-xs">
                    {service.buildConfig.environmentType}
                  </Badge>
                </>
              )}
            </div>
          );
        },
        meta: {
          className: "min-w-[150px]",
        },
      },
      {
        id: "cost",
        header: "Est. Monthly Cost",
        cell: ({ row }) => {
          const monthlyCost = calculateMonthlyCost(row.original);
          return (
            <div className="text-xs min-w-[100px]">
              <div className="font-medium text-foreground">
                {formatCurrency(monthlyCost)}
              </div>
              <div className="text-muted-foreground text-xs">
                {formatCurrency(monthlyCost / 730)}/hr
              </div>
            </div>
          );
        },
        meta: {
          className: "min-w-[100px]",
        },
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => (
          <div className="text-xs text-muted-foreground min-w-[100px]">
            {formatDate(row.original.createdAt)}
          </div>
        ),
        meta: {
          className: "min-w-[100px] hidden sm:table-cell",
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const service = row.original;
          const isRunning = service.status === "running";
          const isStopped = service.status === "stopped";
          const isTransitioning = ["pending", "building", "deploying"].includes(
            service.status
          );
          const loading = actionLoading[service.id];

          return (
            <div className="flex items-center justify-end gap-1 sm:gap-2 min-w-[180px]">
              {isRunning && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleAction(service.id, "stop")}
                    disabled={loading}
                    className="touch-manipulation min-h-[36px] text-xs px-2 sm:px-3"
                  >
                    <Square className="h-3 w-3 sm:mr-1" />
                    <span className="hidden sm:inline">Stop</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction(service.id, "restart")}
                    disabled={loading}
                    className="touch-manipulation min-h-[36px] text-xs px-2 sm:px-3"
                  >
                    <RotateCcw className="h-3 w-3 sm:mr-1" />
                    <span className="hidden sm:inline">Restart</span>
                  </Button>
                </>
              )}
              {isStopped && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleAction(service.id, "start")}
                  disabled={loading || isTransitioning}
                  className="touch-manipulation min-h-[36px] text-xs px-2 sm:px-3"
                >
                  <Play className="h-3 w-3 sm:mr-1" />
                  <span className="hidden sm:inline">Start</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="touch-manipulation min-h-[36px] text-xs px-2 sm:px-3"
              >
                <Link to={`/containers/${service.id}`}>
                  <span className="hidden sm:inline">Details</span>
                  <span className="sm:hidden">📋</span>
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 touch-manipulation min-h-[36px] min-w-[36px]"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Open actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>Quick actions</DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => handleAction(service.id, "rebuild")}
                    disabled={loading}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Rebuild & Deploy
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to={`/containers/${service.id}`}>View details</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={`/containers/${service.id}/logs`}>View logs</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={`/containers/${service.id}/metrics`}>View metrics</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleAction(service.id, "delete")}
                    disabled={loading}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
        size: 220,
        meta: {
          className: "min-w-[180px]",
        },
      },
    ],
    [actionLoading, handleAction]
  );

  const mobileCards = services.map((service) => {
    const isRunning = service.status === "running";
    const isStopped = service.status === "stopped";
    const isTransitioning = ["pending", "building", "deploying"].includes(
      service.status
    );
    const monthlyCost = calculateMonthlyCost(service);
    const loading = actionLoading[service.id];

    return (
      <Card key={service.id} className="border border-border/70 bg-card/95 shadow-sm">
        <CardHeader className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold text-foreground">
                <Link
                  to={`/containers/${service.id}`}
                  className="hover:underline"
                >
                  {service.name}
                </Link>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground font-mono">
                {service.slug}
              </CardDescription>
            </div>
            <Status
              variant={getStatusVariant(service.status)}
              label={statusLabel(service.status)}
              showPing={service.status !== "stopped"}
              animated={service.status === "building"}
            />
          </div>
          {service.publicUrl && (
            <a
              href={service.publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3" />
              <span className="truncate">{service.publicUrl}</span>
            </a>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {(service.status === "building" || service.status === "deploying") && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{statusLabel(service.status)}</span>
                <span>{service.status === "building" ? "50%" : "75%"}</span>
              </div>
              <Progress
                value={service.status === "building" ? 50 : 75}
                className="h-1.5"
              />
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="space-y-1">
              <p className="text-muted-foreground">CPU</p>
              <p className="font-medium text-foreground">
                {service.resourceLimits.cpuCores}{" "}
                {service.resourceLimits.cpuCores === 1 ? "core" : "cores"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Memory</p>
              <p className="font-medium text-foreground">
                {formatMemory(service.resourceLimits.memoryMb)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Storage</p>
              <p className="font-medium text-foreground">
                {service.resourceLimits.diskGb} GB
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">Source</p>
            {service.gitRepository ? (
              <div className="space-y-1">
                <p className="font-medium text-foreground text-xs truncate">
                  {service.gitRepository}
                </p>
                <p className="text-muted-foreground text-xs">
                  Branch: {service.gitBranch}
                </p>
              </div>
            ) : service.templateId ? (
              <Badge variant="outline" className="text-xs">
                Template Deployment
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                {service.buildConfig.environmentType}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <p className="text-muted-foreground">Monthly Cost</p>
              <p className="font-medium text-foreground">
                {formatCurrency(monthlyCost)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Created</p>
              <p className="font-medium text-foreground">
                {formatDate(service.createdAt)}
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button
            variant={isRunning ? "secondary" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => handleAction(service.id, isRunning ? "stop" : "start")}
            disabled={loading || isTransitioning}
          >
            {isRunning ? "Stop" : isStopped ? "Start" : "Action"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => handleAction(service.id, "restart")}
            disabled={loading || isTransitioning}
          >
            Restart
          </Button>
          <Button asChild variant="ghost" size="sm" className="flex-1">
            <Link to={`/containers/${service.id}`}>Details</Link>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="flex-1"
            onClick={() => handleAction(service.id, "delete")}
            disabled={loading}
          >
            Delete
          </Button>
        </CardFooter>
      </Card>
    );
  });

  return (
    <div className="space-y-4">
      {onRefresh && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      )}
      <div className="grid gap-3 lg:hidden">
        {mobileCards.length > 0 ? (
          mobileCards
        ) : (
          <Card className="border border-dashed border-border/60 bg-card/60">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No container services found.
            </CardContent>
          </Card>
        )}
      </div>
      <div className="hidden lg:block">
        <DataTable
          columns={columns}
          data={services}
          isLoading={isLoading}
          getRowId={(row) => row.id}
          emptyState={
            <div className="py-10 text-center">
              <p className="text-base font-medium text-foreground">
                No container services found
              </p>
              <p className="text-sm text-muted-foreground">
                Start by creating a service to see it appear in this list.
              </p>
            </div>
          }
        />
      </div>
    </div>
  );
}
