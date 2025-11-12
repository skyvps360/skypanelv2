# Container Platform Environment Variables

This document explains the environment variables used by the container platform and clarifies the distinction between different URL configurations.

## Critical Environment Variables

### CONTAINER_INGRESS_DOMAIN

**Purpose**: Bare domain for container service ingress routing

**Format**: Domain name only (no scheme, no port)

**Example**: `containers.example.com`

**Usage**: Each deployed container service gets a subdomain:
- Service slug: `my-app`
- Full URL: `my-app.containers.example.com`

**Why separate from CLIENT_URL?**
- `CLIENT_URL` is the full URL to the frontend application (e.g., `https://panel.example.com:5173`)
- `CONTAINER_INGRESS_DOMAIN` is just the domain for container routing (e.g., `containers.example.com`)
- Traefik needs a bare domain for Host() rules, not a full URL

**Configuration in Traefik**:
```typescript
'traefik.http.routers.${serviceName}.rule': `Host(\`${slug}.${CONTAINER_INGRESS_DOMAIN}\`)`
```

### API_URL

**Purpose**: Full URL to the API server for worker-to-manager communication

**Format**: Full URL with scheme and port

**Example**: `https://api.example.com` or `http://localhost:3001`

**Usage**: Worker nodes use this to:
- Send heartbeat updates
- Receive deployment commands
- Report metrics and status

**Why separate from CLIENT_URL?**
- `CLIENT_URL` points to the frontend application (Vite dev server or static build)
- `API_URL` points to the backend API server (Express)
- Workers need to communicate with the API, not the frontend

**Fallback logic**:
```typescript
const apiUrl = process.env.VITE_API_URL || process.env.API_URL || 'http://localhost:3001';
```

### CLIENT_URL

**Purpose**: Full URL to the frontend application

**Format**: Full URL with scheme and port

**Example**: `https://panel.example.com` or `http://localhost:5173`

**Usage**: 
- Frontend application base URL
- Used for CORS configuration
- Used for email links and notifications
- NOT used for worker communication or container ingress

## Environment Variable Comparison

| Variable | Purpose | Format | Example | Used By |
|----------|---------|--------|---------|---------|
| `CLIENT_URL` | Frontend app URL | Full URL | `https://panel.example.com` | Frontend, emails, CORS |
| `API_URL` | Backend API URL | Full URL | `https://api.example.com` | Workers, internal services |
| `VITE_API_URL` | Frontend API endpoint | Full URL | `https://api.example.com/api` | Frontend API calls |
| `CONTAINER_INGRESS_DOMAIN` | Container routing domain | Bare domain | `containers.example.com` | Traefik, container routing |

## Development vs Production

### Development (.env)

```bash
# Frontend runs on Vite dev server
CLIENT_URL=http://localhost:5173

# Backend API runs on Express
API_URL=http://localhost:3001

# Frontend makes API calls to backend
VITE_API_URL=http://localhost:3001/api

# Containers accessible on localhost subdomains
CONTAINER_INGRESS_DOMAIN=localhost
```

### Production (.env)

```bash
# Frontend served from domain
CLIENT_URL=https://panel.example.com

# Backend API on same or different domain
API_URL=https://api.example.com

# Frontend makes API calls to backend
VITE_API_URL=https://api.example.com/api

# Containers on separate subdomain
CONTAINER_INGRESS_DOMAIN=containers.example.com
```

## Worker Configuration

When a worker is registered, it receives a configuration file with the API URL:

```json
{
  "apiUrl": "https://api.example.com",
  "authToken": "jwt-token-here",
  "workerId": "worker-123",
  "heartbeatInterval": 30
}
```

The worker uses `apiUrl` to communicate with the manager:

```javascript
const url = new URL(`${config.apiUrl}/api/workers/${config.workerId}/heartbeat`);
```

## Container Service URLs

When a container service is deployed:

1. **Internal DNS**: `{service-slug}` (within organization network)
2. **Public URL**: `{service-slug}.{CONTAINER_INGRESS_DOMAIN}`

Example:
- Service slug: `my-api`
- Internal: `my-api` (accessible by other containers in same org)
- Public: `my-api.containers.example.com` (accessible from internet)

## Migration Notes

### Before (Incorrect)

```typescript
// ❌ Using CLIENT_URL for Traefik (includes scheme and port)
'traefik.http.routers.${serviceName}.rule': `Host(\`${slug}.${CLIENT_URL}\`)`
// Result: Host(`my-app.https://panel.example.com:5173`) - INVALID

// ❌ Using CLIENT_URL for worker communication
const url = new URL(`${config.clientUrl}/api/workers/heartbeat`);
// Result: Workers try to connect to frontend, not API
```

### After (Correct)

```typescript
// ✅ Using CONTAINER_INGRESS_DOMAIN for Traefik (bare domain)
'traefik.http.routers.${serviceName}.rule': `Host(\`${slug}.${CONTAINER_INGRESS_DOMAIN}\`)`
// Result: Host(`my-app.containers.example.com`) - VALID

// ✅ Using API_URL for worker communication
const url = new URL(`${config.apiUrl}/api/workers/heartbeat`);
// Result: Workers connect to API server correctly
```

## Troubleshooting

### Issue: Containers not accessible via public URL

**Check**:
1. Is `CONTAINER_INGRESS_DOMAIN` set correctly?
2. Does DNS point to your server?
3. Is Traefik running and configured?

**Debug**:
```bash
# Check Traefik labels on service
docker service inspect org-{orgId}-{slug} --format '{{json .Spec.Labels}}'

# Check DNS resolution
nslookup my-app.containers.example.com
```

### Issue: Workers not connecting to manager

**Check**:
1. Is `API_URL` set correctly in worker config?
2. Can workers reach the API server?
3. Is the auth token valid?

**Debug**:
```bash
# Check worker config
cat /opt/skypanel-worker/config.json

# Test API connectivity
curl -I https://api.example.com/health

# Check worker logs
journalctl -u skypanel-worker -f
```

### Issue: Frontend can't reach API

**Check**:
1. Is `VITE_API_URL` set correctly?
2. Is CORS configured properly?
3. Is the API server running?

**Debug**:
```bash
# Check frontend API configuration
echo $VITE_API_URL

# Test API endpoint
curl https://api.example.com/api/health

# Check browser console for CORS errors
```

## Best Practices

1. **Use separate domains for different purposes**:
   - Frontend: `panel.example.com`
   - API: `api.example.com`
   - Containers: `containers.example.com`

2. **Use HTTPS in production**:
   - All URLs should use `https://` scheme
   - Configure SSL certificates for all domains

3. **Use environment-specific values**:
   - Development: `localhost` with ports
   - Staging: Staging domains
   - Production: Production domains

4. **Document your configuration**:
   - Keep `.env.example` up to date
   - Document any custom configurations
   - Include examples for common setups

## References

- [Traefik Host Rule Documentation](https://doc.traefik.io/traefik/routing/routers/#rule)
- [Docker Swarm Networking](https://docs.docker.com/engine/swarm/networking/)
- [Express CORS Configuration](https://expressjs.com/en/resources/middleware/cors.html)
