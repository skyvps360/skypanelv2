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
import MarketingFooter from '@/components/MarketingFooter';

const featureHighlights = [
  {
    title: 'High-Performance VPS',
    description:
      'Deploy powerful VPS instances with instant provisioning and guaranteed resources. Get root access, SSH console, and full control over your server environment.',
    icon: Server,
    bullets: ['Instant deployment in 45 seconds', 'Full root access', 'Web-based SSH console']
  },
  {
    title: 'Application Hosting',
    description:
      'Host web applications and databases with reliable performance. Deploy your applications with full control and monitoring capabilities.',
    icon: Layers,
    bullets: ['Application deployment', 'Database hosting', 'Performance monitoring']
  },
  {
    title: 'Secure Access',
    description:
      'Access your servers directly through our web interface with secure SSH console. Manage files, run commands, and monitor your applications.',
    icon: Globe,
    bullets: ['Web-based SSH console', 'Secure connections', 'Real-time terminal access']
  },
  {
    title: 'Flexible Billing',
    description:
      'Pay-as-you-go billing with prepaid wallet system. Add funds via PayPal and track your usage with detailed billing reports and invoices.',
    icon: Wallet,
    bullets: ['PayPal integration', 'Hourly billing', 'Detailed usage reports']
  }
];

const solutionTiles = [
  {
    title: 'Deploy VPS Infrastructure',
    blurb: 'Provision VPS instances across multiple cloud providers with unified management. Get instant deployment and SSH console access.',
    statLabel: 'Average provision time',
    statValue: '43s',
    icon: Server
  },
  {
    title: 'Application Hosting',
    blurb: 'Host web applications and databases with reliable performance. Deploy your applications with full control and monitoring.',
    statLabel: 'Supported platforms',
    statValue: '20+',
    icon: Layers
  },
  {
    title: 'Cost Management',
    blurb: 'PayPal wallet integration with hourly usage tracking. Monitor your infrastructure spending with detailed billing and automated invoicing.',
    statLabel: 'Billing accuracy',
    statValue: '99.9%',
    icon: Activity
  }
];

const testimonials = [
  {
    quote:
      'The VPS instances are incredibly fast and reliable. SSH console access through the web makes server management so much easier.',
    name: 'Marcus Chen',
    role: 'DevOps Engineer • TechCorp'
  },
  {
    quote:
      'Great pricing with the prepaid wallet system. The hourly billing is transparent and the performance has been excellent for our applications.',
    name: 'Sarah Williams',
    role: 'Infrastructure Lead • StartupXYZ'
  },
  {
    quote:
      'Deploying our applications was incredibly simple. The platform got us up and running in minutes with excellent performance.',
    name: 'David Rodriguez',
    role: 'CTO • DevTeam Inc'
  }
];

const faqs = [
  {
    question: 'How fast can I provision infrastructure?',
    answer:
      'VPS instances typically deploy in 45-60 seconds. Our platform pre-validates configurations to ensure smooth deployment every time.'
  },
  {
    question: 'Which payment methods are supported?',
    answer:
      'Wallets accept PayPal-backed cards today with ACH in beta. Every top-up synchronizes to the ledger instantly and exposes webhook events.'
  },
  {
    question: 'Can I manage everything from one dashboard?',
    answer:
      'Yes. You can create, resize, backup, rebuild, and delete VPS instances from our unified control panel. Real-time status updates keep you informed.'
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
        <section className="rounded-3xl border border-border bg-card p-8 md:p-10">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
            <div className="space-y-8">
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                Cloud infrastructure platform
              </Badge>
              <div className="space-y-6">
                <h1 className="text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
                  Deploy VPS Infrastructure
                </h1>
                <p className="text-lg text-muted-foreground sm:text-xl">
                  Get powerful VPS instances with instant deployment, SSH console access, and flexible billing. Scale your infrastructure on demand.
                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                <Button asChild size="lg" className="gap-2">
                  <Link to="/register">
                    Deploy Now
                    <Sparkles className="h-5 w-5" />
                  </Link>
                </Button>
                <Button variant="outline" size="lg" asChild className="gap-2">
                  <Link to="/pricing">
                    View Pricing
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
              Why choose {BRAND_NAME}
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
                className="relative overflow-hidden border border-border/60 bg-card backdrop-blur transition hover:border-primary/50"
              >
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
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
                  Enterprise-grade infrastructure
                </Badge>
                <h2 className="text-3xl font-semibold sm:text-4xl">
                  Reliable, scalable, and secure cloud hosting.
                </h2>
                <p className="text-lg text-muted-foreground">
                  Deploy your applications on high-performance infrastructure with 99.9% uptime, automated backups, and 24/7 monitoring.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    {
                      title: 'High performance',
                      copy: 'NVMe SSD storage, dedicated CPU cores, and high-speed networking for optimal performance.'
                    },
                    {
                      title: 'Global availability',
                      copy: 'Deploy in multiple regions worldwide for low latency and high availability.'
                    },
                    {
                      title: 'Enterprise security',
                      copy: 'DDoS protection, encrypted storage, and secure network isolation by default.'
                    },
                    {
                      title: 'Easy management',
                      copy: 'Intuitive control panel with one-click deployments and automated scaling.'
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
              DevOps teams, platform engineers, and startups love the simplicity.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              {BRAND_NAME} turns complex cloud management into a streamlined experience.
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
                Everything you need to know to get started with {BRAND_NAME} cloud hosting.
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
            <h2 className="text-3xl font-semibold sm:text-4xl">Create an account, add funds, deploy your infrastructure.</h2>
            <p className="max-w-2xl text-lg text-muted-foreground">
              Your first deployment takes minutes. Add funds to your wallet and start deploying VPS instances immediately.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button size="lg" asChild>
                <Link to="/register">Get Started</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/pricing">View Pricing</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/contact">Get Support</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
