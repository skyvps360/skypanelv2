# SkyPanelV2 Database Scripts

This directory contains utility scripts for managing the SkyPanelV2 database.

## Database Reset & Migration

### Reset Database (Development Only)

**⚠️ WARNING: These commands will DELETE ALL DATA from your database!**

```bash
# Reset database with confirmation prompt
npm run db:reset
# or
node scripts/reset-database.js

# Reset database without confirmation (auto-confirm)
npm run db:reset:confirm
# or
node scripts/reset-database.js --confirm

# Reset database and run all migrations (fresh start)
npm run db:fresh
```

The reset script will:
1. Drop all tables (with CASCADE)
2. Drop all sequences
3. Drop all views
4. Drop all custom functions (excluding extension functions)
5. Drop all custom types (enums, composite types)

**Note:** Extension functions (like those from `pgcrypto` and `uuid-ossp`) are preserved as they're managed by PostgreSQL extensions.

### Apply Migrations

```bash
# Apply all pending migrations
node scripts/run-migration.js

# Apply a specific migration file
node scripts/apply-single-migration.js migrations/001_initial_schema.sql
```

### Data Migration Scripts

```bash
# Migrate VPS provider data (add provider_id to existing instances)
node scripts/migrate-vps-provider-data.js

# Migrate backup pricing data (set default backup configuration)
node scripts/migrate-backup-pricing-data.js
```

### Test Database Connection

```bash
node scripts/test-connection.js
```

## Admin User Management

### Create Test Admin

```bash
node scripts/create-test-admin.js --email admin@example.com --password admin123
```

### Promote User to Admin

```bash
node scripts/promote-to-admin.js --email user@example.com
```

### Update Admin Password

```bash
node scripts/update-admin-password.js --email admin@example.com --password newpassword123
```

### Check Admin Users

```bash
node scripts/check-admin-users.js
```

## Testing & Utilities

### Test Hourly Billing

```bash
node scripts/test-hourly-billing.js
```

### Test SMTP Configuration

```bash
node scripts/test-smtp.js
```

## Common Development Workflows

### Fresh Database Setup

When starting fresh or after pulling major database changes:

```bash
# 1. Reset and migrate database
npm run db:fresh

# 2. Create your admin user (if not using default)
node scripts/create-test-admin.js --email your@email.com --password yourpassword


# 3. Start development servers
npm run dev
```
```md 
you may not use special characters for this password you may reset it via the dashboard afterwards
and allow the use of special character passwords.
```

### Fixing Encryption Key Issues

If you see decryption errors for provider API tokens:

```bash
# 1. Make sure SSH_CRED_SECRET is set in .env (32+ characters)
# 2. Reset database to clear old encrypted data
npm run db:fresh

# 3. Re-configure providers in admin panel at /admin#providers
```

### Testing Migration Changes

When developing new migrations:

```bash
# 1. Reset database
npm run db:reset:confirm

# 2. Run migrations up to your new one
node scripts/run-migration.js

# 3. Verify the changes
node scripts/test-connection.js
```

## Environment Variables

All scripts use environment variables from `.env`:

- `DATABASE_URL` - PostgreSQL connection string (required)
- `SSH_CRED_SECRET` - Encryption key for API tokens (32+ characters recommended)
- `JWT_SECRET` - JWT signing secret

## Safety Features

- **Confirmation prompts**: `db:reset` requires typing "yes" to confirm
- **Auto-confirm flag**: Use `--confirm` flag to skip prompts (for automation)
- **Extension preservation**: PostgreSQL extension functions are not dropped
- **Detailed logging**: All operations are logged with clear status indicators

## Troubleshooting

### "Cannot find module" errors

Make sure you're running scripts from the project root:

```bash
cd /path/to/SkyPANELv2
node scripts/reset-database.js
```

### Database connection errors

1. Check `DATABASE_URL` in `.env`
2. Verify PostgreSQL is running
3. Test connection: `node scripts/test-connection.js`

### Permission errors

Ensure your database user has sufficient privileges:

```sql
GRANT ALL PRIVILEGES ON DATABASE skypanelv2 TO your_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
```
