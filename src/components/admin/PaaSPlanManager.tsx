import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Layers,
  RefreshCw,
  Plus,
  Trash2,
  SlidersHorizontal,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiClient } from "@/lib/api";
import { formatCurrency } from "@/lib/formatters";

interface PaaSPlan {
  id: string;
  name: string;
  slug: string;
  cpu_cores: number;
  ram_mb: number;
  disk_gb: number;
  max_replicas: number;
  price_per_hour: number;
  price_per_month: number;
  hourly_rate: number;
  is_active: boolean;
  features?: Record<string, any>;
  application_count?: number;
  created_at?: string;
  updated_at?: string;
}

const KNOWN_FEATURES = [
  {
    key: "custom_domain",
    label: "Custom Domains",
    description: "Allow customers to map their own hostnames.",
  },
  {
    key: "auto_scaling",
    label: "Auto Scaling",
    description: "Enable automatic replica adjustments.",
  },
  {
    key: "ssl",
    label: "Managed SSL",
    description: "Provision TLS certificates automatically.",
  },
  {
    key: "priority_support",
    label: "Priority Support",
    description: "Route tickets to a faster response queue.",
  },
  {
    key: "dedicated_resources",
    label: "Dedicated Resources",
    description: "Reserve compute for noisy-neighbor isolation.",
  },
] as const;

type KnownFeatureKey = (typeof KNOWN_FEATURES)[number]["key"];
type FeatureFlags = Record<KnownFeatureKey, boolean>;

interface CustomFeatureEntry {
  id: string;
  key: string;
  value: string;
}

interface PlanFormState {
  name: string;
  slug: string;
  slugManuallyEdited: boolean;
  cpuCores: string;
  ramMb: string;
  diskGb: string;
  maxReplicas: string;
  pricePerHour: string;
  featureFlags: FeatureFlags;
  customFeatures: CustomFeatureEntry[];
  notes: string;
  isActive: boolean;
}

const KNOWN_FEATURE_KEYS = KNOWN_FEATURES.map((feature) => feature.key);

const createCustomFeatureEntry = (): CustomFeatureEntry => ({
  id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
  key: "",
  value: "",
});

const createEmptyPlanForm = (): PlanFormState => ({
  name: "",
  slug: "",
  slugManuallyEdited: false,
  cpuCores: "1",
  ramMb: "1024",
  diskGb: "10",
  maxReplicas: "1",
  pricePerHour: "0.0100",
  featureFlags: KNOWN_FEATURES.reduce(
    (acc, feature) => ({
      ...acc,
      [feature.key]:
        feature.key === "ssl" || feature.key === "custom_domain" ? true : false,
    }),
    {} as FeatureFlags
  ),
  customFeatures: [],
  notes: "",
  isActive: true,
});

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

const buildFeatureFlags = (features?: Record<string, any>): FeatureFlags => {
  const defaults = createEmptyPlanForm().featureFlags;
  if (!features) {
    return defaults;
  }

  return KNOWN_FEATURES.reduce((acc, feature) => {
    acc[feature.key] = Boolean(features[feature.key]);
    return acc;
  }, { ...defaults });
};

const buildCustomFeatureEntries = (
  features?: Record<string, any>
): CustomFeatureEntry[] => {
  if (!features) {
    return [];
  }
  return Object.entries(features)
    .filter(
      ([key]) => !KNOWN_FEATURE_KEYS.includes(key as KnownFeatureKey) && key !== "notes"
    )
    .map(([key, value]) => ({
      id: createCustomFeatureEntry().id,
      key,
      value: String(value),
    }));
};

const parseFeatureValue = (value: string): string | number | boolean => {
  const trimmed = value.trim();
  if (trimmed === "") return true;
  if (trimmed.toLowerCase() === "true") return true;
  if (trimmed.toLowerCase() === "false") return false;
  const asNumber = Number(trimmed);
  if (!Number.isNaN(asNumber)) {
    return asNumber;
  }
  return trimmed;
};

interface PaaSPlanManagerProps {
  isActive?: boolean;
}

