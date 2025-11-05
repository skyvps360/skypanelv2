import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { buildApiUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { RefreshCw, Search, Store, ShieldCheck, Filter, Package, ChevronLeft, ChevronRight } from "lucide-react";

interface MarketplaceManagerProps {
  token: string;
}

interface ProviderSummary {
  id: string;
  name: string;
  type: string;
  active: boolean;
}

interface MarketplaceApp {
  slug: string;
  name: string;
  description?: string;
  category?: string;
  image_slug?: string;
  type?: string;
  allowed: boolean;
  display_name?: string;
  provider_name?: string;
  localName?: string;
  originalName?: string;
}

interface MarketplaceConfigResponse {
  provider: {
    id: string;
    name: string;
    type: string;
  };
  mode: "default" | "custom";
  allowedApps: string[];
  displayNameOverrides?: Record<string, string>;
  apps: MarketplaceApp[];
}

type MarketplaceMode = "default" | "custom";

type BaselineSnapshot = {
  mode: MarketplaceMode;
  allowed: string[];
  renames: Record<string, string>;
};

const normalizeSlug = (value: string | null | undefined): string =>
  typeof value === "string" ? value.trim().toLowerCase() : "";
const MAX_DISPLAY_NAME_LENGTH = 120;

const MarketplaceManager: React.FC<MarketplaceManagerProps> = ({ token }) => {
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [mode, setMode] = useState<MarketplaceMode>("default");
  const [apps, setApps] = useState<MarketplaceApp[]>([]);
  const [baseline, setBaseline] = useState<BaselineSnapshot>({ mode: "default", allowed: [], renames: {} });
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [loadingApps, setLoadingApps] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [goToPageInput, setGoToPageInput] = useState("");

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
      const digitalOceanProviders: ProviderSummary[] = Array.isArray(data.providers)
        ? data.providers.filter((provider: ProviderSummary) =>
          provider && provider.type?.toLowerCase() === "digitalocean"
        )
        : [];

      setProviders(digitalOceanProviders);

      if (digitalOceanProviders.length > 0) {
        setSelectedProviderId((prev) => {
          const existing = digitalOceanProviders.find((provider) => provider.id === prev);
          return existing ? existing.id : digitalOceanProviders[0].id;
        });
      } else {
        setSelectedProviderId("");
        setApps([]);
      }
    } catch (error: any) {
      console.error("MarketplaceManager providers error:", error);
      toast.error(error.message || "Failed to load providers");
    } finally {
      setLoadingProviders(false);
    }
  }, [token]);

  const loadMarketplaceConfig = useCallback(
    async (providerId: string) => {
      if (!token || !providerId) return;

      try {
        setLoadingApps(true);
        const response = await fetch(
          buildApiUrl(`/api/admin/providers/${providerId}/marketplace`),
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Failed to load marketplace apps");
        }

        const data: MarketplaceConfigResponse = await response.json();
        const normalizedAllowed = new Set(
          (data.allowedApps || []).map((slug) => normalizeSlug(slug))
        );

        const mappedApps: MarketplaceApp[] = Array.isArray(data.apps)
          ? data.apps.map((app) => {
            const normalizedSlug = normalizeSlug(app.slug);
            const originalName =
              typeof app.provider_name === "string" && app.provider_name.trim().length > 0
                ? app.provider_name
                : app.name;
            const displayName =
              typeof app.display_name === "string" && app.display_name.trim().length > 0
                ? app.display_name
                : originalName;

            return {
              ...app,
              name: originalName,
              provider_name: originalName,
              display_name: displayName,
              originalName,
              localName: displayName !== originalName ? displayName : "",
              allowed:
                data.mode === "custom"
                  ? Boolean(app.allowed)
                  : normalizedAllowed.size > 0
                    ? normalizedAllowed.has(normalizedSlug)
                    : true,
            };
          })
          : [];

        setApps(mappedApps);
        setMode(data.mode);
        const renameBaseline: Record<string, string> = {};
        mappedApps.forEach((app) => {
          const normalizedSlug = normalizeSlug(app.slug);
          const trimmedName = app.localName?.trim();
          if (normalizedSlug && trimmedName && trimmedName !== app.originalName) {
            renameBaseline[normalizedSlug] = trimmedName;
          }
        });
        setBaseline({
          mode: data.mode,
          allowed: Array.from(normalizedAllowed).sort(),
          renames: renameBaseline,
        });
      } catch (error: any) {
        console.error("MarketplaceManager config error:", error);
        toast.error(error.message || "Failed to load marketplace configuration");
        setApps([]);
      } finally {
        setLoadingApps(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (!token) return;
    loadProviders();
  }, [loadProviders, token]);

  useEffect(() => {
    if (!token || !selectedProviderId) return;
    loadMarketplaceConfig(selectedProviderId);
  }, [loadMarketplaceConfig, selectedProviderId, token]);

  const allowedCount = useMemo(
    () => apps.filter((app) => app.allowed).length,
    [apps]
  );

  const categories = useMemo(() => {
    const unique = new Set<string>();
    apps.forEach((app) => {
      if (app.category) unique.add(app.category);
    });
    return ["all", ...Array.from(unique).sort((a, b) => a.localeCompare(b))];
  }, [apps]);

  const filteredApps = useMemo(() => {
    const category = categoryFilter;
    const term = searchTerm.trim().toLowerCase();

    return apps.filter((app) => {
      if (category !== "all" && app.category !== category) {
        return false;
      }

      if (!term) {
        return true;
      }

      const haystack = `${app.name || ""} ${app.display_name || ""} ${app.localName || ""} ${app.description || ""} ${app.slug || ""}`;
      return haystack.toLowerCase().includes(term);
    });
  }, [apps, categoryFilter, searchTerm]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredApps.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedApps = filteredApps.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
    setGoToPageInput(""); // Clear go-to-page input when filters change
  }, [searchTerm, categoryFilter]);

  // Adjust current page if it's beyond available pages
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Clear go-to-page input when page changes through other navigation
  useEffect(() => {
    setGoToPageInput("");
  }, [currentPage]);

  const draftSnapshot = useMemo<BaselineSnapshot>(() => {
    const renames: Record<string, string> = {};

    apps.forEach((app) => {
      const normalizedSlug = normalizeSlug(app.slug);
      const trimmedName = app.localName?.trim();
      if (normalizedSlug && trimmedName && trimmedName !== app.originalName) {
        renames[normalizedSlug] = trimmedName;
      }
    });

    if (mode === "default") {
      return { mode: "default", allowed: [], renames };
    }

    const allowedSlugs = apps
      .filter((app) => app.allowed)
      .map((app) => normalizeSlug(app.slug))
      .filter((slug) => Boolean(slug))
      .sort();

    return {
      mode: "custom",
      allowed: allowedSlugs,
      renames,
    };
  }, [apps, mode]);

  const hasChanges = useMemo(() => {
    const renameChanged = (): boolean => {
      const baselineKeys = Object.keys(baseline.renames).sort();
      const draftKeys = Object.keys(draftSnapshot.renames).sort();

      if (baselineKeys.length !== draftKeys.length) {
        return true;
      }

      for (let index = 0; index < baselineKeys.length; index += 1) {
        const baselineKey = baselineKeys[index];
        const draftKey = draftKeys[index];
        if (baselineKey !== draftKey) {
          return true;
        }
        if (baseline.renames[baselineKey] !== draftSnapshot.renames[baselineKey]) {
          return true;
        }
      }

      return false;
    };

    if (draftSnapshot.mode !== baseline.mode) {
      return true;
    }

    if (draftSnapshot.mode === "default") {
      if (baseline.mode !== "default" || baseline.allowed.length > 0) {
        return true;
      }
      return renameChanged();
    }

    if (draftSnapshot.allowed.length !== baseline.allowed.length) {
      return true;
    }

    if (draftSnapshot.allowed.some((slug, index) => slug !== baseline.allowed[index])) {
      return true;
    }

    return renameChanged();
  }, [baseline, draftSnapshot]);

  const handleToggleApp = (slug: string, value: boolean) => {
    if (mode !== "custom") return;

    setApps((current) =>
      current.map((app) =>
        app.slug === slug
          ? {
            ...app,
            allowed: value,
          }
          : app
      )
    );
  };

  const handleSelectAll = () => {
    if (mode !== "custom") return;
    setApps((current) => current.map((app) => ({ ...app, allowed: true })));
  };

  const handleClearAll = () => {
    if (mode !== "custom") return;
    setApps((current) => current.map((app) => ({ ...app, allowed: false })));
  };

  const handleLocalNameChange = (slug: string, value: string) => {
    const nextValue = value.slice(0, MAX_DISPLAY_NAME_LENGTH);
    setApps((current) =>
      current.map((app) =>
        app.slug === slug
          ? {
            ...app,
            localName: nextValue,
            display_name:
              nextValue.trim().length > 0
                ? nextValue
                : app.originalName || app.provider_name || app.name,
          }
          : app
      )
    );
  };

  const handleResetLocalName = (slug: string) => {
    setApps((current) =>
      current.map((app) =>
        app.slug === slug
          ? {
            ...app,
            localName: "",
            display_name: app.originalName || app.provider_name || app.name,
          }
          : app
      )
    );
  };

  const handleSave = async () => {
    if (!token || !selectedProviderId) {
      toast.error("Select a provider first");
      return;
    }

    if (mode === "custom" && allowedCount === 0) {
      toast.error("Select at least one marketplace app before saving");
      return;
    }

    try {
      setSaving(true);
      const allowedAppsPayload =
        mode === "custom"
          ? apps
            .filter((app) => app.allowed)
            .map((app) => normalizeSlug(app.slug))
            .filter((slug) => Boolean(slug))
            .sort()
          : [];

      const renamesPayload: Record<string, string> = {};
      apps.forEach((app) => {
        const normalizedSlug = normalizeSlug(app.slug);
        if (!normalizedSlug) {
          return;
        }
        const trimmedName = app.localName?.trim();
        const originalName = app.originalName ?? app.name;
        if (trimmedName && trimmedName.length > 0 && trimmedName !== originalName) {
          renamesPayload[normalizedSlug] = trimmedName;
        }
      });

      const payload =
        mode === "default"
          ? { mode: "default", apps: [], renames: renamesPayload }
          : {
            mode: "custom",
            apps: allowedAppsPayload,
            renames: renamesPayload,
          };

      const response = await fetch(
        buildApiUrl(`/api/admin/providers/${selectedProviderId}/marketplace`),
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update marketplace apps");
      }

      const data = await response.json().catch(() => ({ success: true }));
      toast.success(data.message || "Marketplace apps updated");
      await loadMarketplaceConfig(selectedProviderId);
    } catch (error: any) {
      console.error("MarketplaceManager save error:", error);
      toast.error(error.message || "Failed to update marketplace apps");
    } finally {
      setSaving(false);
    }
  };

  if (!token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Marketplace Controls</CardTitle>
          <CardDescription>
            Sign in as an administrator to manage marketplace availability.
          </CardDescription>
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
            Marketplace Controls
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Allow or block marketplace applications for provisioning
          </p>
        </div>
        
        {/* Background decoration */}
        <div className="absolute right-0 top-0 h-full w-1/3 opacity-5">
          <Store className="absolute right-10 top-10 h-32 w-32 rotate-12" />
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Configuration</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (selectedProviderId) {
                  loadMarketplaceConfig(selectedProviderId);
                }
              }}
              disabled={!selectedProviderId || loadingApps || saving}
              className="gap-2"
            >
              <RefreshCw className={cn("h-4 w-4", loadingApps && "animate-spin")} />
              Refresh
            </Button>
            <Button
              onClick={handleSave}
              disabled={!selectedProviderId || saving || !hasChanges}
              className="gap-2"
            >
              <ShieldCheck className="h-4 w-4" />
              Save Changes
            </Button>
          </div>
        </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-stretch xl:justify-between">
            <div className="flex w-full flex-col gap-2 xl:max-w-sm">
              <label className="text-sm font-medium text-foreground">Provider</label>
              <Select
                value={selectedProviderId || undefined}
                onValueChange={setSelectedProviderId}
                disabled={loadingProviders || saving || providers.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      loadingProviders ? "Loading providers..." : "Select a provider"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {providers.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      No providers found
                    </SelectItem>
                  ) : (
                    providers.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex w-full flex-col gap-3 md:flex-row md:items-stretch md:gap-4 xl:justify-end">
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-card/70 p-4 shadow-sm md:flex-row md:items-center md:justify-between md:gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    Enforce custom marketplace list
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Disable to expose every available marketplace app from the upstream provider.
                  </p>
                </div>
                <Switch
                  checked={mode === "custom"}
                  onCheckedChange={(value) => setMode(value ? "custom" : "default")}
                  disabled={loadingApps || saving}
                />
              </div>

              <div className="flex items-center justify-center md:justify-end">
                <Badge
                  variant={mode === "custom" ? "default" : "secondary"}
                  className={cn(
                    "px-4 py-2 text-sm font-medium",
                    mode === "custom" && allowedCount === 0 && "bg-destructive text-destructive-foreground"
                  )}
                >
                  {mode === "custom"
                    ? `${allowedCount} app${allowedCount === 1 ? "" : "s"} enabled`
                    : "All marketplace apps enabled"}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {mode === "custom" && allowedCount === 0 ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
                <p className="text-sm font-medium text-destructive">⚠️ No apps enabled</p>
                <p className="mt-1 text-xs text-destructive/80">
                  Select at least one app to keep provisioning enabled.
                </p>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                {mode === "custom"
                  ? "Custom marketplace list is active."
                  : "All marketplace apps from the provider are available."}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                disabled={mode !== "custom" || loadingApps || saving || apps.length === 0}
              >
                Enable All Apps
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearAll}
                disabled={mode !== "custom" || loadingApps || saving || apps.length === 0}
              >
                Disable All Apps
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="relative w-full sm:w-72 lg:w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search marketplace apps..."
                  className="w-full pl-9 pr-4"
                  disabled={loadingApps}
                />
              </div>
              <Select
                value={categoryFilter}
                onValueChange={setCategoryFilter}
                disabled={loadingApps}
              >
                <SelectTrigger className="w-full sm:w-[200px] lg:w-[180px]">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category === "all" ? "All categories" : category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-xs font-medium px-3 py-1">
                <Package className="h-3 w-3 mr-1" />
                {filteredApps.length} total
              </Badge>
              {mode === "custom" && (
                <Badge variant="outline" className="text-xs font-medium px-3 py-1">
                  {allowedCount} enabled
                </Badge>
              )}
            </div>
          </div>

          {loadingApps ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="rounded-full bg-primary/10 p-4">
                  <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Loading marketplace apps</p>
                  <p className="text-sm text-muted-foreground">Please wait while we fetch the latest applications...</p>
                </div>
              </div>
            </div>
          ) : filteredApps.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-muted-foreground">
              <div className="rounded-full bg-muted p-3">
                <Filter className="h-6 w-6" />
              </div>
              <div>
                <p className="font-medium">No marketplace apps found</p>
                <p className="text-sm">Try adjusting your search or filter criteria</p>
              </div>
              {searchTerm && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchTerm("")}
                  className="mt-2"
                >
                  Clear search
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-lg border border-border">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {mode === "custom" && (
                          <TableHead className="w-12">
                            <Checkbox
                              checked={paginatedApps.length > 0 && paginatedApps.every(app => app.allowed)}
                              onCheckedChange={(checked) => {
                                if (mode === "custom") {
                                  paginatedApps.forEach((app) => {
                                    handleToggleApp(app.slug, !!checked);
                                  });
                                }
                              }}
                              disabled={mode !== "custom" || saving || paginatedApps.length === 0}
                            />
                          </TableHead>
                        )}
                        <TableHead className="w-12"></TableHead>
                        <TableHead className="font-semibold min-w-[240px]">Display Name</TableHead>
                        <TableHead className="font-semibold min-w-[200px]">Provider Name</TableHead>
                        <TableHead className="font-semibold">Category</TableHead>
                        <TableHead className="font-semibold">Description</TableHead>
                        <TableHead className="font-semibold text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedApps.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={mode === "custom" ? 7 : 6} className="text-center py-8 text-muted-foreground">
                            No apps on this page
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedApps.map((app) => {
                          const isEnabled = mode === "custom" ? app.allowed : true;
                          const disabled = mode !== "custom" || saving;
                          const normalizedCategory = app.category || "Other";
                          const effectiveName = (app.display_name || "").trim() || app.originalName || app.name || app.slug;
                          const originalName = app.originalName || app.provider_name || app.name || app.slug;
                          const trimmedLocalName = app.localName?.trim();
                          const hasOverride = Boolean(trimmedLocalName && trimmedLocalName !== originalName);

                          return (
                            <TableRow
                              key={app.slug}
                              className={cn(
                                "cursor-pointer transition-colors hover:bg-muted/50",
                                mode === "custom" && app.allowed && "bg-primary/5",
                                disabled && "cursor-not-allowed opacity-60"
                              )}
                              onClick={() => {
                                if (!disabled) {
                                  handleToggleApp(app.slug, !app.allowed);
                                }
                              }}
                            >
                              {mode === "custom" && (
                                <TableCell>
                                  <Checkbox
                                    checked={app.allowed}
                                    onCheckedChange={(checked) => handleToggleApp(app.slug, !!checked)}
                                    disabled={disabled}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </TableCell>
                              )}
                              <TableCell>
                                <div className={cn(
                                  "flex h-10 w-10 items-center justify-center rounded-lg font-bold text-xs transition-colors",
                                  isEnabled
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "bg-muted text-muted-foreground"
                                )}>
                                  {effectiveName?.substring(0, 2).toUpperCase() || app.slug?.substring(0, 2).toUpperCase() || "AP"}
                                </div>
                              </TableCell>
                              <TableCell onClick={(event) => event.stopPropagation()}>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Input
                                      value={app.localName ?? ""}
                                      onChange={(event) => handleLocalNameChange(app.slug, event.target.value)}
                                      placeholder={originalName}
                                      disabled={saving}
                                      maxLength={MAX_DISPLAY_NAME_LENGTH}
                                      onClick={(event) => event.stopPropagation()}
                                    />
                                    {trimmedLocalName && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 px-2 text-xs"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleResetLocalName(app.slug);
                                        }}
                                      >
                                        Reset
                                      </Button>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                    <span>Effective: {effectiveName}</span>
                                    <span>
                                      {(app.localName ?? "").length}/{MAX_DISPLAY_NAME_LENGTH}
                                    </span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <p className="font-medium text-foreground">
                                    {originalName}
                                  </p>
                                  <p className="text-xs text-muted-foreground font-mono">
                                    {app.slug}
                                  </p>
                                  {hasOverride && (
                                    <span className="text-[11px] font-medium text-primary">
                                      Override active
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-xs">
                                  {normalizedCategory}
                                </Badge>
                              </TableCell>
                              <TableCell className="max-w-md">
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {app.description || "Pre-configured marketplace application ready for deployment"}
                                </p>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge
                                  variant={isEnabled ? "default" : "secondary"}
                                  className={cn(
                                    "text-xs font-semibold",
                                    isEnabled
                                      ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                                      : "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
                                  )}
                                >
                                  {isEnabled ? "Enabled" : "Disabled"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Pagination Controls */}
              {filteredApps.length > 0 && (
                <div className="flex flex-col gap-4 px-2 py-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Rows per page:</span>
                      <Select
                        value={itemsPerPage.toString()}
                        onValueChange={(value) => {
                          setItemsPerPage(Number(value));
                          setCurrentPage(1);
                        }}
                      >
                        <SelectTrigger className="w-16 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5</SelectItem>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Showing {startIndex + 1} to {Math.min(endIndex, filteredApps.length)} of {filteredApps.length} apps
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-4 md:justify-end">
                    {totalPages > 1 && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Go to page:</span>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min="1"
                            max={totalPages}
                            value={goToPageInput}
                            onChange={(e) => setGoToPageInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const pageNum = parseInt(goToPageInput);
                                if (pageNum >= 1 && pageNum <= totalPages) {
                                  setCurrentPage(pageNum);
                                  setGoToPageInput("");
                                }
                              }
                            }}
                            placeholder={`1-${totalPages}`}
                            className="w-16 h-8 text-center text-sm"
                            title={`Enter a page number between 1 and ${totalPages}`}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const pageNum = parseInt(goToPageInput);
                              if (pageNum >= 1 && pageNum <= totalPages) {
                                setCurrentPage(pageNum);
                                setGoToPageInput("");
                              }
                            }}
                            disabled={!goToPageInput || parseInt(goToPageInput) < 1 || parseInt(goToPageInput) > totalPages}
                            className="h-8 px-2 text-xs"
                          >
                            Go
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>

                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }

                          return (
                            <Button
                              key={pageNum}
                              variant={currentPage === pageNum ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(pageNum)}
                              className="h-8 w-8 p-0"
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
    </div>
  );
};

export default MarketplaceManager;
