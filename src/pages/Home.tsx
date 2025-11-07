import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  Check,
  Cloud,
  Globe,
  HelpCircle,
  Layers,
  Server,
  ShieldCheck,
  Sparkles,
  Wallet,
  Zap,
  Play,
  Star,
  Users,
  TrendingUp,
  BarChart3,
  Clock,
  Shield
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
    bullets: ['Instant deployment in 45 seconds', 'Full root access', 'Web-based SSH console'],
    gradient: 'from-blue-500/10 to-cyan-500/10',
    iconBg: 'bg-blue-500/10'
  },
  {
    title: 'Application Hosting',
    description:
      'Host web applications and databases with reliable performance. Deploy your applications with full control and monitoring capabilities.',
    icon: Layers,
    bullets: ['Application deployment', 'Database hosting', 'Performance monitoring'],
    gradient: 'from-purple-500/10 to-pink-500/10',
    iconBg: 'bg-purple-500/10'
  },
  {
    title: 'Secure Access',
    description:
      'Access your servers directly through our web interface with secure SSH console. Manage files, run commands, and monitor your applications.',
    icon: Shield,
    bullets: ['Web-based SSH console', 'Secure connections', 'Real-time terminal access'],
    gradient: 'from-green-500/10 to-emerald-500/10',
    iconBg: 'bg-green-500/10'
  },
  {
    title: 'Flexible Billing',
    description:
      'Pay-as-you-go billing with prepaid wallet system. Add funds via PayPal and track your usage with detailed billing reports and invoices.',
    icon: Wallet,
    bullets: ['PayPal integration', 'Hourly billing', 'Detailed usage reports'],
    gradient: 'from-amber-500/10 to-orange-500/10',
    iconBg: 'bg-amber-500/10'
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
  const [mounted, setMounted] = useState(false);
  const [activeServer, setActiveServer] = useState(0);
  const [cpuUsage, setCpuUsage] = useState(68);

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => {
      setCpuUsage(prev => Math.max(20, Math.min(95, prev + (Math.random() - 0.5) * 10)));
      setActiveServer(prev => (prev + 1) % 3);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 text-foreground">
      <MarketingNavbar />

      <main className="flex flex-col gap-32">
        {/* Hero Section with Enhanced Design */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
          <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:60px_60px]" />
          <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
            <div className="grid gap-16 lg:grid-cols-[1.2fr_1fr] lg:gap-20">
              <div className={`space-y-8 ${mounted ? 'animate-in fade-in slide-in-from-left-10 duration-700' : ''}`}>
                <div className="space-y-4">
                  <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                    <Sparkles className="mr-2 h-3.5 w-3.5" />
                    Next-gen cloud infrastructure platform
                  </Badge>
                  <div className="space-y-6">
                    <h1 className="text-4xl font-bold leading-tight sm:text-6xl lg:text-7xl bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                      Deploy VPS Infrastructure
                      <span className="block text-primary">at Lightning Speed</span>
                    </h1>
                    <p className="text-lg text-muted-foreground sm:text-xl leading-relaxed max-w-2xl">
                      Get powerful VPS instances with instant deployment, SSH console access, and flexible billing.
                      Scale your infrastructure on demand with enterprise-grade reliability.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4">
                  <Button asChild size="lg" className="gap-2 bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all duration-200 group">
                    <Link to="/register">
                      <Zap className="h-5 w-5" />
                      Deploy Now
                      <ArrowUpRight className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </Link>
                  </Button>
                  <Button variant="outline" size="lg" asChild className="gap-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-all duration-200">
                    <Link to="/pricing">
                      <BarChart3 className="h-4 w-4" />
                      View Pricing
                    </Link>
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {[
                    { label: 'Avg. deployment', value: '43 seconds', icon: Clock },
                    { label: 'Monthly insights', value: 'Live spend & alerts', icon: TrendingUp },
                    { label: 'SLA backed', value: '99.95% uptime', icon: ShieldCheck },
                    { label: 'Global coverage', value: '18 regions', icon: Globe }
                  ].map((item, index) => (
                    <div
                      key={item.label}
                      className={`rounded-2xl border border-primary/15 bg-background/80 p-4 backdrop-blur hover:border-primary/30 hover:bg-primary/5 transition-all duration-300 hover:scale-105 ${mounted ? 'animate-in fade-in slide-in-from-bottom-5 duration-700' : ''}`}
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <item.icon className="h-4 w-4 text-primary mb-2" />
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`relative ${mounted ? 'animate-in fade-in slide-in-from-right-10 duration-700 delay-200' : ''}`}>
                <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-primary/20 via-background to-background blur-3xl" />
                <div className="relative rounded-3xl border border-primary/20 bg-background/80 p-6 shadow-2xl backdrop-blur-xl">
                  <div className="mb-6 flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
                      Live fleet telemetry
                    </span>
                    <span className="flex items-center gap-2 text-xs text-primary bg-primary/10 px-2 py-1 rounded-full">
                      <Server className="h-3.5 w-3.5" /> 12 active
                    </span>
                  </div>
                  <div className="space-y-4">
                    <Card className={`border-primary/20 bg-primary/5 transition-all duration-500 ${activeServer === 0 ? 'ring-2 ring-primary/30' : ''}`}>
                      <CardContent className="flex flex-col gap-2 p-5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold">Sydney-web-01</span>
                          <span className="text-xs text-emerald-400 flex items-center gap-1">
                            <div className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-pulse" />
                            Running
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-primary/20 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary to-emerald-400 rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${cpuUsage}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">CPU {Math.round(cpuUsage)}% · Network {Math.round(400 + Math.random() * 100)} Mb/s</p>
                      </CardContent>
                    </Card>
                    <Card className={`border border-border/60 bg-background/80 transition-all duration-500 ${activeServer === 1 ? 'ring-2 ring-primary/30' : ''}`}>
                      <CardContent className="flex flex-col gap-2 p-5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold">Frankfurt-app-08</span>
                          <span className="text-xs text-amber-400 flex items-center gap-1">
                            <div className="h-1.5 w-1.5 bg-amber-400 rounded-full animate-pulse" />
                            Scaling
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                          <span>Blueprint: Next.js API</span>
                          <span>Backups: Enabled</span>
                          <span>Region: eu-central</span>
                          <span>Last deploy: 7m ago</span>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className={`border border-border/60 bg-background/80 transition-all duration-500 ${activeServer === 2 ? 'ring-2 ring-primary/30' : ''}`}>
                      <CardContent className="flex flex-col gap-3 p-5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold">Spend projection</span>
                          <span className="text-xs text-emerald-400 flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            On target
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                          <span>Month to date</span>
                          <span className="text-right font-semibold text-foreground">$1,824</span>
                          <span>Forecast</span>
                          <span className="text-right text-emerald-400">$2,410</span>
                          <span>Alerts</span>
                          <span className="text-right text-muted-foreground">None</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Enhanced Features Section */}
        <section id="platform" className="relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
          <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
            <div className="text-center space-y-6">
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                <Star className="mr-2 h-3.5 w-3.5" />
                Why choose {BRAND_NAME}
              </Badge>
              <h2 className="text-3xl font-bold sm:text-5xl bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                A platform engineered for modern infrastructure
              </h2>
              <p className="mx-auto max-w-3xl text-lg text-muted-foreground leading-relaxed">
                Every screen embraces modern design principles for clarity, while intelligent automation handles the heavy lifting under the hood.
              </p>
            </div>
            <div className="mt-20 grid gap-8 md:grid-cols-2">
              {featureHighlights.map((feature, index) => (
                <Card
                  key={feature.title}
                  className={`group relative overflow-hidden border-0 bg-gradient-to-br ${feature.gradient} backdrop-blur transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl ${mounted ? 'animate-in fade-in slide-in-from-bottom-10 duration-700' : ''}`}
                  style={{ animationDelay: `${index * 150}ms` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <CardContent className="relative space-y-6 p-8">
                    <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${feature.iconBg} text-primary transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg`}>
                      <feature.icon className="h-6 w-6" />
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                        {feature.title}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                    <ul className="space-y-3">
                      {feature.bullets.map((bullet, bulletIndex) => (
                        <li key={bullet} className="flex items-center gap-3 text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                            <Check className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

      {/* Enhanced Capabilities Section */}
        <section id="capabilities" className="relative bg-gradient-to-br from-muted/10 to-muted/5 py-32">
          <div className="absolute inset-0 bg-grid-white/[0.01] bg-[size:80px_80px]" />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-16 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-8">
                <div className="space-y-4">
                  <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-colors w-fit">
                    <ShieldCheck className="mr-2 h-3.5 w-3.5" />
                    Enterprise-grade infrastructure
                  </Badge>
                  <h2 className="text-3xl font-bold sm:text-5xl bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                    Reliable, scalable, and secure cloud hosting
                  </h2>
                  <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
                    Deploy your applications on high-performance infrastructure with 99.9% uptime, automated backups, and 24/7 monitoring.
                  </p>
                </div>
                <div className="grid gap-6 sm:grid-cols-2">
                  {[
                    {
                      title: 'High performance',
                      copy: 'NVMe SSD storage, dedicated CPU cores, and high-speed networking for optimal performance.',
                      icon: Zap,
                      gradient: 'from-blue-500/10 to-cyan-500/10'
                    },
                    {
                      title: 'Global availability',
                      copy: 'Deploy in multiple regions worldwide for low latency and high availability.',
                      icon: Globe,
                      gradient: 'from-green-500/10 to-emerald-500/10'
                    },
                    {
                      title: 'Enterprise security',
                      copy: 'DDoS protection, encrypted storage, and secure network isolation by default.',
                      icon: Shield,
                      gradient: 'from-purple-500/10 to-pink-500/10'
                    },
                    {
                      title: 'Easy management',
                      copy: 'Intuitive control panel with one-click deployments and automated scaling.',
                      icon: BarChart3,
                      gradient: 'from-amber-500/10 to-orange-500/10'
                    }
                  ].map((item, index) => (
                    <Card key={item.title} className={`group border-0 bg-gradient-to-br ${item.gradient} backdrop-blur transition-all duration-300 hover:scale-[1.02] hover:shadow-xl ${mounted ? 'animate-in fade-in slide-in-from-left-5 duration-700' : ''}`} style={{ animationDelay: `${index * 100}ms` }}>
                      <CardContent className="space-y-4 p-6">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                            <item.icon className="h-5 w-5" />
                          </div>
                          <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                            {item.title}
                          </h3>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{item.copy}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
              <div className={`relative ${mounted ? 'animate-in fade-in slide-in-from-right-10 duration-700 delay-200' : ''}`}>
                <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-primary/10 via-background to-background blur-2xl" />
                <div className="relative rounded-3xl border border-primary/20 bg-background/90 p-8 shadow-2xl backdrop-blur-xl">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="h-8 w-8 bg-primary/10 rounded-xl flex items-center justify-center">
                      <Activity className="h-4 w-4 text-primary" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground">Solutions in motion</h3>
                  </div>
                  <div className="space-y-6">
                    {solutionTiles.map((solution, index) => (
                      <div key={solution.title} className={`group rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/5 to-transparent p-6 transition-all duration-300 hover:border-primary/30 hover:shadow-lg ${mounted ? 'animate-in fade-in slide-in-from-bottom-5 duration-700' : ''}`} style={{ animationDelay: `${index * 150}ms` }}>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:scale-110 group-hover:shadow-lg transition-all duration-300">
                            <solution.icon className="h-6 w-6" />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                              {solution.title}
                            </h4>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                              {solution.blurb}
                            </p>
                          </div>
                        </div>
                        <div className="mt-6 flex items-center justify-between rounded-xl border border-primary/20 bg-background/80 p-4 text-xs">
                          <span className="uppercase tracking-wide text-muted-foreground font-medium">
                            {solution.statLabel}
                          </span>
                          <span className="text-sm font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">
                            {solution.statValue}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Enhanced Testimonials Section */}
        <section className="relative py-32" id="solutions">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center space-y-6">
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                <Users className="mr-2 h-3.5 w-3.5" />
                Teams that switched
              </Badge>
              <h2 className="text-3xl font-bold sm:text-5xl bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                DevOps teams, platform engineers, and startups love the simplicity
              </h2>
              <p className="mx-auto max-w-3xl text-lg text-muted-foreground leading-relaxed">
                {BRAND_NAME} turns complex cloud management into a streamlined experience that teams actually enjoy using.
              </p>
            </div>
            <div className="mt-20 grid gap-8 md:grid-cols-3">
              {testimonials.map((testimonial, index) => (
                <Card key={testimonial.name} className={`group relative border-0 bg-gradient-to-br from-background via-background to-primary/5 backdrop-blur transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl ${mounted ? 'animate-in fade-in slide-in-from-bottom-10 duration-700' : ''}`} style={{ animationDelay: `${index * 150}ms` }}>
                  <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <CardContent className="relative space-y-6 p-8">
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 text-primary fill-primary" />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed italic">
                      "{testimonial.quote}"
                    </p>
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">
                          {testimonial.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{testimonial.name}</p>
                        <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Enhanced FAQ Section */}
        <section className="relative bg-gradient-to-br from-muted/10 to-muted/5 py-32">
          <div className="absolute inset-0 bg-grid-white/[0.01] bg-[size:80px_80px]" />
          <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="text-center space-y-6">
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                <HelpCircle className="mr-2 h-3.5 w-3.5" />
                FAQs
              </Badge>
              <h2 className="text-3xl font-bold sm:text-5xl bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                Answers before you ask
              </h2>
              <p className="mx-auto max-w-3xl text-lg text-muted-foreground leading-relaxed">
                Everything you need to know to get started with {BRAND_NAME} cloud hosting platform.
              </p>
            </div>
            <Accordion
              type="single"
              collapsible
              value={openFaq ?? undefined}
              onValueChange={(value) => setOpenFaq(value || null)}
              className="mt-16 space-y-4"
            >
              {faqs.map((faq, index) => (
                <AccordionItem
                  key={faq.question}
                  value={faq.question}
                  className={`group overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-background via-background to-primary/5 backdrop-blur transition-all duration-300 hover:border-primary/30 hover:shadow-lg ${mounted ? 'animate-in fade-in slide-in-from-bottom-10 duration-700' : ''}`}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <AccordionTrigger className="px-8 py-6 text-left text-base font-semibold hover:text-primary transition-colors group">
                    <span className="flex items-center gap-3">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <span className="text-xs font-bold text-primary">{index + 1}</span>
                      </div>
                      {faq.question}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-8 pb-6 text-sm text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

      {/* Enhanced CTA Section */}
        <section className="relative overflow-hidden py-32">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-background" />
          <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:60px_60px]" />
          <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-8 px-4 py-24 text-center sm:px-6">
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
              <Zap className="mr-2 h-3.5 w-3.5" />
              Ready when you are
            </Badge>
            <h2 className="text-3xl font-bold sm:text-5xl bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
              Create an account, add funds, deploy your infrastructure
            </h2>
            <p className="max-w-3xl text-lg text-muted-foreground leading-relaxed">
              Your first deployment takes minutes. Add funds to your wallet and start deploying VPS instances immediately with our intuitive platform.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" asChild className="bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all duration-200 group">
                <Link to="/register" className="gap-2">
                  <Sparkles className="h-5 w-5" />
                  Get Started
                  <ArrowUpRight className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 gap-2">
                <Link to="/pricing">
                  <BarChart3 className="h-4 w-4" />
                  View Pricing
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 gap-2">
                <Link to="/contact">
                  <HelpCircle className="h-4 w-4" />
                  Get Support
                </Link>
              </Button>
            </div>
            <div className="mt-8 flex items-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span>30-day money back guarantee</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <span>Setup in minutes</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span>24/7 support</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
