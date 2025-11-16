export const DEFAULT_LINODE_ALLOWED_REGIONS = [
  "us-east",
  "us-west",
  "us-central",
  "us-southeast",
  "eu-west",
  "eu-central",
  "ap-south",
  "ap-southeast",
  "ap-northeast",
  "ca-central",
];

const normalizedLinodeDefaults = new Set(
  DEFAULT_LINODE_ALLOWED_REGIONS.map((region) => region.toLowerCase())
);

export const normalizeRegionList = (regions: string[]): string[] =>
  Array.from(
    new Set(
      regions
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value.length > 0)
    )
  );

export const matchesDefaultAllowedRegions = (
  normalizedRegions: string[]
): boolean => {
  if (normalizedRegions.length === 0) {
    return false;
  }

  if (normalizedRegions.length !== normalizedLinodeDefaults.size) {
    return false;
  }
  return normalizedRegions.every((region) =>
    normalizedLinodeDefaults.has(region)
  );
};

export const shouldFilterByAllowedRegions = (
  normalizedRegions: string[]
): boolean =>
  normalizedRegions.length > 0 && !matchesDefaultAllowedRegions(normalizedRegions);

export const parseStoredAllowedRegions = (rawValue: unknown): string[] => {
  if (!rawValue) {
    return [];
  }

  if (Array.isArray(rawValue)) {
    return normalizeRegionList(
      rawValue.filter((value: unknown): value is string => typeof value === "string")
    );
  }

  if (typeof rawValue === "string") {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return normalizeRegionList(
          parsed.filter((value: unknown): value is string => typeof value === "string")
        );
      }
    } catch (err) {
      console.warn("Failed to parse stored allowed_regions value", err);
    }
  }

  if (typeof rawValue === "object" && rawValue !== null) {
    // Handle JSONB objects that might resemble {"0": "region"}
    try {
      const entries = Object.values(rawValue);
      if (entries.length > 0) {
        return normalizeRegionList(
          entries.filter((value: unknown): value is string => typeof value === "string")
        );
      }
    } catch (err) {
      console.warn("Failed to normalize structured allowed_regions value", err);
    }
  }

  return [];
};
