/**
 * Create Container Service Wizard
 * Multi-step wizard for creating a new container service
 */

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import type { ApplicationTemplate, ContainerSecret } from "@/types/container";
import type { CreateServiceParams } from "@/lib/containerApi";
import { containerBillingApi } from "@/lib/containerApi";
import { formatCurrency } from "@/lib/formatters";

interface CreateContainerServiceProps {
  templates: ApplicationTemplate[];
  secrets: ContainerSecret[];
  onSubmit: (params: CreateServiceParams) => Promise<void>;
  onCancel: () => void;
}

interface WizardStep {
  id: number;
  title: string;
  description: string;
}

const steps: WizardStep[] = [
  { id: 1, title: "Template", description: "Choose a template or custom configuration" },
  { id: 2, title: "Git Repository", description: "Configure source code repository" },
  { id: 3, title: "Resources", description: "Select resource limits and view costs" },
  { id: 4, title: "Environment", description: "Configure environment variables" },
  { id: 5, title: "Secrets", description: "Select and mount secrets" },
  { id: 6, title: "Review", description: "Review and confirm configuration" },
];

export function CreateContainerService({
  templates,
  secrets,
  onSubmit,
  onCancel,
}: CreateContainerServiceProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState<CreateServiceParams>({
    name: "",
    templateId: undefined,
    gitRepository: "",
    gitBranch: "main",
    buildConfig: {
      nixExpression: "",
      environmentType: "nix",
    },
    environmentVars: {},
    resourceLimits: {
      cpuCores: 1,
      memoryMb: 512,
      diskGb: 10,
    },
    secretIds: [],
  });

  const [customNixExpression, setCustomNixExpression] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [envVarKey, setEnvVarKey] = useState("");
  const [envVarValue, setEnvVarValue] = useState("");
  const [costEstimate, setCostEstimate] = useState<{
    hourly: number;
    daily: number;
    monthly: number;
    breakdown: { cpu: number; memory: number; storage: number };
  } | null>(null);

  // Load cost estimate when resources change
  useEffect(() => {
    const loadCostEstimate = async () => {
      try {
        const estimate = await containerBillingApi.estimateCost({
          cpuCores: formData.resourceLimits.cpuCores,
          memoryMb: formData.resourceLimits.memoryMb,
          diskGb: formData.resourceLimits.diskGb,
        });
        setCostEstimate(estimate);
      } catch (error) {
        console.error("Failed to load cost estimate:", error);
      }
    };

    loadCostEstimate();
  }, [formData.resourceLimits]);

  // Auto-populate from template
  useEffect(() => {
    if (formData.templateId && !useCustom) {
      const template = templates.find((t) => t.id === formData.templateId);
      if (template) {
        setFormData((prev) => ({
          ...prev,
          buildConfig: {
            ...prev.buildConfig,
            nixExpression: template.nixExpression,
          },
          environmentVars: { ...template.defaultEnvVars },
          resourceLimits: { ...template.defaultResourceLimits },
        }));
      }
    }
  }, [formData.templateId, templates, useCustom]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === formData.templateId),
    [templates, formData.templateId]
  );

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const submitData = { ...formData };
      if (useCustom && customNixExpression) {
        submitData.buildConfig = {
          ...submitData.buildConfig,
          nixExpression: customNixExpression,
        };
      }
      await onSubmit(submitData);
      toast.success("Container service created successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to create container service");
    } finally {
      setLoading(false);
    }
  };

  const addEnvVar = () => {
    if (envVarKey && envVarValue) {
      setFormData((prev) => ({
        ...prev,
        environmentVars: {
          ...prev.environmentVars,
          [envVarKey]: envVarValue,
        },
      }));
      setEnvVarKey("");
      setEnvVarValue("");
    }
  };

  const removeEnvVar = (key: string) => {
    setFormData((prev) => {
      const newEnvVars = { ...prev.environmentVars };
      delete newEnvVars[key];
      return { ...prev, environmentVars: newEnvVars };
    });
  };

  const toggleSecret = (secretId: string) => {
    setFormData((prev) => {
      const secretIds = prev.secretIds || [];
      const hasSecret = secretIds.includes(secretId);
      return {
        ...prev,
        secretIds: hasSecret
          ? secretIds.filter((id) => id !== secretId)
          : [...secretIds, secretId],
      };
    });
  };

  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 1:
        return useCustom ? !!customNixExpression : !!formData.templateId;
      case 2:
        return !!formData.gitRepository && !!formData.gitBranch;
      case 3:
        return (
          formData.resourceLimits.cpuCores > 0 &&
          formData.resourceLimits.memoryMb > 0 &&
          formData.resourceLimits.diskGb > 0
        );
      case 4:
        return true; // Environment variables are optional
      case 5:
        return true; // Secrets are optional
      case 6:
        return !!formData.name;
      default:
        return false;
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                  currentStep > step.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : currentStep === step.id
                    ? "border-primary text-primary"
                    : "border-muted text-muted-foreground"
                }`}
              >
                {currentStep > step.id ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <span>{step.id}</span>
                )}
              </div>
              <div className="mt-2 hidden sm:block text-center">
                <p className="text-xs font-medium">{step.title}</p>
                <p className="text-xs text-muted-foreground max-w-[100px] truncate">
                  {step.description}
                </p>
              </div>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`h-0.5 w-12 sm:w-24 mx-2 ${
                  currentStep > step.id ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <Separator />

      {/* Step Content */}
      <div className="min-h-[400px]">
        {/* Step 1: Template Selection */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Choose Template or Custom</h3>
              <p className="text-sm text-muted-foreground">
                Select a pre-configured template or provide a custom Nix expression
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="use-custom"
                checked={useCustom}
                onCheckedChange={(checked) => setUseCustom(!!checked)}
              />
              <Label htmlFor="use-custom">Use custom Nix expression</Label>
            </div>

            {!useCustom ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((template) => (
                  <Card
                    key={template.id}
                    className={`cursor-pointer transition-all ${
                      formData.templateId === template.id
                        ? "border-primary ring-2 ring-primary"
                        : "hover:border-primary/50"
                    }`}
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, templateId: template.id }))
                    }
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        <Badge variant="outline">{template.category}</Badge>
                      </div>
                      <CardDescription className="text-xs">
                        {template.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">CPU:</span>
                          <span>{template.defaultResourceLimits.cpuCores} cores</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Memory:</span>
                          <span>
                            {template.defaultResourceLimits.memoryMb >= 1024
                              ? `${(template.defaultResourceLimits.memoryMb / 1024).toFixed(1)} GB`
                              : `${template.defaultResourceLimits.memoryMb} MB`}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Storage:</span>
                          <span>{template.defaultResourceLimits.diskGb} GB</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="nix-expression">Nix Expression</Label>
                <Textarea
                  id="nix-expression"
                  placeholder="Enter your Nix expression..."
                  value={customNixExpression}
                  onChange={(e) => setCustomNixExpression(e.target.value)}
                  rows={15}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Provide a complete Nix expression for building your application
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Git Repository */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Git Repository Configuration</h3>
              <p className="text-sm text-muted-foreground">
                Connect your Git repository for automatic deployments
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="git-repo">Repository URL</Label>
                <Input
                  id="git-repo"
                  type="url"
                  placeholder="https://github.com/username/repo.git"
                  value={formData.gitRepository}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, gitRepository: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Supports GitHub, GitLab, and Bitbucket repositories
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="git-branch">Branch</Label>
                <Input
                  id="git-branch"
                  placeholder="main"
                  value={formData.gitBranch}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, gitBranch: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Deployments will be triggered when this branch is updated
                </p>
              </div>

              {selectedTemplate && (
                <Card className="bg-muted/50">
                  <CardHeader>
                    <CardTitle className="text-sm">Template: {selectedTemplate.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    <p>
                      This template will be used to build your application from the Git
                      repository.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Resource Limits */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Resource Limits</h3>
              <p className="text-sm text-muted-foreground">
                Configure CPU, memory, and storage limits with cost estimates
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cpu-cores">CPU Cores</Label>
                  <Select
                    value={formData.resourceLimits.cpuCores.toString()}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        resourceLimits: {
                          ...prev.resourceLimits,
                          cpuCores: parseFloat(value),
                        },
                      }))
                    }
                  >
                    <SelectTrigger id="cpu-cores">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.5">0.5 cores</SelectItem>
                      <SelectItem value="1">1 core</SelectItem>
                      <SelectItem value="2">2 cores</SelectItem>
                      <SelectItem value="4">4 cores</SelectItem>
                      <SelectItem value="8">8 cores</SelectItem>
                      <SelectItem value="16">16 cores</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="memory">Memory (MB)</Label>
                  <Select
                    value={formData.resourceLimits.memoryMb.toString()}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        resourceLimits: {
                          ...prev.resourceLimits,
                          memoryMb: parseInt(value),
                        },
                      }))
                    }
                  >
                    <SelectTrigger id="memory">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="256">256 MB</SelectItem>
                      <SelectItem value="512">512 MB</SelectItem>
                      <SelectItem value="1024">1 GB</SelectItem>
                      <SelectItem value="2048">2 GB</SelectItem>
                      <SelectItem value="4096">4 GB</SelectItem>
                      <SelectItem value="8192">8 GB</SelectItem>
                      <SelectItem value="16384">16 GB</SelectItem>
                      <SelectItem value="32768">32 GB</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="storage">Storage (GB)</Label>
                  <Select
                    value={formData.resourceLimits.diskGb.toString()}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        resourceLimits: {
                          ...prev.resourceLimits,
                          diskGb: parseInt(value),
                        },
                      }))
                    }
                  >
                    <SelectTrigger id="storage">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 GB</SelectItem>
                      <SelectItem value="5">5 GB</SelectItem>
                      <SelectItem value="10">10 GB</SelectItem>
                      <SelectItem value="20">20 GB</SelectItem>
                      <SelectItem value="50">50 GB</SelectItem>
                      <SelectItem value="100">100 GB</SelectItem>
                      <SelectItem value="250">250 GB</SelectItem>
                      <SelectItem value="500">500 GB</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {costEstimate && (
                <Card className="bg-muted/50">
                  <CardHeader>
                    <CardTitle className="text-base">Cost Estimate</CardTitle>
                    <CardDescription>
                      Estimated costs based on selected resources
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Hourly:</span>
                        <span className="font-medium">
                          {formatCurrency(costEstimate.hourly)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Daily:</span>
                        <span className="font-medium">
                          {formatCurrency(costEstimate.daily)}
                        </span>
                      </div>
                      <div className="flex justify-between text-base font-semibold">
                        <span>Monthly:</span>
                        <span>{formatCurrency(costEstimate.monthly)}</span>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <p className="text-xs font-medium">Cost Breakdown:</p>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">CPU:</span>
                          <span>{formatCurrency(costEstimate.breakdown.cpu)}/mo</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Memory:</span>
                          <span>{formatCurrency(costEstimate.breakdown.memory)}/mo</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Storage:</span>
                          <span>{formatCurrency(costEstimate.breakdown.storage)}/mo</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Environment Variables */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Environment Variables</h3>
              <p className="text-sm text-muted-foreground">
                Configure environment variables for your application
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="KEY"
                    value={envVarKey}
                    onChange={(e) => setEnvVarKey(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <Input
                    placeholder="value"
                    value={envVarValue}
                    onChange={(e) => setEnvVarValue(e.target.value)}
                  />
                </div>
                <Button onClick={addEnvVar} disabled={!envVarKey || !envVarValue}>
                  Add
                </Button>
              </div>

              {Object.keys(formData.environmentVars).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Current Variables</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(formData.environmentVars).map(([key, value]) => (
                        <div
                          key={key}
                          className="flex items-center justify-between p-2 bg-muted rounded"
                        >
                          <div className="flex-1 font-mono text-xs">
                            <span className="font-semibold">{key}</span> = {value}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeEnvVar(key)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {selectedTemplate &&
                Object.keys(selectedTemplate.defaultEnvVars).length > 0 && (
                  <Card className="bg-muted/50">
                    <CardHeader>
                      <CardTitle className="text-sm">Template Defaults</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1 text-xs font-mono">
                        {Object.entries(selectedTemplate.defaultEnvVars).map(
                          ([key, value]) => (
                            <div key={key}>
                              <span className="font-semibold">{key}</span> = {value}
                            </div>
                          )
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
            </div>
          </div>
        )}

        {/* Step 5: Secrets */}
        {currentStep === 5 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Secrets</h3>
              <p className="text-sm text-muted-foreground">
                Select secrets to inject into your container
              </p>
            </div>

            {secrets.length > 0 ? (
              <div className="space-y-2">
                {secrets.map((secret) => (
                  <Card
                    key={secret.id}
                    className={`cursor-pointer transition-all ${
                      formData.secretIds?.includes(secret.id)
                        ? "border-primary ring-2 ring-primary"
                        : "hover:border-primary/50"
                    }`}
                    onClick={() => toggleSecret(secret.id)}
                  >
                    <CardHeader className="py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={formData.secretIds?.includes(secret.id)}
                            onCheckedChange={() => toggleSecret(secret.id)}
                          />
                          <CardTitle className="text-sm">{secret.name}</CardTitle>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          Secret
                        </Badge>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No secrets available. You can create secrets in the Secrets section.
                  </p>
                </CardContent>
              </Card>
            )}

            <p className="text-xs text-muted-foreground">
              Selected secrets will be injected as environment variables in your container
            </p>
          </div>
        )}

        {/* Step 6: Review */}
        {currentStep === 6 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Review & Confirm</h3>
              <p className="text-sm text-muted-foreground">
                Review your configuration and provide a service name
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-name">Service Name *</Label>
              <Input
                id="service-name"
                placeholder="my-app"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                A unique identifier for your service (lowercase, alphanumeric, hyphens)
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Configuration Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Template:</span>
                    <span className="font-medium">
                      {selectedTemplate?.name || "Custom"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Repository:</span>
                    <span className="font-medium truncate max-w-[200px]">
                      {formData.gitRepository || "None"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Branch:</span>
                    <span className="font-medium">{formData.gitBranch}</span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2 text-sm">
                  <p className="font-medium">Resources:</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">CPU:</span>
                      <p className="font-medium">{formData.resourceLimits.cpuCores} cores</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Memory:</span>
                      <p className="font-medium">
                        {formData.resourceLimits.memoryMb >= 1024
                          ? `${(formData.resourceLimits.memoryMb / 1024).toFixed(1)} GB`
                          : `${formData.resourceLimits.memoryMb} MB`}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Storage:</span>
                      <p className="font-medium">{formData.resourceLimits.diskGb} GB</p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Environment Variables:</span>
                    <span className="font-medium">
                      {Object.keys(formData.environmentVars).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Secrets:</span>
                    <span className="font-medium">
                      {formData.secretIds?.length || 0}
                    </span>
                  </div>
                </div>

                {costEstimate && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="font-medium text-sm">Estimated Cost:</p>
                      <div className="flex justify-between text-lg font-semibold">
                        <span>Monthly:</span>
                        <span>{formatCurrency(costEstimate.monthly)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(costEstimate.hourly)}/hour •{" "}
                        {formatCurrency(costEstimate.daily)}/day
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={currentStep === 1 ? onCancel : handlePrevious}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          {currentStep === 1 ? "Cancel" : "Previous"}
        </Button>

        {currentStep < steps.length ? (
          <Button onClick={handleNext} disabled={!isStepValid(currentStep)}>
            Next
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={!isStepValid(currentStep) || loading}>
            {loading ? "Creating..." : "Create Service"}
          </Button>
        )}
      </div>
    </div>
  );
}
