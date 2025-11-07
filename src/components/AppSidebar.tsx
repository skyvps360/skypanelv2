import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Activity,
  AppWindow,
  Box,
  CreditCard,
  BookOpen,
  Key,
  LayoutDashboard,
  LifeBuoy,
  Search,
  Server,
  ServerCog,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { BRAND_NAME } from "@/lib/brand";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  onOpenCommand?: () => void;
}

export function AppSidebar({ onOpenCommand, ...props }: AppSidebarProps) {
  const location = useLocation();
  const { user } = useAuth();

  // Main navigation items
  const pathname = location.pathname;
  const currentHash = location.hash?.slice(1) ?? "";
  const isDashboardActive = pathname === "/dashboard";
  const isVpsActive = pathname.startsWith("/vps");
  const isAppsActive = pathname.startsWith("/apps");
  const isActivityActive = pathname.startsWith("/activity");
  const isBillingActive = pathname.startsWith("/billing");
  const isSshKeysActive = pathname.startsWith("/ssh-keys");
  const isApiDocsActive = pathname.startsWith("/api-docs");
  const isAdminRoute = pathname.startsWith("/admin");

  const navMainItems = React.useMemo(
    () => {
      if (isAdminRoute) {
        const activeAnchor = currentHash || "dashboard";
        
        // Organized admin navigation with groups
        const adminGroups = [
          {
            title: "Dashboard",
            icon: LayoutDashboard,
            url: `/admin`,
            isActive: activeAnchor === "dashboard" || !currentHash,
          },
          {
            title: "Support",
            icon: LifeBuoy,
            url: `/admin#support`,
            isActive: activeAnchor === "support",
            items: [
              { title: "Tickets", url: `/admin#support`, isActive: activeAnchor === "support" },
            ],
          },
          {
            title: "PaaS",
            icon: Box,
            url: `/admin#paas`,
            isActive: activeAnchor === "paas",
            items: [
              { title: "Overview", url: `/admin#paas`, isActive: activeAnchor === "paas" },
            ],
          },
          {
            title: "Infrastructure",
            icon: ServerCog,
            url: `/admin#servers`,
            isActive: [
              "servers",
              "networking",
              "stackscripts",
              "providers",
              "marketplace",
              "regions",
              "vps-plans",
            ].includes(activeAnchor),
            items: [
              { title: "Servers", url: `/admin#servers`, isActive: activeAnchor === "servers" },
              { title: "Networking", url: `/admin#networking`, isActive: activeAnchor === "networking" },
              { title: "StackScripts", url: `/admin#stackscripts`, isActive: activeAnchor === "stackscripts" },
              { title: "Marketplace", url: `/admin#marketplace`, isActive: activeAnchor === "marketplace" },
              { title: "Regions", url: `/admin#regions`, isActive: activeAnchor === "regions" },
              { title: "Providers", url: `/admin#providers`, isActive: activeAnchor === "providers" },
              { title: "VPS Plans", url: `/admin#vps-plans`, isActive: activeAnchor === "vps-plans" },
            ],
          },
          {
            title: "Platform Settings",
            icon: Settings,
            url: `/admin#platform`,
            isActive: ["platform", "theme", "faq-management", "contact-management"].includes(activeAnchor),
            items: [
              { title: "Theme", url: `/admin#theme`, isActive: activeAnchor === "theme" },
              { title: "FAQ Management", url: `/admin#faq-management`, isActive: activeAnchor === "faq-management" },
              { title: "Contact Management", url: `/admin#contact-management`, isActive: activeAnchor === "contact-management" },
              { title: "Rate Limiting", url: `/admin#rate-limiting`, isActive: activeAnchor === "rate-limiting" },
            ],
          },
          {
            title: "User Management",
            icon: Users,
            url: `/admin#user-management`,
            isActive: activeAnchor === "user-management",
          },
        ];

        return adminGroups;
      }

      return [
        {
          title: "Dashboard",
          url: "/dashboard",
          icon: LayoutDashboard,
          isActive: isDashboardActive,
        },
        {
          title: "Compute",
          url: "/vps",
          icon: Server,
          isActive: isVpsActive,
          items: [
            {
              title: "VPS",
              url: "/vps",
              isActive: isVpsActive,
            },
          ],
        },
        {
          title: "Apps",
          url: "/apps",
          icon: AppWindow,
          isActive: isAppsActive,
        },
        {
          title: "SSH Keys",
          url: "/ssh-keys",
          icon: Key,
          isActive: isSshKeysActive,
        },
        {
          title: "Activity",
          url: "/activity",
          icon: Activity,
          isActive: isActivityActive,
        },
        {
          title: "Billing",
          url: "/billing",
          icon: CreditCard,
          isActive: isBillingActive,
        },
        {
          title: "API Docs",
          url: "/api-docs",
          icon: BookOpen,
          isActive: isApiDocsActive,
        },
      ];
    },
    [
      currentHash,
      isActivityActive,
      isAdminRoute,
      isBillingActive,
      isApiDocsActive,
      isDashboardActive,
      isAppsActive,
      isSshKeysActive,
      isVpsActive,
      pathname,
    ]
  );

  // Secondary navigation items
  const navSecondaryItems: Array<{
    title: string;
    url: string;
    icon: LucideIcon;
  }> = React.useMemo(() => {
    if (isAdminRoute) {
      return [];
    }

    return [];
  }, [isAdminRoute]);

  // User data for the footer
  const displayName = user
    ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email
    : "User";

  const userData = {
    name: displayName,
    email: user?.email || "user@example.com",
    avatar: "/avatars/user.jpg", // You can add user avatar support later
    role: user?.role,
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="gap-4 border-b border-white/10 bg-sidebar-background/80 p-4 pointer-events-none">
        <SidebarMenu className="pointer-events-auto">
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="group-data-[collapsible=icon]:-ml-1.5"
              asChild
            >
              <Link to="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Server className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{BRAND_NAME}</span>
                  <span className="truncate text-xs">Cloud Platform</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {onOpenCommand ? (
          <div className="px-2 pt-2 pb-1 md:hidden">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-start text-muted-foreground"
              onClick={onOpenCommand}
            >
              <Search className="mr-2 h-4 w-4" />
              Search...
              <Kbd className="ml-auto">⌘K</Kbd>
            </Button>
          </div>
        ) : null}
        <NavMain items={navMainItems} label={isAdminRoute ? "Admin" : undefined} />
        {navSecondaryItems.length > 0 ? (
          <NavSecondary items={navSecondaryItems} className="mt-auto" />
        ) : null}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} />
      </SidebarFooter>
    </Sidebar>
  );
}
