/**
 * RegionSelector Component
 * Allows users to select a datacenter region for VPS deployment
 */

import React, { useState, useEffect } from "react";
import { MapPin, Globe, CheckCircle2 } from "lucide-react";
import type { ProviderRegion } from "@/types/vps";

interface RegionSelectorProps {
  providerId: string;
  selectedRegion: string;
  onSelect: (regionId: string) => void;
  token: string;
  disabled?: boolean;
}

export const RegionSelector: React.FC<RegionSelectorProps> = ({
  providerId,
  selectedRegion,
  onSelect,
  token,
  disabled = false,
}) => {
  const [regions, setRegions] = useState<ProviderRegion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRegions = async () => {
      if (!providerId) {
        setRegions([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/vps/providers/${providerId}/regions`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to fetch regions");
        }

        setRegions(data.regions || []);
      } catch (err: any) {
        console.error("Failed to fetch regions:", err);
        setError(err.message || "Failed to load regions");
        setRegions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRegions();
  }, [providerId, token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-muted-foreground">Loading regions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border border-destructive/50 rounded-lg bg-destructive/10">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (regions.length === 0) {
    return (
      <div className="p-4 border border-dashed rounded-lg">
        <p className="text-sm text-muted-foreground">
          No regions available for this provider.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {regions.map((region) => {
          const isSelected = selectedRegion === region.id;

          return (
            <button
              key={region.id}
              type="button"
              onClick={() => !disabled && onSelect(region.id)}
              disabled={disabled}
              className={`
                relative p-4 rounded-lg border-2 text-left transition-all
                ${
                  isSelected
                    ? "border-primary bg-primary/10 dark:bg-primary/20"
                    : "border-border bg-card hover:border-primary/50 hover:bg-accent"
                }
                ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
              `}
              aria-pressed={isSelected}
              aria-label={`Select ${region.label} region`}
            >
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </div>
              )}

              <div className="flex items-start space-x-3">
                <div
                  className={`
                  p-2 rounded-lg flex-shrink-0
                  ${
                    isSelected
                      ? "bg-primary/20 dark:bg-primary/30"
                      : "bg-muted"
                  }
                `}
                >
                  <MapPin
                    className={`h-5 w-5 ${
                      isSelected ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <h3
                    className={`font-medium text-sm ${
                      isSelected ? "text-primary" : "text-foreground"
                    }`}
                  >
                    {region.label}
                  </h3>

                  {region.country && (
                    <div className="flex items-center mt-1 text-xs text-muted-foreground">
                      <Globe className="h-3 w-3 mr-1" />
                      <span>{region.country}</span>
                    </div>
                  )}

                  {region.status && region.status !== "ok" && (
                    <div className="mt-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400">
                        {region.status}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
