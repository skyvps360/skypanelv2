# Easypanel Integration - User Guide

This guide helps users deploy and manage containerized applications using SkyPanelV2's Easypanel integration.

## Overview

The Container as a Service (CaaS) feature allows you to deploy and manage containerized applications alongside your VPS services. You can deploy applications from templates, custom Docker images, or managed databases with automatic resource management and billing.

## Getting Started

### Prerequisites

- Active SkyPanelV2 account with sufficient wallet balance
- Organization membership (containers are managed at the organization level)

### Subscribing to a Container Plan

Before deploying containers, you need to subscribe to a container plan:

1. Navigate to **Containers** → **Plans** in the main menu
2. Review available plans and their resource allocations:
   - **CPU Cores**: Maximum CPU allocation across all containers
   - **Memory**: Maximum RAM allocation in GB
   - **Storage**: Maximum disk space allocation in GB
   - **Container Count**: Maximum number of containers allowed
3. Select a plan that meets your needs
4. Ensure your organization wallet has sufficient balance for the monthly subscription
5. Click **Subscribe** to activate the plan

**Note**: Subscription charges are deducted immediately from your organization wallet, with monthly recurring billing.

## Container Dashboard

After subscribing, access your container dashboard at **Containers** → **Dashboard**.

### Dashboard Overview

The dashboard displays:
- **Resource Usage**: Current usage vs. plan limits with visual progress bars
- **Projects**: List of your container projects
- **Quick Actions**: Buttons to create projects and deploy services
- **Subscription Status**: Current plan details and next billing date

### Resource Monitoring

Monitor your resource usage to avoid hitting plan limits:
- **Green (0-60%)**: Normal usage
- **Yellow (60-80%)**: Approaching limit
- **Red (80-100%)**: Near or at limit

## Project Management

Projects organize your containers into logical groups (e.g., "production", "staging", "development").

### Creating a Project

1. Click **Create Project** from the dashboard
2. Enter a project name (lowercase letters, numbers, hyphens, and underscores only)
3. Click **Create**

**Project Naming Rules**:
- Must match pattern: `^[a-z0-9-_]+$`
- Examples: `my-app`, `production_env`, `test123`

### Managing Projects

From the project list, you can:
- **View Details**: Click a project to see its services
- **Update Environment**: Modify project-level environment variables
- **Delete Project**: Remove the project (must delete all services first)

## Service Deployment

Services are the actual containerized applications running within your projects.

### Deployment Options

You can deploy services in three ways:

#### 1. From Templates

Templates provide one-click deployment of popular applications:

1. Select a project and click **Deploy from Template**
2. Browse available templates by category:
   - **Web Applications**: WordPress, Ghost, Nextcloud
   - **Databases**: PostgreSQL, MySQL, MongoDB, Redis
   - **Development Tools**: GitLab, Code Server
   - **Monitoring**: Grafana, Uptime Kuma
3. Select a template and review its requirements
4. Configure template-specific settings (database credentials, admin passwords, etc.)
5. Enter a service name
6. Click **Deploy**

#### 2. Custom Applications

Deploy your own applications from Docker images:

1. Select a project and click **Deploy Custom App**
2. Configure the deployment:
   - **Service Name**: Unique name within the project
   - **Docker Image**: Full image name (e.g., `nginx:latest`, `myregistry/myapp:v1.0`)
   - **Environment Variables**: Key-value pairs for application configuration
   - **Port Mappings**: Expose container ports (optional)
   - **Resource Limits**: CPU and memory constraints (optional)
3. Click **Deploy**

#### 3. Database Services

Deploy managed database containers:

1. Select a project and click **Deploy Database**
2. Choose database type:
   - **PostgreSQL**: Full-featured relational database
   - **MySQL**: Popular relational database
   - **MariaDB**: MySQL-compatible database
   - **MongoDB**: Document-oriented NoSQL database
   - **Redis**: In-memory data structure store
3. Configure database settings:
   - **Service Name**: Unique identifier
   - **Database Version**: Select from available versions
   - **Credentials**: Username and password (auto-generated if not specified)
   - **Resource Limits**: Memory and storage allocation
4. Click **Deploy**

### Deployment Process

After initiating deployment:
1. The system validates your resource quotas
2. If quotas allow, the service is created in Easypanel
3. The service appears in your project with "Deploying" status
4. Once ready, status changes to "Running"

## Service Management

### Service Status

Services can have the following statuses:
- **Running**: Service is active and healthy
- **Stopped**: Service is stopped but can be restarted
- **Deploying**: Service is being created or updated
- **Error**: Service has encountered an issue

### Service Actions

For each service, you can:

#### Start/Stop/Restart
- **Start**: Begin a stopped service
- **Stop**: Halt a running service (data is preserved)
- **Restart**: Stop and start the service (useful for applying configuration changes)

#### Configuration Management
- **Environment Variables**: Update application configuration
- **Resource Limits**: Modify CPU and memory allocation
- **View Logs**: Access container logs for troubleshooting

#### Service Details
View comprehensive service information:
- Current status and health
- Resource usage (CPU, memory, storage)
- Network configuration
- Environment variables
- Recent activity logs

### Viewing Logs

