import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  Check,
  Cloud,
  Globe,
  Layers,
  Server,
  ShieldCheck,
  Sparkles,
  Wallet,
  Zap
} from 'lucide-react';
import { BRAND_NAME } from '../lib/brand';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';
import MarketingNavbar from '@/components/MarketingNavbar';

const featureHighlights = [
  {
    title: 'Unified control plane',
    description:
      'Aggregate Linode, DigitalOcean, and bare-metal workloads with consistent automation and audit-ready activity logs.',
    icon: Globe,
    bullets: ['Cross-provider orchestration', 'Region-aware scheduling', 'Real-time event streaming'],
    accent: 'from-sky-500/20 via-transparent to-transparent'
  },
  {
    title: 'Velocity at scale',
    description:
      'Deploy optimized VPS blueprints in under 45 seconds with guardrails for SSH keys, networking, and billing spend alerts.',
    icon: Zap,
    bullets: ['Blueprint library', 'Policy-backed provisioning', 'Live health telemetry'],
    accent: 'from-emerald-500/20 via-transparent to-transparent'
  },
  {
    title: 'Enterprise-grade safety',
    description:
      'SOC-ready logging, encrypted provider credentials, and configurable rate limiting keep customer data protected by default.',
    icon: ShieldCheck,
    bullets: ['Secrets vaulted with AES-256', 'Rate-limit overrides per tenant', 'Granular role-based access'],
    accent: 'from-purple-500/20 via-transparent to-transparent'
  },
  {
    title: 'Finance-ready billing',
    description:
      'Wallet-based billing with hourly reconciliation, cost trend projections, and actionable alerts before spend spikes hit.',
    icon: Wallet,
    bullets: ['Hourly usage ledger', 'Automated invoices', 'Wallet webhooks'],
    accent: 'from-amber-500/20 via-transparent to-transparent'
  }
];

const solutionTiles = [
  {
    title: 'Deploy modern workloads',
    blurb: 'Opinionated defaults for Node, Laravel, and container-ready stacks mean teams ship in minutes, not days.',
    statLabel: 'Average deploy time',
    statValue: '43s',
    icon: Layers
  },
  {
    title: 'Operate globally',
    blurb: 'Pick from 18+ regions with intelligent fallbacks, DNS helpers, and automatic reverse DNS management.',
    statLabel: 'Regions available',
    statValue: '18',
    icon: Globe
  },
  {
    title: 'Stay in control',
    blurb: 'Live activity feeds, SLA dashboards, and AI-delivered incident summaries keep teams ahead of customer pings.',
    statLabel: 'Incidents auto-triaged',
    statValue: '92%',
    icon: Activity
  }
];

const testimonials = [
  {
    quote:
      'SkyPanel compressed our deployment pipeline into a single dashboard. We now iterate daily without touching provider portals.',
    name: 'Amelia Stone',
    role: 'Director of Platform • NovaOps'
  },
  {
    quote:
      'Hourly billing visibility and wallet thresholds saved our launch budget. Finance finally gets proactive alerts.',
    name: 'Jordan Park',
    role: 'Head of Finance • Lumen Studio'
  },
  {
    quote:
      'The SSE activity stream means our on-call team is notified before customers ever notice. It feels like cheating.',
    name: 'Priya Narayanan',
    role: 'Site Reliability Lead • Driftwave'
  }
];

const faqs = [
  {
    question: 'How fast can I provision infrastructure?',
    answer:
      'VPS workloads typically land in 45-60 seconds. SkyPanel pre-validates SSH keys, regions, and plans before the provider call so you are never surprised at the end.'
  },
  {
    question: 'Which payment methods are supported?',
    answer:
      'Wallets accept PayPal-backed cards today with ACH in beta. Every top-up synchronizes to the ledger instantly and exposes webhook events.'
  },
  {
    question: 'Does SkyPanel replace provider dashboards?',
    answer:
      'Yes. You can create, resize, backup, rebuild, and delete VPS instances across connected providers without leaving SkyPanel. Provider metadata is synced so you always see authoritative status.'
  },
  {
    question: 'Is there a free tier?',
    answer:
      'The platform itself is free. You only pay for provider usage. We include generous monitoring and notifications so you can build without friction.'
  }
];

