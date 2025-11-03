# Easypanel Integration - Admin Configuration Guide

This guide covers the administrative setup and configuration of the Easypanel Container as a Service (CaaS) integration in SkyPanelV2.

## Overview

The Easypanel integration allows SkyPanelV2 to offer containerized application hosting alongside VPS services. Administrators can configure container plans, manage templates, and monitor platform-wide container usage.

## Prerequisites

Before configuring the Easypanel integration, ensure you have:

- A running Easypanel instance (self-hosted or managed)
- Valid Easypanel API credentials with appropriate permissions
- Network connectivity between SkyPanelV2 and the Easypanel instance
- Administrative access to SkyPanelV2

## Initial Setup

### 1. Environment Configuration

Add the following environment variables to your `.env` file:

```bash
# Easypanel API Configuration
EASYPANEL_API_URL=https://your-easypanel-instance.com
EASYPANEL_API_KEY=your-easypanel-api-key
```

**Important**: The API key will be encrypted when stored in the database for security.

### 2. Restart Application

After adding the environment variables, restart SkyPanelV2 to load the new configuration:

```bash
# Development
npm run dev

# Production with PM2
npm run pm2:reload
```

### 3. Access Admin Configuration

1. Log in to SkyPanelV2 as an administrator
2. Navigate to **Admin Panel** → **Platform Settings** → **Easypanel Config**
3. Enter your Easypanel API URL and API key
4. Click **Test Connection** to verify connectivity
5. Save the configuration

## Container Plans Management

Container plans define the resource quotas and pricing for container subscriptions.

### Creating Container Plans

1. Navigate to **Admin Panel** → **Plan Management** → **Container Plans**
2. Click **Create Plan**
3. Configure the following settings:

#### Basic Information
- **Plan Name**: Descriptive name for the plan (e.g., "Starter", "Professional")
- **Description**: Detailed description of what the plan includes
- **Monthly Price**: Subscription cost in USD

#### Resource Quotas
- **Max CPU Cores**: Maximum CPU cores across all containers
- **Max Memory (GB)**: Maximum memory allocation in gigabytes
- **Max Storage (GB)**: Maximum storage allocation in gigabytes
- **Max Containers**: Maximum number of containers allowed

#### Example Configuration
```
Plan Name: Starter Container Plan
Description: Perfect for small applications and development
Monthly Price: $15.00
Max CPU Cores: 2
Max Memory: 4 GB
Max Storage: 20 GB
Max Containers: 5
```

### Managing Existing Plans

- **Edit Plan**: Modify plan details and resource quotas
- **Activate/Deactivate**: Control plan availability for new subscriptions
- **View Subscriptions**: See which organizations are subscribed to each plan

**Note**: Deactivating a plan hides it from new subscriptions but maintains existing subscriptions.

## Template Management

Templates provide one-click deployment options for popular applications.

### Enabling Templates

1. Navigate to **Admin Panel** → **Plan Management** → **Container Templates**
2. Browse available templates fetched from Easypanel
3. Enable templates you want to offer to users
4. Configure display settings:
   - **Display Name**: Custom name shown to users
   - **Category**: Organize templates by type (Web Apps, Databases, etc.)
   - **Display Order**: Control template ordering

### Template Categories

Organize templates into logical categories:
- **Web Applications**: WordPress, Ghost, Nextcloud
- **Databases**: PostgreSQL, MySQL, MongoDB, Redis
- **Development Tools**: GitLab, Jenkins, Code Server
- **Monitoring**: Grafana, Prometheus, Uptime Kuma
- **Communication**: Mattermost, Rocket.Chat

### Template Configuration

Each template includes:
- **Schema Definition**: Required configuration parameters
- **Resource Requirements**: Minimum CPU, memory, and storage needs
- **Environment Variables**: Configurable application settings
- **Port Mappings**: Network access configuration

## Monitoring and Analytics

### Platform Overview

The Container Monitoring dashboard provides:

- **Total Active Subscriptions**: Number of organizations with container plans
- **Total Projects**: Aggregate project count across all organizations
- **Total Services**: Aggregate service count across all organizations
- **Resource Utilization**: Platform-wide CPU, memory, and storage usage