Access service logs for troubleshooting:
1. Navigate to the service detail page
2. Click **View Logs**
3. Use the log viewer features:
   - **Filter by Level**: Show only errors, warnings, or info messages
   - **Search**: Find specific log entries
   - **Refresh**: Update logs in real-time
   - **Download**: Export logs for external analysis

### Environment Variables

Manage application configuration through environment variables:
1. Go to service details and click **Environment Variables**
2. Add, edit, or delete variables as needed
3. Click **Save Changes**
4. Restart the service to apply changes

**Security Note**: Avoid storing sensitive data like passwords in environment variables. Use secure secret management when possible.

## Resource Management

### Understanding Quotas

Your container plan defines maximum resource allocations:
- **CPU Cores**: Shared across all running containers
- **Memory**: Total RAM available to all containers
- **Storage**: Persistent disk space for container data
- **Container Count**: Maximum number of services you can deploy

### Quota Enforcement

The system prevents deployments that would exceed your quotas:
- Pre-deployment validation checks available resources
- Clear error messages indicate which quota would be exceeded
- Upgrade your plan or delete unused services to free resources

### Optimizing Resource Usage

Tips for efficient resource utilization:
1. **Right-size Services**: Don't over-allocate CPU and memory
2. **Clean Up Unused Services**: Delete services you no longer need
3. **Monitor Usage**: Regularly check the resource usage widget
4. **Plan Upgrades**: Upgrade your plan before hitting limits

## Billing and Subscriptions

### Billing Cycle

Container subscriptions follow a monthly billing cycle:
- Charges are deducted from your organization wallet
- Billing occurs on the same date each month as your initial subscription
- You receive notifications before and after billing events

### Managing Your Subscription

#### Viewing Subscription Details
- Current plan and pricing
- Next billing date and amount
- Resource usage vs. limits
- Billing history

#### Canceling Subscription
To cancel your container subscription:
1. Navigate to **Containers** → **Subscription**
2. Click **Cancel Subscription**
3. **Important**: You must delete all projects and services before canceling
4. Confirm the cancellation

**Note**: Cancellation takes effect at the end of your current billing period.

### Billing Notifications

You'll receive notifications for:
- Successful billing charges
- Failed payments (insufficient wallet balance)
- Subscription suspensions
- Upcoming billing dates

## Troubleshooting

### Common Issues

#### Deployment Failures

**Problem**: Service deployment fails
**Solutions**:
1. Check resource quotas - ensure you have sufficient CPU, memory, and storage
2. Verify Docker image exists and is accessible
3. Review service configuration for errors
4. Check service logs for error details

#### Service Won't Start

**Problem**: Service shows "Error" status
**Solutions**:
1. Review service logs for error messages
2. Check environment variable configuration
3. Verify resource limits are appropriate
4. Ensure port mappings don't conflict

#### Resource Quota Exceeded

**Problem**: Cannot deploy new services due to quota limits
**Solutions**:
1. Delete unused services to free resources
2. Reduce resource allocation for existing services
3. Upgrade to a higher-tier plan
4. Optimize application resource usage

#### Billing Issues

**Problem**: Subscription suspended due to payment failure
**Solutions**:
1. Add funds to your organization wallet
2. Contact support if billing appears incorrect
3. Review billing history for failed transactions

### Getting Help

If you encounter issues not covered in this guide:

1. **Check Service Logs**: Often contain specific error information
2. **Review Resource Usage**: Ensure you're not hitting plan limits
3. **Contact Support**: Use the in-app support ticket system
4. **Community Resources**: Check documentation and community forums

## Best Practices

### Security

1. **Use Strong Passwords**: For database services and application credentials
2. **Limit Exposed Ports**: Only expose necessary ports to the internet
3. **Regular Updates**: Keep container images updated with security patches
4. **Environment Variables**: Avoid storing sensitive data in environment variables

### Performance

1. **Resource Allocation**: Allocate appropriate CPU and memory for each service
2. **Monitoring**: Regularly check service performance and logs
3. **Optimization**: Optimize applications for containerized environments
4. **Scaling**: Consider horizontal scaling for high-traffic applications

### Cost Management

1. **Right-sizing**: Don't over-provision resources
2. **Cleanup**: Remove unused services and projects
3. **Monitoring**: Track resource usage to optimize plan selection
4. **Planning**: Estimate resource needs before deploying multiple services

## Advanced Features

### Custom Docker Images

When deploying custom applications:
- Use official base images when possible
- Implement proper health checks
- Follow Docker best practices for image optimization
- Consider multi-stage builds for smaller images

### Service Networking

Services within the same project can communicate:
- Use service names as hostnames for internal communication
- Configure appropriate port mappings for external access
- Consider security implications of exposed ports

### Data Persistence

For applications requiring persistent data:
- Use appropriate volume mounts for data directories
- Consider backup strategies for critical data
- Understand that service deletion removes all data

## Migration and Backup

### Data Backup

While Easypanel manages container infrastructure:
- Application data should be backed up regularly
- Consider database export/import procedures
- Document configuration for disaster recovery

### Service Migration

To move services between projects:
1. Export application data and configuration
2. Create new service in target project
3. Import data and verify functionality
4. Delete old service after verification

---

For additional help and resources, visit the [Admin Guide](./EASYPANEL_ADMIN_GUIDE.md) or contact support through the SkyPanelV2 interface.