import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Container, 
  Database, 
  Globe, 
  Github, 
  Image, 
  Upload,
  Plus,
  Minus,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { 
  ContainerTemplate, 
  ResourceUsage, 
  QuotaCheckResult,
  AppServiceFormData,
  DatabaseServiceFormData,
  TemplateServiceFormData
} from '@/types/containers';

interface DeployServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  templates: ContainerTemplate[];
  currentUsage: ResourceUsage;
  quota: ResourceUsage;
  onDeployApp: (data: AppServiceFormData) => Promise<void>;
  onDeployDatabase: (data: DatabaseServiceFormData) => Promise<void>;
  onDeployTemplate: (data: TemplateServiceFormData) => Promise<void>;
  onCheckQuota: (requirements: any) => Promise<QuotaCheckResult>;
}

type DeploymentType = 'template' | 'app' | 'database';
type Step = 'type' | 'config' | 'review';

interface StepIndicatorProps {
  currentStep: Step;
  steps: { key: Step; label: string }[];
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, steps }) => {
  const currentIndex = steps.findIndex(step => step.key === currentStep);
  
  return (
    <div className="flex items-center justify-center mb-6">
      {steps.map((step, index) => (
        <React.Fragment key={step.key}>
          <div className="flex items-center">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
              index <= currentIndex 
                ? "bg-primary text-primary-foreground" 
                : "bg-muted text-muted-foreground"
            )}>
              {index < currentIndex ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                index + 1
              )}
            </div>
            <span className={cn(
              "ml-2 text-sm font-medium",
              index <= currentIndex ? "text-foreground" : "text-muted-foreground"
            )}>
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div className={cn(
              "w-12 h-px mx-4",
              index < currentIndex ? "bg-primary" : "bg-muted"
            )} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

interface DeploymentTypeCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}

const DeploymentTypeCard: React.FC<DeploymentTypeCardProps> = ({
  icon,
  title,
  description,
  selected,
  onClick,
}) => (
  <Card 
    className={cn(
      "cursor-pointer transition-all hover:shadow-md",
      selected && "ring-2 ring-primary"
    )}
    onClick={onClick}
  >
    <CardHeader className="text-center">
      <div className="mx-auto mb-2 p-3 bg-primary/10 rounded-full w-fit">
        {icon}
      </div>
      <CardTitle className="text-lg">{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
  </Card>
);

interface EnvironmentVariableRowProps {
  envVar: { key: string; value: string };
  onChange: (key: string, value: string) => void;
  onRemove: () => void;
}

const EnvironmentVariableRow: React.FC<EnvironmentVariableRowProps> = ({
  envVar,
  onChange,
  onRemove,
}) => (
  <div className="flex gap-2 items-center">
    <Input
      placeholder="Key"
      value={envVar.key}
      onChange={(e) => onChange(e.target.value, envVar.value)}
      className="flex-1"
    />
    <Input
      placeholder="Value"
      value={envVar.value}
      onChange={(e) => onChange(envVar.key, e.target.value)}
      className="flex-1"
    />
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onRemove}
    >
      <Minus className="h-4 w-4" />
    </Button>
  </div>
);

export const DeployServiceModal: React.FC<DeployServiceModalProps> = ({
  isOpen,
  onClose,
  projectName,
  templates,
  currentUsage,
  quota,
  onDeployApp,
  onDeployDatabase,
  onDeployTemplate,
  onCheckQuota,
}) => {
  const [step, setStep] = useState<Step>('type');
  const [deploymentType, setDeploymentType] = useState<DeploymentType | null>(null);
  const [loading, setLoading] = useState(false);
  const [quotaCheck, setQuotaCheck] = useState<QuotaCheckResult | null>(null);
  
  // Form data states
  const [appFormData, setAppFormData] = useState<AppServiceFormData>({
    serviceName: '',
    sourceType: 'image',
    image: '',
    env: [{ key: '', value: '' }],
  });
  
  const [databaseFormData, setDatabaseFormData] = useState<DatabaseServiceFormData>({
    serviceName: '',
    databaseType: 'postgres',
    version: '',
    username: '',
    password: '',
    database: '',
  });
  
  const [templateFormData, setTemplateFormData] = useState<TemplateServiceFormData>({
    serviceName: '',
    templateId: '',
    configuration: {},
  });

  const steps = [
    { key: 'type' as Step, label: 'Choose Type' },
    { key: 'config' as Step, label: 'Configure' },
    { key: 'review' as Step, label: 'Review' },
  ];

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setStep('type');
      setDeploymentType(null);
      setQuotaCheck(null);
      setAppFormData({
        serviceName: '',
        sourceType: 'image',
        image: '',
        env: [{ key: '', value: '' }],
      });
      setDatabaseFormData({
        serviceName: '',
        databaseType: 'postgres',
        version: '',
        username: '',
        password: '',
        database: '',
      });
      setTemplateFormData({
        serviceName: '',
        templateId: '',
        configuration: {},
      });
    }
  }, [isOpen]);

  const handleNext = async () => {
    if (step === 'type' && deploymentType) {
      setStep('config');
    } else if (step === 'config') {
      // Perform quota check before moving to review
      try {
        setLoading(true);
        const requirements = getResourceRequirements();
        const result = await onCheckQuota(requirements);
        setQuotaCheck(result);
        setStep('review');
      } catch (error) {
        console.error('Quota check failed:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBack = () => {
    if (step === 'config') {
      setStep('type');
    } else if (step === 'review') {
      setStep('config');
    }
  };

  const handleDeploy = async () => {
    if (!deploymentType) return;
    
    try {
      setLoading(true);
      
      if (deploymentType === 'app') {
        await onDeployApp(appFormData);
      } else if (deploymentType === 'database') {
        await onDeployDatabase(databaseFormData);
      } else if (deploymentType === 'template') {
        await onDeployTemplate(templateFormData);
      }
      
      onClose();
    } catch (error) {
      console.error('Deployment failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getResourceRequirements = () => {
    // This would calculate resource requirements based on the form data
    // For now, return default values
    return {
      cpuCores: 0.5,
      memoryGb: 1,
      storageGb: 10,
      containerCount: 1,
    };
  };

  const canProceed = () => {
    if (step === 'type') {
      return deploymentType !== null;
    } else if (step === 'config') {
      if (deploymentType === 'app') {
        return appFormData.serviceName && appFormData.image;
      } else if (deploymentType === 'database') {
        return databaseFormData.serviceName && databaseFormData.databaseType;
      } else if (deploymentType === 'template') {
        return templateFormData.serviceName && templateFormData.templateId;
      }
    } else if (step === 'review') {
      return quotaCheck?.allowed;
    }
    return false;
  };

  const addEnvironmentVariable = () => {
    setAppFormData(prev => ({
      ...prev,
      env: [...prev.env, { key: '', value: '' }]
    }));
  };

  const updateEnvironmentVariable = (index: number, key: string, value: string) => {
    setAppFormData(prev => ({
      ...prev,
      env: prev.env.map((env, i) => i === index ? { key, value } : env)
    }));
  };

  const removeEnvironmentVariable = (index: number) => {
    setAppFormData(prev => ({
      ...prev,
      env: prev.env.filter((_, i) => i !== index)
    }));
  };

  const renderTypeStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Choose Deployment Type</h3>
        <p className="text-muted-foreground">
          Select how you want to deploy your service to {projectName}
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DeploymentTypeCard
          icon={<Globe className="h-6 w-6 text-primary" />}
          title="Template"
          description="Deploy from pre-configured application templates"
          selected={deploymentType === 'template'}
          onClick={() => setDeploymentType('template')}
        />
        
        <DeploymentTypeCard
          icon={<Container className="h-6 w-6 text-primary" />}
          title="Custom App"
          description="Deploy from Docker image or Git repository"
          selected={deploymentType === 'app'}
          onClick={() => setDeploymentType('app')}
        />
        
        <DeploymentTypeCard
          icon={<Database className="h-6 w-6 text-primary" />}
          title="Database"
          description="Deploy managed database services"
          selected={deploymentType === 'database'}
          onClick={() => setDeploymentType('database')}
        />
      </div>
    </div>
  );

  const renderConfigStep = () => {
    if (deploymentType === 'app') {
      return (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-4">Configure Custom Application</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="serviceName">Service Name</Label>
              <Input
                id="serviceName"
                placeholder="my-app"
                value={appFormData.serviceName}
                onChange={(e) => setAppFormData(prev => ({ ...prev, serviceName: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="sourceType">Source Type</Label>
              <Select
                value={appFormData.sourceType}
                onValueChange={(value: any) => setAppFormData(prev => ({ ...prev, sourceType: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="image">
                    <div className="flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      Docker Image
                    </div>
                  </SelectItem>
                  <SelectItem value="github">
                    <div className="flex items-center gap-2">
                      <Github className="h-4 w-4" />
                      GitHub Repository
                    </div>
                  </SelectItem>
                  <SelectItem value="upload">
                    <div className="flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Upload Code
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {appFormData.sourceType === 'image' && (
              <div>
                <Label htmlFor="image">Docker Image</Label>
                <Input
                  id="image"
                  placeholder="nginx:latest"
                  value={appFormData.image}
                  onChange={(e) => setAppFormData(prev => ({ ...prev, image: e.target.value }))}
                />
              </div>
            )}
            
            {appFormData.sourceType === 'github' && (
              <>
                <div>
                  <Label htmlFor="owner">Repository Owner</Label>
                  <Input
                    id="owner"
                    placeholder="username"
                    value={appFormData.owner}
                    onChange={(e) => setAppFormData(prev => ({ ...prev, owner: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="repo">Repository Name</Label>
                  <Input
                    id="repo"
                    placeholder="my-app"
                    value={appFormData.repo}
                    onChange={(e) => setAppFormData(prev => ({ ...prev, repo: e.target.value }))}
                  />
                </div>
              </>
            )}
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Environment Variables</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addEnvironmentVariable}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Variable
                </Button>
              </div>
              <div className="space-y-2">
                {appFormData.env.map((envVar, index) => (
                  <EnvironmentVariableRow
                    key={index}
                    envVar={envVar}
                    onChange={(key, value) => updateEnvironmentVariable(index, key, value)}
                    onRemove={() => removeEnvironmentVariable(index)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    if (deploymentType === 'database') {
      return (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-4">Configure Database Service</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="serviceName">Service Name</Label>
              <Input
                id="serviceName"
                placeholder="my-database"
                value={databaseFormData.serviceName}
                onChange={(e) => setDatabaseFormData(prev => ({ ...prev, serviceName: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="databaseType">Database Type</Label>
              <Select
                value={databaseFormData.databaseType}
                onValueChange={(value: any) => setDatabaseFormData(prev => ({ ...prev, databaseType: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="postgres">PostgreSQL</SelectItem>
                  <SelectItem value="mysql">MySQL</SelectItem>
                  <SelectItem value="mariadb">MariaDB</SelectItem>
                  <SelectItem value="mongo">MongoDB</SelectItem>
                  <SelectItem value="redis">Redis</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {databaseFormData.databaseType !== 'redis' && (
              <>
                <div>
                  <Label htmlFor="database">Database Name</Label>
                  <Input
                    id="database"
                    placeholder="myapp"
                    value={databaseFormData.database}
                    onChange={(e) => setDatabaseFormData(prev => ({ ...prev, database: e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    placeholder="admin"
                    value={databaseFormData.username}
                    onChange={(e) => setDatabaseFormData(prev => ({ ...prev, username: e.target.value }))}
                  />
                </div>
              </>
            )}
            
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={databaseFormData.password}
                onChange={(e) => setDatabaseFormData(prev => ({ ...prev, password: e.target.value }))}
              />
            </div>
          </div>
        </div>
      );
    }
    
    if (deploymentType === 'template') {
      return (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-4">Deploy from Template</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="serviceName">Service Name</Label>
              <Input
                id="serviceName"
                placeholder="my-service"
                value={templateFormData.serviceName}
                onChange={(e) => setTemplateFormData(prev => ({ ...prev, serviceName: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="template">Template</Label>
              <Select
                value={templateFormData.templateId}
                onValueChange={(value) => setTemplateFormData(prev => ({ ...prev, templateId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div>
                        <div className="font-medium">{template.displayName}</div>
                        <div className="text-xs text-muted-foreground">{template.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      );
    }
    
    return null;
  };

  const renderReviewStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Review Deployment</h3>
      </div>
      
      {quotaCheck && !quotaCheck.allowed && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="h-4 w-4" />
            <span className="font-medium">Quota Exceeded</span>
          </div>
          <p className="text-sm text-red-700 mt-1">
            This deployment would exceed your plan limits: {quotaCheck.exceededQuotas.join(', ')}
          </p>
        </div>
      )}
      
      {quotaCheck && quotaCheck.allowed && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-800">
            <CheckCircle className="h-4 w-4" />
            <span className="font-medium">Ready to Deploy</span>
          </div>
          <p className="text-sm text-green-700 mt-1">
            All quota checks passed. Your service is ready to be deployed.
          </p>
        </div>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle>Deployment Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Project:</span>
            <span className="font-medium">{projectName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Type:</span>
            <Badge className="capitalize">{deploymentType}</Badge>
          </div>
          {deploymentType === 'app' && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Service Name:</span>
                <span className="font-medium">{appFormData.serviceName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Source:</span>
                <span className="font-medium">{appFormData.image || `${appFormData.owner}/${appFormData.repo}`}</span>
              </div>
            </>
          )}
          {deploymentType === 'database' && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Service Name:</span>
                <span className="font-medium">{databaseFormData.serviceName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Database Type:</span>
                <span className="font-medium capitalize">{databaseFormData.databaseType}</span>
              </div>
            </>
          )}
          {deploymentType === 'template' && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Service Name:</span>
                <span className="font-medium">{templateFormData.serviceName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Template:</span>
                <span className="font-medium">
                  {templates.find(t => t.id === templateFormData.templateId)?.displayName}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Deploy New Service</DialogTitle>
          <DialogDescription>
            Deploy a new containerized service to your project
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          <StepIndicator currentStep={step} steps={steps} />
          
          {step === 'type' && renderTypeStep()}
          {step === 'config' && renderConfigStep()}
          {step === 'review' && renderReviewStep()}
          
          <Separator />
          
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={step === 'type' ? onClose : handleBack}
              disabled={loading}
            >
              {step === 'type' ? 'Cancel' : (
                <>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </>
              )}
            </Button>
            
            <Button
              onClick={step === 'review' ? handleDeploy : handleNext}
              disabled={!canProceed() || loading}
            >
              {loading ? 'Processing...' : (
                step === 'review' ? 'Deploy Service' : (
                  <>
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeployServiceModal;