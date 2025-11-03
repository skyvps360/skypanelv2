import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Globe, 
  Database, 
  Code, 
  Server, 
  Cpu, 
  MemoryStick, 
  HardDrive,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { ContainerTemplate, ResourceUsage, TemplateService } from '@/types/containers';

interface TemplateSelectorProps {
  templates: ContainerTemplate[];
  selectedTemplate?: ContainerTemplate | null;
  onSelectTemplate: (template: ContainerTemplate) => void;
  currentUsage?: ResourceUsage;
  quota?: ResourceUsage;
  className?: string;
}

interface TemplateCardProps {
  template: ContainerTemplate;
  selected: boolean;
  onClick: () => void;
  canDeploy: boolean;
  resourceWarning?: string;
}

const getCategoryIcon = (category: string) => {
  const normalized = category?.toLowerCase?.() ?? '';
  switch (normalized) {
    case 'web':
    case 'frontend':
      return <Globe className="h-5 w-5" />;
    case 'database':
      return <Database className="h-5 w-5" />;
    case 'development':
    case 'tools':
      return <Code className="h-5 w-5" />;
    default:
      return <Server className="h-5 w-5" />;
  }
};

const getCategoryColor = (category: string) => {
  const normalized = category?.toLowerCase?.() ?? '';
  switch (normalized) {
    case 'web':
    case 'frontend':
      return 'bg-blue-100 text-blue-600';
    case 'database':
      return 'bg-green-100 text-green-600';
    case 'development':
    case 'tools':
      return 'bg-purple-100 text-purple-600';
    case 'cms':
      return 'bg-orange-100 text-orange-600';
    case 'analytics':
      return 'bg-pink-100 text-pink-600';
    default:
      return 'bg-gray-100 text-gray-600';
  }
};

