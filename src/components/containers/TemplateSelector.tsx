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
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { ContainerTemplate, ResourceUsage } from '@/types/containers';

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
  switch (category.toLowerCase()) {
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
  switch (category.toLowerCase()) {
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

const getResourceRequirements = (template: ContainerTemplate) => {
  // Extract resource requirements from template schema
  // This is a simplified version - in reality, you'd parse the template schema
  const services = template.templateSchema?.services || [];
  
  let totalCpu = 0;
  let totalMemory = 0;
  let totalStorage = 0;
  
  services.forEach(service => {
    // Default resource estimates based on service type
    if (service.type === 'app') {
      totalCpu += 0.5;
      totalMemory += 1;
      totalStorage += 5;
    } else if (service.type === 'postgres' || service.type === 'mysql') {
      totalCpu += 0.25;
      totalMemory += 0.5;
      totalStorage += 10;
    } else if (service.type === 'redis') {
      totalCpu += 0.1;
      totalMemory += 0.25;
      totalStorage += 1;
    }
  });
  
  return {
    cpuCores: Math.max(totalCpu, 0.1),
    memoryGb: Math.max(totalMemory, 0.25),
    storageGb: Math.max(totalStorage, 1),
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
  const requirements = getResourceRequirements(template);
  
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
            <div className={cn("p-2 rounded-lg", getCategoryColor(template.category))}>
              {getCategoryIcon(template.category)}
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg font-semibold">
                {template.displayName}
              </CardTitle>
              <Badge variant="outline" className="mt-1 text-xs capitalize">
                {template.category}
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
          {template.description}
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
        {template.templateSchema?.services && template.templateSchema.services.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              Includes
            </div>
            <div className="flex flex-wrap gap-1">
              {template.templateSchema.services.slice(0, 3).map((service, index) => (
                <Badge key={index} variant="secondary" className="text-xs capitalize">
                  {service.type}
                </Badge>
              ))}
              {template.templateSchema.services.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{template.templateSchema.services.length - 3} more
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
    const cats = Array.from(new Set(templates.map(t => t.category)));
    return cats.sort();
  }, [templates]);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return templates.filter(template => {
      const matchesSearch = template.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           template.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [templates, searchQuery, selectedCategory]);

  // Check if template can be deployed based on quotas
  const checkCanDeploy = (template: ContainerTemplate) => {
    if (!currentUsage || !quota) return { canDeploy: true, warning: '' };
    
    const requirements = getResourceRequirements(template);
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
      {selectedTemplate && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              Selected Template
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-4">
              <div className={cn("p-2 rounded-lg", getCategoryColor(selectedTemplate.category))}>
                {getCategoryIcon(selectedTemplate.category)}
              </div>
              <div>
                <div className="font-semibold">{selectedTemplate.displayName}</div>
                <Badge variant="outline" className="text-xs capitalize">
                  {selectedTemplate.category}
                </Badge>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground mb-4">
              {selectedTemplate.description}
            </p>
            
            {selectedTemplate.templateSchema?.services && (
              <div>
                <div className="text-sm font-medium mb-2">Services included:</div>
                <div className="flex flex-wrap gap-2">
                  {selectedTemplate.templateSchema.services.map((service, index) => (
                    <Badge key={index} variant="secondary" className="text-xs capitalize">
                      {service.type}
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