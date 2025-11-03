import React from 'react';
import MarketingNavbar from '@/components/MarketingNavbar';
import MarketingFooter from '@/components/MarketingFooter';

interface PublicLayoutProps {
  children: React.ReactNode;
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNavbar />

      {/* Main Content */}
      <main>
        {children}
      </main>

      <MarketingFooter />
    </div>
  );
}