/**
 * Navigation Component
 * Main navigation bar for authenticated users
 */

import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  CreditCard,
  FileText,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Rocket,
  Server,
  Settings,
  Sun,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { BRAND_NAME } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import NotificationDropdown from "./NotificationDropdown";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

const navigationItems: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "VPS", href: "/vps", icon: Server },
  { name: "PaaS", href: "/paas", icon: Rocket },
  { name: "Activity", href: "/activity", icon: Activity },
  { name: "Billing", href: "/billing", icon: CreditCard },
];

const Navigation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
      toast.success("Logged out successfully");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to logout");
    }
  };

  const isActive = (href: string) => {
    if (href === "/paas") {
      return location.pathname.startsWith("/paas");
    }
    return location.pathname === href;
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="text-lg font-semibold tracking-tight">
            {BRAND_NAME}
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Button
                  key={item.name}
                  asChild
                  variant={active ? "secondary" : "ghost"}
                  className="gap-2"
                >
                  <Link to={item.href}>
                    <Icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                </Button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <NotificationDropdown />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="gap-2 px-2"
                aria-label="Open account menu"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {user?.email?.slice(0, 2).toUpperCase() || <User className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-sm font-medium lg:inline">
                  {user?.email || "Account"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-60" align="end">
              <DropdownMenuLabel>
                <div className="flex flex-col gap-1">
                  <span className="truncate text-sm font-medium">
                    {user?.email || "Authenticated user"}
                  </span>
                  <Badge variant="secondary" className="w-min">
                    {user?.role === "admin" ? "Admin" : "Member"}
                  </Badge>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {user?.role === "admin" && (
                <DropdownMenuItem asChild>
                  <Link to="/admin" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Admin Panel
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link to="/settings" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/support" className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4" />
                  Support
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/api-docs" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  API Docs
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] sm:w-[320px]">
              <SheetHeader>
                <SheetTitle>{BRAND_NAME}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        {user?.email?.slice(0, 2).toUpperCase() || "US"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{user?.email}</p>
                      <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
                    </div>
                  </div>
                  <Separator className="my-3" />
                  <div className="flex flex-wrap gap-2">
                    <SheetClose asChild>
                      <Button variant="secondary" size="sm" asChild>
                        <Link to="/settings">Settings</Link>
                      </Button>
                    </SheetClose>
                    <SheetClose asChild>
                      <Button variant="outline" size="sm" asChild>
                        <Link to="/support">Support</Link>
                      </Button>
                    </SheetClose>
                    <SheetClose asChild>
                      <Button variant="outline" size="sm" asChild>
                        <Link to="/api-docs">API Docs</Link>
                      </Button>
                    </SheetClose>
                  </div>
                </div>
                <nav className="space-y-1">
                  {navigationItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <SheetClose key={item.name} asChild>
                        <Button
                          asChild
                          variant={active ? "secondary" : "ghost"}
                          className="w-full justify-start gap-3"
                        >
                          <Link to={item.href}>
                            <Icon className="h-4 w-4" />
                            {item.name}
                          </Link>
                        </Button>
                      </SheetClose>
                    );
                  })}
                </nav>
                <Separator />
                <SheetClose asChild>
                  <Button variant="destructive" className="w-full" onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </Button>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

export default Navigation;