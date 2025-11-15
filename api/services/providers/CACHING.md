# Provider Resource Caching

## Overview

The provider resource caching system implements in-memory caching for frequently accessed provider resources to reduce API calls and improve performance.

## Cached Resources

### Plans (1 hour TTL)
- Linode types/plans
- Cached per provider ID

### OS Images (1 hour TTL)
- Linode images
- Cached per provider ID

### Regions (24 hours TTL)
- Linode regions
- Cached per provider ID

## Cache Invalidation

Caches are automatically invalidated when:

1. **Provider Configuration Changes** - When an admin updates provider settings via:
   - `POST /api/admin/providers` - Creating a new provider
   - `PUT /api/admin/providers/:id` - Updating provider configuration
   - `DELETE /api/admin/providers/:id` - Deleting a provider

2. **Manual Invalidation** - Via the `ProviderResourceCache` API:
   ```typescript
   // Invalidate all resources for a provider
   ProviderResourceCache.invalidateProvider(providerId);
   
   // Invalidate specific resource type
   ProviderResourceCache.invalidateResource(providerId, 'plans');
   
   // Clear all caches
   ProviderResourceCache.clearAll();
   ```

## Implementation Details

### Cache Storage
- In-memory Map-based storage
- Keyed by provider ID for multi-provider support
- Each cache entry includes:
  - `data`: The cached resource array
  - `timestamp`: When the data was cached
  - `providerId`: The provider this data belongs to

### Cache Validation
- TTL-based expiration
- Configurable per resource type
- Automatic cache miss on expired entries

### Provider Service Integration
- `LinodeProviderService` checks cache before API calls
- Provider ID passed through `ProviderFactory` for cache keying

## Configuration

### Adjusting TTL
```typescript
// Set plans cache to 2 hours
ProviderResourceCache.configureTTL('plans', 2 * 60 * 60 * 1000);

// Set marketplace cache to 12 hours
ProviderResourceCache.configureTTL('marketplace', 12 * 60 * 60 * 1000);
```

### Enabling/Disabling Cache
```typescript
// Disable plans caching
ProviderResourceCache.setCacheEnabled('plans', false);

// Re-enable plans caching
ProviderResourceCache.setCacheEnabled('plans', true);
```

## Monitoring

### Cache Statistics
```typescript
const stats = ProviderResourceCache.getStats();
console.log(stats);
// {
//   plans: { size: 2, providers: ['uuid-1', 'uuid-2'] },
//   images: { size: 2, providers: ['uuid-1', 'uuid-2'] },
//   regions: { size: 2, providers: ['uuid-1', 'uuid-2'] }
// }
```

### Cache Logging
Cache operations are logged to console:
- `[Cache HIT]` - Data served from cache
- `[Cache MISS]` - Data fetched from provider API
- `[Cache SET]` - Data stored in cache
- `[Cache INVALIDATE]` - Cache cleared
- `[Cache CLEAR]` - All caches cleared
- `[Cache CONFIG]` - Configuration changed

## Performance Impact

### Benefits
- Reduced API calls to provider APIs
- Faster response times for resource listings
- Lower rate limit consumption
- Improved user experience

### Considerations
- Memory usage scales with number of providers
- Stale data possible within TTL window
- Cache invalidation on provider changes ensures consistency

## Future Enhancements

Potential improvements for production deployments:

1. **Redis Integration** - Replace in-memory cache with Redis for:
   - Shared cache across multiple server instances
   - Persistence across server restarts
   - Better memory management

2. **Cache Warming** - Pre-populate caches on server startup

3. **Metrics Collection** - Track cache hit/miss rates for optimization

4. **Conditional Requests** - Use ETags/Last-Modified headers with provider APIs

5. **Background Refresh** - Refresh cache before expiration to avoid cache misses
