import { Link } from "react-router-dom";
import {
  Award,
  Building2,
  Cpu,
  Globe,
  Handshake,
  Layers,
  Shield,
  Sparkles,
  Target,
  Users,
  Zap,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { BRAND_NAME } from "../lib/brand";
import PublicLayout from "@/components/PublicLayout";
import api from "@/lib/api";

const values = [
  {
    title: "Reliability first",
    description: "Enterprise-grade infrastructure, redundant networking, and observability baked into every region.",
    icon: Shield,
  },
  {
    title: "Developer delight",
    description: "An interface built for busy teams—predictable APIs, consistent CLI tooling, and actionable dashboards.",
    icon: Zap,
  },
  {
    title: "Transparent pricing",
    description: "Metered billing down to the hour with clear invoices, usage alerts, and no surprise overages.",
    icon: Award,
  },
  {
    title: "Global reach",
    description: "Low-latency deployments across strategic regions so you can ship closer to your customers.",
    icon: Globe,
  },
  {
    title: "Human support",
    description: "Real engineers on-call 24/7 to help troubleshoot incidents, migrations, and architectural decisions.",
    icon: Users,
  },
  {
    title: "Security by design",
    description: "Hardening, compliance, and audit trails woven into the platform from SSH access to activity logs.",
    icon: Target,
  },
];

interface PlatformStats {
  users: {
    total: number;
    admins: number;
    regular: number;
  };
  organizations: {
    total: number;
  };
  vps: {
    total: number;
    active: number;
  };
  // containers removed
  support: {
    totalTickets: number;
    openTickets: number;
  };
  plans: {
    vpsPlans: number;
  };
  regions: {
    total: number;
  };
  cacheExpiry: string;
}

const differentiators = [
  {
    title: "Opinionated automation",
    description: "Reusable stack scripts, GitOps-ready APIs, and fine-grained access controls designed to scale with your org.",
    icon: Layers,
  },
  {
    title: "Finance-friendly tooling",
    description: "Shared wallets, granular usage exports, and alerts keep engineering and finance aligned without spreadsheet wrangling.",
    icon: Handshake,
  },
  {
    title: "Managed partner ecosystem",
    description: "Carefully vetted integrations with Linode, PayPal, and monitoring providers so you can extend without re-architecting.",
    icon: Building2,
  },
];

const milestones = [
  {
    year: "2023",
    title: "Founded to simplify infrastructure",
    description: "Launched {BRAND_NAME} with a vision to bring streamlined VPS management into a cohesive control plane.",
  },
  {
    year: "2024",
    title: "Expanded to multi-region",
    description: "Rolled out global networking, API keys, and SOC 2-aligned activity logging for enterprise customers.",
  },
  {
    year: "2025",
    title: "Automation-first platform",
    description: "Introduced programmable themes, advanced billing insights, and a refined admin experience for large teams.",
  },
];

export default function AboutUs() {
  // Fetch platform statistics with 5-minute cache
  const { data: platformStats, isLoading, isError } = useQuery<PlatformStats>({
    queryKey: ['platform-stats'],
    queryFn: async () => {
      const response = await api.get<any>('/health/platform-stats');
      // API client returns the full response object with success, timestamp, and spread stats
      // Extract just the stats by removing metadata fields
      const { success, timestamp, ...stats } = response;
      return stats as PlatformStats;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
    refetchOnWindowFocus: false,
  });

  const formatStat = (value?: number | null, fallback: string = 'N/A') => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value.toLocaleString();
    }
    return fallback;
  };

  return (
    <PublicLayout>
      <div className="container mx-auto max-w-6xl px-4 py-12">
      <section className="space-y-6 text-center">
        <Badge variant="outline" className="mx-auto uppercase tracking-wide">Who we are</Badge>
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold md:text-5xl">The infrastructure platform teams actually enjoy using</h1>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground md:text-lg">
            {BRAND_NAME} gives engineering, platform, and security teams a unified way to manage VPS fleets and understand spend—without losing the human support that growing companies need.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Build faster</span>
          <span className="inline-flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> Stay secure</span>
          <span className="inline-flex items-center gap-2"><Cpu className="h-4 w-4 text-primary" /> Scale confidently</span>
        </div>
      </section>

      <section className="mt-12 grid gap-8 md:grid-cols-[2fr,1fr]">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Our mission</CardTitle>
            <CardDescription className="text-base">
              Empower builders with reliable infrastructure that doesn’t require a dedicated operations team to unlock.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
            <p>
              We founded {BRAND_NAME} to bridge the gap between developer velocity and operational excellence. Traditional cloud platforms offer power at the cost of complexity. We believe you shouldn’t need a week of training—or professional services—to ship your next release.
            </p>
            <p>
              By pairing opinionated defaults with transparent controls, we help teams move from manual provisioning to scripted automation without losing visibility or governance.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>At a glance</CardTitle>
            <CardDescription>Numbers that reflect how customers rely on us today.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {isLoading ? (
              // Loading skeleton
              <>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="rounded-lg border border-border p-4 text-left">
                    <Skeleton className="h-8 w-20 mb-2" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                ))}
              </>
            ) : isError ? (
              // Error state
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
                <p className="text-sm text-destructive">Unable to load platform statistics. Please try again later.</p>
              </div>
            ) : platformStats ? (
              // Real data
              <>
                <div className="rounded-lg border border-border p-4 text-left">
                  <div className="text-2xl font-semibold text-foreground">{formatStat(platformStats?.users?.total)}</div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Users</p>
                </div>
                <div className="rounded-lg border border-border p-4 text-left">
                  <div className="text-2xl font-semibold text-foreground">{formatStat(platformStats?.organizations?.total)}</div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Organizations</p>
                </div>
                <div className="rounded-lg border border-border p-4 text-left">
                  <div className="text-2xl font-semibold text-foreground">{formatStat(platformStats?.vps?.total)}</div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Total VPS Deployed</p>
                </div>
                {/* Containers metric removed */}
                <div className="rounded-lg border border-border p-4 text-left">
                  <div className="text-2xl font-semibold text-foreground">{formatStat(platformStats?.support?.totalTickets)}</div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Tickets Handled</p>
                </div>
                <div className="rounded-lg border border-border p-4 text-left">
                  <div className="text-2xl font-semibold text-foreground">{formatStat(platformStats?.plans?.vpsPlans)}</div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Available VPS Plans</p>
                </div>
                <div className="rounded-lg border border-border p-4 text-left">
                  <div className="text-2xl font-semibold text-foreground">{formatStat(platformStats?.regions?.total)}</div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Supported Regions</p>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="mt-16 space-y-8">
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-semibold md:text-3xl">What drives our team</h2>
          <p className="mx-auto max-w-2xl text-sm text-muted-foreground md:text-base">
            Every decision—from API design to support SLAs—starts with empathy for the teams running production workloads on our platform.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {values.map(({ title, description, icon: Icon }) => (
            <Card key={title} className="h-full border-border/80">
              <CardHeader className="space-y-3">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <CardTitle className="text-lg">{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-6">{description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-16 grid gap-6 md:grid-cols-3">
        {differentiators.map(({ title, description, icon: Icon }) => (
          <Card key={title} className="border-primary/20 bg-primary/5">
            <CardHeader className="space-y-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Icon className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-6">{description}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-16">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Our journey</CardTitle>
            <CardDescription>Key milestones that shaped the platform.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-3">
              {milestones.map((milestone) => (
                <div key={milestone.year} className="rounded-lg border border-dashed border-border/70 p-5">
                  <Badge variant="secondary" className="mb-3">{milestone.year}</Badge>
                  <h3 className="text-lg font-semibold text-foreground">{milestone.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-6">
                    {milestone.description.replace("{BRAND_NAME}", BRAND_NAME)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-16 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>How we partner with teams</CardTitle>
            <CardDescription>Every account gets a dedicated onboarding plan tailored to their stack.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              From the first migration call to production launch, our success engineers help map workloads, configure security guardrails, and set up monitoring so your team can stay focused on features.
            </p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2"><span className="mt-1 h-2 w-2 rounded-full bg-primary" /> Guided migrations &amp; architecture reviews</li>
              <li className="flex items-start gap-2"><span className="mt-1 h-2 w-2 rounded-full bg-primary" /> Incident response playbooks and runbooks</li>
              <li className="flex items-start gap-2"><span className="mt-1 h-2 w-2 rounded-full bg-primary" /> Quarterly cost optimization sessions</li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button asChild variant="ghost" className="px-0">
              <Link to="/contact" className="text-primary">Meet the team →</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Built for modern workflows</CardTitle>
            <CardDescription>Everything connects back to your preferred tools.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Provision infrastructure with Terraform, manage secrets through your SSO provider, and audit activity directly from our API or UI.</p>
            <Separator />
            <div className="flex flex-wrap gap-3 text-xs uppercase tracking-wide text-muted-foreground/80">
              <span className="rounded-full border border-border px-3 py-1">Terraform</span>
              <span className="rounded-full border border-border px-3 py-1">GitOps</span>
              <span className="rounded-full border border-border px-3 py-1">SAML / SSO</span>
              <span className="rounded-full border border-border px-3 py-1">Audit Logs</span>
              <span className="rounded-full border border-border px-3 py-1">Prometheus</span>
            </div>
          </CardContent>
          <CardFooter>
            <Button asChild variant="ghost" className="px-0">
              <Link to="/api-docs" className="text-primary">Explore the API →</Link>
            </Button>
          </CardFooter>
        </Card>
      </section>

      <Card className="mt-20 border-primary/30 bg-primary/5 shadow-sm">
        <CardContent className="flex flex-col items-start justify-between gap-6 px-8 py-10 md:flex-row md:items-center">
          <div className="space-y-3">
            <h2 className="text-3xl font-semibold">Ready to build with {BRAND_NAME}?</h2>
            <p className="max-w-xl text-sm text-muted-foreground md:text-base">
              Spin up your first environment in minutes, invite your team, and start deploying with confidence. We’ll be here if you need us.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link to="/register">Create free account</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/contact">Talk with sales</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
      </div>
    </PublicLayout>
  );
}
