# SkyPanelV2 PaaS – User Guide

This guide walks organization owners and developers through every PaaS capability that shipped in the backlog: app creation, deployments, scaling/billing, logs, domains/SSL, rollbacks, and usage exports.

## 1. Getting Started

1. Create an organization (or join one).
2. Navigate to **PaaS → Applications**.
3. Ensure your wallet has funds; billing runs hourly and automatically suspends apps when balances reach zero.

### Primary Navigation

| Tab | Purpose |
| --- | --- |
| **Applications** | List apps, status, plan, replica count, cost/hour. |
| **Deployments** | History, build logs, rollback action. |
| **Logs** | Build + runtime logs (SSE stream backed by Loki). |
| **Environment** | Manage secrets/config values. |
| **Domains** | Custom domain + SSL management. |
| **Metrics** | Prometheus-backed CPU/RAM charts and per-replica health. |

## 2. Creating & Deploying an App

1. Click **New Application**.
2. Provide name, Git URL (HTTPS or SSH), branch, plan, and desired replicas.
3. Submit → API enqueues a build job (`buildQueue`) and streams progress in the Deployments tab.
4. Once build completes it automatically triggers a deploy job with health checks and scaling rules.

### Build Options

| Option | Description |
| --- | --- |
| **Auto-detected buildpack** | Builder inspects repo files and selects Herokuish buildpack. |
| **Custom buildpack** | Provide a Git URL or short slug (e.g., `heroku/nodejs`). |
| **Build cache** | Enabled by default if admin turns on caching; clear manually via *App Settings → Clear Build Cache*. |

## 3. Managing an Application

### Scaling
Use the **Scale Slider** on the Overview tab. The UI shows:
- Current replicas vs. plan max.
- Projected hourly cost.
- Wallet balance after scaling.

### Quick Actions
- **View Logs**: jumps to the live SSE view with filters (build/app/router/system).
- **Deployment History**: review buildpack, slug size, commit, status.
- **Delete App**: removes services, slugs, and domains (with confirmation).

### Environment Variables
- Add/update/delete key/value pairs. Sensitive values are encrypted server-side.
- Import `.env` files or export a sanitized list.
- System variables (`PORT`, `DYNO`, `PS`) are injected automatically at deploy time.

### Domains & SSL
1. Add domain.
2. Provide TXT record for verification (shown in modal).
3. After verification, Traefik + Let's Encrypt provisions SSL automatically.
4. Status badges show verification + SSL state; worker rechecks certificates periodically.

### Logs
- Build logs stored with deployments (`BuilderService.logBuild`).
- Runtime logs come from Loki; use filters (level, pod, time range) and the live stream toggle.
- SSE endpoint (`/api/paas/apps/:id/logs/stream`) supports reconnect + abort.

### Metrics & Health
- Cards summarize CPU, RAM, network, response latency (Prometheus queries).
- Health Check status shows the configured HTTP/TCP path, interval, retries, and last failure reason.

## 4. Deployments, Rollbacks, and Restarting

| Action | Effect |
| --- | --- |
| **Redeploy** | Triggers fresh build + deploy pipeline. |
| **Rollback** | Prefetches cached slug, skips rebuild, redeploys previous version, and records lineage. |
| **Restart** | Scales suspended/stopped apps back to target replicas or reuses last good slug. |
| **Stop** | Scales to zero and pauses billing for replicas (storage + logs still billed per plan). |

Rollbacks inherit build logs and record metrics like duration, cached slug path, and replicas restored. Activity feed entries (per org) capture each action for audit purposes.

## 5. Usage & Billing

### User Portal
- **PaaS Usage** page renders hourly cost per app with filters by time range and plan.
- Wallet deductions run hourly. Apps stop automatically when balances are exhausted; UI surfaces suspension state with guidance.

### API Reference

| Endpoint | Description |
| --- | --- |
| `GET /api/paas/apps` | List organization apps with plan + cost metadata. |
| `POST /api/paas/apps` | Create app (requires plan + git metadata). |
| `POST /api/paas/apps/:id/deploy` | Trigger a deploy; returns queue job id. |
| `GET /api/paas/apps/:id/deployments` | Paginated deployment history. |
| `POST /api/paas/apps/:id/rollback` | Roll back to selected deployment. |
| `POST /api/paas/apps/:id/scale` | Adjust replicas (enforces limits + wallet balance). |
| `GET /api/paas/apps/:id/logs` | Historical logs. |
| `GET /api/paas/apps/:id/logs/stream` | SSE log stream. |
| `GET /api/paas/usage` | Usage summary for current org. |

All routes require JWT auth + organization context (provided by the dashboard automatically).

## 6. Tutorials

1. **First Deployment**
   1. Create app → GitHub URL → `main` branch.
   2. Watch Deployment Progress panel; confirm status transitions `building → deploying → running`.
   3. Test default domain `https://<subdomain>.apps.example.com`.
2. **Connect Custom Domain**
   1. Add domain → copy TXT token → create DNS record.
   2. Click *Verify*. Once status shows “Verified”, toggle SSL if not automatic.
   3. Hit the domain in the browser; certificate is issued via Traefik/Let’s Encrypt.
3. **Recover from Failed Build**
   1. Open Deployments tab → failed build row → expand logs.
   2. Fix repository issue, push, then click *Redeploy*.
   3. Optional: clear build cache via App Settings before retrying.
4. **Export Usage**
   1. Admin → PaaS Usage Reports → pick time range.
   2. Download CSV for accounting systems.

## 7. FAQ

| Question | Answer |
| --- | --- |
| Why did my app scale down to zero? | Wallet balance hit zero or org was suspended; refill funds or ask admin to resume. |
| Do I need to rerun `npm run paas:init` every deploy? | Only when infrastructure stack files change (e.g., Loki/Traefik updates). |
| How do I view real-time logs? | Open the Logs tab and toggle “Live stream”. SSE reconnects automatically if the browser tab sleeps. |
| Can I use private repos? | Yes—configure Git HTTPS token or SSH key under Admin → PaaS Settings. |
| What happens if a health check fails? | Worker restarts unhealthy replicas after 3 consecutive failures and records an activity log entry. |

You now have a complete tour of the UI + API surface, including every new capability implemented for the PaaS backlog.
