import React from 'react';
import { AlertTriangle, Cpu, HardDrive, MemoryStick, Container } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { ResourceUsage } from '@/types/containers';

interface ResourceUsageWidgetProps {
  usage: ResourceUsage;
  quota: ResourceUsage;
  percentages: {
    cpu: number;
    memory: number;
    storage: number;
    containers: number;
  };
  className?: string;
}

interface ResourceItemProps {
  icon: React.ReactNode;
  label: string;
  used: number;
  total: number;
  percentage: number;
  unit: string;
  isWarning: boolean;
}

const ResourceItem: React.FC<ResourceItemProps> = ({
  icon,
  label,
  used,
  total,
  percentage,
  unit,
  isWarning,
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{label}</span>
          {isWarning && (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {used.toFixed(1)} / {total} {unit}
        </div>
      </div>
      <div className="space-y-1">
        <Progress
          value={percentage}
          className={cn(
            "h-2",
            isWarning && "bg-amber-100",
            percentage >= 90 && "bg-red-100"
          )}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{percentage.toFixed(1)}% used</span>
          {isWarning && (
            <span className="text-amber-600 font-medium">High usage</span>
          )}
          {percentage >= 90 && (
            <span className="text-red-600 font-medium">Critical</span>
          )}
        </div>
      </div>
    </div>
  );
};

export const ResourceUsageWidget: React.FC<ResourceUsageWidgetProps> = ({
  usage,
  quota,
  percentages,
  className,
}) => {
  const resources = [
    {
      icon: <Cpu className="h-4 w-4 text-blue-500" />,
      label: 'CPU Cores',
      used: usage.cpuCores,
      total: quota.cpuCores,
      percentage: percentages.cpu,
      unit: 'cores',
      isWarning: percentages.cpu > 80,
    },
    {
      icon: <MemoryStick className="h-4 w-4 text-green-500" />,
      label: 'Memory',
      used: usage.memoryGb,
      total: quota.memoryGb,
      percentage: percentages.memory,
      unit: 'GB',
      isWarning: percentages.memory > 80,
    },
    {
      icon: <HardDrive className="h-4 w-4 text-purple-500" />,
      label: 'Storage',
      used: usage.storageGb,
      total: quota.storageGb,
      percentage: percentages.storage,
      unit: 'GB',
      isWarning: percentages.storage > 80,
    },
    {
      icon: <Container className="h-4 w-4 text-orange-500" />,
      label: 'Containers',
      used: usage.containerCount,
      total: quota.containerCount,
      percentage: percentages.containers,
      unit: 'containers',
      isWarning: percentages.containers > 80,
    },
  ];

  const hasWarnings = resources.some(resource => resource.isWarning);
  const hasCritical = resources.some(resource => resource.percentage >= 90);

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          Resource Usage
          {hasWarnings && !hasCritical && (
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          )}
          {hasCritical && (
            <AlertTriangle className="h-5 w-5 text-red-500" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {resources.map((resource, index) => (
          <ResourceItem
            key={index}
            icon={resource.icon}
            label={resource.label}
            used={resource.used}
            total={resource.total}
            percentage={resource.percentage}
            unit={resource.unit}
            isWarning={resource.isWarning}
          />
        ))}
        
        {hasWarnings && (
          <div className={cn(
            "mt-4 p-3 rounded-md border",
            hasCritical 
              ? "bg-red-50 border-red-200 text-red-800" 
              : "bg-amber-50 border-amber-200 text-amber-800"
          )}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">
                {hasCritical 
                  ? "Critical resource usage detected" 
                  : "High resource usage detected"
                }
              </span>
            </div>
            <p className="text-xs mt-1">
              {hasCritical 
                ? "Some resources are at 90%+ capacity. Consider upgrading your plan or reducing usage."
                : "Some resources are above 80% capacity. Monitor usage closely."
              }
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ResourceUsageWidget;