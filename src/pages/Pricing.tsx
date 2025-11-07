/**
 * Pricing Page
 * 
 * Public-facing pricing page that displays available VPS plans with transparent pricing
 * information. Includes plan specifications, hourly/monthly rates, and feature comparisons.
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
  Cloud,
  Zap,
  Globe,
  Users,
  Star,
  HelpCircle,
  Rocket,
  Gauge,
  Database
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
        {/* Hero Header */}
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary px-4 py-2">
              <Zap className="w-4 h-4 mr-2" />
              Transparent Pricing
            </Badge>
          </div>
          <h1 className="text-4xl font-bold mb-6 lg:text-6xl bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
            Simple, Predictable Pricing
          </h1>
          <p className="text-xl text-muted-foreground max-w-4xl mx-auto leading-relaxed mb-8">
            Deploy powerful cloud infrastructure without surprise bills. Pay only for what you use with
            our transparent hourly billing. No hidden fees, no long-term contracts.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="w-4 h-4 text-green-600" />
              <span>Pay hourly or monthly</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="w-4 h-4 text-green-600" />
              <span>99.9% uptime SLA</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="w-4 h-4 text-green-600" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>

        {error && (
          <Alert className="mb-8" variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* VPS Plans */}
        <div className="space-y-12">
          <div className="text-center mb-12">
            <div className="flex justify-center mb-4">
              <Server className="w-12 h-12 text-primary" />
            </div>
            <h2 className="text-3xl font-semibold mb-4">VPS Instances</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              High-performance virtual private servers with full root access, instant deployment, and enterprise-grade security
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
                {vpsPlans.map((plan, index) => {
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

                  const isPopular = index === 1; // Make the second plan popular

                  return (
                    <Card
                      key={plan.id}
                      className={`relative border bg-card hover:border-primary/50 transition-all duration-300 hover:shadow-lg ${
                        isPopular ? 'border-primary/50 ring-2 ring-primary/20 scale-105' : 'border-border/60'
                      }`}
                    >
                      {isPopular && (
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                          <Badge className="bg-primary text-primary-foreground px-3 py-1 text-sm font-medium">
                            <Star className="w-3 h-3 mr-1" />
                            Popular
                          </Badge>
                        </div>
                      )}

                      <CardHeader className="pb-4">
                        <div className="flex items-center justify-between mb-2">
                          <CardTitle className="text-xl font-semibold">{plan.name}</CardTitle>
                          {plan.daily_backups_enabled || plan.weekly_backups_enabled ? (
                            <Shield className="w-5 h-5 text-green-600" />
                          ) : null}
                        </div>
                        {plan.description && (
                          <CardDescription className="text-sm text-muted-foreground">
                            {plan.description}
                          </CardDescription>
                        )}
                        <div className="pt-4">
                          <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-bold">{formatCurrency(totalMonthly)}</span>
                            <span className="text-lg text-muted-foreground">/month</span>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            ≈ {formatCurrency(totalHourly)} per hour
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="pt-0">
                        <div className="space-y-4">
                          {/* Resource Specs */}
                          <div className="grid grid-cols-2 gap-3">
                            {specs.vcpus && (
                              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                                <Cpu className="h-4 w-4 text-blue-600" />
                                <div>
                                  <div className="text-sm font-medium">
                                    {formatResource(specs.vcpus, 'vCPU')}
                                  </div>
                                  <div className="text-xs text-muted-foreground">Processors</div>
                                </div>
                              </div>
                            )}

                            {(specs.memory || specs.memory_gb) && (
                              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                                <MemoryStick className="h-4 w-4 text-green-600" />
                                <div>
                                  <div className="text-sm font-medium">
                                    {specs.memory_gb ? `${specs.memory_gb}GB` : `${Math.round(specs.memory / 1024)}GB`}
                                  </div>
                                  <div className="text-xs text-muted-foreground">Memory</div>
                                </div>
                              </div>
                            )}

                            {(specs.disk || specs.storage_gb) && (
                              <div className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
                                <HardDrive className="h-4 w-4 text-purple-600" />
                                <div>
                                  <div className="text-sm font-medium">
                                    {specs.storage_gb ? `${specs.storage_gb}GB` : `${Math.round(specs.disk / 1024)}GB`}
                                  </div>
                                  <div className="text-xs text-muted-foreground">SSD Storage</div>
                                </div>
                              </div>
                            )}

                            {(specs.transfer || specs.transfer_gb || specs.bandwidth_gb) && (
                              <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                                <Network className="h-4 w-4 text-orange-600" />
                                <div>
                                  <div className="text-sm font-medium">
                                    {specs.transfer_gb || specs.bandwidth_gb ?
                                      `${specs.transfer_gb || specs.bandwidth_gb}GB` :
                                      `${Math.round(specs.transfer / 1024)}GB`
                                    }
                                  </div>
                                  <div className="text-xs text-muted-foreground">Bandwidth</div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Backup Info */}
                          {((Number(plan.backup_price_monthly) || 0) > 0 || (Number(plan.backup_upcharge_monthly) || 0) > 0) && (
                            <div className="pt-2 border-t border-border/60">
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-muted-foreground">Backup Pricing:</p>
                                <p className="text-sm font-medium">
                                  +{formatCurrency((Number(plan.backup_price_monthly) || 0) + (Number(plan.backup_upcharge_monthly) || 0))}/month
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Quick Features */}
                          <div className="text-xs text-muted-foreground space-y-1">
                            <div className="flex items-center gap-1">
                              <Check className="w-3 h-3 text-green-600" />
                              <span>Instant deployment</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Check className="w-3 h-3 text-green-600" />
                              <span>99.9% uptime SLA</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>

                      <CardFooter className="pt-4">
                        <Button asChild className={`w-full ${isPopular ? 'bg-primary' : ''}`} size="lg">
                          <Link to="/register">
                            <Rocket className="w-4 h-4 mr-2" />
                            Deploy Now
                          </Link>
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Enhanced Features Section */}
            <Card className="bg-gradient-to-br from-muted/20 via-background to-muted/20 border-primary/20">
              <CardContent className="pt-8 pb-6">
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-semibold mb-3">All VPS Plans Include</h3>
                  <p className="text-muted-foreground">Everything you need to run your applications with confidence</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { icon: Rocket, title: 'Instant Deployment', desc: '45-second setup time' },
                    { icon: Shield, title: 'Security', desc: 'DDoS protection included' },
                    { icon: Globe, title: 'Global Network', desc: 'IPv4 & IPv6 support' },
                    { icon: Gauge, title: 'Performance', desc: '99.9% uptime guarantee' },
                    { icon: Users, title: 'Full Control', desc: 'Root access & SSH console' },
                    { icon: Database, title: 'Storage', desc: 'High-performance SSDs' },
                    { icon: Cloud, title: 'Backups', desc: 'Automated backup options' },
                    { icon: HelpCircle, title: '24/7 Support', desc: 'Expert assistance anytime' }
                  ].map((feature) => (
                    <div key={feature.title} className="text-center">
                      <div className="flex justify-center mb-3">
                        <div className="p-3 bg-primary/10 rounded-full">
                          <feature.icon className="w-6 h-6 text-primary" />
                        </div>
                      </div>
                      <h4 className="font-medium mb-1">{feature.title}</h4>
                      <p className="text-sm text-muted-foreground">{feature.desc}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
        </div>

        {/* FAQ Section */}
        <div className="mt-20 mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-semibold mb-4">Frequently Asked Questions</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to know about our pricing and services
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                q: "How does billing work?",
                a: "You're billed hourly for VPS instances based on their hourly rate. You can choose to pay hourly or monthly at a discount. Funds are deducted from your prepaid wallet automatically."
              },
              {
                q: "Can I scale my resources?",
                a: "Yes! You can upgrade or downgrade your VPS plan at any time. Changes take effect immediately and your billing adjusts accordingly."
              },
              {
                q: "What's included in the SLA?",
                a: "We guarantee 99.9% uptime for all VPS instances. If we fail to meet this guarantee, you may be eligible for service credits."
              },
              {
                q: "How quickly can I deploy?",
                a: "VPS instances are deployed in under 45 seconds. You can start using your server immediately after deployment."
              },
              {
                q: "What operating systems are supported?",
                a: "We support multiple Linux distributions including Ubuntu, CentOS, Debian, and more. You can also upload custom ISOs."
              },
              {
                q: "Is technical support included?",
                a: "Yes, all plans include 24/7 technical support. Enterprise customers also get access to a dedicated account manager."
              }
            ].map((faq, index) => (
              <Card key={index} className="p-6">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-primary" />
                  {faq.q}
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* Enhanced Call to Action */}
        <div className="mt-20 mb-16">
          <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/30 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-primary/20 opacity-50" />
            <CardContent className="relative py-16">
              <div className="text-center">
                <div className="flex justify-center mb-6">
                  <div className="p-4 bg-primary/20 rounded-full">
                    <Rocket className="w-8 h-8 text-primary" />
                  </div>
                </div>
                <h2 className="text-3xl font-semibold mb-6">Ready to Scale Your Infrastructure?</h2>
                <p className="text-lg text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
                  Join thousands of developers and businesses who trust {BRAND_NAME} for their cloud infrastructure needs.
                  Start with our smallest plan or go big – the choice is yours.
                </p>
                <div className="flex flex-wrap justify-center gap-4 mb-8">
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-600" />
                    <span>No credit card required</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-600" />
                    <span>Free starting credits</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-600" />
                    <span>Cancel anytime</span>
                  </div>
                </div>
                <div className="flex flex-wrap justify-center gap-4">
                  <Button size="lg" asChild className="px-8 text-base py-3">
                    <Link to="/register">
                      Start Free Trial
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild className="px-8 text-base py-3">
                    <Link to="/contact">Schedule Demo</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Enhanced Footer Info */}
      <div className="border-t border-border/60 bg-muted/20">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2 md:justify-start justify-center">
                <Gauge className="w-4 h-4 text-primary" />
                Billing Details
              </h4>
              <p className="text-sm text-muted-foreground">
                All prices are in USD. VPS instances are billed hourly. Pay only for what you use.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2 md:justify-start justify-center">
                <Shield className="w-4 h-4 text-primary" />
                Money Back Guarantee
              </h4>
              <p className="text-sm text-muted-foreground">
                Not satisfied? Get a full refund within 7 days. No questions asked.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2 md:justify-start justify-center">
                <HelpCircle className="w-4 h-4 text-primary" />
                Need Help?
              </h4>
              <p className="text-sm text-muted-foreground">
                Questions about pricing? <Link to="/contact" className="text-primary hover:underline">Contact our team</Link>
              </p>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-border/40 text-center text-sm text-muted-foreground">
            <p>© 2025 {BRAND_NAME}. All rights reserved. | <Link to="/privacy" className="hover:text-primary">Privacy Policy</Link> | <Link to="/terms" className="hover:text-primary">Terms of Service</Link></p>
          </div>
        </div>
      </div>

      <MarketingFooter />
    </div>
  );
};

export default PricingPage;