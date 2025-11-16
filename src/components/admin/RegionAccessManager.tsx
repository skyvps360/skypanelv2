import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, MapPin, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { buildApiUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface RegionAccessManagerProps {
  token: string;
}

interface ProviderSummary {
  id: string;
  name: string;
  type: "linode" | string;
  active: boolean;
}

interface RegionRow {
  id: string;
  normalizedId: string;
  label: string;
  country: string;
  status: string;
  capabilities: string[];
  allowed: boolean;
  isDefault: boolean;
}

interface ProviderRegionsResponse {
  provider: {
    id: string;
    name: string;
    type: "linode";
  };
  mode: "default" | "custom";
  allowedRegions: string[];
  defaultRegions: string[];
  regions: Array<{
    id: string;
    label: string;
    country: string;
    status: string;
    capabilities: string[];
    allowed: boolean;
    isDefault: boolean;
  }>;
}

const SUPPORTED_PROVIDER_TYPES = new Set(["linode"]);

type RegionMode = "default" | "custom";

type BaselineSnapshot = {
  mode: RegionMode;
  allowed: string[];
};

const normalizeSlug = (value: string): string => value.trim().toLowerCase();

const sortSlugs = (values: string[]): string[] => [...values].sort();

export const RegionAccessManager: React.FC<RegionAccessManagerProps> = ({ token }) => {
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const selectedProviderIdRef = useRef<string>("");
  const [mode, setMode] = useState<RegionMode>("default");
  const [regions, setRegions] = useState<RegionRow[]>([]);
  const [baseline, setBaseline] = useState<BaselineSnapshot>({ mode: "default", allowed: [] });
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [loadingRegions, setLoadingRegions] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadProviders = useCallback(async () => {
    if (!token) return;

    try {
      setLoadingProviders(true);
      const response = await fetch(buildApiUrl("/api/admin/providers"), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load providers");
      }

      const data = await response.json();
      const supportedProviders: ProviderSummary[] = Array.isArray(data.providers)
        ? data.providers.filter((provider: ProviderSummary) =>
            provider && SUPPORTED_PROVIDER_TYPES.has((provider.type || "").toLowerCase())
          )
        : [];

      setProviders(supportedProviders);

      if (supportedProviders.length > 0) {
        const currentSelection = selectedProviderIdRef.current;
        const existingSelection = supportedProviders.find((provider) => provider.id === currentSelection);
        const nextSelection = existingSelection ? existingSelection.id : supportedProviders[0].id;
        selectedProviderIdRef.current = nextSelection;
        setSelectedProviderId(nextSelection);
      } else {
        setSelectedProviderId("");
        selectedProviderIdRef.current = "";
        setRegions([]);
      }
    } catch (error: any) {
      console.error("RegionAccessManager providers error:", error);
      toast.error(error.message || "Failed to load providers");
    } finally {
      setLoadingProviders(false);
    }
  }, [token]);

  const loadRegions = useCallback(
    async (providerId: string) => {
      if (!token || !providerId) return;

      try {
        setLoadingRegions(true);
        const response = await fetch(buildApiUrl(`/api/admin/providers/${providerId}/regions`), {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Failed to load regions");
        }

        const data: ProviderRegionsResponse = await response.json();
        const regionRows: RegionRow[] = data.regions.map((region) => ({
          id: region.id,
          normalizedId: normalizeSlug(String(region.id || "")),
          label: region.label || region.id,
          country: region.country,
          status: region.status,
          capabilities: Array.isArray(region.capabilities) ? region.capabilities : [],
          allowed: Boolean(region.allowed),
          isDefault: Boolean(region.isDefault),
        }));

        const allowedSlugs = sortSlugs(
          regionRows.filter((region) => region.allowed).map((region) => region.normalizedId)
        );

        setMode(data.mode);
        setRegions(regionRows);
        setBaseline({ mode: data.mode, allowed: allowedSlugs });
      } catch (error: any) {
        console.error("RegionAccessManager regions error:", error);
        toast.error(error.message || "Failed to load regions");
        setRegions([]);
      } finally {
        setLoadingRegions(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (!token) return;
    loadProviders();
  }, [loadProviders, token]);

  useEffect(() => {
    if (!selectedProviderId || !token) return;
    loadRegions(selectedProviderId);
  }, [loadRegions, selectedProviderId, token]);

  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.id === selectedProviderId) || null,
    [providers, selectedProviderId]
  );

  const selectedCount = useMemo(
    () => regions.filter((region) => region.allowed).length,
    [regions]
  );

  const totalRegions = regions.length;

  const draftSnapshot = useMemo<BaselineSnapshot>(() => {
    if (mode === "default") {
      return { mode: "default", allowed: [] };
    }

    const allowed = sortSlugs(
      regions.filter((region) => region.allowed).map((region) => region.normalizedId)
    );
    return { mode: "custom", allowed };
  }, [mode, regions]);

  const hasChanges = useMemo(() => {
    if (draftSnapshot.mode !== baseline.mode) {
      return true;
    }

    if (draftSnapshot.mode === "default") {
      return false;
    }

    if (draftSnapshot.allowed.length !== baseline.allowed.length) {
      return true;
    }

    return draftSnapshot.allowed.some((slug, index) => slug !== baseline.allowed[index]);
  }, [baseline, draftSnapshot]);

  const handleProviderChange = (providerId: string) => {
    const normalized = providerId === "__none__" ? "" : providerId;
    selectedProviderIdRef.current = normalized;
    setSelectedProviderId(normalized);
  };

  const handleModeToggle = (next: boolean) => {
    setMode(next ? "custom" : "default");
  };

  const handleToggleRegion = (normalizedId: string, value: boolean) => {
    setRegions((current) =>
      current.map((region) =>
        region.normalizedId === normalizedId ? { ...region, allowed: value } : region
      )
    );
  };

  const handleSelectAll = () => {
    setRegions((current) => current.map((region) => ({ ...region, allowed: true })));
  };

  const handleClearAll = () => {
    setRegions((current) => current.map((region) => ({ ...region, allowed: false })));
  };

  const handleUseDefaultList = () => {
    setRegions((current) =>
      current.map((region) => ({ ...region, allowed: region.isDefault }))
    );
    setMode("custom");
  };

  const handleSave = async () => {
    if (!token || !selectedProviderId) {
      toast.error("Select a provider first");
      return;
    }

    if (mode === "custom" && selectedCount === 0) {
      toast.error("Select at least one region before saving");
      return;
    }

    try {
      setSaving(true);
      const payload =
        mode === "default"
          ? { mode: "default", regions: [] }
          : {
              mode: "custom",
              regions: regions
                .filter((region) => region.allowed)
                .map((region) => region.normalizedId),
            };

      const response = await fetch(buildApiUrl(`/api/admin/providers/${selectedProviderId}/regions`), {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update regions");
      }

      const data = await response.json().catch(() => ({ success: true }));
      toast.success(data.message || "Region allowlist updated");
      await loadRegions(selectedProviderId);
    } catch (error: any) {
      console.error("RegionAccessManager save error:", error);
      toast.error(error.message || "Failed to update regions");
    } finally {
      setSaving(false);
    }
  };

  if (!token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Region Controls</CardTitle>
          <CardDescription>Sign in as an administrator to manage provider regions.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-muted/20 p-6 md:p-8">
        <div className="relative z-10">
          <Badge variant="secondary" className="mb-3">
            Infrastructure
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Region Controls
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Choose which data center regions are available for VPS provisioning
          </p>
        </div>
        
        {/* Background decoration */}
        <div className="absolute right-0 top-0 h-full w-1/3 opacity-5">
          <MapPin className="absolute right-10 top-10 h-32 w-32 rotate-12" />
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Configuration</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (selectedProviderId) {
                loadRegions(selectedProviderId);
              }
            }}
            disabled={!selectedProviderId || loadingRegions || saving}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", loadingRegions && "animate-spin")} />
            Refresh
          </Button>
        </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">Provider</span>
            <Select
              value={selectedProviderId || undefined}
              onValueChange={handleProviderChange}
              disabled={loadingProviders || saving || providers.length === 0}
            >
              <SelectTrigger className="w-full min-w-[240px] lg:w-72">
                <SelectValue placeholder={loadingProviders ? "Loading providers" : "Select a provider"} />
              </SelectTrigger>
              <SelectContent>
                {providers.length === 0 ? (
                  <SelectItem value="__none__" disabled>
                    No supported providers
                  </SelectItem>
                ) : (
                  providers.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name} ({provider.type})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">Enforce custom region list</p>
                <p className="text-xs text-muted-foreground">
                  Disable to allow every region that the provider exposes.
                </p>
              </div>
              <Switch checked={mode === "custom"} onCheckedChange={handleModeToggle} disabled={loadingRegions || saving} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <Badge variant="outline" className="gap-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            {mode === "custom" ? `${selectedCount} of ${totalRegions} regions allowed` : "All provider regions allowed"}
          </Badge>
          {mode === "custom" && selectedCount === 0 && (
            <span className="text-destructive">Select at least one region to keep provisioning enabled.</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            disabled={mode !== "custom" || loadingRegions || saving || regions.length === 0}
          >
            Allow All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleUseDefaultList}
            disabled={mode !== "custom" || loadingRegions || saving || regions.length === 0}
          >
            Use Recommended Defaults
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            disabled={mode !== "custom" || loadingRegions || saving || regions.length === 0}
          >
            Clear Selection
          </Button>
        </div>

        <div className="rounded-lg border border-dashed border-border">
          <ScrollArea className="h-[32rem] pr-2">
            <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
              {loadingRegions ? (
                <div className="col-span-full flex items-center justify-center py-10 text-sm text-muted-foreground">
                  Loading regions…
                </div>
              ) : regions.length === 0 ? (
                <div className="col-span-full flex items-center justify-center py-10 text-sm text-muted-foreground">
                  {selectedProvider ? "This provider did not return any regions." : "Select a provider to view available regions."}
                </div>
              ) : (
                regions.map((region) => (
                  <div
                    key={region.id}
                    className={cn(
                      "flex gap-3 rounded-lg border p-4 transition",
                      mode === "custom" && region.allowed
                        ? "border-primary/60 bg-primary/5"
                        : "border-border bg-card",
                      mode !== "custom" && "opacity-90"
                    )}
                  >
                    <Checkbox
                      checked={region.allowed}
                      onCheckedChange={(value) => handleToggleRegion(region.normalizedId, value === true)}
                      disabled={mode !== "custom" || saving}
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{region.label}</p>
                        <Badge variant="outline" className="text-xs">
                          {region.id}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {region.country || "Unknown"}
                        </span>
                        <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                        <span>{region.status === "ok" ? "Available" : region.status}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {region.isDefault && (
                          <Badge variant="secondary" className="text-xs">
                            Default recommendation
                          </Badge>
                        )}
                        {mode === "custom" && region.allowed && (
                          <Badge variant="default" className="bg-primary text-primary-foreground text-xs">
                            Allowed
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <ScrollBar orientation="vertical" />
          </ScrollArea>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (selectedProviderId) {
                loadRegions(selectedProviderId);
              }
            }}
            disabled={!selectedProviderId || loadingRegions || saving || regions.length === 0}
          >
            Reset Changes
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || saving || loadingRegions || !selectedProviderId}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
    </div>
  );
};
