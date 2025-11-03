import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Cloud, Menu, X } from "lucide-react";
import { BRAND_NAME } from "@/lib/brand";
import { Button } from "@/components/ui/button";

interface MarketingNavbarProps {
  sticky?: boolean;
}

interface NavLinkConfig {
  label: string;
  href: string;
  isAnchor?: boolean;
}

const navLinks: NavLinkConfig[] = [
  { label: "Platform", href: "#platform", isAnchor: true },
  { label: "Capabilities", href: "#capabilities", isAnchor: true },
  { label: "Solutions", href: "#solutions", isAnchor: true },
  { label: "Pricing", href: "/pricing" },
  { label: "Status", href: "/status" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "FAQ", href: "/faq" },
];

export function MarketingNavbar({ sticky = true }: MarketingNavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === "/";

  const resolveHref = (link: NavLinkConfig) => {
    if (link.isAnchor && !isHome) {
      return `/${link.href}`;
    }
    return link.href;
  };

  const wrapperClasses = [
    "border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/65",
  ];
  if (sticky) {
    wrapperClasses.push("sticky top-0 z-40");
  }

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const renderNavLink = (link: NavLinkConfig) => {
    const resolvedHref = resolveHref(link);

    if (link.isAnchor && isHome) {
      return (
        <a
          key={link.label}
          href={resolvedHref}
          className="text-muted-foreground transition hover:text-primary"
          onClick={closeMobileMenu}
        >
          {link.label}
        </a>
      );
    }

    return (
      <Link
        key={link.label}
        to={resolvedHref}
        className="text-muted-foreground transition hover:text-primary"
        onClick={closeMobileMenu}
      >
        {link.label}
      </Link>
    );
  };

  return (
    <header className={wrapperClasses.join(" ")}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2 text-lg font-semibold" onClick={closeMobileMenu}>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Cloud className="h-5 w-5" />
          </div>
          <span>{BRAND_NAME}</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
          {navLinks.map(renderNavLink)}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <Button variant="ghost" asChild>
            <Link to="/login" onClick={closeMobileMenu}>
              Log in
            </Link>
          </Button>
          <Button asChild>
            <Link to="/register" onClick={closeMobileMenu}>
              Launch console
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setIsMobileMenuOpen((open) => !open)}
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>
      {isMobileMenuOpen && (
        <div className="border-t border-border/60 bg-background/95 px-4 pb-6 pt-3 md:hidden">
          <div className="flex flex-col gap-4 text-sm font-medium">
            {navLinks.map(renderNavLink)}
          </div>
          <div className="mt-6 flex flex-col gap-3">
            <Button variant="ghost" asChild className="justify-start">
              <Link to="/login" onClick={closeMobileMenu}>
                Log in
              </Link>
            </Button>
            <Button asChild onClick={closeMobileMenu}>
              <Link to="/register">
                Launch console
              </Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}

export default MarketingNavbar;
