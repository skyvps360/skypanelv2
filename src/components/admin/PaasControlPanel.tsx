import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Box,
  Cpu,
  FolderGit2,
  Globe2,
  MapPin,
  Plus,
  Server,
  Settings2,
  ShieldCheck,
  Workflow,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api";

interface OverviewResponse {
  clusters: any[];
  nodes: any[];
  plans: any[];
  templates: any[];
  templateRegions: any[];
  registries: any[];
  storageTargets: any[];
  domains: any[];
  portPools: any[];
  images: any[];
  traefik: any[];
}

interface CreateClusterForm {
  name: string;
  slug: string;
  region: string;
  orchestrator: string;
  description: string;
}

interface CreatePlanForm {
  name: string;
  slug: string;
  cpuMillicores: number;
  memoryMb: number;
  storageGb: number;
  networkMbps: number;
  maxContainers: number;
  priceHourly: number;
  priceMonthly: number;
  description: string;
}

interface CreateTemplateForm {
  name: string;
  slug: string;
  description: string;
  defaultPlanId: string;
  imageId: string;
}

const initialClusterForm: CreateClusterForm = {
  name: "",
  slug: "",
  region: "",
  orchestrator: "kubernetes",
  description: "",
};

const initialPlanForm: CreatePlanForm = {
  name: "",
  slug: "",
  cpuMillicores: 1000,
  memoryMb: 2048,
  storageGb: 40,
  networkMbps: 1000,
  maxContainers: 10,
  priceHourly: 0.02,
  priceMonthly: 15,
  description: "",
};

const initialTemplateForm: CreateTemplateForm = {
  name: "",
  slug: "",
  description: "",
  defaultPlanId: "",
  imageId: "",
};

