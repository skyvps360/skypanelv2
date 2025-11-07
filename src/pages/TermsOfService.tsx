import { Link } from "react-router-dom";
import { FileText, ShieldCheck } from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { BRAND_NAME } from "../lib/brand";
import MarketingNavbar from "@/components/MarketingNavbar";
import MarketingFooter from "@/components/MarketingFooter";

const lastUpdated = "October 20, 2025";

const sections = [
  {
    value: "acceptance",
    title: "1. Acceptance of Terms",
    content: (
      <>
        <p>
          By accessing and using {BRAND_NAME} ("Service"), you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to abide by these Terms, do not use the Service.
        </p>
        <p>
          These Terms of Service ("Terms") constitute a legally binding agreement between you and {BRAND_NAME} regarding your use of our cloud infrastructure platform and related services.
        </p>
      </>
    ),
  },
  {
    value: "service",
    title: "2. Description of Service",
    content: (
      <>
        <p>{BRAND_NAME} provides cloud infrastructure services including but not limited to:</p>
        <ul className="space-y-2 pl-6">
          <li>Virtual Private Server (VPS) hosting and lifecycle management</li>
          <li>Network configuration, IP address management, and DNS tooling</li>
          <li>Automated backups, snapshots, and disaster recovery workflows</li>
          <li>Observability dashboards, usage analytics, and audit trails</li>
          <li>REST API and CLI access for programmatic resource management</li>
        </ul>
        <p>We may modify, suspend, or discontinue any aspect of the Service at any time with or without notice.</p>
      </>
    ),
  },
  {
    value: "accounts",
    title: "3. Account Registration and Security",
    content: (
      <>
        <p><strong>3.1 Account creation:</strong> You must provide accurate, complete, and current information when registering. You are responsible for safeguarding your credentials.</p>
        <p><strong>3.2 Account security:</strong> You are accountable for all activity under your account. Notify us immediately of unauthorized use or suspected compromise.</p>
        <p><strong>3.3 Eligibility:</strong> You must be at least 18 years old (or the age of majority in your jurisdiction) to use the Service.</p>
      </>
    ),
  },
  {
    value: "billing",
    title: "4. Billing and Payments",
    content: (
      <>
        <p><strong>4.1 Pricing:</strong> All fees are listed in USD unless otherwise stated. Resources are billed hourly based on active usage.</p>
        <p><strong>4.2 Wallet balance:</strong> You must maintain a positive prepaid wallet. Services may be suspended if the balance reaches zero.</p>
        <p><strong>4.3 Payment methods:</strong> We accept transactions via PayPal. Additional processing fees may apply depending on your bank or provider.</p>
        <p><strong>4.4 Refunds:</strong> Refunds may be issued on a prorated basis for unused services at our discretion. No refunds are provided for partially consumed billing periods.</p>
        <p><strong>4.5 Price changes:</strong> We may adjust pricing with 30 days notice. Continued use after notice constitutes acceptance of the new pricing.</p>
      </>
    ),
  },
  {
    value: "acceptable-use",
    title: "5. Acceptable Use Policy",
    content: (
      <>
        <p>You agree not to use the Service to:</p>
        <ul className="space-y-2 pl-6">
          <li>Violate laws, regulations, or third-party rights</li>
          <li>Distribute malware, ransomware, or other harmful code</li>
          <li>Engage in fraudulent, deceptive, or illegal activity</li>
          <li>Launch DDoS attacks or abuse network resources</li>
          <li>Mine cryptocurrency without written approval</li>
          <li>Send spam or unsolicited bulk communications</li>
          <li>Host or distribute infringing or pirated content</li>
          <li>Attempt unauthorized access to other accounts or systems</li>
          <li>Interfere with or disrupt the integrity of the Service</li>
        </ul>
        <p>Violations may result in immediate suspension or termination without refund.</p>
      </>
    ),
  },
  {
    value: "sla",
    title: "6. Service Level Agreement (SLA)",
    content: (
      <>
        <p><strong>6.1 Uptime guarantee:</strong> We target 99.9% monthly uptime for core services, excluding scheduled maintenance.</p>
        <p><strong>6.2 Maintenance windows:</strong> We provide at least 48 hours notice before planned maintenance that may impact availability.</p>
        <p><strong>6.3 SLA credits:</strong> If uptime falls below target, you may request service credits as described in our SLA documentation.</p>
      </>
    ),
  },
  {
    value: "privacy",
    title: "7. Data and Privacy",
    content: (
      <>
        <p><strong>7.1 Ownership:</strong> You retain all rights to data stored on the Service. We do not claim ownership over your content.</p>
        <p><strong>7.2 Security:</strong> We implement industry-standard controls, but no transmission method is 100% secure. You acknowledge residual risk.</p>
        <p><strong>7.3 Backups:</strong> While we offer backup options, you are ultimately responsible for maintaining independent backups.</p>
        <p><strong>7.4 Privacy policy:</strong> Personal data processing is governed by our <Link to="/privacy" className="text-primary underline">Privacy Policy</Link>, incorporated by reference.</p>
      </>
    ),
  },
  {
    value: "ip",
    title: "8. Intellectual Property",
    content: (
      <>
        <p>
          The Service, its original content, features, and functionality are owned by {BRAND_NAME} and protected by applicable intellectual property laws. You may not copy, modify, or redistribute platform assets without written permission.
        </p>
      </>
    ),
  },
  {
    value: "liability",
    title: "9. Limitation of Liability",
    content: (
      <>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, {BRAND_NAME.toUpperCase()} SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFITS, DATA, OR GOODWILL.
        </p>
        <p>
          Our aggregate liability for claims arising from the Service shall not exceed the fees paid by you in the twelve (12) months preceding the claim.
        </p>
      </>
    ),
  },
  {
    value: "termination",
    title: "10. Termination",
    content: (
      <>
        <p><strong>10.1 By you:</strong> You may terminate your account at any time by contacting support. Eligible prepaid balances may be refunded on a prorated basis.</p>
        <p><strong>10.2 By us:</strong> We may suspend or terminate accounts for policy violations, fraudulent activity, or other reasons at our discretion.</p>
        <p><strong>10.3 After termination:</strong> Access to the Service ceases immediately. We delete customer data within 30 days unless retention is required by law.</p>
      </>
    ),
  },
  {
    value: "changes",
    title: "11. Changes to Terms",
    content: (
      <>
        <p>
          We may modify these Terms from time to time. Significant changes will be communicated via email or in-app notification. Continued use after updates constitutes acceptance of the revised Terms.
        </p>
      </>
    ),
  },
  {
    value: "law",
    title: "12. Governing Law",
    content: (
      <>
        <p>
          These Terms are governed by the laws of the State of California, United States, without regard to conflict-of-law principles. Disputes shall be resolved in the state or federal courts located in San Francisco County, California.
        </p>
      </>
    ),
  },
  {
    value: "contact",
    title: "13. Contact Information",
    content: (
      <>
        <p>For questions about these Terms, contact our legal team:</p>
        <p>
          Email: legal@{BRAND_NAME.toLowerCase()}.com<br />
          Address: 123 Cloud Street, Tech District, San Francisco, CA 94105
        </p>
      </>
    ),
  },
];

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNavbar />
      <div className="container mx-auto max-w-6xl px-4 py-12">
      <div className="grid gap-10 lg:grid-cols-[2fr,1fr]">
        <div>
          <div className="space-y-4">
            <Badge variant="outline" className="uppercase tracking-wide">Legal</Badge>
            <h1 className="text-3xl font-semibold md:text-4xl">Terms of Service</h1>
            <p className="text-sm text-muted-foreground md:text-base">
              Last updated {lastUpdated}. These Terms describe your rights and responsibilities when using {BRAND_NAME}. If you have questions, please reach out at any time.
            </p>
          </div>

          <Card className="mt-10 shadow-sm">
            <CardHeader>
              <CardTitle>Agreement overview</CardTitle>
              <CardDescription>Review the sections below or download a copy for your records.</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" defaultValue={[sections[0].value]} className="space-y-4">
                {sections.map((section) => (
                  <AccordionItem key={section.value} id={section.value} value={section.value} className="rounded-lg border border-border">
                    <AccordionTrigger className="px-4 py-3 text-left text-base font-semibold">
                      {section.title}
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-5 text-sm leading-6 text-muted-foreground">
                      {section.content}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          <Card className="mt-8 border-primary/30 bg-primary/5">
            <CardContent className="flex flex-col gap-4 px-6 py-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Need a signed copy or have compliance questions?</h2>
                <p className="text-sm text-muted-foreground">Our legal and security teams are happy to coordinate NDAs, DPAs, or custom terms for enterprise engagements.</p>
              </div>
              <Button asChild size="lg">
                <Link to="/contact">Contact legal</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Quick reference</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <Link to="/privacy" className="font-medium text-primary">Privacy policy</Link>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <a href={`mailto:legal@${BRAND_NAME.toLowerCase()}.com`} className="font-medium text-primary">legal@{BRAND_NAME.toLowerCase()}.com</a>
              </div>
              <Separator />
              <p>Looking for the previous version of these Terms? Email us and we&apos;ll send a copy.</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Table of contents</CardTitle>
              <CardDescription>Jump to a specific section.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <ol className="space-y-3 text-sm">
                  {sections.map((section) => (
                    <li key={section.value}>
                      <a href={`#${section.value}`} className="text-muted-foreground hover:text-primary">
                        {section.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </ScrollArea>
            </CardContent>
          </Card>
        </aside>
      </div>
      <MarketingFooter />
    </div>
  </div>
  );
}
