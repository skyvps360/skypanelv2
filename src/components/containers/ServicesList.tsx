import React, { useState } from 'react';
import { 
  Play, 
  Square, 
  RotateCcw, 
  Trash2, 
  MoreVertical, 
  Eye, 
  Settings, 
  Database, 
  Container, 
  Globe,
  Grid3X3,
  List,
  Cpu,
  MemoryStick,
  HardDrive
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ContainerService } from '@/types/containers';

interface ServicesListProps {
  services: ContainerService[];
  loading?: boolean;
  onViewService: (service: ContainerService) => void;
  onStartService: (service: ContainerService) => void;
  onStopService: (service: ContainerService) => void;
  onRestartService: (service: ContainerService) => void;
  onEditService: (service: ContainerService) => void;
  onDeleteService: (service: ContainerService) => void;
  className?: string;
}

interface ServiceCardProps {
  service: ContainerService;
  onView: () => void;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const getServiceIcon = (serviceType: ContainerService['serviceType']) => {
  switch (serviceType) {
    case 'postgres':
    case 'mysql':
    case 'mariadb':
    case 'mongo':
    case 'redis':
      return <Database className="h-5 w-5" />;
    case 'wordpress':
      return <Globe className="h-5 w-5" />;
    default:
      return <Container className="h-5 w-5" />;
  }
};

const getServiceTypeColor = (serviceType: ContainerService['serviceType']) => {
  switch (serviceType) {
    case 'postgres':
      return 'bg-blue-100 text-blue-600';
    case 'mysql':
    case 'mariadb':
      return 'bg-orange-100 text-orange-600';
    case 'mongo':
      return 'bg-green-100 text-green-600';
    case 'redis':
      return 'bg-red-100 text-red-600';
    case 'wordpress':
      return 'bg-purple-100 text-purple-600';
    default:
      return 'bg-gray-100 text-gray-600';
  }
};

const getStatusBadge = (status: string) => {
  switch (status.toLowerCase()) {
    case 'running':
      return <Badge className="bg-green-100 text-green-800 border-green-200">Running</Badge>;
    case 'stopped':
      return <Badge variant="secondary">Stopped</Badge>;
    case 'error':
    case 'failed':
      return <Badge variant="destructive">Error</Badge>;
    case 'deploying':
    case 'starting':
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Starting</Badge>;
    case 'stopping':
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Stopping</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  onView,
  onStart,
  onStop,
  onRestart,
  onEdit,
  onDelete,
}) => {
  const isRunning = service.status.toLowerCase() === 'running';
  const isStopped = service.status.toLowerCase() === 'stopped';
  const isError = service.status.toLowerCase() === 'error' || service.status.toLowerCase() === 'failed';

  return (
    <Card className="group hover:shadow-md transition-shadow cursor-pointer">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3" onClick={onView}>
            <div className={cn("p-2 rounded-lg", getServiceTypeColor(service.serviceType))}>
              {getServiceIcon(service.serviceType)}
            </div>
            <div>
              <CardTitle className="text-lg font-semibold group-hover:text-blue-600 transition-colors">
                {service.serviceName}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs capitalize">
                  {service.serviceType}
                </Badge>
                {getStatusBadge(service.status)}
              </div>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onView}>
                <Eye className="h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {isStopped && (
                <DropdownMenuItem onClick={onStart}>
                  <Play className="h-4 w-4" />
                  Start Service
                </DropdownMenuItem>
              )}
              {isRunning && (
                <>
                  <DropdownMenuItem onClick={onStop}>
                    <Square className="h-4 w-4" />
                    Stop Service
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onRestart}>
                    <RotateCcw className="h-4 w-4" />
                    Restart Service
                  </DropdownMenuItem>
                </>
              )}
              {isError && (
                <DropdownMenuItem onClick={onRestart}>
                  <RotateCcw className="h-4 w-4" />
                  Restart Service
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onEdit}>
                <Settings className="h-4 w-4" />
                Edit Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={onDelete}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
                Delete Service
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0" onClick={onView}>
        {/* Resource Usage */}
        {(service.cpuLimit || service.memoryLimitGb || service.storageLimitGb) && (
          <div className="space-y-2 mb-4">
            <div className="text-xs font-medium text-muted-foreground">Resource Limits</div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {service.cpuLimit && (
                <div className="flex items-center gap-1">
                  <Cpu className="h-3 w-3" />
                  <span>{service.cpuLimit} cores</span>
                </div>
              )}
              {service.memoryLimitGb && (
                <div className="flex items-center gap-1">
                  <MemoryStick className="h-3 w-3" />
                  <span>{service.memoryLimitGb} GB</span>
                </div>
              )}
              {service.storageLimitGb && (
                <div className="flex items-center gap-1">
                  <HardDrive className="h-3 w-3" />
                  <span>{service.storageLimitGb} GB</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          {isStopped && (
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onStart(); }}>
              <Play className="h-3 w-3 mr-1" />
              Start
            </Button>
          )}
          {isRunning && (
            <>
              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onStop(); }}>
                <Square className="h-3 w-3 mr-1" />
                Stop
              </Button>
              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onRestart(); }}>
                <RotateCcw className="h-3 w-3 mr-1" />
                Restart
              </Button>
            </>
          )}
          {isError && (
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onRestart(); }}>
              <RotateCcw className="h-3 w-3 mr-1" />
              Restart
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

