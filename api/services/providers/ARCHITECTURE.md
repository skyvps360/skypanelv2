# Provider Service Architecture (Linode)

```
┌──────────────────────────────┐
│ service_providers            │
│ • id, name, type='linode'    │
│ • api_key_encrypted          │
└──────────────┬───────────────┘
               │ normalizeProviderToken()
┌──────────────▼───────────────┐
│ ProviderFactory              │
│ └─> LinodeProviderService    │
│      implements IProviderService
│      • createInstance()      │
│      • getInstance()         │
│      • listInstances()       │
└──────────────┬───────────────┘
               │ uses
┌──────────────▼───────────────┐
│ linodeService wrapper        │
│ • REST calls -> api.linode.com│
│ • caching + normalization    │
└──────────────────────────────┘
```

## IProviderService Surface Area

- `createInstance(CreateInstanceParams)` – delegates to `linodeService.createLinodeInstance`.
- `getInstance(id)` – fetches instance details and normalizes status, IPs, specs.
- `listInstances()` – used by the legacy admin routes to reconcile progress.
- `performAction(id, action)` – reboot/shutdown/delete maps to the appropriate Linode API endpoint.
- `getPlans()/getImages()/getRegions()` – cached wrappers around the Linode catalog endpoints.

## Database Touchpoints

- `service_providers.type` is constrained to `'linode'`.
- `vps_instances.provider_type` still exists for backwards compatibility but the UI now always stores `'linode'`.
- `user_ssh_keys.linode_key_id` tracks the remote SSH key ID.
- `vps_plans` drives pricing, markup, and backup settings. Daily/weekly fields remain for legacy data.

## API Flow (Create VPS)

1. `/api/vps/providers` – returns active Linode providers (honoring `allowed_regions` overrides).
2. `/api/vps/plans` – surfaces curated plans stored in `vps_plans`.
3. `/api/vps/apps` – returns admin-approved StackScripts/marketplace apps.
4. `POST /api/vps` – body includes:

```json
{
  "provider_id": "uuid",
  "provider_type": "linode",
  "label": "skp-prod-1234",
  "type": "g6-standard-2",
  "region": "us-east",
  "image": "linode/ubuntu24.04",
  "rootPassword": "Secure#Pass123",
  "sshKeys": ["key-id-from-ui"],
  "backups": true,
  "backup_frequency": "weekly",
  "privateIP": false,
  "stackscriptId": 12345,
  "stackscriptData": { "db_password": "secret" }
}
```

The route resolves the provider token via `normalizeProviderToken`, calls `LinodeProviderService.createInstance`, and persists the instance with `provider_id`/`provider_type`.

## Admin Responsibilities

- **Providers**: store the Linode API token in `/admin#providers`.
- **Plans**: map Linode plan IDs to retail pricing (`/admin#plans`).
- **Regions**: optionally restrict regions per provider (stored in `provider_region_overrides`).
- **StackScripts**: manage curated StackScripts and metadata (`/admin#stackscripts`).

This simplified architecture is easier to extend in the future, but for now focuses exclusively on Linode. If a new provider is introduced later, the same abstractions (ProviderFactory, IProviderService) can be expanded without revisiting the UI flow.
