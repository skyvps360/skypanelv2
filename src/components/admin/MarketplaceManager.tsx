import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Search, RefreshCw, Store, ListChecks } from "lucide-react";

import { buildApiUrl } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface ProviderSummary {
  id: string;
  name: string;
  type: string;
  active: boolean;
}

type MarketplaceMode = "default" | "custom";

interface MarketplaceApp {
  slug: string;
  name: string;
  display_name: string;
  provider_name?: string;
  category?: string;
  description?: string;
  summary?: string;
  icon?: string;
  stackscript_id?: number;
  allowed?: boolean;
  user_defined_fields?: Array<{ name: string; label?: string }>;
}

interface MarketplaceConfig {
  provider: {
    id: string;
    name: string;
    type: string;
  };
  mode: MarketplaceMode;
  allowedApps: string[];
  displayNameOverrides: Record<string, string>;
  apps: MarketplaceApp[];
  categories: Record<string, number>;
}

interface MarketplaceManagerProps {
  token: string;
}

const normalizeSlug = (value: unknown): string =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const cleanRenameMap = (source: Record<string, string>): Record<string, string> => {
  const cleaned: Record<string, string> = {};
  Object.entries(source || {}).forEach(([slug, name]) => {
    const normalizedSlug = normalizeSlug(slug);
    const trimmed = typeof name === "string" ? name.trim() : "";
    if (normalizedSlug && trimmed.length > 0) {
      cleaned[normalizedSlug] = trimmed;
    }
  });
  return cleaned;
};

const areSetsEqual = (a: Set<string>, b: Set<string>): boolean => {
  if (a.size !== b.size) return false;
  for (const value of a.values()) {
    if (!b.has(value)) return false;
  }
  return true;
};

const areRenameMapsEqual = (a: Record<string, string>, b: Record<string, string>): boolean => {
  const aEntries = Object.entries(a).sort();
  const bEntries = Object.entries(b).sort();
  if (aEntries.length !== bEntries.length) {
    return false;
  }
  return aEntries.every(([key, value], index) => {
    const [otherKey, otherValue] = bEntries[index];
    return key === otherKey && value === otherValue;
  });
};

