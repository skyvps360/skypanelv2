import React, { useCallback, useMemo, useState } from "react";
import { BookOpen, Copy, Rocket, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BRAND_NAME } from "@/lib/brand";

type EndpointDefinition = {
  method: string;
  path: string;
  description: string;
  auth?: boolean;
  body?: unknown;
  params?: Record<string, unknown>;
  response?: unknown;
};

type SectionDefinition = {
  title: string;
  base: string;
  description: string;
  endpoints: EndpointDefinition[];
};

const methodStyles: Record<string, string> = {
  GET: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  POST: "bg-blue-500/10 text-blue-600 dark:text-blue-300",
  PUT: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  PATCH: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300",
  DELETE: "bg-red-500/10 text-red-600 dark:text-red-300",
  DEFAULT: "bg-muted text-foreground",
};

 const formatJson = (value: unknown) => JSON.stringify(value, null, 2);

 const buildCurlCommand = (base: string, endpoint: EndpointDefinition) => {
  const query = endpoint.params
    ? new URLSearchParams(
        Object.entries(endpoint.params).map(([key, value]) => [
          key,
          value === undefined || value === null ? "" : String(value),
        ])
      ).toString()
    : "";

  const url = query ? `${base}${endpoint.path}?${query}` : `${base}${endpoint.path}`;

  const lines = [`curl -X ${endpoint.method} "${url}"`];

  if (endpoint.auth) {
    lines.push('-H "Authorization: Bearer YOUR_TOKEN"');
  }

  if (endpoint.body) {
    lines.push('-H "Content-Type: application/json"');
    lines.push(`-d '${JSON.stringify(endpoint.body)}'`);
  }

  return lines
    .map((line, index) => (index === 0 ? line : `  ${line}`))
    .join(' \\\n');
};

