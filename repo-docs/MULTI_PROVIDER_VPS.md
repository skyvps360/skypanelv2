# Linode VPS Architecture

SkyPanel now focuses exclusively on delivering a polished Linode integration. This document replaces the older multi-provider guide and summarizes the pieces that remain relevant for provisioning VPS instances, managing plans, and exposing the API.

## Provider Service Overview

```
┌──────────────────────────────┐
│  service_providers table     │
│  • id, name, type='linode'   │
│  • api_key_encrypted         │
└──────────────┬───────────────┘
               │ normalize/token handling
┌──────────────▼───────────────┐
│  ProviderFactory (linode)    │
│  └─> LinodeProviderService   │
│       • createInstance       │
│       • getInstance          │
│       • listInstances        │
└──────────────┬───────────────┘
               │ consumes
┌──────────────▼───────────────┐
│  linodeService wrapper       │
│  • REST calls to Linode API  │
│  • caching + normalization   │
└──────────────────────────────┘
```

### Key API Endpoints

- `POST /api/vps` – creates a Linode instance using a plan (`provider_plan_id`), region, image, SSH keys, and optional StackScript metadata.
- `GET /api/vps/providers` – lists active Linode providers for the organization.
- `GET /api/vps/plans` – exposes curated plans stored in `vps_plans`.
- `GET /api/vps/apps` – returns the marketplace/StackScript catalogue maintained by the admin console.

## Admin Console Touchpoints

1. **Providers** – `/admin#providers`
   - Adds Linode API tokens.
   - Stores allowed regions and display order for the create flow.

2. **Plans** – `/admin#plans`
   - Associates a Linode plan (`provider_plan_id`) with retail pricing, backup pricing, and availability toggles.

3. **Regions** – `/admin#regions`
   - Optional allowlist to restrict the regions displayed to end-users.

4. **StackScripts/Marketplace** – `/admin#stackscripts`
   - Admin-curated StackScripts can be toggled on/off and re-ordered. Marketplace apps are represented as StackScripts with metadata.

## Database Highlights

- `service_providers` – now constrained to `type = 'linode'`.
- `vps_plans` – contains pricing, markup, and backup configuration. Daily/weekly backups still exist for backwards compatibility but default to weekly usage.
- `user_ssh_keys` – only tracks Linode key IDs (`linode_key_id`).
- `provider_region_overrides` – optional allowlist per provider.

## API Consumers (client)

The `CreateVPS` modal uses:

1. `ProviderSelector` → resolves provider + region allowlists.
2. `PlanSelector` → pulls from `vps_plans`.
3. `CreateVPSSteps` → StackScript selection, OS selection, and final configuration.
4. `LinodeConfiguration` → collects backups, SSH keys, and private IP options.

### Form Payload

```json
{
  "provider_id": "uuid",
  "provider_type": "linode",
  "label": "skp-prod-1234",
  "type": "g6-standard-2",
  "region": "us-east",
  "image": "linode/ubuntu24.04",
  "rootPassword": "secure-password",
  "sshKeys": ["key-id-1"],
  "backups": true,
  "backup_frequency": "weekly",
  "privateIP": false,
  "stackscriptId": 12345,
  "stackscriptData": { "db_password": "secret" }
}
```

## Deployment Checklist

1. Generate `SSH_CRED_SECRET`.
2. Configure `LINODE_API_TOKEN` in `.env`.
3. Add the provider in `/admin#providers`.
4. Synchronize Linode plans (`fetchLinodeTypes`) and regions (`fetchLinodeRegions`).
5. Configure StackScripts/marketplace apps.
6. Create retail plans in `/admin#plans`.

With these pieces in place, SkyPanel operates strictly against Linode while reusing the existing abstractions (provider service, plan catalogue, and admin workflows). Documenting additional providers can be revisited if multi-provider work resumes in the future.
