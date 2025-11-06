# Environment Variables Reference

This document provides a comprehensive reference for all environment variables used in SkyPanelV2.

## Core Application Settings

### Basic Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Application environment (`development`, `production`, `test`) |
| `PORT` | No | `3001` | Port for the Express.js backend server |
| `CLIENT_URL` | No | `http://localhost:5173` | Frontend application URL for CORS and redirects |
| `JWT_SECRET` | **Yes** | - | Secret key for JWT token signing (use strong random string) |
| `JWT_EXPIRES_IN` | No | `7d` | JWT token expiration time (e.g., `7d`, `24h`, `3600s`) |

### Security & Encryption

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SSH_CRED_SECRET` | **Yes** | - | 32+ character key for encrypting provider API tokens |
| `ENCRYPTION_KEY` | **Yes** | - | 32-character key for general encryption operations |
| `TRUST_PROXY` | No | `true` | Proxy trust configuration for proper IP detection |

**Security Notes:**
- Generate `SSH_CRED_SECRET` using: `node scripts/generate-ssh-secret.js`
- Use cryptographically secure random strings for all secrets
- Rotate secrets regularly in production environments

## Database Configuration

### PostgreSQL

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | **Yes** | - | PostgreSQL connection string |

**Examples:**
```bash
# Local PostgreSQL
DATABASE_URL=postgresql://postgres:password@localhost:5432/skypanelv2

# Neon.tech (cloud PostgreSQL)
DATABASE_URL=postgresql://username:password@ep-example-123456.us-east-1.aws.neon.tech/skypanelv2?sslmode=require

# Other cloud providers
DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require
```

### Redis

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection URL for caching and queues |
| `REDIS_PASSWORD` | No | - | Redis password if authentication is enabled |

## Branding & UI Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `COMPANY_NAME` | No | `SkyPanelV2` | Company name displayed in the backend |
| `VITE_COMPANY_NAME` | No | `SkyPanelV2` | Company name displayed in the frontend |
| `COMPANY_BRAND_NAME` | No | `SkyPanelV2` | Brand name used in marketing materials |

**Note:** Frontend variables must be prefixed with `VITE_` to be accessible in the React application.

## Payment Integration

### PayPal Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PAYPAL_CLIENT_ID` | **Yes** | - | PayPal REST API client ID |
| `PAYPAL_CLIENT_SECRET` | **Yes** | - | PayPal REST API client secret |
| `PAYPAL_MODE` | No | `sandbox` | PayPal environment (`sandbox` or `live`) |

**Setup Instructions:**
1. Create PayPal developer account at https://developer.paypal.com
2. Create a new application to get client credentials
3. Use sandbox credentials for development, live for production

## Email Configuration

### SMTP2GO Integration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SMTP2GO_API_KEY` | **Yes** | - | SMTP2GO API key for email delivery |
| `SMTP2GO_USERNAME` | **Yes** | - | SMTP2GO username |
| `SMTP2GO_PASSWORD` | **Yes** | - | SMTP2GO password |
| `SMTP2GO_HOST` | No | `mail.smtp2go.com` | SMTP server hostname |
| `SMTP2GO_PORT` | No | `2525` | SMTP server port |
| `SMTP2GO_SECURE` | No | `false` | Use SSL/TLS encryption |
| `SMTP2GO_REQUIRE_TLS` | No | `true` | Require STARTTLS |

### Email Addresses

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FROM_EMAIL` | **Yes** | - | Default sender email address |
| `FROM_NAME` | No | `SkyVPS360` | Default sender name |
| `CONTACT_FORM_RECIPIENT` | **Yes** | - | Email address for contact form submissions |
| `TEST_EMAIL` | No | - | Email address for testing SMTP configuration |

## Cloud Provider Integration

### Linode (Required)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LINODE_API_TOKEN` | **Yes** | - | Linode API personal access token |
| `LINODE_API_URL` | No | `https://api.linode.com/v4` | Linode API base URL |

### DigitalOcean (Optional)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DIGITALOCEAN_API_TOKEN` | No | - | DigitalOcean API personal access token |

**Setup Instructions:**
1. **Linode**: Create token at https://cloud.linode.com/profile/tokens
2. **DigitalOcean**: Create token at https://cloud.digitalocean.com/account/api/tokens



## Rate Limiting Configuration

### Anonymous Users (Unauthenticated)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RATE_LIMIT_ANONYMOUS_WINDOW_MS` | No | `900000` | Time window in milliseconds (15 minutes) |
| `RATE_LIMIT_ANONYMOUS_MAX` | No | `200` | Maximum requests per window |

