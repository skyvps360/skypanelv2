# Git Webhook Integration

This document describes the Git webhook integration for automatic container deployments in SkyPanelV2.

## Overview

The webhook integration enables automatic builds and deployments when code is pushed to a Git repository. When a webhook is received from GitHub, GitLab, or Bitbucket, the system:

1. Validates the webhook signature to ensure authenticity
2. Extracts commit information from the payload
3. Checks if the branch matches the service configuration
4. Triggers a build asynchronously
5. Deploys the new version automatically on build success
6. Performs health checks before routing traffic
7. Automatically rolls back if the deployment fails

## Supported Git Providers

- **GitHub**: Uses HMAC SHA-256 signature validation with `X-Hub-Signature-256` header
- **GitLab**: Uses token-based validation with `X-Gitlab-Token` header
- **Bitbucket**: Uses HMAC SHA-256 signature validation with `X-Hub-Signature` header

## Setup Instructions

### 1. Get Webhook URL and Secret

Make a GET request to get the webhook URL and secret for your service:

```bash
GET /api/containers/services/:serviceId/webhook-url?provider=github
```

Response:
```json
{
  "webhookUrl": "https://your-domain.com/api/containers/webhooks/github/service-id",
  "secret": "generated-secret-key",
  "provider": "github",
  "instructions": "Add this URL to your GitHub repository settings..."
}
```

### 2. Configure Webhook in Git Provider

#### GitHub

1. Go to your repository settings
2. Navigate to **Webhooks** → **Add webhook**
3. Set **Payload URL** to the webhook URL from step 1
4. Set **Content type** to `application/json`
5. Set **Secret** to the secret from step 1
6. Select **Just the push event**
7. Ensure **Active** is checked
8. Click **Add webhook**

#### GitLab

1. Go to your project settings
2. Navigate to **Webhooks**
3. Set **URL** to the webhook URL from step 1
4. Set **Secret token** to the secret from step 1
5. Check **Push events**
6. Uncheck all other events
7. Click **Add webhook**

#### Bitbucket

1. Go to your repository settings
2. Navigate to **Webhooks** → **Add webhook**
3. Set **URL** to the webhook URL from step 1
4. Set **Secret** to the secret from step 1
5. Select **Repository push** trigger
6. Click **Save**

## Webhook Flow

### 1. Webhook Received

When a push event occurs, the Git provider sends a webhook to:
```
POST /api/containers/webhooks/{provider}/{serviceId}
```

The webhook handler:
- Validates the signature/token
- Extracts commit information
- Returns 200 OK immediately (async processing)

### 2. Build Triggered

The system asynchronously:
- Updates service status to `building`
- Sends notification to user about build start
- Clones the repository at the specific commit
- Builds the application using Nix
- Creates a Docker image
- Pushes the image to the registry

### 3. Automatic Deployment

On successful build:
- Updates service status to `deploying`
- Preserves previous deployment for rollback
- Deploys new container to Docker Swarm
- Performs health check (60 second timeout)
- Routes traffic to new container if healthy

### 4. Health Check and Rollback

The health check verifies:
- All replicas are running
- No tasks have failed
- Service responds correctly

If health check fails:
- Automatically rolls back to previous deployment
- Sends notification about rollback
- Service continues running on previous version

## API Endpoints

### Webhook Handlers

```
POST /api/containers/webhooks/github/:serviceId
POST /api/containers/webhooks/gitlab/:serviceId
POST /api/containers/webhooks/bitbucket/:serviceId
```

### Get Webhook Configuration

```
GET /api/containers/services/:serviceId/webhook-url?provider={github|gitlab|bitbucket}
```

## Notifications

Users receive real-time notifications for:

- **webhook_received**: Webhook received from Git provider
- **build_started**: Build started for commit
- **build_completed**: Build completed successfully
- **build_failed**: Build failed with error details
- **deployment_started**: Deployment started
- **deployment_completed**: Deployment successful
- **deployment_failed**: Deployment failed
- **deployment_rollback**: Automatic rollback completed
- **deployment_rollback_failed**: Rollback failed

## Security

### Signature Validation

All webhooks are validated using cryptographic signatures:

- **GitHub**: HMAC SHA-256 with `X-Hub-Signature-256` header
- **GitLab**: Token comparison with `X-Gitlab-Token` header
- **Bitbucket**: HMAC SHA-256 with `X-Hub-Signature` header

Invalid signatures are rejected with 401 Unauthorized.

### Timing-Safe Comparison

All signature comparisons use `crypto.timingSafeEqual()` to prevent timing attacks.

### Branch Validation

Only pushes to the configured branch trigger builds. Pushes to other branches are ignored.

## Error Handling

### Build Failures

If a build fails:
- Current deployment continues running (no disruption)
- Build logs are stored for debugging
- User receives notification with error details
- Service status remains `running` or `failed` (not `building`)

### Deployment Failures

If a deployment fails:
- Automatic rollback to previous deployment
- Previous container continues running
- User receives notification about rollback
- Service status returns to `running`

### Rollback Failures

If automatic rollback fails:
- Service status set to `failed`
- User receives critical notification
- Manual intervention required

## Configuration

### Environment Variables

```bash
# Docker registry for container images
DOCKER_REGISTRY_URL=localhost:5000

# Base URL for webhook endpoints
CLIENT_URL=https://your-domain.com

# Nix cache for faster builds (optional)
NIX_CACHE_URL=https://cache.nixos.org
```

### Service Configuration

Each service must have:
- `git_repository`: Git repository URL
- `git_branch`: Branch to watch for changes (default: `main`)
- `build_config`: Build configuration with Nix expression or build command

## Troubleshooting

### Webhook Not Triggering

1. Check webhook secret is correctly configured in Git provider
2. Verify webhook URL is accessible from internet
3. Check service branch matches the pushed branch
4. Review webhook delivery logs in Git provider settings

### Build Failures

1. Check build logs in deployment history
2. Verify Nix expression syntax
3. Ensure all dependencies are available
4. Check build timeout settings

### Deployment Failures

1. Check deployment logs
2. Verify resource limits are sufficient
3. Check Docker Swarm cluster health
4. Review health check configuration

### Rollback Issues

1. Verify previous deployment exists
2. Check Docker image is still available
3. Review Swarm service update status
4. Check worker node capacity

## Best Practices

1. **Test Webhooks**: Use Git provider's webhook testing feature to verify configuration
2. **Monitor Builds**: Watch build logs for the first few deployments
3. **Set Appropriate Timeouts**: Adjust build and health check timeouts based on application
4. **Use Branch Protection**: Protect production branches to prevent accidental deployments
5. **Review Rollback Logs**: Check rollback notifications to identify deployment issues
6. **Keep Secrets Secure**: Never commit webhook secrets to version control

## Example Workflow

1. Developer pushes code to `main` branch
2. GitHub sends webhook to SkyPanelV2
3. System validates signature and extracts commit info
4. Build starts automatically (user notified)
5. Nix builds application and creates Docker image
6. Build completes successfully (user notified)
7. Deployment starts automatically (user notified)
8. New container deployed to Swarm
9. Health check passes
10. Traffic routed to new container
11. Deployment complete (user notified)
12. Previous deployment preserved for rollback

Total time: ~2-5 minutes depending on build complexity
