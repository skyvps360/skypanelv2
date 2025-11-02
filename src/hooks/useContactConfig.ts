import { useEffect, useState } from "react";

import { buildApiUrl } from "@/lib/api";
import type { ContactConfig, ContactMethod, PlatformAvailability } from "@/types/contact";

const FALLBACK_CONTACT_CONFIG: ContactConfig = {
  categories: [
    {
      id: "fallback-general",
      label: "General inquiry",
      value: "general",
      display_order: 0,
      is_active: true,
      created_at: "",
      updated_at: "",
    },
    {
      id: "fallback-sales",
      label: "Pricing & sales",
      value: "sales",
      display_order: 1,
      is_active: true,
      created_at: "",
      updated_at: "",
    },
    {
      id: "fallback-support",
      label: "Technical support",
      value: "support",
      display_order: 2,
      is_active: true,
      created_at: "",
      updated_at: "",
    },
  ],
  methods: {},
  availability: [
    {
      id: "fallback-weekdays",
      day_of_week: "Weekdays",
      is_open: true,
      hours_text: "9:00 AM – 6:00 PM EST",
      display_order: 0,
      created_at: "",
      updated_at: "",
    },
    {
      id: "fallback-saturday",
      day_of_week: "Saturday",
      is_open: true,
      hours_text: "10:00 AM – 4:00 PM EST",
      display_order: 1,
      created_at: "",
      updated_at: "",
    },
    {
      id: "fallback-sunday",
      day_of_week: "Sunday",
      is_open: false,
      hours_text: "Closed",
      display_order: 2,
      created_at: "",
      updated_at: "",
    },
  ],
  emergency_support_text:
    "Available 24/7 for customers with enterprise SLAs. Use your runbook hotline for immediate response.",
};

let cachedConfig: ContactConfig | null = null;
let cachedError: Error | null = null;
let inflightRequest: Promise<ContactConfig> | null = null;

const METHOD_KEYS: Array<keyof ContactConfig["methods"]> = [
  "email",
  "ticket",
  "phone",
  "office",
];

function cloneAvailability(entries: PlatformAvailability[]): PlatformAvailability[] {
  return entries.map((entry) => ({ ...entry }));
}

function normalizeMethods(methods: ContactConfig["methods"] | undefined) {
  const normalized: ContactConfig["methods"] = {};
  METHOD_KEYS.forEach((key) => {
    const method = methods?.[key];
    if (method && typeof method === "object") {
      normalized[key] = {
        ...method,
        config: method.config ?? {},
      } as ContactMethod;
    }
  });
  return normalized;
}

function normalizeConfig(data: ContactConfig | null | undefined): ContactConfig {
  const categories = Array.isArray(data?.categories) && data?.categories.length
    ? data.categories.map((category) => ({ ...category }))
    : FALLBACK_CONTACT_CONFIG.categories.map((category) => ({ ...category }));

  const availability = Array.isArray(data?.availability) && data?.availability.length
    ? cloneAvailability(data.availability)
    : cloneAvailability(FALLBACK_CONTACT_CONFIG.availability);

  const emergencyText =
    typeof data?.emergency_support_text === "string" && data.emergency_support_text.trim().length > 0
      ? data.emergency_support_text
      : FALLBACK_CONTACT_CONFIG.emergency_support_text;

  return {
    categories,
    methods: normalizeMethods(data?.methods),
    availability,
    emergency_support_text: emergencyText,
  };
}

async function fetchContactConfig(): Promise<ContactConfig> {
  try {
    const response = await fetch(buildApiUrl("/contact/config"));
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Failed to load contact configuration");
    }
    const payload = (await response.json()) as ContactConfig;
    return normalizeConfig(payload);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to load contact configuration");
  }
}

export function useContactConfig() {
  const [contactConfig, setContactConfig] = useState<ContactConfig>(() =>
    normalizeConfig(cachedConfig ?? FALLBACK_CONTACT_CONFIG),
  );
  const [isLoading, setIsLoading] = useState<boolean>(!cachedConfig && !cachedError);
  const [error, setError] = useState<Error | null>(cachedError);

  useEffect(() => {
    if (cachedConfig) {
      setContactConfig(normalizeConfig(cachedConfig));
      setIsLoading(false);
      return;
    }

    if (cachedError) {
      setError(cachedError);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    if (!inflightRequest) {
      inflightRequest = fetchContactConfig()
        .then((config) => {
          cachedConfig = config;
          cachedError = null;
          return config;
        })
        .catch((err: Error) => {
          cachedError = err;
          cachedConfig = null;
          throw err;
        })
        .finally(() => {
          inflightRequest = null;
        });
    }

    inflightRequest
      .then((config) => {
        if (!isMounted) return;
        setContactConfig(normalizeConfig(config));
        setError(null);
        setIsLoading(false);
      })
      .catch((err: Error) => {
        if (!isMounted) return;
        setContactConfig(normalizeConfig(FALLBACK_CONTACT_CONFIG));
        setError(err);
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return { contactConfig, isLoading, error } as const;
}

export function primeContactConfigCache(data: ContactConfig) {
  cachedConfig = normalizeConfig(data);
  cachedError = null;
  inflightRequest = null;
}

export { FALLBACK_CONTACT_CONFIG };
