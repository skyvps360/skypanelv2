# CaaS Migration - Remaining Work Guide

## Overview
This document outlines the remaining work to complete the Easypanel/Dokploy to CaaS migration.

## Completed Work (~80%)

### Backend Infrastructure ✅
- Created `api/services/caasService.ts` with full Docker integration
- Database migration `003_migrate_to_caas.sql` ready to deploy
- Updated error handling system for CaaS
- Updated configuration system
- Removed legacy service files

### Frontend Infrastructure ✅
- Created CaasConfig admin page
- Updated containerService.ts with CaaS methods
- Updated navigation and routing
- Removed legacy UI components

### Documentation ✅
- Updated README.md
- Updated .env.example
- Configuration documented

## Remaining Work (~20%)

### Critical: Container Routes (api/routes/containers.ts)

The containers.ts file has ~40 remaining references to easypanel/dokploy services that need updating.

**Problem Areas:**
1. **Lines 151-365**: Old easypanel test connection logic
2. **Lines 1365-3310**: Service deployment and management routes

**Solution Pattern:**
```typescript
// OLD:
const result = await easypanelService.createProject(projectName);
const result = await dokployService.deployApp(config);

// NEW:
const result = await caasService.createProject(projectName, owner);
const result = await caasService.deployApp({...config, project: projectName});
```

**Key Method Mappings:**

| Old (Easypanel/Dokploy) | New (CaaS) |
|--------------------------|------------|
| `createProject(name)` | `createProject(name, owner)` |
| `deployApp(config)` | `deployApp({...config, project})` |
| `deployDatabase(config)` | `deployDatabase({...config, project, serviceName})` |
| `listProjectsAndServices()` | `listProjects()` + `listServices(project)` |
| `startService(id)` | `startService(serviceId)` |
| `stopService(id)` | `stopService(serviceId)` |
| `getLogs(id)` | `getLogs(serviceId, options)` |

### TypeScript Errors to Fix

Current errors from `npm run check`:
```
api/routes/containers.ts - 38 errors (easypanelService/dokployService references)
src/pages/ContainerProjects.tsx - 2 errors (serviceCount property)
src/pages/admin/CaasConfig.tsx - 3 errors (status property type)
src/pages/admin/AdminUserDetail.tsx - 1 error (onSuccess prop)
```

### Recommended Approach

#### Phase 1: Fix Configuration Routes (1-2 hours)
Replace remaining easypanelService references in lines 151-365:
- Update test connection routes to use caasService.testConnection()
- Remove Dokploy-specific routes (lines 354-620)
- Ensure config endpoints only use caasService

#### Phase 2: Update Service Deployment Routes (2-3 hours)
Replace service method calls in lines 1365-3310:
- Project creation/deletion
- Service deployment (apps, databases, templates)
- Service lifecycle management (start/stop/restart)
- Environment and resource updates
- Log retrieval

#### Phase 3: Fix TypeScript Errors (1 hour)
- Add missing type properties
- Update CaasConfig types
- Fix ContainerProjects serviceCount references

#### Phase 4: Testing (1-2 hours)
1. Run database migration
2. Test admin config flow
3. Test project creation
4. Test service deployment
5. Test service management

## Quick Fixes for Common Errors

### 1. EasypanelConfig type error
```typescript
// In types file, add or update:
export interface CaasConfig {
  id?: string;
  apiUrl: string;
  apiKey?: string;
  hasApiKey?: boolean;
  status?: 'healthy' | 'degraded' | 'unknown';
  lastConnectionTest?: string;
  connectionStatus?: 'success' | 'failed' | 'pending' | 'connected';
  source?: 'db' | 'env' | 'none';
}
```

### 2. Service count property
```typescript
// The caasService doesn't track serviceCount directly
// Either compute it from listServices() or remove the property display
```

### 3. Mass replacement commands
```bash
# Careful - review each change!
cd api/routes

# Replace service references
sed -i 's/easypanelService\./caasService\./g' containers.ts
sed -i 's/dokployService\./caasService\./g' containers.ts

# Update method calls (will need manual adjustment)
sed -i 's/\.createProject(\([^)]*\))/\.createProject(\1, owner)/g' containers.ts
```

## Testing Checklist

After completing updates:

- [ ] `npm run check` passes without errors
- [ ] `npm run lint` passes
- [ ] `npm run build` succeeds
- [ ] Database migration applies cleanly
- [ ] Admin can configure CaaS in UI
- [ ] Connection test works
- [ ] Can create container plan
- [ ] Can subscribe to plan
- [ ] Can create project
- [ ] Can deploy simple app (nginx)
- [ ] Can start/stop/restart service
- [ ] Can view logs
- [ ] Can delete service
- [ ] Can delete project

## Docker Setup for Testing

```bash
# Ensure Docker is running
sudo systemctl start docker

# For development, expose Docker API
# WARNING: Only for development, not production!
sudo dockerd -H unix:///var/run/docker.sock -H tcp://0.0.0.0:2375

# Or configure in /etc/docker/daemon.json:
{
  "hosts": ["unix:///var/run/docker.sock", "tcp://127.0.0.1:2375"]
}

# Then set in .env:
CAAS_API_URL=http://localhost:2375
```

## Production Considerations

1. **Docker Security**: Use TLS for Docker API in production
2. **Resource Limits**: Configure cgroups v2 for proper isolation
3. **Network Policies**: Set up iptables rules for tenant isolation
4. **Storage Quotas**: Configure disk quotas per tenant
5. **Monitoring**: Add metrics collection for container health

## Support

If you encounter issues:
1. Check migration logs: `node scripts/run-migration.js`
2. Test Docker connection: `docker ps` should work from app server
3. Check CaaS service logs for detailed errors
4. Refer to caasService.ts JSDoc comments for method usage

## Summary

The foundation is solid - ~80% complete. The remaining work is primarily:
1. Updating route handlers to use caasService (mechanical, can be scripted)
2. Fixing TypeScript errors (straightforward type additions)
3. Testing the full workflow

Total estimated time to completion: 5-8 hours of focused development work.
