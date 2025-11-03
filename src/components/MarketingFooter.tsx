import React from 'react';
import { Link } from 'react-router-dom';
import { Cloud } from 'lucide-react';
import { BRAND_NAME } from '@/lib/brand';

export default function MarketingFooter() {
  return (
    <footer className="border-t border-border/60 bg-background/95">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 text-sm text-muted-foreground sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 text-foreground">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Cloud className="h-4 w-4" />
          </div>
          <span className="font-semibold">{BRAND_NAME}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link to="/privacy" className="hover:text-primary transition-colors">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-primary transition-colors">
            Terms
          </Link>
          <Link to="/status" className="hover:text-primary transition-colors">
            Status
          </Link>
          <Link to="/contact" className="hover:text-primary transition-colors">
            Support
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} {BRAND_NAME}. Purpose-built for teams who demand elegance and power.
        </p>
      </div>
    </footer>
  );
}