### Organization Details

View detailed information for each organization:
- Subscription plan and status
- Project and service counts
- Resource usage vs. quotas
- Billing history

### Service Management

Monitor all container services across the platform:
- Service status and health
- Resource consumption
- Error logs and troubleshooting
- Performance metrics

## Billing Configuration

Container billing integrates with the existing SkyPanelV2 billing system.

### Billing Cycles

- **Monthly Billing**: Subscriptions are billed monthly from the subscription date
- **Automated Processing**: Billing cycles are processed automatically via scheduled jobs
- **Wallet Integration**: Charges are deducted from organization wallets
- **Payment Failures**: Subscriptions are suspended if wallet balance is insufficient

### Billing Automation

The billing system runs automated jobs:

```bash
# Manual billing cycle processing
node scripts/process-container-billing.js

# Test billing with mock data
node scripts/test-container-billing.js
```

### Billing Monitoring

Track billing activities through:
- **Activity Logs**: All billing events are logged
- **Payment Transactions**: Detailed transaction records
- **Billing Cycles**: Historical billing cycle data

## Security Considerations

### API Key Security

- API keys are encrypted using the same encryption system as VPS provider keys
- Keys are never exposed in frontend code or logs
- Regular key rotation is recommended

### Access Control

- All container operations require valid authentication
- Users can only access their organization's resources
- Admin operations require admin role privileges

### Resource Isolation

- Each organization's containers are isolated within separate Easypanel projects
- Resource quotas prevent abuse and ensure fair usage
- Service names are validated to prevent conflicts

## Troubleshooting

### Connection Issues

**Problem**: Cannot connect to Easypanel API
**Solutions**:
1. Verify API URL is correct and accessible
2. Check API key permissions
3. Ensure network connectivity
4. Review firewall settings

### Quota Enforcement

**Problem**: Users exceeding resource quotas
**Solutions**:
1. Review quota calculations in ResourceQuotaService
2. Check for orphaned services not properly tracked
3. Verify Easypanel resource reporting accuracy

### Billing Issues

**Problem**: Billing cycles not processing
**Solutions**:
1. Check scheduled job configuration
2. Verify wallet balances
3. Review billing cycle status
4. Check for database connection issues

### Template Deployment Failures

**Problem**: Template deployments failing
**Solutions**:
1. Verify template schema compatibility
2. Check resource availability
3. Review Easypanel service logs
4. Validate template configuration

## Maintenance Tasks

### Regular Maintenance

1. **Monitor Resource Usage**: Review platform-wide resource consumption
2. **Update Templates**: Keep template library current with new applications
3. **Review Billing**: Monitor billing cycle processing and payment failures
4. **Security Updates**: Rotate API keys periodically
5. **Performance Monitoring**: Track API response times and error rates

### Backup Considerations

- Container data is managed by Easypanel
- SkyPanelV2 stores metadata and configuration
- Regular database backups include container plan and subscription data
- Consider Easypanel backup strategies for container data

## API Integration Details

### Authentication

All Easypanel API calls use Bearer token authentication:

```
Authorization: Bearer your-api-key
```

### Request Format

Requests follow TRPC-style JSON format:

```json
{
  "json": {
    "projectName": "example-project",
    "serviceName": "example-service"
  }
}
```

### Rate Limiting

- API calls are subject to Easypanel rate limits
- SkyPanelV2 implements request throttling to prevent abuse
- Monitor API usage to avoid hitting limits

## Support and Resources

### Documentation

- [Easypanel User Guide](./EASYPANEL_USER_GUIDE.md)
- [Container API Reference](./CONTAINER_API_REFERENCE.md)
- [Main README](../README.md)

### Getting Help

1. Check the troubleshooting section above
2. Review application logs for error details
3. Use the in-app support ticket system
4. Open an issue on the GitHub repository

### Community Resources

- Easypanel Documentation: https://easypanel.io/docs
- SkyPanelV2 GitHub: https://github.com/skyvps360/skypanelv2
- Community Discord: [Link if available]

---

For additional support, contact the SkyPanelV2 development team or consult the community resources listed above.