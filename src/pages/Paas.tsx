import { useEffect, useMemo, useState } from "react";
import { Check, Globe2, Loader2, Play, Server } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { useBreadcrumb } from "@/contexts/BreadcrumbContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { apiClient } from "@/lib/api";

interface CatalogResponse {
  templates: any[];
  plans: any[];
  clusters: any[];
  templateRegions: any[];
}

interface DeploymentResponse {
  deployments: any[];
}

interface DeployForm {
  templateId: string;
  planId: string;
  clusterId: string;
  name: string;
  description: string;
}

const initialDeployForm: DeployForm = {
  templateId: "",
  planId: "",
  clusterId: "",
  name: "",
  description: "",
};

export default function Paas() {
  const { token } = useAuth();
  const { setBreadcrumbOverrides } = useBreadcrumb();
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [deployments, setDeployments] = useState<any[]>([]);
  const [deployForm, setDeployForm] = useState<DeployForm>(initialDeployForm);
  const [deploying, setDeploying] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setBreadcrumbOverrides({
      "/paas": { label: "PaaS" },
    });
    return () => setBreadcrumbOverrides({});
  }, [setBreadcrumbOverrides]);

  const loadData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [catalogResponse, deploymentsResponse] = await Promise.all([
        apiClient.get<{ catalog: CatalogResponse | null }>("/paas/catalog"),
        apiClient.get<DeploymentResponse>("/paas/deployments"),
      ]);
      setCatalog((catalogResponse.catalog ?? null) as CatalogResponse | null);
      setDeployments(Array.isArray(deploymentsResponse.deployments) ? deploymentsResponse.deployments : []);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load PaaS data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const selectedTemplate = useMemo(
    () => catalog?.templates.find((template) => template.id === deployForm.templateId) ?? null,
    [catalog, deployForm.templateId],
  );

  const handleDeploy = async () => {
    if (!token) return;
    if (!deployForm.templateId || !deployForm.planId || !deployForm.clusterId || !deployForm.name) {
      toast.error("Please fill in all required fields");
      return;
    }
    try {
      setDeploying(true);
      await apiClient.post("/paas/deployments", {
        templateId: deployForm.templateId,
        planId: deployForm.planId,
        clusterId: deployForm.clusterId,
        name: deployForm.name,
        metadata: { description: deployForm.description },
      });
      toast.success("Deployment started");
      setDeployForm(initialDeployForm);
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to start deployment");
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Platform-as-a-Service</h1>
          <p className="text-sm text-muted-foreground">
            Launch managed container workloads with billing, ingress, and registry integrations handled for you.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      <Card className="border border-border/80 bg-card/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Deploy a new workload</CardTitle>
          <CardDescription>
            Choose a template and plan to launch a managed container instance. Billing is hourly with automatic wallet charges.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="template">Template</Label>
              <select
                id="template"
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={deployForm.templateId}
                onChange={(event) =>
                  setDeployForm((prev) => ({ ...prev, templateId: event.target.value }))
                }
              >
                <option value="">Select template</option>
                {catalog?.templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan">Plan</Label>
              <select
                id="plan"
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={deployForm.planId}
                onChange={(event) =>
                  setDeployForm((prev) => ({ ...prev, planId: event.target.value }))
                }
              >
                <option value="">Select plan</option>
                {catalog?.plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} · ${plan.price_hourly.toFixed(4)} / hr
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cluster">Cluster</Label>
              <select
                id="cluster"
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={deployForm.clusterId}
                onChange={(event) =>
                  setDeployForm((prev) => ({ ...prev, clusterId: event.target.value }))
                }
              >
                <option value="">Select cluster</option>
                {catalog?.clusters.map((cluster) => (
                  <option key={cluster.id} value={cluster.id}>
                    {cluster.name} · {cluster.region}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Instance name</Label>
              <Input
                id="name"
                value={deployForm.name}
                onChange={(event) => setDeployForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="my-service-prod"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Notes (optional)</Label>
              <Textarea
                id="description"
                rows={3}
                value={deployForm.description}
                onChange={(event) =>
                  setDeployForm((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Environment variables, rollout instructions, etc."
              />
            </div>
          </div>

          {selectedTemplate ? (
            <div className="rounded-lg border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">About this template</p>
              <p className="mt-2">{selectedTemplate.description || "No description provided."}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" /> Managed compute
            </span>
            <span className="inline-flex items-center gap-2">
              <Globe2 className="h-4 w-4 text-primary" /> Automated routing
            </span>
            <span className="inline-flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" /> Hourly billing
            </span>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => void handleDeploy()} disabled={deploying}>
              {deploying ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Starting…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Launch deployment <Play className="h-4 w-4" />
                </span>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border/80 bg-card/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Marketplace templates</CardTitle>
          <CardDescription>Curated blueprints available to your organization.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {catalog?.templates.length ? (
            catalog.templates.map((template) => (
              <div key={template.id} className="rounded-lg border border-border/80 bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{template.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {template.description || "No description provided."}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {template.is_active ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <Separator className="my-3" />
                <p className="text-xs text-muted-foreground">
                  Default plan: {catalog.plans.find((plan) => plan.id === template.default_plan_id)?.name ?? "—"}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No templates available yet.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border border-border/80 bg-card/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Recent deployments</CardTitle>
          <CardDescription>Track the workloads running on managed clusters.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {deployments.length ? (
            deployments.map((deployment) => (
              <div key={deployment.id} className="rounded-lg border border-border/80 bg-muted/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{deployment.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Template: {deployment.template_name || "—"} · Plan: {deployment.plan_name || "—"}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {deployment.status}
                  </Badge>
                </div>
                {deployment.endpoint ? (
                  <p className="mt-2 text-xs">
                    Endpoint: <span className="font-medium text-foreground">{deployment.endpoint}</span>
                  </p>
                ) : null}
                <p className="mt-2 text-xs">
                  {new Date(deployment.created_at).toLocaleString()}
                </p>
              </div>
            ))
          ) : (
            <p>No deployments yet. Launch your first container above.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