export function PaasControlPanel() {
  const { token } = useAuth();
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [clusterDialogOpen, setClusterDialogOpen] = useState(false);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [regionDialogOpen, setRegionDialogOpen] = useState(false);
  const [clusterForm, setClusterForm] = useState<CreateClusterForm>(initialClusterForm);
  const [planForm, setPlanForm] = useState<CreatePlanForm>(initialPlanForm);
  const [templateForm, setTemplateForm] = useState<CreateTemplateForm>(initialTemplateForm);
  const [regionEditorTemplate, setRegionEditorTemplate] = useState<any | null>(null);
  const [regionSelections, setRegionSelections] = useState<Record<string, boolean>>({});
  const [newRegion, setNewRegion] = useState("");
  const [regionSaving, setRegionSaving] = useState(false);

  const loadOverview = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await apiClient.get<{ overview: OverviewResponse | null }>("/admin/paas/overview");
      setOverview((data.overview ?? null) as OverviewResponse | null);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load PaaS overview");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!regionDialogOpen) {
      setRegionEditorTemplate(null);
      setRegionSelections({});
      setNewRegion("");
      setRegionSaving(false);
    }
  }, [regionDialogOpen]);

  const templateRegionMap = useMemo(() => {
    const map = new Map<string, Array<{ region: string; is_enabled: boolean }>>();
    overview?.templateRegions.forEach((entry) => {
      const list = map.get(entry.template_id) ?? [];
      list.push(entry);
      map.set(entry.template_id, list);
    });
    return map;
  }, [overview]);

  const availableRegions = useMemo(() => {
    const regionSet = new Set<string>();
    overview?.clusters.forEach((cluster) => {
      if (cluster.region) {
        regionSet.add(String(cluster.region));
      }
    });
    overview?.templateRegions.forEach((entry) => {
      if (entry.region) {
        regionSet.add(String(entry.region));
      }
    });
    overview?.templates.forEach((template) => {
      if (Array.isArray(template.region_scope)) {
        template.region_scope.forEach((region: string) => {
          if (region) {
            regionSet.add(region);
          }
        });
      }
    });
    return Array.from(regionSet).sort((a, b) => a.localeCompare(b));
  }, [overview]);

  const openRegionDialog = (template: any) => {
    setRegionEditorTemplate(template);
    const regions = new Set<string>(availableRegions);
    const existing = templateRegionMap.get(template.id) ?? [];
    existing.forEach((entry) => regions.add(entry.region));
    if (Array.isArray(template.region_scope)) {
      template.region_scope.forEach((region: string) => regions.add(region));
    }
    const selectionEntries: Record<string, boolean> = {};
    const existingMap = new Map(existing.map((entry) => [entry.region, Boolean(entry.is_enabled)]));
    const scopeSet = new Set<string>(Array.isArray(template.region_scope) ? template.region_scope : []);
    Array.from(regions)
      .sort((a, b) => a.localeCompare(b))
      .forEach((region) => {
        if (!region) return;
        if (existingMap.has(region)) {
          selectionEntries[region] = Boolean(existingMap.get(region));
        } else if (scopeSet.has(region)) {
          selectionEntries[region] = true;
        } else {
          selectionEntries[region] = false;
        }
      });
    setRegionSelections(selectionEntries);
    setNewRegion("");
    setRegionDialogOpen(true);
  };

  const handleRegionToggle = (region: string, value: boolean) => {
    setRegionSelections((prev) => ({ ...prev, [region]: value }));
  };

  const handleAddRegion = () => {
    const sanitized = newRegion.trim().toLowerCase();
    if (!sanitized) return;
    setRegionSelections((prev) => ({ ...prev, [sanitized]: true }));
    setNewRegion("");
  };

  const handleRegionSave = async () => {
    if (!regionEditorTemplate) return;
    try {
      setRegionSaving(true);
      const payload = Object.entries(regionSelections)
        .map(([region, isEnabled]) => ({ region: region.trim(), isEnabled }))
        .filter((entry) => entry.region.length > 0);
      await apiClient.post(`/admin/paas/templates/${regionEditorTemplate.id}/regions`, {
        regions: payload,
      });
      toast.success("Template regions updated");
      setRegionDialogOpen(false);
      await loadOverview();
    } catch (error) {
      console.error(error);
      toast.error("Unable to update template regions");
    } finally {
      setRegionSaving(false);
    }
  };

  const clusterStats = useMemo(() => {
    if (!overview) return { active: 0, total: 0, regions: 0 };
    const active = overview.clusters.filter((cluster) => cluster.status === "active").length;
    const total = overview.clusters.length;
    const regions = new Set(overview.clusters.map((cluster) => cluster.region)).size;
    return { active, total, regions };
  }, [overview]);

  const planStats = useMemo(() => {
    if (!overview) return { active: 0, total: 0 };
    const active = overview.plans.filter((plan) => plan.is_active).length;
    return { active, total: overview.plans.length };
  }, [overview]);

  const templateStats = useMemo(() => {
    if (!overview) return { active: 0, total: 0 };
    const active = overview.templates.filter((template) => template.is_active).length;
    return { active, total: overview.templates.length };
  }, [overview]);

  const handleClusterSubmit = async () => {
    try {
      await apiClient.post("/admin/paas/clusters", {
        ...clusterForm,
        slug: clusterForm.slug.trim().toLowerCase(),
      });
      toast.success("Cluster created");
      setClusterForm(initialClusterForm);
      setClusterDialogOpen(false);
      await loadOverview();
    } catch (error) {
      console.error(error);
      toast.error("Unable to create cluster");
    }
  };

  const handlePlanSubmit = async () => {
    try {
      await apiClient.post("/admin/paas/plans", {
        ...planForm,
        slug: planForm.slug.trim().toLowerCase(),
      });
      toast.success("Plan created");
      setPlanForm(initialPlanForm);
      setPlanDialogOpen(false);
      await loadOverview();
    } catch (error) {
      console.error(error);
      toast.error("Unable to create plan");
    }
  };

  const handleTemplateSubmit = async () => {
    try {
      await apiClient.post("/admin/paas/templates", {
        ...templateForm,
        slug: templateForm.slug.trim().toLowerCase(),
        defaultPlanId: templateForm.defaultPlanId || null,
        imageId: templateForm.imageId || null,
      });
      toast.success("Template created");
      setTemplateForm(initialTemplateForm);
      setTemplateDialogOpen(false);
      await loadOverview();
    } catch (error) {
      console.error(error);
      toast.error("Unable to create template");
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium">Clusters</CardTitle>
              <CardDescription>Provisioned control planes</CardDescription>
            </div>
            <Server className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-semibold text-foreground">{clusterStats.total}</p>
            <p className="text-xs text-muted-foreground">
              {clusterStats.active} active · {clusterStats.regions} regions
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium">Plans</CardTitle>
              <CardDescription>Available compute footprints</CardDescription>
            </div>
            <Cpu className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-semibold text-foreground">{planStats.total}</p>
            <p className="text-xs text-muted-foreground">{planStats.active} active plans</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium">Templates</CardTitle>
              <CardDescription>Marketplace entries</CardDescription>
            </div>
            <Box className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-semibold text-foreground">{templateStats.total}</p>
            <p className="text-xs text-muted-foreground">{templateStats.active} enabled</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border/80 bg-card/80 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">Catalog management</CardTitle>
            <CardDescription>
              Define clusters, plans, and templates that power the platform-as-a-service experience.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Dialog open={clusterDialogOpen} onOpenChange={setClusterDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2">
                  <Server className="h-4 w-4" /> New cluster
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create cluster</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="cluster-name">Name</Label>
                    <Input
                      id="cluster-name"
                      value={clusterForm.name}
                      onChange={(event) =>
                        setClusterForm((prev) => ({ ...prev, name: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cluster-slug">Slug</Label>
                    <Input
                      id="cluster-slug"
                      value={clusterForm.slug}
                      onChange={(event) =>
                        setClusterForm((prev) => ({ ...prev, slug: event.target.value }))
                      }
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="cluster-region">Region</Label>
                      <Input
                        id="cluster-region"
                        value={clusterForm.region}
                        onChange={(event) =>
                          setClusterForm((prev) => ({ ...prev, region: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cluster-orchestrator">Orchestrator</Label>
                      <Input
                        id="cluster-orchestrator"
                        value={clusterForm.orchestrator}
                        onChange={(event) =>
                          setClusterForm((prev) => ({ ...prev, orchestrator: event.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cluster-description">Description</Label>
                    <Textarea
                      id="cluster-description"
                      value={clusterForm.description}
                      onChange={(event) =>
                        setClusterForm((prev) => ({ ...prev, description: event.target.value }))
                      }
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setClusterDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => void handleClusterSubmit()}>Create cluster</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2">
                  <Cpu className="h-4 w-4" /> New plan
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create plan</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="plan-name">Name</Label>
                    <Input
                      id="plan-name"
                      value={planForm.name}
                      onChange={(event) =>
                        setPlanForm((prev) => ({ ...prev, name: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="plan-slug">Slug</Label>
                    <Input
                      id="plan-slug"
                      value={planForm.slug}
                      onChange={(event) =>
                        setPlanForm((prev) => ({ ...prev, slug: event.target.value }))
                      }
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="plan-cpu">CPU (millicores)</Label>
                      <Input
                        id="plan-cpu"
                        type="number"
                        value={planForm.cpuMillicores}
                        onChange={(event) =>
                          setPlanForm((prev) => ({
                            ...prev,
                            cpuMillicores: Number(event.target.value),
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="plan-memory">Memory (MB)</Label>
                      <Input
                        id="plan-memory"
                        type="number"
                        value={planForm.memoryMb}
                        onChange={(event) =>
                          setPlanForm((prev) => ({
                            ...prev,
                            memoryMb: Number(event.target.value),
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="plan-storage">Storage (GB)</Label>
                      <Input
                        id="plan-storage"
                        type="number"
                        value={planForm.storageGb}
                        onChange={(event) =>
                          setPlanForm((prev) => ({
                            ...prev,
                            storageGb: Number(event.target.value),
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="plan-network">Network (Mbps)</Label>
                      <Input
                        id="plan-network"
                        type="number"
                        value={planForm.networkMbps}
                        onChange={(event) =>
                          setPlanForm((prev) => ({
                            ...prev,
                            networkMbps: Number(event.target.value),
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="plan-containers">Max containers</Label>
                      <Input
                        id="plan-containers"
                        type="number"
                        value={planForm.maxContainers}
                        onChange={(event) =>
                          setPlanForm((prev) => ({
                            ...prev,
                            maxContainers: Number(event.target.value),
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="plan-hourly">Price hourly</Label>
                      <Input
                        id="plan-hourly"
                        type="number"
                        step="0.0001"
                        value={planForm.priceHourly}
                        onChange={(event) =>
                          setPlanForm((prev) => ({
                            ...prev,
                            priceHourly: Number(event.target.value),
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="plan-monthly">Price monthly</Label>
                      <Input
                        id="plan-monthly"
                        type="number"
                        step="0.01"
                        value={planForm.priceMonthly}
                        onChange={(event) =>
                          setPlanForm((prev) => ({
                            ...prev,
                            priceMonthly: Number(event.target.value),
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="plan-description">Description</Label>
                    <Textarea
                      id="plan-description"
                      value={planForm.description}
                      onChange={(event) =>
                        setPlanForm((prev) => ({ ...prev, description: event.target.value }))
                      }
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setPlanDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => void handlePlanSubmit()}>Create plan</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2">
                  <Box className="h-4 w-4" /> New template
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create template</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="template-name">Name</Label>
                    <Input
                      id="template-name"
                      value={templateForm.name}
                      onChange={(event) =>
                        setTemplateForm((prev) => ({ ...prev, name: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="template-slug">Slug</Label>
                    <Input
                      id="template-slug"
                      value={templateForm.slug}
                      onChange={(event) =>
                        setTemplateForm((prev) => ({ ...prev, slug: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="template-description">Description</Label>
                    <Textarea
                      id="template-description"
                      value={templateForm.description}
                      onChange={(event) =>
                        setTemplateForm((prev) => ({ ...prev, description: event.target.value }))
                      }
                      rows={3}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="template-plan">Default plan</Label>
                      <select
                        id="template-plan"
                        className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                        value={templateForm.defaultPlanId}
                        onChange={(event) =>
                          setTemplateForm((prev) => ({
                            ...prev,
                            defaultPlanId: event.target.value,
                          }))
                        }
                      >
                        <option value="">Select plan</option>
                        {overview?.plans.map((plan) => (
                          <option key={plan.id} value={plan.id}>
                            {plan.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="template-image">Image</Label>
                      <select
                        id="template-image"
                        className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                        value={templateForm.imageId}
                        onChange={(event) =>
                          setTemplateForm((prev) => ({ ...prev, imageId: event.target.value }))
                        }
                      >
                        <option value="">Select image</option>
                        {overview?.images.map((image) => (
                          <option key={image.id} value={image.id}>
                            {image.display_name || image.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => void handleTemplateSubmit()}>Create template</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="clusters">
            <TabsList className="flex flex-wrap items-center gap-2">
              <TabsTrigger value="clusters">Clusters</TabsTrigger>
              <TabsTrigger value="plans">Plans</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
              <TabsTrigger value="routing">Routing</TabsTrigger>
            </TabsList>
            <TabsContent value="clusters" className="space-y-4">
              {overview?.clusters.length ? (
                overview.clusters.map((cluster) => (
                  <div
                    key={cluster.id}
                    className="rounded-lg border border-border/80 bg-muted/30 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {cluster.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {cluster.region} · {cluster.orchestrator}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          cluster.status === "active"
                            ? "border-emerald-500/40 text-emerald-600"
                            : "border-amber-500/40 text-amber-600",
                        )}
                      >
                        {cluster.status}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No clusters configured yet.</p>
              )}
            </TabsContent>
            <TabsContent value="plans" className="space-y-4">
              {overview?.plans.length ? (
                overview.plans.map((plan) => (
                  <div
                    key={plan.id}
                    className="rounded-lg border border-border/80 bg-muted/30 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{plan.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {plan.cpu_millicores / 1000} vCPU · {plan.memory_mb / 1024} GB RAM · {plan.storage_gb} GB disk
                        </p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <div>${plan.price_hourly.toFixed(4)} / hour</div>
                        <div>${plan.price_monthly.toFixed(2)} / month</div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No plans defined yet.</p>
              )}
            </TabsContent>
            <TabsContent value="templates" className="space-y-4">
              {overview?.templates.length ? (
                overview.templates.map((template) => (
                  <div
                    key={template.id}
                    className="rounded-lg border border-border/80 bg-muted/30 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">{template.name}</p>
                        <p className="text-xs text-muted-foreground">{template.description || "No description"}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {template.is_active ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <p>
                        Default plan: {overview?.plans.find((plan) => plan.id === template.default_plan_id)?.name || "—"}
                      </p>
                      <p>
                        Image: {overview?.images.find((image) => image.id === template.image_id)?.display_name || overview?.images.find((image) => image.id === template.image_id)?.name || "—"}
                      </p>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {(() => {
                        const assigned = templateRegionMap.get(template.id) ?? [];
                        const enabledRegions = assigned
                          .filter((entry) => entry.is_enabled)
                          .map((entry) => entry.region);
                        const fallback = !enabledRegions.length && Array.isArray(template.region_scope)
                          ? template.region_scope
                          : [];
                        const regionsToShow = enabledRegions.length ? enabledRegions : fallback;
                        if (regionsToShow.length) {
                          return regionsToShow.map((region: string) => (
                            <Badge key={region} variant="secondary" className="flex items-center gap-1 text-[11px]">
                              <MapPin className="h-3 w-3" /> {region}
                            </Badge>
                          ));
                        }
                        return (
                          <span className="text-xs text-muted-foreground">
                            No regions enabled
                          </span>
                        );
                      })()}
                    </div>
                    <div className="mt-4 flex flex-wrap justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => openRegionDialog(template)}
                      >
                        <Settings2 className="h-4 w-4" /> Manage regions
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No templates created yet.</p>
              )}
            </TabsContent>
            <TabsContent value="routing" className="grid gap-4 md:grid-cols-2">
              <Card className="border border-border/60 bg-background">
                <CardHeader className="flex flex-row items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-sm font-semibold">Traefik</CardTitle>
                    <CardDescription>Ingress configuration per cluster</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground">
                  {overview?.traefik.length ? (
                    overview.traefik.map((config) => (
                      <div key={config.id} className="rounded-md border border-border/70 bg-muted/30 p-3">
                        <p className="font-medium text-foreground">Cluster: {config.cluster_id}</p>
                        <p>Entrypoints: {(config.entrypoints || []).join(", ")}</p>
                        <p>Dashboard: {config.dashboard_enabled ? "Enabled" : "Disabled"}</p>
                      </div>
                    ))
                  ) : (
                    <p>No Traefik configuration stored yet.</p>
                  )}
                </CardContent>
              </Card>
              <Card className="border border-border/60 bg-background">
                <CardHeader className="flex flex-row items-center gap-3">
                  <Globe2 className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-sm font-semibold">Domains</CardTitle>
                    <CardDescription>Mapped ingress domains</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground">
                  {overview?.domains.length ? (
                    overview.domains.map((domain) => (
                      <div key={domain.id} className="rounded-md border border-border/70 bg-muted/30 p-3">
                        <p className="font-medium text-foreground">{domain.domain}</p>
                        <p>Status: {domain.status}</p>
                      </div>
                    ))
                  ) : (
                    <p>No domains registered yet.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={regionDialogOpen} onOpenChange={setRegionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage template regions</DialogTitle>
            <DialogDescription>
              Select the regions where this template should be available for end-user deployments.
            </DialogDescription>
          </DialogHeader>
          {regionEditorTemplate ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">{regionEditorTemplate.name}</p>
                <p className="text-xs text-muted-foreground">{regionEditorTemplate.description || "No description provided."}</p>
              </div>
              <div className="space-y-3">
                {Object.keys(regionSelections).length ? (
                  Object.entries(regionSelections)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([region, enabled]) => (
                      <div
                        key={region}
                        className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-muted/30 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground">{region}</p>
                          <p className="text-xs text-muted-foreground">Expose template in this region</p>
                        </div>
                        <Checkbox
                          checked={enabled}
                          onCheckedChange={(value) => handleRegionToggle(region, value === true)}
                          aria-label={`Toggle availability for ${region}`}
                        />
                      </div>
                    ))
                ) : (
                  <p className="rounded-md border border-dashed border-border/60 bg-muted/20 px-3 py-6 text-center text-sm text-muted-foreground">
                    No regions available yet. Add a region below to get started.
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  value={newRegion}
                  onChange={(event) => setNewRegion(event.target.value)}
                  placeholder="e.g. us-east-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={handleAddRegion}
                  disabled={!newRegion.trim()}
                >
                  <Plus className="h-4 w-4" /> Add region
                </Button>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleRegionSave()} disabled={regionSaving}>
              {regionSaving ? "Saving…" : "Save regions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="border border-border/80 bg-card/80 shadow-sm">
        <CardHeader className="flex flex-row items-center gap-3">
          <FolderGit2 className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-lg font-semibold">Container images</CardTitle>
            <CardDescription>Images available to template authors.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {overview?.images.length ? (
            overview.images.map((image) => (
              <div key={image.id} className="rounded-lg border border-border/80 bg-muted/30 p-4">
                <p className="text-sm font-semibold text-foreground">{image.display_name || image.name}</p>
                <p className="text-xs text-muted-foreground">Tag: {image.tag}</p>
                <p className="text-xs text-muted-foreground">
                  Visibility: {image.is_public ? "Public" : "Private"}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No container images registered yet.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border border-border/80 bg-card/80 shadow-sm">
          <CardHeader className="flex flex-row items-center gap-3">
            <Workflow className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg font-semibold">Registries</CardTitle>
              <CardDescription>External container registries.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {overview?.registries.length ? (
              overview.registries.map((registry) => (
                <div key={registry.id} className="rounded-lg border border-border/80 bg-muted/30 p-4">
                  <p className="font-medium text-foreground">{registry.name}</p>
                  <p className="text-xs">Endpoint: {registry.endpoint}</p>
                </div>
              ))
            ) : (
              <p>No registries configured.</p>
            )}
          </CardContent>
        </Card>
        <Card className="border border-border/80 bg-card/80 shadow-sm">
          <CardHeader className="flex flex-row items-center gap-3">
            <BadgeCheck className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg font-semibold">Storage targets</CardTitle>
              <CardDescription>S3-compatible storage for artifacts and backups.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {overview?.storageTargets.length ? (
              overview.storageTargets.map((target) => (
                <div key={target.id} className="rounded-lg border border-border/80 bg-muted/30 p-4">
                  <p className="font-medium text-foreground">{target.name}</p>
                  <p className="text-xs">Provider: {target.provider}</p>
                  {target.bucket ? <p className="text-xs">Bucket: {target.bucket}</p> : null}
                </div>
              ))
            ) : (
              <p>No storage targets configured.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          Use these controls to curate the public catalog before enabling templates for customers.
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadOverview()} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh data"}
        </Button>
      </div>
    </div>
  );
}