interface ServiceRowProps {
  service: ContainerService;
  onView: () => void;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const ServiceRow: React.FC<ServiceRowProps> = ({
  service,
  onView,
  onStart,
  onStop,
  onRestart,
  onEdit,
  onDelete,
}) => {
  const isRunning = service.status.toLowerCase() === 'running';
  const isStopped = service.status.toLowerCase() === 'stopped';
  const isError = service.status.toLowerCase() === 'error' || service.status.toLowerCase() === 'failed';

  return (
    <div className="group flex items-center justify-between p-4 border rounded-lg hover:shadow-sm transition-shadow cursor-pointer">
      <div className="flex items-center gap-4" onClick={onView}>
        <div className={cn("p-2 rounded-lg", getServiceTypeColor(service.serviceType))}>
          {getServiceIcon(service.serviceType)}
        </div>
        
        <div className="flex-1">
          <div className="font-semibold group-hover:text-blue-600 transition-colors">
            {service.serviceName}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Badge variant="outline" className="text-xs capitalize">
              {service.serviceType}
            </Badge>
            {getStatusBadge(service.status)}
            {service.cpuLimit && (
              <span className="text-xs">{service.cpuLimit} cores</span>
            )}
            {service.memoryLimitGb && (
              <span className="text-xs">{service.memoryLimitGb} GB RAM</span>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {/* Quick Action Buttons */}
        {isStopped && (
          <Button size="sm" variant="outline" onClick={onStart}>
            <Play className="h-3 w-3" />
          </Button>
        )}
        {isRunning && (
          <>
            <Button size="sm" variant="outline" onClick={onStop}>
              <Square className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="outline" onClick={onRestart}>
              <RotateCcw className="h-3 w-3" />
            </Button>
          </>
        )}
        {isError && (
          <Button size="sm" variant="outline" onClick={onRestart}>
            <RotateCcw className="h-3 w-3" />
          </Button>
        )}
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onView}>
              <Eye className="h-4 w-4" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit}>
              <Settings className="h-4 w-4" />
              Edit Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={onDelete}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
              Delete Service
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export const ServicesList: React.FC<ServicesListProps> = ({
  services,
  loading = false,
  onViewService,
  onStartService,
  onStopService,
  onRestartService,
  onEditService,
  onDeleteService,
  className,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  if (loading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Services</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-3 bg-gray-200 rounded w-1/4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Services</h3>
        {services.length > 0 && (
          <div className="flex items-center border rounded-lg p-1">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="h-8 w-8 p-0"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="h-8 w-8 p-0"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {services.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-gray-100 rounded-full">
              <Container className="h-8 w-8 text-gray-400" />
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-2">No services deployed</h4>
              <p className="text-muted-foreground">
                Deploy your first service to get started with containerized applications.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  onView={() => onViewService(service)}
                  onStart={() => onStartService(service)}
                  onStop={() => onStopService(service)}
                  onRestart={() => onRestartService(service)}
                  onEdit={() => onEditService(service)}
                  onDelete={() => onDeleteService(service)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {services.map((service) => (
                <ServiceRow
                  key={service.id}
                  service={service}
                  onView={() => onViewService(service)}
                  onStart={() => onStartService(service)}
                  onStop={() => onStopService(service)}
                  onRestart={() => onRestartService(service)}
                  onEdit={() => onEditService(service)}
                  onDelete={() => onDeleteService(service)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ServicesList;