### Authenticated Users

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RATE_LIMIT_AUTHENTICATED_WINDOW_MS` | No | `900000` | Time window in milliseconds (15 minutes) |
| `RATE_LIMIT_AUTHENTICATED_MAX` | No | `500` | Maximum requests per window |

### Admin Users

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RATE_LIMIT_ADMIN_WINDOW_MS` | No | `900000` | Time window in milliseconds (15 minutes) |
| `RATE_LIMIT_ADMIN_MAX` | No | `1000` | Maximum requests per window |

### Legacy Rate Limiting (Deprecated)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RATE_LIMIT_WINDOW_MS` | No | `900000` | Legacy rate limit window (deprecated) |
| `RATE_LIMIT_MAX_REQUESTS` | No | `100` | Legacy rate limit max (deprecated) |

## File Upload Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MAX_FILE_SIZE` | No | `10485760` | Maximum file upload size in bytes (10MB) |
| `UPLOAD_PATH` | No | `./uploads` | Directory for temporary file uploads |

## Monitoring & Analytics (Optional)

### InfluxDB Integration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `INFLUXDB_URL` | No | - | InfluxDB instance URL |
| `INFLUXDB_TOKEN` | No | - | InfluxDB authentication token |
| `INFLUXDB_ORG` | No | `skypanelv2` | InfluxDB organization name |
| `INFLUXDB_BUCKET` | No | `metrics` | InfluxDB bucket for metrics storage |

## Backup Configuration (Optional)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BACKUP_STORAGE_PROVIDER` | No | `local` | Backup storage provider (`local`, `s3`, etc.) |
| `BACKUP_RETENTION_DAYS` | No | `30` | Number of days to retain backups |

## Environment-Specific Configurations

### Development Environment

```bash
NODE_ENV=development
PORT=3001
CLIENT_URL=http://localhost:5173
PAYPAL_MODE=sandbox
TRUST_PROXY=true
```

### Production Environment

```bash
NODE_ENV=production
PORT=3001
CLIENT_URL=https://your-domain.com
PAYPAL_MODE=live
TRUST_PROXY=1  # Adjust based on your proxy setup
```

### Testing Environment

```bash
NODE_ENV=test
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/skypanelv2_test
REDIS_URL=redis://localhost:6379/1
```

## Security Best Practices

### Secret Management

1. **Never commit secrets to version control**
2. **Use strong, randomly generated secrets**
3. **Rotate secrets regularly**
4. **Use different secrets for each environment**
5. **Store secrets securely (e.g., AWS Secrets Manager, HashiCorp Vault)**

### Production Checklist

- [ ] Strong `JWT_SECRET` (32+ characters, cryptographically random)
- [ ] Secure `SSH_CRED_SECRET` and `ENCRYPTION_KEY`
- [ ] PayPal live credentials (not sandbox)
- [ ] Proper `TRUST_PROXY` configuration for your infrastructure
- [ ] Redis password protection enabled
- [ ] PostgreSQL SSL/TLS enabled
- [ ] Rate limiting configured appropriately
- [ ] Monitoring and logging enabled

## Troubleshooting

### Common Issues

**Database Connection Fails**
- Verify `DATABASE_URL` format and credentials
- Check network connectivity and firewall rules
- Ensure PostgreSQL is running and accepting connections

**PayPal Integration Issues**
- Verify client ID and secret are correct
- Check `PAYPAL_MODE` matches your credentials (sandbox vs live)
- Ensure frontend can reach PayPal SDK

**Email Delivery Problems**
- Test SMTP configuration with `node scripts/test-smtp.js`
- Verify SMTP2GO credentials and settings
- Check firewall rules for SMTP ports

**Rate Limiting Too Restrictive**
- Adjust rate limit values based on usage patterns
- Consider different limits for different user types
- Monitor rate limit hit rates in logs

**Provider API Errors**
- Verify API tokens are valid and have required permissions
- Check API token expiration dates
- Ensure network connectivity to provider APIs

### Validation Scripts

Use these scripts to validate your configuration:

```bash
# Test database connection
node scripts/test-connection.js

# Test SMTP configuration
node scripts/test-smtp.js

# Test billing workflow
node scripts/test-hourly-billing.js


```

## Migration Notes

### Upgrading from Previous Versions

When upgrading SkyPanelV2, check for new environment variables:

1. Compare your `.env` with the latest `.env.example`
2. Add any missing variables with appropriate values
3. Update deprecated variables as noted in release notes
4. Test configuration with validation scripts

### Environment Variable Changes


- **v2.0.0**: Enhanced rate limiting configuration
- **v1.5.0**: Added InfluxDB monitoring support
- **v1.4.0**: Improved SMTP2GO configuration options

---

For additional help with environment configuration, see:
- [Main README](../README.md)

- [API Reference](./API_REFERENCE.md)