/**
 * Breadcrumb utility for generating breadcrumbs from the current route
 */

export interface BreadcrumbItem {
  label: string;
  href?: string;
  isActive?: boolean;
}

export interface DynamicBreadcrumbOverride {
  path: string;
  label: string;
}

const routeLabels: Record<string, string> = {
  "/": "Home",
  "/dashboard": "Dashboard",
  "/vps": "VPS",
  "/vps/:id": "VPS Details",
  // Containers removed
  "/billing": "Billing",
  "/billing/invoice/:id": "Invoice",
  "/billing/transaction/:id": "Transaction",
  "/billing/payment/success": "Payment Success",
  "/billing/payment/cancel": "Payment Cancelled",
  "/support": "Support",
  "/settings": "Settings",
  "/activity": "Activity",
  "/admin": "Admin",
  "/api-docs": "API Docs",
};

export function generateBreadcrumbs(
  pathname: string, 
  dynamicOverrides?: DynamicBreadcrumbOverride[]
): BreadcrumbItem[] {
  // Start with dashboard as home
  const breadcrumbs: BreadcrumbItem[] = [
    { label: "Dashboard", href: "/dashboard" },
  ];

  // Skip if on dashboard
  if (pathname === "/dashboard" || pathname === "/") {
    return [{ label: "Dashboard", isActive: true }];
  }

  // Parse pathname segments
  const segments = pathname.split("/").filter(Boolean);

  // Build breadcrumbs from segments
  let currentPath = "";
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    currentPath += `/${segment}`;

    // Check if this is an ID parameter (UUID or number)
    const isIdSegment = /^[0-9a-f-]{36}$/.test(segment) || /^\d+$/.test(segment);

    // Check for dynamic override for this path
    const dynamicOverride = dynamicOverrides?.find(override => override.path === currentPath);

    if (dynamicOverride) {
      // Use dynamic override label
      breadcrumbs.push({
        label: dynamicOverride.label,
        href: currentPath,
        isActive: i === segments.length - 1,
      });
    } else if (isIdSegment) {
      // For ID segments, try to get parent route label
      const parentRoute = segments.slice(0, i).join("/");
      const parentLabel =
        routeLabels[`/${parentRoute}/:id`] ||
        routeLabels[`/${parentRoute}`] ||
        segment;

      breadcrumbs.push({
        label: parentLabel,
        href: currentPath,
        isActive: i === segments.length - 1,
      });
    } else {
      // For regular segments, look up label or use segment
      const label = routeLabels[currentPath] || capitalize(segment);
      breadcrumbs.push({
        label,
        href: currentPath,
        isActive: i === segments.length - 1,
      });
    }
  }

  return breadcrumbs;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
