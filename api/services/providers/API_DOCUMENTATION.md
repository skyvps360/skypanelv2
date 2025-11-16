# Provider API Notes (Linode)

SkyPanel exposes a handful of internal endpoints that wrap the Linode API. This file captures the Linode-focused endpoints.

## Admin Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/admin/providers` | Save Linode credentials (`api_key_encrypted`). |
| `GET`  | `/api/admin/providers/:id/regions` | Fetch Linode regions with optional allowlist logic. |
| `GET`  | `/api/admin/upstream/plans` | Retrieves Linode plan catalogue for the admin UI. |
| `GET`  | `/api/admin/upstream/regions` | Retrieves Linode region catalogue for the admin UI. |

## VPS Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/vps/providers` | Lists active Linode providers. |
| `GET`  | `/api/vps/plans`     | Lists curated Linode plans (`vps_plans`). |
| `GET`  | `/api/vps/apps`      | Lists StackScripts/marketplace apps configured by admins. |
| `POST` | `/api/vps`          | Creates a Linode instance. |

### `POST /api/vps` Body

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
  "stackscriptData": {
    "db_password": "secret"
  }
}
```

The API response includes the normalized Linode instance plus pricing metadata pulled from `vps_plans`.

## Client Integration

- `ProviderSelector` → `/api/vps/providers`
- `PlanSelector` → `/api/vps/plans`
- `CreateVPSSteps` → `/api/vps/apps` (StackScripts/marketplace)
- `RegionSelector` → `/api/vps/providers/:id/regions`

No other provider-specific endpoints remain. If another provider is added in the future, the previous multi-provider patterns (factory, provider service, caching) can be reused without impacting existing Linode behavior.