export const PaaSPlanManager: React.FC<PaaSPlanManagerProps> = ({
  isActive = false,
}) => {
  const [plans, setPlans] = useState<PaaSPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PaaSPlan | null>(null);
  const [formState, setFormState] = useState<PlanFormState>(
    createEmptyPlanForm()
  );
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toggleLoadingId, setToggleLoadingId] = useState<string | null>(null);

  const loadPlans = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.get<{ plans: PaaSPlan[] }>("/admin/paas/plans");
      setPlans(data.plans || []);
    } catch (err: any) {
      const message = err?.message || "Failed to load plans";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive) {
      return;
    }
    void loadPlans();
  }, [isActive, loadPlans]);

  const resetForm = () => {
    setFormState(createEmptyPlanForm());
    setEditingPlanId(null);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    resetForm();
  };

  const handleCreatePlanClick = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleEditPlanClick = (plan: PaaSPlan) => {
    setEditingPlanId(plan.id);
    setFormState({
      name: plan.name,
      slug: plan.slug,
      slugManuallyEdited: true,
      cpuCores: String(plan.cpu_cores ?? ""),
      ramMb: String(plan.ram_mb ?? ""),
      diskGb: String(plan.disk_gb ?? ""),
      maxReplicas: String(plan.max_replicas ?? ""),
      pricePerHour: plan.price_per_hour?.toString() ?? "",
      featureFlags: buildFeatureFlags(plan.features),
      customFeatures: buildCustomFeatureEntries(plan.features),
      notes:
        typeof plan.features?.notes === "string" ? plan.features.notes : "",
      isActive: Boolean(plan.is_active),
    });
    setDialogOpen(true);
  };

  const handleToggleFeature = (key: KnownFeatureKey, value: boolean) => {
    setFormState((prev) => ({
      ...prev,
      featureFlags: {
        ...prev.featureFlags,
        [key]: value,
      },
    }));
  };

  const handleAddCustomFeature = () => {
    setFormState((prev) => ({
      ...prev,
      customFeatures: [...prev.customFeatures, createCustomFeatureEntry()],
    }));
  };

  const handleCustomFeatureChange = (
    id: string,
    field: "key" | "value",
    value: string
  ) => {
    setFormState((prev) => ({
      ...prev,
      customFeatures: prev.customFeatures.map((entry) =>
        entry.id === id ? { ...entry, [field]: value } : entry
      ),
    }));
  };

  const handleRemoveCustomFeature = (id: string) => {
    setFormState((prev) => ({
      ...prev,
      customFeatures: prev.customFeatures.filter((entry) => entry.id !== id),
    }));
  };

  const derivedCustomFeatures = useMemo(() => {
    return plans.map((plan) => ({
      id: plan.id,
      custom: buildCustomFeatureEntries(plan.features),
    }));
  }, [plans]);

  const handleToggleActive = async (plan: PaaSPlan, checked: boolean) => {
    try {
      setToggleLoadingId(plan.id);
      await apiClient.patch(`/admin/paas/plans/${plan.id}`, {
        is_active: checked,
      });
      setPlans((prev) =>
        prev.map((p) =>
          p.id === plan.id
            ? {
                ...p,
                is_active: checked,
              }
            : p
        )
      );
      toast.success(
        `Plan ${checked ? "activated" : "hidden"} for customers successfully`
      );
    } catch (err: any) {
      toast.error(err?.message || "Failed to update plan visibility");
    } finally {
      setToggleLoadingId(null);
    }
  };

  const validateNumber = (label: string, value: string, opts?: { min?: number }) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || (opts?.min !== undefined && parsed < opts.min)) {
      throw new Error(`${label} must be at least ${opts?.min ?? 0}`);
    }
    return parsed;
  };

  const buildFeaturesPayload = (): Record<string, any> => {
    const payload: Record<string, any> = {};
    Object.entries(formState.featureFlags).forEach(([key, value]) => {
      payload[key] = value;
    });

    if (formState.notes.trim()) {
      payload.notes = formState.notes.trim();
    }

    formState.customFeatures.forEach((entry) => {
      if (entry.key.trim()) {
        payload[entry.key.trim()] = parseFeatureValue(entry.value);
      }
    });

    return payload;
  };

  const handleSavePlan = async () => {
    try {
      if (!formState.name.trim()) {
        toast.error("Plan name is required");
        return;
      }
      if (!formState.slug.trim()) {
        toast.error("Plan slug is required");
        return;
      }

      const payload = {
        name: formState.name.trim(),
        slug: formState.slug.trim(),
        cpu_cores: validateNumber("CPU cores", formState.cpuCores, { min: 0.1 }),
        ram_mb: validateNumber("RAM (MB)", formState.ramMb, { min: 128 }),
        disk_gb: validateNumber("Disk (GB)", formState.diskGb, { min: 1 }),
        max_replicas: validateNumber("Max replicas", formState.maxReplicas, {
          min: 1,
        }),
        price_per_hour: validateNumber("Price per hour", formState.pricePerHour, {
          min: 0,
        }),
        features: buildFeaturesPayload(),
      };

      setSaving(true);
      if (editingPlanId) {
        await apiClient.patch(`/admin/paas/plans/${editingPlanId}`, {
          ...payload,
          is_active: formState.isActive,
        });
        toast.success("Plan updated");
      } else {
        await apiClient.post("/admin/paas/plans", payload);
        toast.success("Plan created");
      }
      handleCloseDialog();
      await loadPlans();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save plan");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!deleteTarget) return;
    try {
      await apiClient.delete(`/admin/paas/plans/${deleteTarget.id}`);
      toast.success("Plan deleted");
      setDeleteTarget(null);
      await loadPlans();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete plan");
    }
  };

  const planFeatureBadges = (plan: PaaSPlan) => {
    const entries = KNOWN_FEATURES.filter(
      (feature) => plan.features?.[feature.key]
    );
    const customEntry = derivedCustomFeatures.find((c) => c.id === plan.id);
    return (
      <>
        {entries.map((feature) => (
          <Badge key={`${plan.id}-${feature.key}`} variant="outline">
            {feature.label}
          </Badge>
        ))}
        {customEntry?.custom.map((feature) => (
          <Badge
            key={`${plan.id}-${feature.id}`}
            variant="secondary"
            className="capitalize"
          >
            {feature.key}
          </Badge>
        ))}
      </>
    );
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-muted/20 p-6 md:p-8">
        <div className="relative z-10 flex flex-col gap-2">
          <Badge variant="secondary" className="w-max">
            Platform
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            PaaS Plans
          </h2>
          <p className="text-muted-foreground max-w-2xl">
            Curate the resource tiers and pricing that power application deployments.
            Toggle capabilities and publish new SKUs without touching SQL.
          </p>
          <div className="flex flex-wrap gap-3 pt-4">
            <Button onClick={handleCreatePlanClick} className="gap-2">
              <Plus className="h-4 w-4" />
              New Plan
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => void loadPlans()}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
        <div className="absolute right-0 top-0 h-full w-1/3 opacity-5">
          <Layers className="absolute right-10 top-10 h-32 w-32 rotate-12" />
          <SlidersHorizontal className="absolute bottom-6 right-16 h-24 w-24" />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Plan Catalog</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground">
              Loading plan catalog...
            </p>
          ) : error ? (
            <div className="space-y-3 p-6 text-sm text-muted-foreground">
              <p>{error}</p>
              <Button size="sm" onClick={() => void loadPlans()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Try again
              </Button>
            </div>
          ) : plans.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No PaaS plans have been created yet. Add one to get started.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[16rem]">Plan</TableHead>
                    <TableHead className="min-w-[10rem]">Resources</TableHead>
                    <TableHead className="min-w-[6rem]">Replicas</TableHead>
                    <TableHead className="min-w-[10rem]">Pricing</TableHead>
                    <TableHead className="min-w-[14rem]">Features</TableHead>
                    <TableHead className="min-w-[6rem]">Apps</TableHead>
                    <TableHead className="min-w-[6rem]">Active</TableHead>
                    <TableHead className="w-[10rem] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell>
                        <div className="font-semibold">{plan.name}</div>
                        <p className="text-xs text-muted-foreground">
                          slug: {plan.slug}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p>{plan.cpu_cores} vCPU</p>
                        <p className="text-xs text-muted-foreground">
                          {plan.ram_mb} MB RAM • {plan.disk_gb} GB SSD
                        </p>
                      </TableCell>
                      <TableCell>{plan.max_replicas}</TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {formatCurrency(plan.price_per_hour)}/hr
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(plan.price_per_month)}/mo
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {planFeatureBadges(plan)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {plan.application_count ?? 0} live
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={plan.is_active}
                          onCheckedChange={(value) =>
                            handleToggleActive(plan, Boolean(value))
                          }
                          disabled={toggleLoadingId === plan.id}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditPlanClick(plan)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setDeleteTarget(plan)}
                            disabled={(plan.application_count ?? 0) > 0}
                            title={
                              (plan.application_count ?? 0) > 0
                                ? "Plans in use cannot be deleted"
                                : ""
                            }
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : handleCloseDialog())}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingPlanId ? "Edit PaaS Plan" : "Create PaaS Plan"}
            </DialogTitle>
            <DialogDescription>
              Define compute capacity, pricing, and platform capabilities available to organizations.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="plan-name">Plan name</Label>
                <Input
                  id="plan-name"
                  placeholder="Pro"
                  value={formState.name}
                  onChange={(event) => {
                    const value = event.target.value;
                    setFormState((prev) => ({
                      ...prev,
                      name: value,
                      slug: prev.slugManuallyEdited
                        ? prev.slug
                        : slugify(value),
                    }));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-slug">Slug</Label>
                <Input
                  id="plan-slug"
                  placeholder="pro"
                  value={formState.slug}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      slug: slugify(event.target.value),
                      slugManuallyEdited: true,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="plan-cpu">vCPU cores</Label>
                <Input
                  id="plan-cpu"
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={formState.cpuCores}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      cpuCores: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-ram">RAM (MB)</Label>
                <Input
                  id="plan-ram"
                  type="number"
                  min="128"
                  step="64"
                  value={formState.ramMb}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      ramMb: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="plan-disk">Disk (GB)</Label>
                <Input
                  id="plan-disk"
                  type="number"
                  min="1"
                  value={formState.diskGb}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      diskGb: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-replicas">Max replicas</Label>
                <Input
                  id="plan-replicas"
                  type="number"
                  min="1"
                  value={formState.maxReplicas}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      maxReplicas: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan-price">Price per hour (USD)</Label>
              <Input
                id="plan-price"
                type="number"
                min="0"
                step="0.0001"
                value={formState.pricePerHour}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    pricePerHour: event.target.value,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Monthly price is derived automatically using 730 hours.
              </p>
            </div>

            <div className="rounded-lg border p-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">Capabilities</p>
                    <p className="text-sm text-muted-foreground">
                      Toggle built-in platform features for this tier.
                    </p>
                  </div>
                  {editingPlanId && (
                    <div className="flex items-center gap-2 text-sm">
                      <span>Status</span>
                      <Switch
                        checked={formState.isActive}
                        onCheckedChange={(value) =>
                          setFormState((prev) => ({
                            ...prev,
                            isActive: Boolean(value),
                          }))
                        }
                      />
                    </div>
                  )}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {KNOWN_FEATURES.map((feature) => (
                    <div
                      key={feature.key}
                      className="flex items-start justify-between rounded-lg border p-3"
                    >
                      <div className="pr-4">
                        <p className="font-medium text-sm">{feature.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {feature.description}
                        </p>
                      </div>
                      <Switch
                        checked={formState.featureFlags[feature.key]}
                        onCheckedChange={(value) =>
                          handleToggleFeature(feature.key, Boolean(value))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Custom feature flags</Label>
                  <p className="text-xs text-muted-foreground">
                    Optional string/boolean fields exposed to the API (e.g. {"\"beta_access\""}).
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={handleAddCustomFeature}
                >
                  <Plus className="h-4 w-4" />
                  Add feature
                </Button>
              </div>
              {formState.customFeatures.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No custom keys defined.
                </p>
              ) : (
                <div className="space-y-2">
                  {formState.customFeatures.map((feature) => (
                    <div
                      key={feature.id}
                      className="grid gap-3 md:grid-cols-[1fr,1fr,auto]"
                    >
                      <Input
                        placeholder="feature_key"
                        value={feature.key}
                        onChange={(event) =>
                          handleCustomFeatureChange(
                            feature.id,
                            "key",
                            event.target.value
                          )
                        }
                      />
                      <Input
                        placeholder="value"
                        value={feature.value}
                        onChange={(event) =>
                          handleCustomFeatureChange(
                            feature.id,
                            "value",
                            event.target.value
                          )
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveCustomFeature(feature.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan-notes">Internal notes (optional)</Label>
              <Textarea
                id="plan-notes"
                rows={3}
                value={formState.notes}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    notes: event.target.value,
                  }))
                }
                placeholder="Describe intended workloads, scaling rules, or change history."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseDialog}
            >
              Cancel
            </Button>
            <Button onClick={handleSavePlan} disabled={saving}>
              {saving ? "Saving..." : editingPlanId ? "Save changes" : "Create plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete PaaS plan</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The plan{" "}
              <strong>{deleteTarget?.name}</strong> will be permanently removed.
              Make sure no applications rely on it before continuing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeletePlan}
            >
              Delete plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
