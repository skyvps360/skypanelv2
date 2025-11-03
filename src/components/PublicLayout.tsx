import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Server, 
  Shield, 
  Award,
  Github,
  Twitter,
  Linkedin
} from 'lucide-react';
import { BRAND_NAME } from '../lib/brand';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import MarketingNavbar from '@/components/MarketingNavbar';

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

      {/* Enhanced Footer */}
      <footer className="border-t bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Brand Column */}
            <div className="space-y-4">
              <Link to="/" className="flex items-center hover:opacity-80 transition-opacity">
                <Server className="h-6 w-6 text-primary" />
                <span className="ml-2 text-lg font-bold">{BRAND_NAME}</span>
              </Link>
              <p className="text-sm text-muted-foreground">
                The most reliable cloud infrastructure platform for developers and businesses.
              </p>
              <div className="flex space-x-4">
                <Button variant="ghost" size="sm">
                  <Twitter className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm">
                  <Github className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm">
                  <Linkedin className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Product Column */}
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/vps" className="hover:text-foreground transition-colors">VPS Hosting</Link></li>
                <li><Link to="/#pricing" className="hover:text-foreground transition-colors">Pricing</Link></li>
                <li><Link to="/api-docs" className="hover:text-foreground transition-colors">API</Link></li>
              </ul>
            </div>

            {/* Contact Column */}
            <div>
              <h3 className="font-semibold mb-4">Contact</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/contact" className="hover:text-foreground transition-colors">Contact Us</Link></li>
                <li><Link to="/support" className="hover:text-foreground transition-colors">Help Center</Link></li>
                <li><Link to="/status" className="hover:text-foreground transition-colors">Status Page</Link></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Documentation</a></li>
              </ul>
            </div>

            {/* Company Column */}
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/about" className="hover:text-foreground transition-colors">About</Link></li>
                <li><Link to="/faq" className="hover:text-foreground transition-colors">FAQ</Link></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a></li>
              </ul>
            </div>
          </div>

          <Separator className="my-8" />
          
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-muted-foreground">
              © 2025 {BRAND_NAME}. All rights reserved.
            </p>
            <div className="flex items-center space-x-4 mt-4 md:mt-0">
              <Badge variant="outline" className="text-xs">
                <Award className="h-3 w-3 mr-1" />
                SOC 2 Compliant
              </Badge>
              <Badge variant="outline" className="text-xs">
                <Shield className="h-3 w-3 mr-1" />
                GDPR Ready
              </Badge>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}