# Product Overview

SkyPanelV2 is an open-source cloud service reseller billing panel that provides a unified control plane for managing VPS instances across multiple cloud providers (Linode and DigitalOcean).

## Core Purpose

The platform enables service resellers to:
- Provision and manage VPS instances across multiple cloud providers through a single interface
- Handle customer billing with PayPal-backed prepaid wallets and hourly reconciliation
- Provide white-label branding for their own customers
- Offer a modern self-service portal with real-time notifications and SSH console access

## Key Features

- **Multi-provider VPS management**: Unified interface for Linode and DigitalOcean with provider abstraction and normalized APIs
- **Flexible billing system**: PayPal prepaid wallets, hourly billing reconciliation, invoices, and downloadable billing artifacts
- **White-label experience**: Environment-driven branding, theme toggles, and customizable UI
- **Real-time features**: PostgreSQL LISTEN/NOTIFY feeds Server-Sent Events for activity, billing, and support updates
- **Security**: JWT authentication, role-based access, SSH WebSocket bridge for VPS consoles
- **Team collaboration**: Multi-tenant organizations, role-based routing, and auditable activity logs

## Target Users

- Cloud service resellers who want to offer VPS services under their own brand
- Businesses needing unified management of multi-provider cloud infrastructure
- Teams requiring collaborative VPS management with billing transparency