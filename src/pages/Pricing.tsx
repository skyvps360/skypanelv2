/*
displays VPS plans with pricing information
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Loader2, 
  Check, 
  Cpu, 
  HardDrive, 
  MemoryStick, 
  Server,
  Network,
  Shield,
  AlertCircle,
  ArrowRight,
  Cloud
} from 'lucide-react';
import type { VPSPlan } from '@/types/vps';
import { BRAND_NAME } from '@/lib/brand';
import MarketingNavbar from '@/components/MarketingNavbar';
import MarketingFooter from '@/components/MarketingFooter';

const PricingPage: React.FC = () => {
  const [vpsPlans, setVpsPlans] = useState<VPSPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPricingData();
  }, []);

  const loadPricingData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch VPS plans  
      const vpsResponse = await fetch('/api/pricing/vps');
      const vpsResult = await vpsResponse.json();
      
      if (!vpsResponse.ok) {
        console.warn('VPS plans fetch failed:', vpsResult.error);
      }

      console.log('VPS plans loaded:', vpsResult.plans?.length || 0);
      
      setVpsPlans(vpsResult.plans || []);
    } catch (err) {
      console.error('Failed to load pricing data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load pricing information');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number): string => {
    // Handle NaN, null, undefined, or invalid numbers
    if (!Number.isFinite(amount) || amount < 0) {
      return '$0.00';
    }
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatResource = (value: number, unit: string): string => {
    // Handle special pluralization cases
    const pluralizeUnit = (unit: string, count: number): string => {
      if (count === 1) return unit;
      
      // Special cases that don't follow standard pluralization
      const specialCases: Record<string, string> = {
        'GB Memory': 'GB Memory',
        'GB Storage': 'GB Storage',
        'Memory': 'Memory',
        'Storage': 'Storage'
      };
      
      if (specialCases[unit]) {
        return specialCases[unit];
      }
      
      // Standard pluralization for other units
      return `${unit}s`;
    };
    
    return `${value} ${pluralizeUnit(unit, value)}`;
  };

  const formatBytes = (bytes: number): string => {
    // Handle MB to GB conversion for storage values
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(0)}TB`;
    } else if (bytes >= 1024) {
      return `${Math.round(bytes / 1024)}GB`;
    }
    return `${bytes}MB`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MarketingNavbar />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="flex items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Loading pricing information...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MarketingNavbar />
      
      <main className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-6 border-primary/40 bg-primary/10 text-primary">
            Transparent Pricing
          </Badge>
          <h1 className="text-4xl font-bold mb-6 lg:text-5xl">
            Simple, Predictable Pricing
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Choose from our VPS instances. Pay only for what you use with transparent, hourly billing.
          </p>
        </div>

        {error && (
          <Alert className="mb-8" variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* VPS Plans */}
        <div className="space-y-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-semibold mb-4">VPS Instances</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              High-performance virtual private servers with full root access and SSH console
            </p>
          </div>

            {vpsPlans.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <Server className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium mb-2">No VPS Plans Available</h3>
                    <p className="text-muted-foreground mb-4">
                      VPS plans are not currently configured. Please check back later.
                    </p>
                    <Button asChild variant="outline">
                      <Link to="/contact">Contact Support</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {vpsPlans.map((plan) => {
                  // Safely calculate prices with fallbacks
                  const basePrice = Number(plan.base_price) || 0;
                  const markupPrice = Number(plan.markup_price) || 0;
                  const totalMonthly = basePrice + markupPrice;
                  const totalHourly = totalMonthly / 730; // Approximate hours per month
                  const specs = plan.specifications || {};
                  
                  // Debug logging
                  if (totalMonthly === 0) {
                    console.log('VPS Plan with zero price:', {
                      name: plan.name,
                      base_price: plan.base_price,
                      markup_price: plan.markup_price,
                      basePrice,
                      markupPrice,
                      totalMonthly
                    });
                  }

                  return (
                    <Card key={plan.id} className="relative border border-border/60 bg-card hover:border-primary/50 transition-colors">
                      <CardHeader>
                        <CardTitle className="text-xl">{plan.name}</CardTitle>
                        {plan.description && (
                          <CardDescription>{plan.description}</CardDescription>
                        )}
                        <div className="pt-2">
                          <span className="text-3xl font-bold">{formatCurrency(totalMonthly)}</span>
                          <span className="text-muted-foreground">/month</span>
                          <div className="text-sm text-muted-foreground">
                            {formatCurrency(totalHourly)} per hour
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        <div className="space-y-3">
                          {specs.vcpus && (
                            <div className="flex items-center gap-3">
                              <Cpu className="h-4 w-4 text-blue-600" />
                              <span className="text-sm">
                                {formatResource(specs.vcpus, 'vCPU')}
                              </span>
                            </div>
                          )}
                          
                          {(specs.memory || specs.memory_gb) && (
                            <div className="flex items-center gap-3">
                              <MemoryStick className="h-4 w-4 text-green-600" />
                              <span className="text-sm">
                                {specs.memory_gb ? `${specs.memory_gb}GB` : `${Math.round(specs.memory / 1024)}GB`} Memory
                              </span>
                            </div>
                          )}
                          
                          {(specs.disk || specs.storage_gb) && (
                            <div className="flex items-center gap-3">
                              <HardDrive className="h-4 w-4 text-purple-600" />
                              <span className="text-sm">
                                {specs.storage_gb ? `${specs.storage_gb}GB` : `${Math.round(specs.disk / 1024)}GB`} SSD Storage
                              </span>
                            </div>
                          )}
                          
                          {(specs.transfer || specs.transfer_gb || specs.bandwidth_gb) && (
                            <div className="flex items-center gap-3">
                              <Network className="h-4 w-4 text-orange-600" />
                              <span className="text-sm">
                                {specs.transfer_gb || specs.bandwidth_gb ? 
                                  `${specs.transfer_gb || specs.bandwidth_gb}GB` : 
                                  `${Math.round(specs.transfer / 1024)}GB`
                                } Transfer
                              </span>
                            </div>
                          )}

                          <div className="flex items-center gap-3">
                            <Shield className="h-4 w-4 text-red-600" />
                            <span className="text-sm">
                              {plan.daily_backups_enabled || plan.weekly_backups_enabled ? 'Backups Available' : 'No Backups'}
                            </span>
                          </div>
                        </div>

                        {((Number(plan.backup_price_monthly) || 0) > 0 || (Number(plan.backup_upcharge_monthly) || 0) > 0) && (
                          <div className="pt-2 border-t border-border/60">
                            <p className="text-xs text-muted-foreground mb-1">Backup Pricing:</p>
                            <p className="text-sm">
                              +{formatCurrency((Number(plan.backup_price_monthly) || 0) + (Number(plan.backup_upcharge_monthly) || 0))}/month
                            </p>
                          </div>
                        )}
                      </CardContent>

                      <CardFooter>
                        <Button asChild className="w-full">
                          <Link to="/register">
                            Get Started
                            <ArrowRight className="h-4 w-4 ml-2" />
                          </Link>
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* VPS Features */}
            <Card className="bg-muted/20">
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-4">VPS Features Include:</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    'Full root access',
                    'Web-based SSH console',
                    'Multiple Linux distributions',
                    'Instant deployment (45 seconds)',
                    'High-performance SSD storage',
                    'DDoS protection',
                    'IPv4 and IPv6 support',
                    '99.9% uptime SLA'
                  ].map((feature) => (
                    <div key={feature} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
        </div>

        {/* Call to Action */}
        <Card className="mt-16 bg-gradient-to-br from-primary/5 via-transparent to-transparent border-primary/20">
          <CardContent className="py-16">
            <div className="text-center">
              <h2 className="text-3xl font-semibold mb-6">Ready to Get Started?</h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
                Create your {BRAND_NAME} account today and start deploying your infrastructure in minutes. 
                Add funds to your wallet and pay only for what you use.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button size="lg" asChild className="px-8">
                  <Link to="/register">Create Account</Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="px-8">
                  <Link to="/contact">Contact Sales</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Pricing Footer Info */}
      <div className="border-t border-border/60 bg-muted/20 mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-sm text-muted-foreground">
            <p>All prices are in USD. VPS instances are billed hourly. Container plans are billed monthly.</p>
            <p className="mt-2">
              Questions about pricing? <Link to="/contact" className="text-primary hover:underline">Contact our team</Link>
            </p>
          </div>
        </div>
      </div>

      <MarketingFooter />
    </div>
  );
};

export default PricingPage;