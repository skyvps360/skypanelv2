# Product Overview

SkyPanelV2 is an open-source cloud service reseller control panel for VPS hosting businesses. It provides a white-label platform for managing multi-provider VPS infrastructure with integrated billing and customer self-service.

## Core Features

- **Multi-Provider VPS Management**: Unified interface for Linode and DigitalOcean with provider abstraction, normalized APIs, and intelligent caching
- **Prepaid Wallet Billing**: PayPal-backed wallet system with hourly reconciliation, invoices, and transaction history
- **White-Label Branding**: Environment-driven customization of brand name, theme, and provider visibility
- **Real-Time Notifications**: PostgreSQL LISTEN/NOTIFY with Server-Sent Events for activity, billing, and support updates
- **SSH Web Console**: WebSocket-based SSH bridge for direct VPS terminal access
- **Support Ticketing**: Built-in ticket system with categories, priorities, and admin/user views
- **Role-Based Access**: JWT authentication with admin impersonation and multi-tenant organizations

## Target Users

- **End Users**: Self-service VPS provisioning, billing management, SSH console access
- **Admins**: User management, provider configuration, support tickets, platform settings, billing oversight

## White-Label Philosophy

The platform is designed for resellers to brand as their own cloud hosting business. Provider names (Linode/DigitalOcean) can be hidden from customers, and all branding is controlled via environment variables.
