# Design Document

## Overview

This design outlines the completion of the native Docker-based Container as a Service (CaaS) platform for SkyPanelV2. The system builds upon the existing caasService implementation and integrates with the current database schema, organization structure, and billing system to provide a comprehensive container hosting solution.

## Architecture

### High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend UI   │    │   Backend API   │    │  Docker Daemon  │
│                 │    │                 │    │                 │
│ - Admin Config  │◄──►│ - CaaS Service  │◄──►│ - Containers    │
│ - Container Mgmt│    │ - Volume Mgmt   │    │ - Networks      │
│ - Monitoring    │    │ - Domain Mgmt   │    │ - Volumes       │
│ - Templates     │    │ - Metrics       │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   PostgreSQL    │
                       │                 │
                       │ - Organizations │
                       │ - Subscriptions │
                       │ - Containers    │
                       │ - Billing       │
                       └─────────────────┘
```

### Component Architecture

The system extends the existing caasService with additional services:

1. **Configuration Service**: Manages Docker daemon connection and CaaS settings
2. **Volume Service**: Handles persistent storage and backup/restore
3. **Domain Service**: Manages Traefik routing and SSL certificates
4. **Metrics Service**: Collects and provides container resource usage data
5. **Template Service**: Manages application templates and deployment
6. **Admin Service**: Handles organization and member management

## Components and Interfaces

### 1. CaaS Configuration Service

**Purpose**: Fix the current configuration interface to work with local Docker setup

**Interface**:
```typescript
interface CaasConfigService {
  // Get current Docker configuration
  getDockerConfig(): Promise<DockerConfig>
  
  // Update Docker connection settings
  updateDockerConfig(config: DockerConfigUpdate): Promise<void>
  
  // Test Docker daemon connection
  testDockerConnection(): Promise<ConnectionTestResult>
  
  // Auto-detect Docker setup
  detectDockerSetup(): Promise<DockerSetupInfo>
}

interface DockerConfig {
  connectionType: 'socket' | 'tcp'
  socketPath?: string
  apiUrl?: string
  tlsEnabled: boolean
  status: 'connected' | 'disconnected' | 'error'
  version?: string
}
```

**Implementation**:
- Remove API key requirements for local Docker connections
- Default to Unix socket path `/var/run/docker.sock`
- Support TCP connections for remote Docker (development)
- Auto-detect available connection methods

### 2. Volume Management Service

**Purpose**: Provide persistent storage for database containers and applications

**Interface**:
```typescript
interface VolumeService {
  // Create persistent volume for service
  createVolume(config: VolumeConfig): Promise<Volume>
  
  // List volumes for organization
  listVolumes(organizationId: string): Promise<Volume[]>
  
  // Get volume usage statistics
  getVolumeUsage(volumeId: string): Promise<VolumeUsage>
  
  // Backup volume data
  backupVolume(volumeId: string): Promise<BackupResult>
  
  // Restore volume from backup
  restoreVolume(volumeId: string, backupId: string): Promise<void>
}

interface VolumeConfig {
  organizationId: string
  serviceName: string
  mountPath: string
  sizeLimit?: number // MB
  backupEnabled: boolean
}
```

**Implementation**:
- Use Docker volumes for database persistence
- Store volume metadata in existing database
- Implement backup using tar archives
- Track usage against organization quotas

### 3. Domain Management Service

**Purpose**: Enable custom domains with automatic SSL certificates

**Interface**:
```typescript
interface DomainService {
  // Configure domain for service
  addDomain(config: DomainConfig): Promise<Domain>
  
  // Generate Traefik labels for container
  generateTraefikLabels(domain: Domain): Record<string, string>
  
  // Validate domain ownership
  validateDomain(domain: string): Promise<ValidationResult>
  
  // Manage SSL certificates
  getCertificateStatus(domain: string): Promise<CertificateStatus>
}

interface DomainConfig {
  organizationId: string
  serviceId: string
  hostname: string
  port: number
  pathPrefix?: string
  sslEnabled: boolean
}
```

**Implementation**:
- Deploy Traefik as reverse proxy
- Generate appropriate Docker labels for routing
- Use Let's Encrypt for SSL certificates
- Validate DNS configuration before activation

### 4. Metrics and Monitoring Service

**Purpose**: Provide real-time and historical resource usage monitoring

**Interface**:
```typescript
interface MetricsService {
  // Get real-time container stats
  getLiveStats(containerId: string): Promise<ContainerStats>
  
