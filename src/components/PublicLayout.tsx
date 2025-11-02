import { useMemo } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  Blocks,
  Cloud,
  Command,
  LifeBuoy,
  Mail,
  Menu,
  MessageCircle,
  Phone,
  Server,
  ShieldCheck,
  Github,
  Linkedin,
  Twitter,
} from "lucide-react";

import { BRAND_NAME } from "../lib/brand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useContactConfig } from "@/hooks/useContactConfig";
import { FALLBACK_CONTACT_EMAIL, FALLBACK_CONTACT_PHONE, getEmailDetails, getPhoneDetails } from "@/lib/contact";

interface PublicLayoutProps {
  children: React.ReactNode;
}

const primaryLinks = [
  { label: "Platform", to: "/#platform" },
  { label: "Compute", to: "/vps" },
  { label: "PaaS", to: "/#paas" },
  { label: "Pricing", to: "/#pricing" },
  { label: "Status", to: "/status" },
];

const secondaryLinks = [
  { label: "About", to: "/about" },
  { label: "FAQ", to: "/faq" },
  { label: "Support", to: "/support" },
  { label: "Contact", to: "/contact" },
];

const footerColumns = [
  {
    title: "Product",
    links: [
      { label: "Overview", to: "/#platform" },
      { label: "Compute", to: "/vps" },
      { label: "PaaS", to: "/#paas" },
      { label: "Status", to: "/status" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", to: "/about" },
      { label: "Careers", to: "#" },
      { label: "Partners", to: "#" },
      { label: "Press", to: "#" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", to: "/api-docs" },
      { label: "Support", to: "/support" },
      { label: "FAQ", to: "/faq" },
      { label: "Terms", to: "/terms-of-service" },
    ],
  },
];

const socialLinks = [
  { label: "Twitter", icon: Twitter, href: "#" },
  { label: "GitHub", icon: Github, href: "#" },
  { label: "LinkedIn", icon: Linkedin, href: "#" },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "text-sm font-medium transition-colors",
    isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
  );

export default function PublicLayout({ children }: PublicLayoutProps) {
  const location = useLocation();
  const { contactConfig } = useContactConfig();
  const emailMethod = contactConfig.methods.email?.is_active ? contactConfig.methods.email : null;
  const phoneMethod = contactConfig.methods.phone?.is_active ? contactConfig.methods.phone : null;
  const emailDetails = getEmailDetails(emailMethod ?? undefined);
  const phoneDetails = getPhoneDetails(phoneMethod ?? undefined);
  const displayEmail = emailDetails.address || FALLBACK_CONTACT_EMAIL;
  const displayPhone = phoneDetails.number || FALLBACK_CONTACT_PHONE;
  const contactStatus = phoneDetails.availability || emailDetails.responseTime || "Live chat 24/7";

  const activeHash = useMemo(() => location.hash, [location.hash]);

  const anchorClass = (to: string) => {
    const [, hash] = to.split("#");
    const isActive = hash ? activeHash === `#${hash}` : false;
    return cn(
      "text-sm font-medium text-muted-foreground transition hover:text-foreground",
      isActive && "text-foreground",
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted text-primary">
              <Cloud className="h-4 w-4" />
            </span>
            <span className="text-base font-semibold tracking-tight sm:text-lg">
              {BRAND_NAME}
            </span>
          </Link>

          <nav className="hidden items-center gap-6 lg:flex">
            {primaryLinks.map((link) =>
              link.to.startsWith("/#") ? (
                <a key={link.label} href={link.to} className={anchorClass(link.to)}>
                  {link.label}
                </a>
              ) : (
                <NavLink key={link.label} to={link.to} className={navLinkClass}>
                  {link.label}
                </NavLink>
              ),
            )}
            <Separator orientation="vertical" className="h-6" />
            {secondaryLinks.map((link) => (
              <NavLink key={link.label} to={link.to} className={navLinkClass}>
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/register">Open console</Link>
            </Button>
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Toggle navigation">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full max-w-xs">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-muted text-primary">
                    <Cloud className="h-4 w-4" />
                  </span>
                  <span className="text-base font-semibold tracking-tight">{BRAND_NAME}</span>
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-8">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Explore
                  </p>
                  <div className="grid gap-3">
                    {primaryLinks.map((link) =>
                      link.to.startsWith("/#") ? (
                        <a key={link.label} href={link.to} className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm font-medium">
                          {link.label}
                          <Command className="h-4 w-4 text-muted-foreground" />
                        </a>
                      ) : (
                        <NavLink
                          key={link.label}
                          to={link.to}
                          className={({ isActive }) =>
                            cn(
                              "flex items-center justify-between rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm font-medium",
                              isActive && "border-primary text-primary",
                            )
                          }
                        >
                          {link.label}
                          <Command className="h-4 w-4 text-muted-foreground" />
                        </NavLink>
                      ),
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Company</p>
                  <div className="grid gap-2">
                    {secondaryLinks.map((link) => (
                      <NavLink
                        key={link.label}
                        to={link.to}
                        className={({ isActive }) =>
                          cn(
                            "rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground",
                            isActive && "text-foreground",
                          )
                        }
                      >
                        {link.label}
                      </NavLink>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <Button variant="outline" asChild>
                    <Link to="/login">Sign in</Link>
                  </Button>
                  <Button asChild>
                    <Link to="/register">Open console</Link>
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main>{children}</main>

      <footer className="border-t bg-background">
        <div className="mx-auto flex max-w-7xl flex-col gap-12 px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-[1.75fr,repeat(3,1fr)]">
            <div className="space-y-6">
              <Link to="/" className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted text-primary">
                  <Server className="h-5 w-5" />
                </span>
                <span className="text-lg font-semibold tracking-tight">{BRAND_NAME}</span>
              </Link>
              <p className="text-sm text-muted-foreground">
                A unified control plane for provisioning, securing, and operating modern infrastructure with confidence.
              </p>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  SOC2 Ready
                </span>
                <span className="inline-flex items-center gap-2">
                  <Blocks className="h-4 w-4 text-primary" />
                  API-first
                </span>
              </div>
              <div className="flex items-center gap-2">
                {socialLinks.map(({ label, icon: Icon, href }) => (
                  <Button key={label} variant="ghost" size="icon" className="h-9 w-9" asChild>
                    <a href={href} aria-label={label}>
                      <Icon className="h-4 w-4" />
                    </a>
                  </Button>
                ))}
              </div>
            </div>

            {footerColumns.map((column) => (
              <div key={column.title} className="space-y-4">
                <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {column.title}
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {column.links.map((link) => (
                    link.to.startsWith("/") ? (
                      <li key={link.label}>
                        <NavLink to={link.to} className={({ isActive }) => cn(isActive ? "text-foreground" : "hover:text-foreground")}
                        >
                          {link.label}
                        </NavLink>
                      </li>
                    ) : (
                      <li key={link.label}>
                        <a href={link.to} className="hover:text-foreground">
                          {link.label}
                        </a>
                      </li>
                    )
                  ))}
                </ul>
              </div>
            ))}

            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Talk to a specialist
              </p>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  {displayPhone}
                </p>
                <p className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <a href={`mailto:${displayEmail}`} className="hover:text-foreground">
                    {displayEmail}
                  </a>
                </p>
                <p className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-primary" />
                  {contactStatus}
                </p>
              </div>
              <Badge variant="outline" className="gap-2 text-xs">
                <LifeBuoy className="h-3 w-3" /> 15-minute SLA for priority queues
              </Badge>
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
            <p>© {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.</p>
            <div className="flex flex-wrap items-center gap-4">
              <NavLink to="/privacy-policy" className={({ isActive }) => cn(isActive ? "text-foreground" : "hover:text-foreground")}
              >
                Privacy
              </NavLink>
              <NavLink to="/terms-of-service" className={({ isActive }) => cn(isActive ? "text-foreground" : "hover:text-foreground")}
              >
                Terms
              </NavLink>
              <a href="#" className="hover:text-foreground">
                Compliance
              </a>
              <a href="#" className="hover:text-foreground">
                System status
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
