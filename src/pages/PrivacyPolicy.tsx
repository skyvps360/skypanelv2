import { Link } from "react-router-dom";
import { Lock, Shield, ShieldAlert } from "lucide-react";

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
    value: "introduction",
    title: "1. Introduction",
    content: (
      <>
        <p>
          {BRAND_NAME} ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard information when you use our cloud infrastructure platform.
        </p>
        <p>
          By accessing the Service, you consent to the practices described here. If you disagree with any part of this policy, please discontinue use of the Service.
        </p>
      </>
    ),
  },
  {
    value: "collection",
    title: "2. Information We Collect",
    content: (
      <>
        <p><strong>2.1 Personal information:</strong> When you create an account we collect details such as your name, email address, billing information (processed through PayPal), and optional organization data.</p>
        <p><strong>2.2 Technical information:</strong> We gather IP address, device details, operating system, browser type, and logs such as access times and pages viewed. Cookies and similar technologies help us personalize sessions.</p>
        <p><strong>2.3 Usage information:</strong> Resource metrics (CPU, memory, bandwidth), API requests, feature usage patterns, and support interactions help us improve the platform.</p>
        <p><strong>2.4 Customer data:</strong> Content you store or process using the Service remains yours. We access it only to provide the Service or comply with legal obligations.</p>
      </>
    ),
  },
  {
    value: "usage",
    title: "3. How We Use Your Information",
    content: (
      <>
        <p>We use collected information to:</p>
        <ul className="space-y-2 pl-6">
          <li>Provide, maintain, and enhance the Service</li>
          <li>Process transactions and manage your account</li>
          <li>Send technical notices, security alerts, and administrative messages</li>
          <li>Respond to support requests and improve customer experience</li>
          <li>Monitor usage trends and safeguard against abuse or fraud</li>
          <li>Comply with legal requirements and enforce our Terms of Service</li>
          <li>Send marketing communications with your explicit consent</li>
        </ul>
      </>
    ),
  },
  {
    value: "sharing",
    title: "4. How We Share Information",
    content: (
      <>
        <p>We share data only when necessary:</p>
        <p><strong>4.1 Service providers:</strong> Infrastructure partners (such as Linode/Akamai), payment processors (PayPal), email delivery services, and analytics vendors operate on our behalf under strict agreements.</p>
        <p><strong>4.2 Legal obligations:</strong> We may disclose information to comply with laws, regulations, or lawful requests by public authorities.</p>
        <p><strong>4.3 Business transfers:</strong> If we merge, acquire, or sell assets, data may be transferred subject to this policy.</p>
        <p><strong>4.4 With consent:</strong> We share information for other purposes only when you explicitly authorize it.</p>
      </>
    ),
  },
  {
    value: "security",
    title: "5. Data Security",
    content: (
      <>
        <p>We implement technical and organizational safeguards such as:</p>
        <ul className="space-y-2 pl-6">
          <li>TLS encryption for data in transit and encryption for sensitive data at rest</li>
          <li>Role-based access controls and multi-factor authentication for internal tools</li>
          <li>Regular penetration tests, vulnerability scanning, and third-party audits</li>
          <li>Security training for employees handling customer data</li>
        </ul>
        <p>Despite these measures, no system is infallible. You acknowledge the inherent risks of transmitting information online.</p>
      </>
    ),
  },
  {
    value: "retention",
    title: "6. Data Retention",
    content: (
      <>
        <p>
          We retain personal data for as long as necessary to deliver the Service and fulfill the purposes described in this policy. When you close your account, we delete associated data within 30 days unless retention is required for legal, tax, or accounting reasons.
        </p>
      </>
    ),
  },
  {
    value: "rights",
    title: "7. Your Rights and Choices",
    content: (
      <>
        <p>You may exercise the following rights:</p>
        <ul className="space-y-2 pl-6">
          <li><strong>Access:</strong> Request a copy of personal data we hold.</li>
          <li><strong>Correction:</strong> Update inaccurate or incomplete data.</li>
          <li><strong>Deletion:</strong> Request deletion of your account and associated data.</li>
          <li><strong>Portability:</strong> Receive data in a portable format.</li>
          <li><strong>Opt-out:</strong> Unsubscribe from marketing communications.</li>
          <li><strong>Objection:</strong> Object to certain processing activities.</li>
        </ul>
        <p>Email privacy@{BRAND_NAME.toLowerCase()}.com to submit a request. We respond within 30 days.</p>
      </>
    ),
  },
  {
    value: "cookies",
    title: "8. Cookies and Tracking Technologies",
    content: (
      <>
        <p>Cookies and similar technologies help us authenticate sessions, remember preferences, and analyze usage.</p>
        <p>You can adjust browser settings to refuse cookies. Some features may not function properly if cookies are disabled.</p>
        <p>We use session cookies, preference cookies, and analytics cookies from trusted providers.</p>
      </>
    ),
  },
  {
    value: "third-parties",
    title: "9. Third-Party Links",
    content: (
      <>
        <p>Links to external sites or services are provided for convenience. We are not responsible for their privacy practices and encourage you to review the policies of any third party you interact with.</p>
      </>
    ),
  },
  {
    value: "children",
    title: "10. Children’s Privacy",
    content: (
      <>
        <p>The Service is not directed at individuals under 18. We do not knowingly collect personal data from children. If you believe a child has provided information, contact us immediately so we can remove it.</p>
      </>
    ),
  },
  {
    value: "transfers",
    title: "11. International Data Transfers",
    content: (
      <>
        <p>Your data may be transferred to and stored in countries where {BRAND_NAME} or its service providers operate. We ensure appropriate safeguards consistent with applicable data protection laws.</p>
      </>
    ),
  },
  {
    value: "changes",
    title: "12. Changes to This Policy",
    content: (
      <>
        <p>We may update this policy periodically. We will post updates on this page and revise the "Last updated" date. Material changes may include email or in-app notice.</p>
      </>
    ),
  },
  {
    value: "contact",
    title: "13. Contact Us",
    content: (
      <>
        <p>Questions or concerns? Reach out to our privacy team:</p>
        <p>
          Email: privacy@{BRAND_NAME.toLowerCase()}.com<br />
          Address: 123 Cloud Street, Tech District, San Francisco, CA 94105<br />
          Privacy Officer: privacy@{BRAND_NAME.toLowerCase()}.com
        </p>
      </>
    ),
  },
  {
    value: "gdpr",
    title: "14. GDPR Rights (EU/EEA)",
    content: (
      <>
        <p>Residents of the European Economic Area have additional rights, including restriction of processing and the right to lodge complaints with supervisory authorities. We honor these rights in accordance with GDPR.</p>
      </>
    ),
  },
  {
    value: "ccpa",
    title: "15. CCPA Rights (California)",
    content: (
      <>
        <p>California residents may request disclosure of personal information categories we collect, request deletion, and opt out of certain sharing. Submit requests via privacy@{BRAND_NAME.toLowerCase()}.com.</p>
      </>
    ),
  },
];

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNavbar />
      <div className="container mx-auto max-w-6xl px-4 py-12">
      <div className="grid gap-10 lg:grid-cols-[2fr,1fr]">
        <div>
          <div className="space-y-4">
            <Badge variant="outline" className="uppercase tracking-wide">Privacy</Badge>
            <h1 className="text-3xl font-semibold md:text-4xl">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground md:text-base">
              Last updated {lastUpdated}. This policy explains how {BRAND_NAME} handles personal information, your rights, and how to reach us for additional details.
            </p>
          </div>

          <Card className="mt-10 shadow-sm">
            <CardHeader>
              <CardTitle>How we protect your data</CardTitle>
              <CardDescription>Navigate the sections below for specifics on collection, usage, and rights.</CardDescription>
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
                <h2 className="text-lg font-semibold">Need a data processing addendum (DPA)?</h2>
                <p className="text-sm text-muted-foreground">
                  Enterprise customers can request our standard DPA or submit their own for review. Turnaround typically within three business days.
                </p>
              </div>
              <Button asChild size="lg">
                <Link to="/contact">Request DPA</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>At a glance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" /> Encryption in transit and at rest
              </div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-primary" /> 24/7 security monitoring
              </div>
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" /> SSO and least-privilege access controls
              </div>
              <Separator />
              <p>Want to report a security issue? Email <a href={`mailto:security@${BRAND_NAME.toLowerCase()}.com`} className="text-primary">security@{BRAND_NAME.toLowerCase()}.com</a>.</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Table of contents</CardTitle>
              <CardDescription>Quickly jump to any section.</CardDescription>
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