  // Get historical usage data
  getHistoricalStats(organizationId: string, timeRange: TimeRange): Promise<UsageHistory>
  
  // Get organization resource summary
  getOrganizationUsage(organizationId: string): Promise<ResourceSummary>
  
  // Set up usage alerts
  configureAlerts(organizationId: string, thresholds: AlertThresholds): Promise<void>
}

interface ContainerStats {
  cpuPercent: number
  memoryUsage: number
  memoryLimit: number
  networkIO: NetworkStats
  diskIO: DiskStats
  uptime: number
}
```

**Implementation**:
- Use Docker stats API for real-time metrics
- Store historical data in PostgreSQL
- Implement background collection service
- Provide usage alerts and notifications

### 5. Template Management Service

**Purpose**: Provide pre-configured application deployment templates

**Interface**:
```typescript
interface TemplateService {
  // List available templates
  listTemplates(category?: string): Promise<Template[]>
  
  // Get template details and form schema
  getTemplate(templateId: string): Promise<TemplateDetail>
  
  // Deploy from template
  deployTemplate(config: TemplateDeployConfig): Promise<DeploymentResult>
  
  // Manage template catalog (admin)
  createTemplate(template: TemplateDefinition): Promise<Template>
  updateTemplate(templateId: string, updates: TemplateUpdate): Promise<Template>
}

interface Template {
  id: string
  name: string
  category: string
  description: string
  icon?: string
  tags: string[]
  requirements: ResourceRequirements
}
```

**Implementation**:
- Store templates in database with JSON schema
- Support multi-container deployments
- Auto-generate database credentials
- Provide popular application templates (WordPress, Node.js, etc.)

### 6. Admin Organization Service

**Purpose**: Complete organization and member management interface

**Interface**:
```typescript
interface AdminOrganizationService {
  // Organization management
  listOrganizations(filters?: OrganizationFilters): Promise<Organization[]>
  getOrganization(organizationId: string): Promise<OrganizationDetail>
  updateOrganization(organizationId: string, updates: OrganizationUpdate): Promise<Organization>
  
  // Member management
  listMembers(organizationId: string): Promise<Member[]>
  addMember(organizationId: string, memberConfig: MemberConfig): Promise<Member>
  updateMemberRole(organizationId: string, userId: string, role: string): Promise<void>
  removeMember(organizationId: string, userId: string): Promise<void>
  
  // Bulk operations
  bulkUpdateOrganizations(updates: BulkOrganizationUpdate[]): Promise<BulkResult>
}

interface OrganizationDetail extends Organization {
  memberCount: number
  subscriptionStatus: string
  resourceUsage: ResourceSummary
  billingInfo: BillingSummary
  containerCount: number
}
```

**Implementation**:
- Extend existing organization management
- Add member invitation workflow
- Provide bulk operations interface
- Integrate with existing billing system

## Data Models

### Extended Container Service Model

```typescript
interface ContainerService {
  id: string
  organizationId: string
  name: string
  type: 'app' | 'database'
  image: string
  containerId?: string
  status: 'running' | 'stopped' | 'error'
  
  // New fields for enhanced functionality
  volumes: VolumeMount[]
  domains: DomainMapping[]
  environment: Record<string, string>
  resources: ResourceLimits
  
  createdAt: string
  updatedAt: string
}

interface VolumeMount {
  id: string
  name: string
  mountPath: string
  hostPath: string
  sizeLimit?: number
  backupEnabled: boolean
}