export default function Home() {
  const [openFaq, setOpenFaq] = useState<string | null>(faqs.length ? faqs[0].question : null);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingNavbar />

      <main className="flex flex-col gap-24">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-20 bg-gradient-to-br from-primary/20 via-background to-background" />
          <div className="absolute -top-36 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/30 blur-3xl" />
          <div className="absolute bottom-0 left-0 right-0 -z-10 h-48 bg-gradient-to-t from-background to-transparent" />

          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
            <div className="space-y-8">
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                Built for infrastructure teams
              </Badge>
              <div className="space-y-6">
                <h1 className="text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
                  Deploy jaw-dropping infrastructure with composable controls.
                </h1>
                <p className="text-lg text-muted-foreground sm:text-xl">
                  SkyPanel unifies your multi-provider VPS footprint into a single, beautiful command center. Provision, observe, and bill with clarity—no more tab sprawl.
                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                <Button asChild size="lg" className="gap-2">
                  <Link to="/register">
                    Start for free
                    <Sparkles className="h-5 w-5" />
                  </Link>
                </Button>
                <Button variant="outline" size="lg" asChild className="gap-2">
                  <Link to="/demo">
                    View interactive demo
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4 text-left text-sm sm:grid-cols-4">
                {[
                  { label: 'Avg. deployment', value: '43 seconds' },
                  { label: 'Monthly insights', value: 'Live spend & alerts' },
                  { label: 'SLA backed', value: '99.95% uptime' },
                  { label: 'Global coverage', value: '18 regions' }
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-primary/15 bg-background/80 p-4 backdrop-blur">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-primary/15 via-background to-background blur-2xl" />
              <div className="rounded-3xl border border-primary/15 bg-background/70 p-6 shadow-xl backdrop-blur">
                <div className="mb-6 flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Live fleet telemetry</span>
                  <span className="flex items-center gap-2 text-xs text-primary">
                    <Server className="h-3.5 w-3.5" /> 12 active
                  </span>
                </div>
                <div className="grid gap-4">
                  <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="flex flex-col gap-2 p-5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold">Sydney-web-01</span>
                        <span className="text-xs text-emerald-400">Running</span>
                      </div>
                      <div className="h-2 rounded-full bg-primary/20">
                        <div className="h-full w-[68%] rounded-full bg-primary" />
                      </div>
                      <p className="text-xs text-muted-foreground">CPU 68% · Network 423 Mb/s</p>
                    </CardContent>
                  </Card>
                  <Card className="border border-border/60 bg-background/80">
                    <CardContent className="flex flex-col gap-2 p-5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold">Frankfurt-app-08</span>
                        <span className="text-xs text-amber-400">Scaling</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                        <span>Blueprint: Next.js API</span>
                        <span>Backups: Enabled</span>
                        <span>Region: eu-central</span>
                        <span>Last deploy: 7m</span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border border-border/60 bg-background/80">
                    <CardContent className="flex flex-col gap-3 p-5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold">Spend projection</span>
                        <span className="text-xs text-emerald-400">On target</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                        <span>Month to date</span>
                        <span className="text-right font-semibold text-foreground">$1,824</span>
                        <span>Forecast</span>
                        <span className="text-right text-emerald-400">$2,410</span>
                        <span>Alerts</span>
                        <span className="text-right">None</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="platform" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <Badge variant="outline" className="mb-4 border-primary/40 bg-primary/10 text-primary">
              Why teams choose SkyPanel
            </Badge>
            <h2 className="text-3xl font-semibold sm:text-4xl">
              A platform engineered for modern infrastructure.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Every screen embraces the shadcn design system for clarity, while automation handles the heavy lifting under the hood.
            </p>
          </div>
          <div className="mt-16 grid gap-6 md:grid-cols-2">
            {featureHighlights.map((feature) => (
              <Card
                key={feature.title}
                className="relative overflow-hidden border border-border/60 bg-background/70 backdrop-blur transition hover:border-primary/50"
              >
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${feature.accent}`} />
                <CardContent className="relative space-y-4 p-8">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <feature.icon className="h-5 w-5" />
                  </span>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {feature.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-primary" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="capabilities" className="bg-muted/20 py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-6">
                <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                  Built for velocity
                </Badge>
                <h2 className="text-3xl font-semibold sm:text-4xl">
                  Automation, observability, and billing—elevated.
                </h2>
                <p className="text-lg text-muted-foreground">
                  SkyPanel ships with live SSE notifications, synthetics-ready health checks, and a ledger-aware billing engine. Teams get a beautifully opinionated UI layered on top of formidable automation.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    {
                      title: 'Telemetry first',
                      copy: 'Every provisioned VPS streams metrics to the dashboard within seconds.'
                    },
                    {
                      title: 'Pluggable providers',
                      copy: 'Connect Linode, DigitalOcean, and bespoke providers with the same workflow.'
                    },
                    {
                      title: 'Security by default',
                      copy: 'Encrypted credentials, RBAC, and rate limiting help you pass audits with ease.'
                    },
                    {
                      title: 'Design that inspires',
                      copy: 'Crafted with shadcn primitives so every screen feels polished and familiar.'
                    }
                  ].map((item) => (
                    <Card key={item.title} className="border-border/60 bg-background/80">
                      <CardContent className="space-y-2 p-5">
                        <h3 className="text-base font-semibold">{item.title}</h3>
                        <p className="text-sm text-muted-foreground">{item.copy}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
              <div className="rounded-3xl border border-border/60 bg-background/90 p-8 shadow-xl backdrop-blur">
                <h3 className="text-lg font-semibold">Solutions in motion</h3>
                <div className="mt-6 space-y-6">
                  {solutionTiles.map((solution) => (
                    <div key={solution.title} className="rounded-2xl border border-primary/10 bg-primary/5 p-6">
                      <div className="flex items-center gap-3 text-sm">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <solution.icon className="h-5 w-5" />
                        </span>
                        <div>
                          <h4 className="text-base font-semibold">{solution.title}</h4>
                          <p className="text-xs text-muted-foreground">{solution.blurb}</p>
                        </div>
                      </div>
                      <div className="mt-6 flex items-center justify-between rounded-xl border border-primary/20 bg-background/80 p-4 text-xs text-muted-foreground">
                        <span className="uppercase tracking-wide">{solution.statLabel}</span>
                        <span className="text-sm font-semibold text-foreground">{solution.statValue}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" id="solutions">
          <div className="text-center">
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
              Teams that switched
            </Badge>
            <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">
              Revenue teams, platform teams, and startups love the polish.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              SkyPanel turns infrastructure into an experience your customers notice.
            </p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {testimonials.map((testimonial) => (
              <Card key={testimonial.name} className="border-border/60 bg-background/85 shadow-lg">
                <CardContent className="space-y-4 p-6">
                  <p className="text-sm text-muted-foreground">“{testimonial.quote}”</p>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{testimonial.name}</p>
                    <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="bg-muted/10 py-24">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                FAQs
              </Badge>
              <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">Answers before you ask.</h2>
              <p className="mx-auto mt-3 max-w-2xl text-lg text-muted-foreground">
                Everything you need to know to feel confident migrating your workloads to SkyPanel.
              </p>
            </div>
            <Accordion
              type="single"
              collapsible
              value={openFaq ?? undefined}
              onValueChange={(value) => setOpenFaq(value || null)}
              className="mt-12 space-y-4"
            >
              {faqs.map((faq) => (
                <AccordionItem key={faq.question} value={faq.question} className="overflow-hidden rounded-2xl border border-border/60 bg-background">
                  <AccordionTrigger className="px-6 py-4 text-left text-base font-semibold hover:text-primary">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-6 text-sm text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/25 via-primary/5 to-background" />
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-24 text-center sm:px-6">
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
              Ready when you are
            </Badge>
            <h2 className="text-3xl font-semibold sm:text-4xl">Create an account, connect a provider, ship your next release.</h2>
            <p className="max-w-2xl text-lg text-muted-foreground">
              Your first deployment takes minutes. We include detailed migration guides, observability instrumentation, and fast support when you need it.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button size="lg" asChild>
                <Link to="/register">Launch SkyPanel</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/contact">Talk to sales</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 bg-background/95">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 text-sm text-muted-foreground sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 text-foreground">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Cloud className="h-4 w-4" />
            </div>
            <span className="font-semibold">{BRAND_NAME}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link to="/privacy" className="hover:text-primary">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-primary">
              Terms
            </Link>
            <Link to="/status" className="hover:text-primary">
              Status
            </Link>
            <Link to="/contact" className="hover:text-primary">
              Support
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {BRAND_NAME}. Purpose-built for teams who demand elegance and power.
          </p>
        </div>
      </footer>
    </div>
  );
}
