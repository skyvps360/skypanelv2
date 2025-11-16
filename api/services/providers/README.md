# Provider Service Docs

The provider service layer wraps Linode's REST API behind a small abstraction so the rest of the application does not speak directly to the vendor SDK. Multi-provider support used to exist; the codebase now focuses solely on Linode.

## File Overview

| File | Purpose |
|------|---------|
| `IProviderService.ts` | Interface contract representing provider capabilities (create/list/get/etc). |
| `ProviderFactory.ts` | Returns a `LinodeProviderService` instance with encrypted token handling. |
| `LinodeProviderService.ts` | Implementation of `IProviderService` that proxies into `linodeService`. |
| `errorNormalizer.ts` | Converts Linode API errors into a consistent shape (`ProviderError`). |

## Typical Flow

1. API route resolves a provider record (`service_providers`).
2. Token is normalized via `normalizeProviderToken`.
3. `ProviderFactory.createProvider('linode', token)` returns `LinodeProviderService`.
4. Route calls `createInstance`, `getInstance`, `performAction`, etc.
5. Responses are normalized before being persisted or returned to the client.

### Example

```ts
import { getProviderService } from "@/api/services/providerService";

const provider = await getProviderService(providerId); // throws if inactive/missing token
const instance = await provider.createInstance({
  label: "skp-prod-1234",
  type: "g6-standard-2",
  region: "us-east",
  image: "linode/ubuntu24.04",
  rootPassword: "Secure#Pass123",
  sshKeys: ["key-id"],
  backups: true,
  stackscriptId: 12345,
  stackscriptData: { db_password: "secret" },
});
```

See `repo-docs/MULTI_PROVIDER_VPS.md` for a higher-level view of how plans, regions, and StackScripts feed into this layer.