interface DomainMapping {
  id: string
  hostname: string
  port: number
  pathPrefix?: string
  sslEnabled: boolean
  status: 'active' | 'pending' | 'error'
}
```

### Configuration Model

```typescript
interface CaasConfiguration {
  id: string
  dockerConnectionType: 'socket' | 'tcp'
  dockerSocketPath?: string
  dockerApiUrl?: string
  traefikEnabled: boolean
  defaultDomain?: string
  sslProvider: 'letsencrypt' | 'custom'
  backupRetentionDays: number
  updatedAt: string
}
```

### Metrics Model

```typescript
interface ResourceUsageRecord {
  id: string
  organizationId: string
  serviceId?: string
  timestamp: string
  cpuPercent: number
  memoryMB: number
  storageMB: number
  networkInMB: number
  networkOutMB: number
}
```

## Error Handling

### Error Categories

1. **Configuration Errors**: Docker connection issues, invalid settings
2. **Resource Errors**: Quota exceeded, insufficient resources
3. **Deployment Errors**: Container creation failures, image pull errors
4. **Domain Errors**: DNS validation failures, SSL certificate issues
5. **Storage Errors**: Volume creation failures, backup/restore errors

### Error Response Format

```typescript
interface CaasError {
  code: string
  message: string
  details?: Record<string, any>
  suggestions?: string[]
  retryable: boolean
}
```

### Error Recovery Strategies

- **Automatic Retry**: For transient Docker API errors
- **Graceful Degradation**: Continue operation with reduced functionality
- **User Notification**: Clear error messages with actionable suggestions
- **Logging**: Comprehensive error logging for debugging

## Testing Strategy

### Unit Tests

- Service layer methods with mocked dependencies
- Configuration validation logic
- Resource quota calculations
- Template parsing and validation

### Integration Tests

- Docker API integration
- Database operations
- Volume management workflows
- Domain configuration and validation

### End-to-End Tests

- Complete container deployment workflow
- Template-based deployments
- Domain setup and SSL certificate generation
- Backup and restore operations
- Organization and member management

### Performance Tests

- Container startup times
- Resource usage monitoring accuracy
- Concurrent deployment handling
- Database query performance

## Security Considerations

### Container Security

- **Non-privileged Containers**: All containers run without root privileges
- **Network Isolation**: Each organization gets isolated Docker networks
- **Resource Limits**: Strict CPU and memory limits per container
- **Image Security**: Validate and scan container images

### API Security

- **Authentication**: JWT-based authentication for all endpoints
- **Authorization**: Role-based access control (admin, user)
- **Input Validation**: Strict validation of all user inputs
- **Rate Limiting**: Prevent abuse with request rate limiting

### Data Security

- **Encryption**: Encrypt sensitive configuration data
- **Backup Security**: Secure backup storage and access
- **Audit Logging**: Log all administrative actions
- **Secret Management**: Secure handling of API keys and passwords

## Deployment Strategy

### Development Environment

1. **Local Docker**: Use Docker Desktop or Docker Engine
2. **Database**: Local PostgreSQL instance
3. **Configuration**: Environment variables for settings
4. **Testing**: Automated test suite with Docker containers

### Production Environment

1. **Docker Daemon**: Secure Docker daemon with TLS
2. **Reverse Proxy**: Traefik for domain routing and SSL
3. **Monitoring**: Resource usage monitoring and alerting
4. **Backup**: Automated backup system for volumes and data
5. **Security**: Firewall rules and network isolation

### Migration Path

1. **Phase 1**: Fix CaaS configuration interface
2. **Phase 2**: Implement volume management and persistence
3. **Phase 3**: Add domain management and Traefik integration
4. **Phase 4**: Implement monitoring and metrics collection
5. **Phase 5**: Add template system and catalog
6. **Phase 6**: Complete admin organization management
7. **Phase 7**: Performance optimization and security hardening

## Performance Considerations

### Scalability

- **Horizontal Scaling**: Support multiple Docker hosts
- **Load Balancing**: Distribute containers across hosts
- **Resource Optimization**: Efficient resource allocation
- **Caching**: Cache frequently accessed data

### Monitoring

- **Real-time Metrics**: Live container resource usage
- **Historical Data**: Long-term usage trends
- **Alerting**: Proactive notifications for issues
- **Performance Tracking**: Monitor system performance metrics

### Optimization

- **Container Startup**: Optimize container startup times
- **Image Management**: Efficient image caching and updates
- **Database Queries**: Optimize database performance
- **API Response Times**: Minimize API latency

This design provides a comprehensive approach to completing the CaaS platform while leveraging existing infrastructure and maintaining compatibility with the current system architecture.