export default function ApiDocs() {
  const apiBase = (import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.host}/api`).replace(/\/$/, "");

  const sections = useMemo<SectionDefinition[]>(() => [
    {
      title: "Authentication & Profile",
      base: `${apiBase}/auth`,
      description:
        "Endpoints used for account onboarding, JWT management, profile updates, organization metadata, and API key lifecycle.",
      endpoints: [
        {
          method: "POST",
          path: "/register",
          description: "Create a new customer account and return an authenticated session.",
          body: {
            email: "admin@example.com",
            password: "Sup3rSecure!",
            firstName: "Sky",
            lastName: "Panel",
            company: "Example Corp",
            agreeToTerms: true,
          },
          response: {
            token: "jwt_token_here",
            user: {
              id: "user_123",
              email: "admin@example.com",
              firstName: "Sky",
              lastName: "Panel",
              role: "owner",
              organizationId: "org_123",
            },
          },
        },
        {
          method: "POST",
          path: "/login",
          description: "Authenticate an existing user and issue a fresh JWT token.",
          body: {
            email: "admin@example.com",
            password: "Sup3rSecure!",
          },
          response: {
            token: "jwt_token_here",
            user: {
              id: "user_123",
              email: "admin@example.com",
              firstName: "Sky",
              lastName: "Panel",
              role: "owner",
              organizationId: "org_123",
            },
          },
        },
        {
          method: "POST",
          path: "/refresh",
          description: "Exchange a valid refresh token for a new JWT and optional updated user payload.",
          auth: true,
          response: {
            token: "new_jwt_token",
            user: {
              id: "user_123",
              email: "admin@example.com",
              firstName: "Sky",
              lastName: "Panel",
              role: "owner",
              organizationId: "org_123",
            },
          },
        },
        {
          method: "GET",
          path: "/profile",
          description: "Retrieve the authenticated user's profile record.",
          auth: true,
          response: {
            user: {
              id: "user_123",
              email: "admin@example.com",
              firstName: "Sky",
              lastName: "Panel",
              phone: "+1-555-555-0100",
              timezone: "America/New_York",
              role: "owner",
            },
          },
        },
        {
          method: "PUT",
          path: "/profile",
          description: "Update profile attributes such as display name, phone number, or preferred timezone.",
          auth: true,
          body: {
            firstName: "Sky",
            lastName: "Panel",
            phone: "+1-555-555-0100",
            timezone: "America/New_York",
          },
          response: {
            user: {
              id: "user_123",
              email: "admin@example.com",
              firstName: "Sky",
              lastName: "Panel",
              phone: "+1-555-555-0100",
              timezone: "America/New_York",
            },
          },
        },
        {
          method: "GET",
          path: "/organization",
          description: "Fetch the organization metadata associated with the current user.",
          auth: true,
          response: {
            organization: {
              id: "org_123",
              name: "Example Corp",
              website: "https://example.com",
              address: "123 Innovation Way, Example City",
              taxId: "US-12-3456789",
            },
          },
        },
        {
          method: "PUT",
          path: "/organization",
          description: "Update the organization's legal or billing profile.",
          auth: true,
          body: {
            name: "Example Corp",
            website: "https://example.com",
            address: "123 Innovation Way, Example City",
            taxId: "US-12-3456789",
          },
          response: {
            organization: {
              id: "org_123",
              name: "Example Corp",
              website: "https://example.com",
              address: "123 Innovation Way, Example City",
              taxId: "US-12-3456789",
            },
          },
        },
        {
          method: "PUT",
          path: "/password",
          description: "Change the account password after verifying the existing credentials.",
          auth: true,
          body: {
            currentPassword: "Sup3rSecure!",
            newPassword: "N3wSecurePass!",
          },
          response: {
            success: true,
            message: "Password updated successfully",
          },
        },
        {
          method: "PUT",
          path: "/preferences",
          description: "Persist user preference toggles such as notification channels or security options.",
          auth: true,
          body: {
            notifications: { email: true, push: false },
            security: { multiFactorEnabled: true },
          },
          response: {
            preferences: {
              notifications: { email: true, push: false },
              security: { multiFactorEnabled: true },
            },
          },
        },
        {
          method: "GET",
          path: "/api-keys",
          description: "List API keys scoped to the authenticated user.",
          auth: true,
          response: {
            apiKeys: [
              {
                id: "key_123",
                name: "production",
                token: "sk_live_************************",
                createdAt: "2024-10-20T12:00:00Z",
                lastUsedAt: "2024-10-25T08:30:00Z",
              },
            ],
          },
        },
        {
          method: "POST",
          path: "/api-keys",
          description: "Issue a new API key for programmatic access.",
          auth: true,
          body: {
            name: "automation",
          },
          response: {
            apiKey: {
              id: "key_456",
              name: "automation",
              token: "sk_live_************************",
              createdAt: "2024-10-26T09:00:00Z",
            },
          },
        },
        {
          method: "DELETE",
          path: "/api-keys/:id",
          description: "Revoke an API key immediately.",
          auth: true,
          response: {
            success: true,
          },
        },
        {
          method: "POST",
          path: "/forgot-password",
          description: "Initiate the password reset workflow by emailing a recovery link.",
          body: {
            email: "admin@example.com",
          },
          response: {
            success: true,
            message: "If an account exists for admin@example.com we have sent password reset instructions.",
          },
        },
        {
          method: "POST",
          path: "/reset-password",
          description: "Complete the reset flow by providing a valid token and new password.",
          body: {
            token: "reset_token_here",
            newPassword: "N3wSecurePass!",
          },
          response: {
            success: true,
            message: "Password reset successfully",
          },
        },
        {
          method: "POST",
          path: "/verify-password",
          description: "Server-side password verification used before destructive account actions (SSH console, deletions).",
          auth: true,
          body: {
            password: "Sup3rSecure!",
          },
          response: {
            success: true,
          },
        },
      ],
    },
    {
      title: "Billing & Payments",
      base: `${apiBase}/payments`,
      description:
        "Wallet funding, PayPal integrations, transaction history, and summary reporting that power the billing area of the dashboard.",
      endpoints: [
        {
          method: "POST",
          path: "/create-payment",
          description: "Create a PayPal payment intent used to top up the wallet balance.",
          auth: true,
          body: {
            amount: 100.0,
            currency: "USD",
            description: "Wallet top-up",
          },
          response: {
            success: true,
            paymentId: "PAYID-MOCK123",
            approvalUrl: "https://paypal.com/checkout?token=PAYID-MOCK123",
          },
        },
        {
          method: "POST",
          path: "/capture-payment/:orderId",
          description: "Capture a PayPal payment after the customer approves the order.",
          auth: true,
          response: {
            success: true,
            paymentId: "PAYID-MOCK123",
          },
        },
        {
          method: "POST",
          path: "/cancel-payment/:orderId",
          description: "Cancel a pending PayPal order and optionally record the reason.",
          auth: true,
          body: {
            reason: "Customer changed plan tier",
          },
          response: {
            success: true,
          },
        },
        {
          method: "GET",
          path: "/config",
          description: "Fetch the PayPal client configuration (client ID, mode, allowed funding sources).",
          auth: true,
          response: {
            success: true,
            config: {
              clientId: "PAYPAL_CLIENT_ID",
              currency: "USD",
              intent: "capture",
              mode: "sandbox",
              disableFunding: ["paylater"],
              brandName: `${BRAND_NAME}`,
            },
          },
        },
        {
          method: "GET",
          path: "/wallet/balance",
          description: "Return the organization's wallet balance used to provision VPS resources.",
          auth: true,
          response: {
            balance: 245.67,
            currency: "USD",
            updatedAt: "2024-10-26T15:00:00Z",
          },
        },
        {
          method: "GET",
          path: "/wallet/transactions",
          description: "Paginated wallet ledger containing credits, debits, and running balance adjustments.",
          auth: true,
          params: { limit: 20, offset: 0 },
          response: {
            transactions: [
              {
                id: "txn_001",
                type: "credit",
                amount: 100,
                currency: "USD",
                description: "Wallet top-up via PayPal",
                balanceBefore: 145.67,
                balanceAfter: 245.67,
                createdAt: "2024-10-26T14:55:00Z",
              },
            ],
            pagination: { hasMore: false },
          },
        },
        {
          method: "GET",
          path: "/history",
          description: "Historical payment events across all providers (currently PayPal).",
          auth: true,
          params: { limit: 20, status: "completed" },
          response: {
            payments: [
              {
                id: "pay_001",
                amount: 100,
                currency: "USD",
                description: "Wallet top-up",
                status: "completed",
                provider: "paypal",
                providerPaymentId: "PAYID-MOCK123",
                createdAt: "2024-10-26T14:54:00Z",
                updatedAt: "2024-10-26T14:55:00Z",
              },
            ],
            pagination: { hasMore: false },
          },
        },
        {
          method: "GET",
          path: "/transactions/:transactionId",
          description: "Detailed view of a single payment transaction used by the transaction drawer.",
          auth: true,
          response: {
            transaction: {
              id: "txn_001",
              organizationId: "org_123",
              amount: 100,
              currency: "USD",
              description: "Wallet top-up",
              status: "completed",
              provider: "paypal",
              paymentMethod: "paypal-balance",
              providerPaymentId: "PAYID-MOCK123",
              type: "credit",
              balanceBefore: 145.67,
              balanceAfter: 245.67,
              createdAt: "2024-10-26T14:54:00Z",
              updatedAt: "2024-10-26T14:55:00Z",
            },
          },
        },
        {
          method: "POST",
          path: "/refund",
          description: "Issue a manual refund or payout through PayPal to a customer email address.",
          auth: true,
          body: {
            email: "customer@example.com",
            amount: 25.0,
            currency: "USD",
            reason: "Service credit",
          },
          response: {
            success: true,
            paymentId: "PAYOUT-001",
          },
        },
        {
          method: "GET",
          path: "/billing/summary",
          description: "Aggregated spend metrics displayed on the billing overview cards.",
          auth: true,
          response: {
            success: true,
            summary: {
              totalSpentThisMonth: 320.5,
              totalSpentAllTime: 1480.25,
              activeVPSCount: 6,
              monthlyEstimate: 340.0,
            },
          },
        },
      ],
    },
    {
      title: "Invoices & Financial Records",
      base: `${apiBase}`,
      description: "Invoice listings, PDF generation, and uptime/billing analytics surfaced in the billing experience.",
      endpoints: [
        {
          method: "GET",
          path: "/invoices",
          description: "List invoices for the organization with pagination information.",
          auth: true,
          params: { limit: 50, offset: 0 },
          response: {
            invoices: [
              {
                id: "inv_001",
                invoiceNumber: "INV-2024-001",
                totalAmount: 120.5,
                currency: "USD",
                createdAt: "2024-10-01T00:00:00Z",
              },
            ],
            pagination: { hasMore: false },
          },
        },
        {
          method: "GET",
          path: "/invoices/:id",
          description: "Retrieve a single invoice record for detailed display.",
          auth: true,
          response: {
            invoice: {
              id: "inv_001",
              invoiceNumber: "INV-2024-001",
              totalAmount: 120.5,
              currency: "USD",
              createdAt: "2024-10-01T00:00:00Z",
              lineItems: [
                { description: "VPS usage", quantity: 720, unitPrice: 0.12, amount: 86.4 },
              ],
            },
          },
        },
        {
          method: "GET",
          path: "/invoices/:id/download",
          description: "Download the generated PDF for an invoice (requires authenticated fetch).",
          auth: true,
          response: {
            contentType: "application/pdf",
            body: "<binary stream>",
          },
        },
        {
          method: "POST",
          path: "/invoices/from-transaction/:transactionId",
          description: "Generate an invoice artifact from a historical payment transaction.",
          auth: true,
          response: {
            success: true,
            invoiceId: "inv_001",
            invoiceNumber: "INV-2024-001",
          },
        },
        {
          method: "GET",
          path: "/vps/uptime-summary",
          description: "Summarised uptime calculations displayed on the billing page's VPS cost breakdown.",
          auth: true,
          response: {
            success: true,
            data: {
              totalActiveHours: 985.4,
              totalEstimatedCost: 265.42,
              vpsInstances: [
                {
                  id: "vps_001",
                  label: "production-web-1",
                  status: "running",
                  activeHours: 240.5,
                  hourlyRate: 0.04,
                  estimatedCost: 9.62,
                  lastBilledAt: "2024-10-25T12:00:00Z",
                },
              ],
            },
          },
        },
      ],
    },
    {
      title: "VPS Provisioning & Lifecycle",
      base: `${apiBase}/vps`,
      description:
        "Core compute actions for provisioning, managing power state, hostname updates, backups, and firewall attachment.",
      endpoints: [
        {
          method: "GET",
          path: "/",
          description: "List VPS instances for the authenticated organization with live metrics where available.",
          auth: true,
          response: {
            instances: [
              {
                id: "vps_001",
                provider_instance_id: "123456",
                label: "production-web-1",
                status: "running",
                ip_address: "203.0.113.12",
                configuration: { type: "g6-standard-2", region: "us-east", image: "ubuntu-24-04" },
                plan_specs: { vcpus: 2, memory: 4096, disk: 81920, transfer: 4000 },
                plan_pricing: { hourly: 0.027, monthly: 20 },
              },
            ],
          },
        },
        {
          method: "POST",
          path: "/",
          description: "Provision a new VPS instance with the configured Linode provider.",
          auth: true,
          body: {
            label: "production-web-1",
            provider_id: "linode",
            provider_type: "linode",
            type: "g6-standard-2",
            region: "us-east",
            image: "linode/ubuntu24.04",
            rootPassword: "Sup3rSecure!",
            sshKeys: ["123"],
            backups: true,
            privateIP: false,
          },
          response: {
            instance: {
              id: "vps_001",
              status: "provisioning",
              label: "production-web-1",
            },
          },
        },
        {
          method: "GET",
          path: "/:id",
          description: "Fetch an enriched detail view including metrics, networking, backups, and provider metadata.",
          auth: true,
          response: {
            instance: {
              id: "vps_001",
              label: "production-web-1",
              status: "running",
              ipAddress: "203.0.113.12",
              region: "us-east",
              plan: {
                id: "g6-standard-2",
                pricing: { hourly: 0.027, monthly: 20 },
                specs: { vcpus: 2, memory: 4096, disk: 81920, transfer: 4000 },
              },
              metrics: {
                cpu: { summary: { average: 18.3, peak: 72.5, last: 21.9 } },
                network: {
                  inbound: { summary: { average: 1200000, peak: 8200000, last: 1500000 } },
                  outbound: { summary: { average: 950000, peak: 6500000, last: 1100000 } },
                },
              },
            },
          },
        },
        {
          method: "POST",
          path: "/:id/boot",
          description: "Power on a stopped VPS instance.",
          auth: true,
          response: {
            success: true,
            message: "VPS boot initiated",
          },
        },
        {
          method: "POST",
          path: "/:id/shutdown",
          description: "Gracefully shut down a running VPS instance.",
          auth: true,
          response: {
            success: true,
            message: "VPS shutdown initiated",
          },
        },
        {
          method: "POST",
          path: "/:id/reboot",
          description: "Reboot a VPS instance.",
          auth: true,
          response: {
            success: true,
            message: "VPS reboot initiated",
          },
        },
        {
          method: "DELETE",
          path: "/:id",
          description: "Schedule a VPS for deletion (requires confirmation modal client-side).",
          auth: true,
          response: {
            success: true,
            message: "VPS deletion initiated",
          },
        },
        {
          method: "PUT",
          path: "/:id/hostname",
          description: "Update the VPS hostname/label used for reverse DNS and UI display.",
          auth: true,
          body: { hostname: "new-hostname" },
          response: {
            success: true,
            message: "Hostname updated successfully",
          },
        },
        {
          method: "POST",
          path: "/:id/backups/enable",
          description: "Enable provider-managed backups for the VPS instance.",
          auth: true,
          response: {
            success: true,
            message: "Backups enabled",
          },
        },
        {
          method: "POST",
          path: "/:id/backups/disable",
          description: "Disable recurring backups on the VPS instance.",
          auth: true,
          response: {
            success: true,
            message: "Backups disabled",
          },
        },
        {
          method: "POST",
          path: "/:id/backups/snapshot",
          description: "Request an on-demand snapshot backup.",
          auth: true,
          body: { label: "Before maintenance" },
          response: {
            success: true,
            message: "Snapshot requested",
          },
        },
        {
          method: "POST",
          path: "/:id/backups/schedule",
          description: "Update the provider backup schedule (day/window).",
          auth: true,
          body: { day: "Sunday", window: "W2" },
          response: {
            success: true,
            message: "Backup schedule updated",
          },
        },
        {
          method: "POST",
          path: "/:id/backups/:backupId/restore",
          description: "Restore a specific automatic or snapshot backup to the instance.",
          auth: true,
          body: { overwrite: true },
          response: {
            success: true,
            message: "Backup restore initiated",
          },
        },
        {
          method: "POST",
          path: "/:id/firewalls/attach",
          description: "Attach a firewall profile to the VPS instance.",
          auth: true,
          body: { firewallId: "fw_123" },
          response: {
            success: true,
            message: "Firewall attached",
          },
        },
        {
          method: "POST",
          path: "/:id/firewalls/detach",
          description: "Detach the firewall profile from the VPS instance.",
          auth: true,
          body: { firewallId: "fw_123" },
          response: {
            success: true,
            message: "Firewall detached",
          },
        },
      ],
    },
    {
      title: "VPS Catalog & Integrations",
      base: `${apiBase}/vps`,
      description: "Supporting catalog endpoints that power plan selection, marketplace apps, and provider integrations.",
      endpoints: [
        {
          method: "GET",
          path: "/providers",
          description: "List configured cloud providers available to the tenant (e.g. Linode).",
          auth: true,
          response: {
            providers: [
              { id: "linode", name: "Linode", type: "linode" },
            ],
          },
        },
        {
          method: "GET",
          path: "/providers/:id/regions",
          description: "Fetch regions for a specific provider, merged across admin-configured accounts.",
          auth: true,
          response: {
            regions: [
              { id: "us-east", label: "Newark, NJ", country: "US" },
              { id: "eu-west", label: "Frankfurt", country: "DE" },
            ],
          },
        },
        {
          method: "GET",
          path: "/plans",
          description: "List VPS plans (CPU, RAM, disk, transfer, pricing) used on the create VPS screen.",
          auth: true,
          response: {
            plans: [
              {
                id: "g6-standard-2",
                label: "Shared 2GB",
                disk: 81920,
                memory: 4096,
                vcpus: 2,
                transfer: 4000,
                price: { hourly: 0.027, monthly: 20 },
              },
            ],
          },
        },
        {
          method: "GET",
          path: "/images",
          description: "Available base operating system images per provider (Linode variant).",
          auth: true,
          response: {
            images: [
              { id: "linode/ubuntu24.04", label: "Ubuntu 24.04 LTS" },
              { id: "linode/debian12", label: "Debian 12" },
            ],
          },
        },
        {
          method: "GET",
          path: "/stackscripts",
          description: "Admin curated StackScripts and marketplace applications (when `configured=true`).",
          auth: true,
          params: { configured: true },
          response: {
            stackscripts: [
              {
                id: 12345,
                label: "SkyPanel Marketplace App",
                user_defined_fields: [{ name: "db_password", label: "Database Password" }],
                isMarketplace: true,
              },
            ],
          },
        },
        {
          method: "GET",
          path: "/linode/ssh-keys",
          description: "Linode SSH keys available to the authenticated organization.",
          auth: true,
          response: {
            ssh_keys: [
              { id: 2001, label: "shared-key", ssh_key: "ssh-ed25519 AAAA..." },
            ],
          },
        },
      ],
    },
    {
      title: "VPS Networking",
      base: `${apiBase}/vps`,
      description: "Networking configuration helpers including default rDNS domain lookups and per-instance reverse DNS updates.",
      endpoints: [
        {
          method: "GET",
          path: "/networking/config",
          description: "Return platform-wide networking defaults such as the base rDNS domain.",
          auth: true,
          response: {
            config: {
              rdns_base_domain: "example.sky.network",
            },
          },
        },
        {
          method: "POST",
          path: "/:id/networking/rdns",
          description: "Create or update reverse DNS records for IPv4/IPv6 addresses on the instance.",
          auth: true,
          body: {
            address: "203.0.113.12",
            rdns: "host1.example.sky.network",
          },
          response: {
            success: true,
            message: "rDNS updated",
          },
        },
      ],
    },
    {
      title: "User SSH Keys",
      base: `${apiBase}/ssh-keys`,
      description: "Personal SSH key management used across VPS provisioning and console access.",
      endpoints: [
        {
          method: "GET",
          path: "/",
          description: "List SSH keys registered for the authenticated user.",
          auth: true,
          response: {
            keys: [
              {
                id: "ssh_001",
                label: "Work Laptop",
                fingerprint: "SHA256:abcd...",
                createdAt: "2024-10-20T08:00:00Z",
              },
            ],
          },
        },
        {
          method: "POST",
          path: "/",
          description: "Create a new SSH key entry.",
          auth: true,
          body: {
            label: "Work Laptop",
            publicKey: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA...",
          },
          response: {
            id: "ssh_002",
            label: "Work Laptop",
            fingerprint: "SHA256:abcd...",
          },
        },
        {
          method: "DELETE",
          path: "/:id",
          description: "Remove an SSH key from the account.",
          auth: true,
          response: {
            success: true,
          },
        },
      ],
    },
    {
      title: "Activity & Audit Log",
      base: `${apiBase}/activity`,
      description: "Customer-facing activity feed supporting filters, export, and dashboard recent items.",
      endpoints: [
        {
          method: "GET",
          path: "/",
          description: "Fetch paginated activity events filtered by date, type, and status.",
          auth: true,
          params: { page: 1, status: "success" },
          response: {
            activities: [
              {
                id: "act_001",
                type: "vps",
                message: "Provisioned production-web-1",
                status: "success",
                timestamp: "2024-10-25T08:00:00Z",
              },
            ],
            pagination: { page: 1, totalPages: 5 },
          },
        },
        {
          method: "GET",
          path: "/recent",
          description: "Return the latest activity entries for dashboard summaries (limit fixed to 10).",
          auth: true,
          params: { limit: 10 },
          response: {
            activities: [
              {
                id: "act_001",
                type: "billing",
                message: "Wallet credited via PayPal",
                status: "success",
                timestamp: "2024-10-26T14:55:00Z",
              },
            ],
          },
        },
        {
          method: "GET",
          path: "/export",
          description: "Export the filtered activity feed as CSV for compliance or offline review.",
          auth: true,
          params: { format: "csv" },
          response: {
            contentType: "text/csv",
            body: "id,type,message,status,timestamp\nact_001,vps,Provisioned production-web-1,success,2024-10-25T08:00:00Z",
          },
        },
      ],
    },
    {
      title: "Support Tickets",
      base: `${apiBase}/support`,
      description: "Customer support workflow including ticket creation, threaded replies, and SSE streams.",
      endpoints: [
        {
          method: "GET",
          path: "/tickets",
          description: "List support tickets created by the authenticated organization.",
          auth: true,
          response: {
            tickets: [
              {
                id: "ticket_001",
                subject: "Unable to reach SSH",
                status: "open",
                priority: "high",
                category: "vps",
                created_at: "2024-10-24T10:00:00Z",
                updated_at: "2024-10-24T12:00:00Z",
                has_staff_reply: true,
              },
            ],
          },
        },
        {
          method: "POST",
          path: "/tickets",
          description: "Create a new support ticket from the dashboard.",
          auth: true,
          body: {
            subject: "Unable to reach SSH",
            message: "Port 22 is timing out after provisioning.",
            priority: "high",
            category: "vps",
          },
          response: {
            ticket: {
              id: "ticket_002",
              subject: "Unable to reach SSH",
              status: "open",
            },
          },
        },
        {
          method: "GET",
          path: "/tickets/:id/replies",
          description: "Fetch threaded replies for a ticket when opening the detail drawer.",
          auth: true,
          response: {
            replies: [
              {
                id: "reply_001",
                ticket_id: "ticket_001",
                sender_type: "admin",
                message: "We're investigating the networking configuration.",
                created_at: "2024-10-24T11:00:00Z",
              },
            ],
          },
        },
        {
          method: "POST",
          path: "/tickets/:id/replies",
          description: "Submit a reply to an existing support ticket.",
          auth: true,
          body: {
            message: "Thanks! Issue resolved after reboot.",
          },
          response: {
            reply: {
              id: "reply_002",
              ticket_id: "ticket_001",
              message: "Thanks! Issue resolved after reboot.",
              created_at: "2024-10-24T12:30:00Z",
            },
          },
        },
        {
          method: "GET",
          path: "/tickets/:id/stream",
          description: "Server-sent event stream for live ticket updates; token is passed via query string.",
          auth: true,
          params: { token: "JWT_TOKEN" },
          response: {
            eventStream: true,
            examples: [
              'data: {"type":"ticket_message","ticket_id":"ticket_001","message_id":"reply_002","message":"New reply","is_staff_reply":true}',
              'data: {"type":"ticket_status_change","ticket_id":"ticket_001","new_status":"resolved"}',
            ],
          },
        },
      ],
    },
    {
      title: "Notifications",
      base: `${apiBase}/notifications`,
      description: "Real-time notification center supporting unread counts, SSE streaming, and acknowledgement.",
      endpoints: [
        {
          method: "GET",
          path: "/unread",
          description: "Load the latest unread notifications for the dropdown.",
          auth: true,
          params: { limit: 20 },
          response: {
            notifications: [
              {
                id: "notif_001",
                event_type: "vps.created",
                entity_type: "vps",
                entity_id: "vps_001",
                message: "VPS production-web-1 provisioned successfully",
                status: "success",
                created_at: "2024-10-26T14:55:00Z",
                is_read: false,
              },
            ],
          },
        },
        {
          method: "GET",
          path: "/unread-count",
          description: "Return the unread notification count used for the badge indicator.",
          auth: true,
          response: {
            count: 3,
          },
        },
        {
          method: "PATCH",
          path: "/:id/read",
          description: "Mark a notification as read after the user opens it.",
          auth: true,
          response: {
            success: true,
          },
        },
        {
          method: "PATCH",
          path: "/read-all",
          description: "Mark every notification as read.",
          auth: true,
          response: {
            success: true,
          },
        },
        {
          method: "GET",
          path: "/stream",
          description: "Server-sent event stream delivering live notifications. Token supplied via query string.",
          auth: true,
          params: { token: "JWT_TOKEN" },
          response: {
            eventStream: true,
            examples: [
              'data: {"type":"notification","data":{"id":"notif_001","event_type":"vps.created","message":"VPS ready"}}',
            ],
          },
        },
      ],
    },
    {
      title: "Admin Platform Management",
      base: `${apiBase}/admin`,
      description:
        "Administrative endpoints for tenant operators managing users, content, marketplace integrations, and platform guardrails.",
      endpoints: [
        {
          method: "GET",
          path: "/users",
          description: "List users in the tenant including role, status, and MFA state.",
          auth: true,
          response: {
            users: [
              {
                id: "user_123",
                email: "admin@example.com",
                role: "owner",
                status: "active",
                mfaEnabled: true,
                createdAt: "2024-01-05T00:00:00Z",
              },
            ],
          },
        },
        {
          method: "PATCH",
          path: "/users/:userId",
          description: "Update a user's role or account status (used by the admin user editor).",
          auth: true,
          body: {
            role: "admin",
            status: "active",
          },
          response: {
            success: true,
            user: { id: "user_456", role: "admin", status: "active" },
          },
        },
        {
          method: "POST",
          path: "/users/:userId/impersonate",
          description: "Start an impersonation session as the target user (admin only).",
          auth: true,
          response: {
            success: true,
            token: "impersonation_jwt",
          },
        },
        {
          method: "POST",
          path: "/impersonation/exit",
          description: "End an active impersonation session and restore the admin's identity.",
          auth: true,
          response: {
            success: true,
          },
        },
        {
          method: "GET",
          path: "/tickets",
          description: "Administrative view of all support tickets across the tenant.",
          auth: true,
          response: {
            tickets: [
              {
                id: "ticket_001",
                organization: "Example Corp",
                subject: "Unable to reach SSH",
                status: "open",
                priority: "high",
                created_at: "2024-10-24T10:00:00Z",
              },
            ],
          },
        },
        {
          method: "POST",
          path: "/tickets/:id/replies",
          description: "Post an admin reply to a customer ticket.",
          auth: true,
          body: { message: "Please reboot the VPS and confirm." },
          response: {
            reply: {
              id: "reply_admin_001",
              ticket_id: "ticket_001",
              message: "Please reboot the VPS and confirm.",
              created_at: "2024-10-24T11:30:00Z",
            },
          },
        },
        {
          method: "PATCH",
          path: "/tickets/:id/status",
          description: "Update a ticket's status (open, pending, resolved, closed).",
          auth: true,
          body: { status: "resolved" },
          response: {
            success: true,
          },
        },
        {
          method: "DELETE",
          path: "/tickets/:id",
          description: "Delete a ticket (used for spam/cleanup).",
          auth: true,
          response: {
            success: true,
          },
        },
        {
          method: "GET",
          path: "/faq/categories",
          description: "List FAQ categories surfaced on the public marketing site.",
          auth: true,
          response: {
            categories: [
              { id: "cat_general", name: "General", display_order: 1, is_enabled: true },
            ],
          },
        },
        {
          method: "POST",
          path: "/faq/categories",
          description: "Create a new FAQ category.",
          auth: true,
          body: { name: "Billing", description: "Invoices, refunds" },
          response: {
            category: { id: "cat_billing", name: "Billing", display_order: 2, is_enabled: true },
          },
        },
        {
          method: "PUT",
          path: "/faq/categories/:id",
          description: "Update category metadata.",
          auth: true,
          body: { name: "Billing", description: "Invoices, refunds", is_enabled: true },
          response: {
            category: { id: "cat_billing", name: "Billing", is_enabled: true },
          },
        },
        {
          method: "DELETE",
          path: "/faq/categories/:id",
          description: "Remove a category (questions must be moved first).",
          auth: true,
          response: {
            success: true,
          },
        },
        {
          method: "POST",
          path: "/faq/categories/reorder",
          description: "Persist drag-and-drop ordering of FAQ categories.",
          auth: true,
          body: { order: ["cat_general", "cat_billing"] },
          response: {
            success: true,
          },
        },
        {
          method: "GET",
          path: "/faq/items",
          description: "List FAQ entries and their content.",
          auth: true,
          response: {
            items: [
              {
                id: "faq_001",
                category_id: "cat_general",
                question: "What is SkyPANEL?",
                answer: "SkyPANEL manages VPS workloads across providers.",
              },
            ],
          },
        },
        {
          method: "POST",
          path: "/faq/items",
          description: "Create a new FAQ item.",
          auth: true,
          body: {
            category_id: "cat_general",
            question: "How do I reset my password?",
            answer: "Use the Forgot Password link on the login page.",
          },
          response: {
            item: { id: "faq_002", question: "How do I reset my password?" },
          },
        },
        {
          method: "PUT",
          path: "/faq/items/:id",
          description: "Update an existing FAQ entry.",
          auth: true,
          body: {
            category_id: "cat_general",
            question: "How do I reset my password?",
            answer: "Click Forgot Password on the login page.",
          },
          response: {
            item: { id: "faq_002", question: "How do I reset my password?" },
          },
        },
        {
          method: "DELETE",
          path: "/faq/items/:id",
          description: "Delete an FAQ item.",
          auth: true,
          response: {
            success: true,
          },
        },
        {
          method: "POST",
          path: "/faq/items/reorder",
          description: "Persist the order of FAQ items within a category.",
          auth: true,
          body: { order: ["faq_001", "faq_002"] },
          response: {
            success: true,
          },
        },
        {
          method: "GET",
          path: "/faq/updates",
          description: "Changelog/updates entries surfaced on marketing pages.",
          auth: true,
          response: {
            updates: [
              {
                id: "update_001",
                title: "October platform update",
                content: "Enhanced Linode support",
                display_order: 1,
              },
            ],
          },
        },
        {
          method: "POST",
          path: "/faq/updates",
          description: "Create a changelog update.",
          auth: true,
          body: { title: "October platform update", content: "Enhanced Linode support" },
          response: {
            update: { id: "update_001", title: "October platform update" },
          },
        },
        {
          method: "PUT",
          path: "/faq/updates/:id",
          description: "Edit a changelog update entry.",
          auth: true,
          body: { title: "October platform update", content: "Added provider integrations" },
          response: {
            update: { id: "update_001", title: "October platform update" },
          },
        },
        {
          method: "DELETE",
          path: "/faq/updates/:id",
          description: "Delete a changelog entry.",
          auth: true,
          response: {
            success: true,
          },
        },
        {
          method: "POST",
          path: "/faq/updates/reorder",
          description: "Persist update ordering for marketing pages.",
          auth: true,
          body: { order: ["update_001", "update_002"] },
          response: {
            success: true,
          },
        },
        {
          method: "GET",
          path: "/contact/categories",
          description: "List support contact categories (used on contact page).",
          auth: true,
          response: {
            categories: [
              { id: "sales", label: "Sales", is_enabled: true },
            ],
          },
        },
        {
          method: "POST",
          path: "/contact/categories",
          description: "Create a support contact category.",
          auth: true,
          body: { label: "Sales", email: "sales@example.com", is_enabled: true },
          response: {
            category: { id: "sales", label: "Sales", is_enabled: true },
          },
        },
        {
          method: "PUT",
          path: "/contact/categories/:id",
          description: "Update contact category metadata.",
          auth: true,
          body: { label: "Sales", email: "sales@example.com", is_enabled: true },
          response: {
            category: { id: "sales", label: "Sales", is_enabled: true },
          },
        },
        {
          method: "DELETE",
          path: "/contact/categories/:id",
          description: "Delete a contact category.",
          auth: true,
          response: {
            success: true,
          },
        },
        {
          method: "POST",
          path: "/contact/categories/reorder",
          description: "Reorder contact categories.",
          auth: true,
          body: { order: ["sales", "support"] },
          response: {
            success: true,
          },
        },
        {
          method: "GET",
          path: "/contact/methods",
          description: "Retrieve available contact methods (email, phone, chat).",
          auth: true,
          response: {
            methods: {
              email: { is_enabled: true, address: "support@example.com" },
              phone: { is_enabled: false },
            },
          },
        },
        {
          method: "PUT",
          path: "/contact/methods/:methodType",
          description: "Update a specific contact method configuration (e.g. toggle live chat).",
          auth: true,
          body: { is_enabled: true, address: "support@example.com" },
          response: {
            method: { type: "email", is_enabled: true },
          },
        },
        {
          method: "GET",
          path: "/providers",
          description: "List infrastructure providers configured in the admin panel.",
          auth: true,
          response: {
            providers: [
              { id: "linode", name: "Linode", type: "linode" },
            ],
          },
        },
        {
          method: "GET",
          path: "/providers/:id/regions",
          description: "Return provider regions with admin-specific metadata (availability, visibility).",
          auth: true,
          response: {
            regions: [
              { id: "us-east", label: "Newark, NJ", enabled: true },
            ],
          },
        },
        {
          method: "GET",
          path: "/providers/:id/marketplace",
          description: "List provider marketplace applications that can be toggled for customers.",
          auth: true,
          response: {
            apps: [
              { slug: "wordpress", label: "WordPress" },
            ],
          },
        },
        {
          method: "GET",
          path: "/rate-limits/overrides",
          description: "List rate limit overrides applied to specific users.",
          auth: true,
          response: {
            overrides: [
              { userId: "user_123", window: 60, maxRequests: 120 },
            ],
          },
        },
        {
          method: "POST",
          path: "/rate-limits/overrides",
          description: "Create or update a rate limit override for a user.",
          auth: true,
          body: { userId: "user_123", window: 60, maxRequests: 120 },
          response: {
            success: true,
          },
        },
        {
          method: "DELETE",
          path: "/rate-limits/overrides/:userId",
          description: "Remove a rate limit override.",
          auth: true,
          response: {
            success: true,
          },
        },
        {
          method: "GET",
          path: "/platform/availability",
          description: "Return global maintenance mode / availability settings displayed on the status page.",
          auth: true,
          response: {
            availability: {
              status: "operational",
              message: "All systems operational",
              updatedAt: "2024-10-25T10:00:00Z",
            },
          },
        },
        {
          method: "PUT",
          path: "/platform/availability",
          description: "Update availability messaging for the hosted status page.",
          auth: true,
          body: {
            status: "maintenance",
            message: "Scheduled maintenance at 22:00 UTC",
          },
          response: {
            success: true,
          },
        },
        {
          method: "GET",
          path: "/theme",
          description: "Retrieve theming configuration (colors, logos) for the tenant.",
          auth: true,
          response: {
            theme: {
              primary: "#2563eb",
              accent: "#9333ea",
              logoUrl: "https://cdn.example.com/logo.svg",
            },
          },
        },
        {
          method: "PUT",
          path: "/theme",
          description: "Update theming configuration.",
          auth: true,
          body: {
            primary: "#2563eb",
            accent: "#9333ea",
            logoUrl: "https://cdn.example.com/logo.svg",
          },
          response: {
            success: true,
          },
        },
      ],
    },
    {
      title: "Platform Health",
      base: `${apiBase}/health`,
      description: "Status endpoints consumed by the public status page and admin rate-limit diagnostics.",
      endpoints: [
        {
          method: "GET",
          path: "/status",
          description: "Overall platform health indicator consumed by the /status marketing page.",
          response: {
            status: "operational",
            components: [
              { id: "api", name: "API", status: "operational" },
              { id: "compute", name: "Compute Provisioning", status: "degraded" },
            ],
            updatedAt: "2024-10-25T10:00:00Z",
          },
        },
        {
          method: "GET",
          path: "/metrics",
          description: "Rolling metrics (request rate, error rate) used by the admin rate-limit dashboard.",
          auth: true,
          params: { window: 15 },
          response: {
            metrics: {
              requestRate: 85,
              errorRate: 1.2,
              windowMinutes: 15,
            },
          },
        },
        {
          method: "GET",
          path: "/rate-limiting",
          description: "Detailed rate limit performance and current throttle states.",
          auth: true,
          response: {
            activeRules: [
              { route: "/api/vps", limit: 60, window: 60, current: 15 },
            ],
          },
        },
      ],
    },
  ], [apiBase]);
  const [selectedSection, setSelectedSection] = useState(sections[0]?.title ?? "");

  const handleCopy = useCallback(async (value: string, label: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      toast.success(`${label} copied to clipboard`);
    } catch (error) {
      console.error("Clipboard copy failed", error);
      toast.error("Unable to copy. Please copy manually.");
    }
  }, []);

  const handleCopyJson = useCallback(
    (payload: unknown, label: string) => handleCopy(formatJson(payload), label),
    [handleCopy]
  );

  const handleScrollToSection = useCallback((title: string) => {
    setSelectedSection(title);
    const anchor = document.getElementById(`section-${title}`);
    if (anchor) {
      anchor.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2 text-primary">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">{BRAND_NAME} API Documentation</CardTitle>
              <CardDescription>
                Updated reference of every backend endpoint consumed by the application. Copy ready-to-use examples for manual testing or onboarding partners.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Rocket className="h-4 w-4" />
              Coverage
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {sections.length} sections spanning authentication, billing, compute, support, and administrative surfaces.
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4" />
              Authentication
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Endpoints marked with a shield require a valid bearer token. Use the copy buttons to speed up requests in tools like Postman.
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4" />
              Usage tips
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Toggle between request payloads, sample responses, and cURL commands inside each endpoint accordion.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Sections</CardTitle>
            <CardDescription>Select a section to jump to its endpoints.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {sections.map((section) => (
              <Button
                key={section.title}
                variant={selectedSection === section.title ? "secondary" : "ghost"}
                className="w-full justify-start"
                onClick={() => handleScrollToSection(section.title)}
              >
                {section.title}
              </Button>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {sections.map((section) => (
            <Card key={section.title} id={`section-${section.title}`}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-4">
                  <span>{section.title}</span>
                  <Badge variant="outline" className="font-normal">
                    Base: {section.base}
                  </Badge>
                </CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {section.endpoints.map((endpoint, index) => (
                    <AccordionItem value={`${section.title}-${index}`} key={`${section.title}-${endpoint.path}-${index}`}>
                      <AccordionTrigger>
                        <div className="flex w-full items-center gap-3 text-left">
                          <Badge className={methodStyles[endpoint.method] ?? methodStyles.DEFAULT}>
                            {endpoint.method}
                          </Badge>
                          <div className="flex flex-col">
                            <span className="font-semibold">{endpoint.path}</span>
                            <span className="text-xs text-muted-foreground">{endpoint.description}</span>
                          </div>
                          {endpoint.auth && (
                            <Badge variant="secondary" className="ml-auto">
                              Auth Required
                            </Badge>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <Tabs defaultValue={endpoint.body ? "request" : endpoint.response ? "response" : "curl"} className="mt-4">
                          <TabsList>
                            {endpoint.body && <TabsTrigger value="request">Request</TabsTrigger>}
                            {endpoint.response && <TabsTrigger value="response">Response</TabsTrigger>}
                            <TabsTrigger value="curl">cURL</TabsTrigger>
                          </TabsList>
                          {endpoint.body && (
                            <TabsContent value="request" className="mt-4">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold">Sample Request Body</h4>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleCopyJson(endpoint.body, "Request body")}
                                >
                                  <Copy className="mr-2 h-4 w-4" /> Copy
                                </Button>
                              </div>
                              <ScrollArea className="mt-2 max-h-60 rounded-md border bg-muted/40 p-4">
                                <pre className="text-xs leading-relaxed">{formatJson(endpoint.body)}</pre>
                              </ScrollArea>
                            </TabsContent>
                          )}
                          {endpoint.response && (
                            <TabsContent value="response" className="mt-4">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold">Sample Response</h4>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleCopyJson(endpoint.response, "Response body")}
                                >
                                  <Copy className="mr-2 h-4 w-4" /> Copy
                                </Button>
                              </div>
                              <ScrollArea className="mt-2 max-h-60 rounded-md border bg-muted/40 p-4">
                                <pre className="text-xs leading-relaxed">{formatJson(endpoint.response)}</pre>
                              </ScrollArea>
                            </TabsContent>
                          )}
                          <TabsContent value="curl" className="mt-4">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-semibold">cURL Example</h4>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleCopy(buildCurlCommand(section.base, endpoint), "cURL command")}
                              >
                                <Copy className="mr-2 h-4 w-4" /> Copy
                              </Button>
                            </div>
                            <ScrollArea className="mt-2 max-h-60 rounded-md border bg-muted/40 p-4">
                              <pre className="text-xs leading-relaxed">{buildCurlCommand(section.base, endpoint)}</pre>
                            </ScrollArea>
                            {endpoint.params && (
                              <p className="mt-2 text-xs text-muted-foreground">
                                Query parameters example: {formatJson(endpoint.params)}
                              </p>
                            )}
                          </TabsContent>
                        </Tabs>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