const DEFAULT_RESOURCE_GUESSES: Record<string, { cpu: number; memory: number; storage: number }> = {
  app: { cpu: 0.5, memory: 1, storage: 5 },
  frontend: { cpu: 0.4, memory: 0.75, storage: 3 },
  postgres: { cpu: 0.5, memory: 1, storage: 10 },
  mysql: { cpu: 0.4, memory: 0.75, storage: 10 },
  mariadb: { cpu: 0.4, memory: 0.75, storage: 10 },
  mongo: { cpu: 0.4, memory: 0.75, storage: 8 },
  redis: { cpu: 0.2, memory: 0.5, storage: 2 },
  wordpress: { cpu: 0.5, memory: 1, storage: 10 },
  default: { cpu: 0.25, memory: 0.5, storage: 4 },
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const normalizeMemoryGb = (value: unknown): number | null => {
  const numeric = toNumber(value);
  if (numeric == null) {
    return null;
  }

  // Easypanel resource values are typically expressed in MB. When the value
  // looks like a larger whole number, convert it to GB for display purposes.
  if (numeric > 64) {
    return numeric / 1024;
  }

  return numeric;
};

const normalizeStorageGb = (value: unknown): number | null => {
  const numeric = toNumber(value);
  if (numeric == null) {
    return null;
  }

  if (numeric > 64) {
    return numeric / 1024;
  }

  return numeric;
};

const extractServiceResources = (service: TemplateService) => {
  const defaults = DEFAULT_RESOURCE_GUESSES[service.type?.toLowerCase?.() ?? ''] ?? DEFAULT_RESOURCE_GUESSES.default;
  const config = service.configuration ?? service.data ?? {};
  const resources = config.resources ?? config.resource ?? {};

  const cpu =
    toNumber(resources.cpuLimit ?? resources.cpu ?? config.cpuLimit ?? config.cpu) ??
    defaults.cpu;

  const memory =
    normalizeMemoryGb(resources.memoryLimit ?? resources.memory ?? config.memoryLimit ?? config.memory) ??
    defaults.memory;

  const storage =
    normalizeStorageGb(resources.storageLimit ?? resources.storage ?? config.storageLimit ?? config.storage) ??
    defaults.storage;

  return { cpu, memory, storage };
};

export const estimateTemplateResources = (template: ContainerTemplate): ResourceUsage => {
  const services = Array.isArray(template.templateSchema?.services)
    ? template.templateSchema.services
    : [];

  if (services.length === 0) {
    const defaults = DEFAULT_RESOURCE_GUESSES.default;
    return {
      cpuCores: defaults.cpu,
      memoryGb: defaults.memory,
      storageGb: defaults.storage,
      containerCount: 1,
    };
  }

  let totalCpu = 0;
  let totalMemory = 0;
  let totalStorage = 0;

  services.forEach((service) => {
    const { cpu, memory, storage } = extractServiceResources(service);
    totalCpu += cpu;
    totalMemory += memory;
    totalStorage += storage;
  });

  return {
    cpuCores: Math.max(totalCpu, 0.1),
    memoryGb: Math.max(totalMemory, 0.1),
    storageGb: Math.max(totalStorage, 0.5),
    containerCount: services.length,
  };
};

const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  selected,
  onClick,
  canDeploy,
  resourceWarning,
}) => {
  const requirements = estimateTemplateResources(template);
  const services = Array.isArray(template.templateSchema?.services)
    ? template.templateSchema.services
    : [];
  const categoryLabel = template.category?.trim() || 'General';
  const description = template.description?.trim() || 'Template details coming soon.';

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        selected && "ring-2 ring-primary",
        !canDeploy && "opacity-60"
      )}
      onClick={canDeploy ? onClick : undefined}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", getCategoryColor(categoryLabel))}>
              {getCategoryIcon(categoryLabel)}
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg font-semibold">
                {template.displayName}
              </CardTitle>
              <Badge variant="outline" className="mt-1 text-xs capitalize">
                {categoryLabel}
              </Badge>
            </div>
          </div>

          {selected && (
            <CheckCircle className="h-5 w-5 text-primary" />
          )}
          
          {!canDeploy && (
            <AlertCircle className="h-5 w-5 text-red-500" />
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {description}
        </p>
        
        {/* Resource Requirements */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">
            Resource Requirements
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1">
              <Cpu className="h-3 w-3 text-blue-500" />
              <span>{requirements.cpuCores} cores</span>
            </div>
            <div className="flex items-center gap-1">
              <MemoryStick className="h-3 w-3 text-green-500" />
              <span>{requirements.memoryGb} GB</span>
            </div>
            <div className="flex items-center gap-1">
              <HardDrive className="h-3 w-3 text-purple-500" />
              <span>{requirements.storageGb} GB</span>
            </div>
            <div className="flex items-center gap-1">
              <Server className="h-3 w-3 text-orange-500" />
              <span>{requirements.containerCount} service{requirements.containerCount !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
        
        {/* Warning message */}
        {resourceWarning && (
          <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            {resourceWarning}
          </div>
        )}
        
        {/* Services included */}
        {services.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              Includes
            </div>
            <div className="flex flex-wrap gap-1">
              {services.slice(0, 3).map((service, index) => (
                <Badge key={index} variant="secondary" className="text-xs capitalize">
                  {service.name || service.type}
                </Badge>
              ))}
              {services.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{services.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  templates,
  selectedTemplate,
  onSelectTemplate,
  currentUsage,
  quota,
  className,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Get unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((template) => {
      const categoryLabel = template.category?.trim();
      if (categoryLabel && categoryLabel.length > 0) {
        set.add(categoryLabel);
      } else {
        set.add('General');
      }
    });

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [templates]);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return templates.filter((template) => {
      const categoryLabel = template.category?.trim() || 'General';
      const matchesCategory = selectedCategory === 'all' || categoryLabel === selectedCategory;

      if (!matchesCategory) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchableValues = [
        template.displayName,
        template.templateName,
        template.description,
        categoryLabel,
      ]
        .filter(Boolean)
        .map((value) => value!.toLowerCase());

      return searchableValues.some((value) => value.includes(query));
    });
  }, [templates, searchQuery, selectedCategory]);

  const selectedTemplateDetails = useMemo(() => {
    if (!selectedTemplate) {
      return null;
    }

    return {
      categoryLabel: selectedTemplate.category?.trim() || 'General',
      description: selectedTemplate.description?.trim() || 'Template details coming soon.',
      services: Array.isArray(selectedTemplate.templateSchema?.services)
        ? selectedTemplate.templateSchema.services
        : [],
    };
  }, [selectedTemplate]);

  // Check if template can be deployed based on quotas
  const checkCanDeploy = (template: ContainerTemplate) => {
    if (!currentUsage || !quota) return { canDeploy: true, warning: '' };
    
    const requirements = estimateTemplateResources(template);
    const warnings: string[] = [];
    
    if (currentUsage.cpuCores + requirements.cpuCores > quota.cpuCores) {
      warnings.push('CPU quota exceeded');
    }
    if (currentUsage.memoryGb + requirements.memoryGb > quota.memoryGb) {
      warnings.push('Memory quota exceeded');
    }
    if (currentUsage.storageGb + requirements.storageGb > quota.storageGb) {
      warnings.push('Storage quota exceeded');
    }
    if (currentUsage.containerCount + requirements.containerCount > quota.containerCount) {
      warnings.push('Container limit exceeded');
    }
    
    return {
      canDeploy: warnings.length === 0,
      warning: warnings.length > 0 ? warnings.join(', ') : '',
    };
  };

  if (templates.length === 0) {
    return (
      <Card className={cn("p-8 text-center", className)}>
        <div className="flex flex-col items-center gap-4">
          <div className="p-4 bg-gray-100 rounded-full">
            <Server className="h-8 w-8 text-gray-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">No templates available</h3>
            <p className="text-muted-foreground">
              No application templates are currently enabled for deployment.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Choose Template</h3>
        <p className="text-muted-foreground">
          Select from pre-configured application templates to deploy quickly
        </p>
      </div>
      
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                <div className="flex items-center gap-2">
                  {getCategoryIcon(category)}
                  <span className="capitalize">{category}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} found
      </div>
      
      {/* Templates grid */}
      {filteredTemplates.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-gray-100 rounded-full">
              <Search className="h-8 w-8 text-gray-400" />
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-2">No templates found</h4>
              <p className="text-muted-foreground">
                Try adjusting your search or filter criteria.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => {
            const { canDeploy, warning } = checkCanDeploy(template);
            
            return (
              <TemplateCard
                key={template.id}
                template={template}
                selected={selectedTemplate?.id === template.id}
                onClick={() => onSelectTemplate(template)}
                canDeploy={canDeploy}
                resourceWarning={warning}
              />
            );
          })}
        </div>
      )}
      
      {/* Selected template details */}
      {selectedTemplate && selectedTemplateDetails && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              Selected Template
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-4">
              <div className={cn("p-2 rounded-lg", getCategoryColor(selectedTemplateDetails.categoryLabel))}>
                {getCategoryIcon(selectedTemplateDetails.categoryLabel)}
              </div>
              <div>
                <div className="font-semibold">{selectedTemplate.displayName}</div>
                <Badge variant="outline" className="text-xs capitalize">
                  {selectedTemplateDetails.categoryLabel}
                </Badge>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              {selectedTemplateDetails.description}
            </p>

            {selectedTemplateDetails.services.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">Services included:</div>
                <div className="flex flex-wrap gap-2">
                  {selectedTemplateDetails.services.map((service, index) => (
                    <Badge key={index} variant="secondary" className="text-xs capitalize">
                      {service.name || service.type}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TemplateSelector;