export const MarketplaceManager: React.FC<MarketplaceManagerProps> = ({ token }) => {
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");

  const [config, setConfig] = useState<MarketplaceConfig | null>(null);
  const [mode, setMode] = useState<MarketplaceMode>("default");
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});

  const [loadingProviders, setLoadingProviders] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  const baselineRef = useRef<{
    mode: MarketplaceMode;
    slugs: Set<string>;
    renames: Record<string, string>;
  }>({
    mode: "default",
    slugs: new Set(),
    renames: {},
  });

  const fetchProviders = useCallback(async () => {
    if (!token) return;
    try {
      setLoadingProviders(true);
      const response = await fetch(buildApiUrl("/api/admin/providers"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to load providers");
      }

      const linodeProviders: ProviderSummary[] = Array.isArray(data.providers)
        ? data.providers.filter(
            (provider: ProviderSummary) =>
              provider &&
              (provider.type || "").toLowerCase() === "linode" &&
              provider.active !== false
          )
        : [];

      setProviders(linodeProviders);

      if (linodeProviders.length > 0 && !selectedProviderId) {
        setSelectedProviderId(linodeProviders[0].id);
      } else if (
        linodeProviders.length > 0 &&
        !linodeProviders.find((provider) => provider.id === selectedProviderId)
      ) {
        setSelectedProviderId(linodeProviders[0].id);
      }
    } catch (error: any) {
      console.error("Marketplace providers fetch failed", error);
      toast.error(error?.message || "Failed to load providers");
    } finally {
      setLoadingProviders(false);
    }
  }, [selectedProviderId, token]);

  const loadMarketplaceConfig = useCallback(
    async (providerId: string) => {
      if (!token || !providerId) return;
      try {
        setLoadingConfig(true);
        const response = await fetch(
          buildApiUrl(`/api/admin/providers/${providerId}/marketplace`),
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch marketplace configuration");
        }

        setConfig(data);
        const initialMode: MarketplaceMode = data.mode;
        const appSlugs =
          initialMode === "custom"
            ? new Set(
                (Array.isArray(data.allowedApps) ? data.allowedApps : [])
                  .map(normalizeSlug)
                  .filter(Boolean)
              )
            : new Set(
                (Array.isArray(data.apps) ? data.apps : [])
                  .map((app: MarketplaceApp) => normalizeSlug(app.slug))
                  .filter(Boolean)
              );

        const initialRenames = cleanRenameMap(data.displayNameOverrides || {});

        setMode(initialMode);
        setSelectedSlugs(appSlugs);
        setRenameDrafts(initialRenames);
        baselineRef.current = {
          mode: initialMode,
          slugs: new Set(appSlugs),
          renames: initialRenames,
        };
      } catch (error: any) {
        console.error("Marketplace config fetch failed", error);
        toast.error(error?.message || "Unable to fetch marketplace apps");
      } finally {
        setLoadingConfig(false);
      }
    },
    [token]
  );

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  useEffect(() => {
    if (selectedProviderId) {
      loadMarketplaceConfig(selectedProviderId);
    }
  }, [loadMarketplaceConfig, selectedProviderId]);

  const filteredApps = useMemo(() => {
    if (!config) {
      return [];
    }
    return (config.apps || []).filter((app) => {
      const normalizedCategory =
        typeof app.category === "string" && app.category.trim().length > 0
          ? app.category
          : "Other";
      const matchesCategory =
        categoryFilter === "all" ||
        normalizedCategory.toLowerCase() === categoryFilter.toLowerCase();
      const haystack = `${app.display_name || app.name} ${app.description || ""} ${
        app.slug
      }`.toLowerCase();
      const matchesSearch = search.trim().length === 0 || haystack.includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [categoryFilter, config, search]);

  const currentRenames = useMemo(() => cleanRenameMap(renameDrafts), [renameDrafts]);
  const baselineRenames = baselineRef.current.renames;

  const selectionChanged =
    mode === "custom"
      ? !areSetsEqual(selectedSlugs, baselineRef.current.slugs)
      : baselineRef.current.mode === "custom";
  const modeChanged = mode !== baselineRef.current.mode;
  const renameChanged = !areRenameMapsEqual(currentRenames, baselineRenames);
  const hasChanges = modeChanged || (mode === "custom" ? selectionChanged : false) || renameChanged;

  const handleToggleApp = (slug: string, checked: boolean) => {
    if (mode !== "custom") return;
    const normalized = normalizeSlug(slug);
    if (!normalized) return;

    setSelectedSlugs((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(normalized);
      } else {
        next.delete(normalized);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (mode !== "custom" || !config) return;
    setSelectedSlugs(
      new Set(
        config.apps
          .map((app) => normalizeSlug(app.slug))
          .filter(Boolean)
      )
    );
  };

  const handleClearAll = () => {
    if (mode !== "custom") return;
    setSelectedSlugs(new Set());
  };

  const handleRenameChange = (slug: string, value: string) => {
    setRenameDrafts((prev) => ({
      ...prev,
      [slug]: value,
    }));
  };

  const handleSave = async () => {
    if (!token || !selectedProviderId || !config) return;

    try {
      setSaving(true);
      const payload: Record<string, any> = { mode };
      if (mode === "custom") {
        payload.apps = Array.from(selectedSlugs);
      }
      const renames = cleanRenameMap(renameDrafts);
      if (Object.keys(renames).length > 0) {
        payload.renames = renames;
      }

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
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to update marketplace configuration");
      }

      toast.success(data.message || "Marketplace configuration updated");
      await loadMarketplaceConfig(selectedProviderId);
    } catch (error: any) {
      console.error("Marketplace update failed", error);
      toast.error(error?.message || "Unable to save marketplace configuration");
    } finally {
      setSaving(false);
    }
  };

  const summaryText = useMemo(() => {
    if (!config) return "";
    if (mode === "default") {
      return "All marketplace apps are available to organizations.";
    }
    return `${selectedSlugs.size} app${selectedSlugs.size === 1 ? "" : "s"} allowed`;
  }, [config, mode, selectedSlugs.size]);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-muted/20 p-6 md:p-8">
        <div className="relative z-10 space-y-2">
          <Badge variant="secondary">Infrastructure</Badge>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Marketplace</h2>
          <p className="max-w-2xl text-muted-foreground">
            Choose which Linode Marketplace apps are exposed during VPS creation. Apps come from
            Linode&apos;s StackScript catalog (
            <a
              href="https://github.com/linode/linode-api-docs"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              linode-openapi.json
            </a>
            ) and can be renamed for your white-label storefront.
          </p>
        </div>
        <Store className="absolute right-10 top-10 h-32 w-32 text-primary/10" />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Provider Marketplace</CardTitle>
            <CardDescription>
              Select a Linode provider and enable the marketplace apps your customers should see.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                fetchProviders();
                if (selectedProviderId) {
                  loadMarketplaceConfig(selectedProviderId);
                }
              }}
              disabled={loadingProviders || loadingConfig}
            >
              <RefreshCw className="h-4 w-4" />
              {loadingProviders || loadingConfig ? "Refreshing…" : "Refresh"}
            </Button>
            <Button
              size="sm"
              className="gap-2"
              onClick={handleSave}
              disabled={saving || !hasChanges || loadingConfig}
            >
              {saving ? (
                <>
                  <ListChecks className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <ListChecks className="h-4 w-4" />
                  Save changes
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select
                value={selectedProviderId}
                onValueChange={(value) => setSelectedProviderId(value)}
                disabled={loadingProviders || providers.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label className="text-sm font-medium">Custom allowlist</Label>
                <p className="text-sm text-muted-foreground">
                  {mode === "custom"
                    ? "Only selected apps will appear in Create VPS."
                    : "All marketplace apps stay enabled."}
                </p>
              </div>
              <Switch
                checked={mode === "custom"}
                onCheckedChange={(checked) => setMode(checked ? "custom" : "default")}
                disabled={loadingConfig}
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              <Store className="h-5 w-5 text-primary" />
              <span>{summaryText}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={mode !== "custom" || loadingConfig}
                onClick={handleSelectAll}
                className="justify-center"
              >
                Select all
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={mode !== "custom" || loadingConfig}
                onClick={handleClearAll}
                className="justify-center"
              >
                Clear all
              </Button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
            <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search apps by name or slug"
                className="border-0 bg-transparent shadow-none focus-visible:ring-0"
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {config &&
                    Object.entries(config.categories || {}).map(([category, count]) => (
                      <SelectItem key={category} value={category}>
                        {category} ({count})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loadingConfig ? (
            <div className="flex items-center justify-center rounded-lg border border-dashed p-8 text-muted-foreground">
              Loading marketplace apps…
            </div>
          ) : filteredApps.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              {config
                ? "No marketplace apps match your filters."
                : "Select a provider to load marketplace data."}
            </div>
          ) : (
            <ScrollArea className="max-h-[640px] rounded-lg border">
              <div className="divide-y">
                {filteredApps.map((app) => {
                  const normalizedSlug = normalizeSlug(app.slug);
                  const isSelected =
                    mode === "custom" ? selectedSlugs.has(normalizedSlug) : true;
                  const renameValue = renameDrafts[app.slug] ?? "";
                  const category =
                    app.category && app.category.trim().length > 0 ? app.category : "Other";
                  const description =
                    app.summary || app.description || "No description provided.";
                  const fieldsCount = Array.isArray(app.user_defined_fields)
                    ? app.user_defined_fields.length
                    : 0;
                  return (
                    <div key={app.slug} className="grid gap-4 p-4 md:grid-cols-[auto,1fr]">
                      <div className="flex items-start gap-3">
                        {mode === "custom" && (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) =>
                              handleToggleApp(app.slug, checked === true)
                            }
                            aria-label={`Toggle ${app.display_name}`}
                          />
                        )}
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold">{app.display_name}</h3>
                            <Badge variant="outline">{category}</Badge>
                            <Badge variant={isSelected ? "default" : "secondary"}>
                              {isSelected ? "Allowed" : "Hidden"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            slug: {app.slug}
                            {app.stackscript_id ? ` • StackScript #${app.stackscript_id}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">{description}</p>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Display name override</Label>
                            <Input
                              value={renameValue}
                              onChange={(event) => handleRenameChange(app.slug, event.target.value)}
                              placeholder={app.provider_name || app.name}
                              disabled={mode === "custom" && !isSelected}
                            />
                            <p className="text-xs text-muted-foreground">
                              Leave blank to use Linode&apos;s default name.
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label>StackScript prompts</Label>
                            <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                              {fieldsCount > 0
                                ? `${fieldsCount} user-defined field${
                                    fieldsCount === 1 ? "" : "s"
                                  }`
                                : "No additional inputs required"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <ScrollBar />
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketplaceManager;
