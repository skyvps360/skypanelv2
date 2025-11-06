# Admin User Management Troubleshooting Guide

Common issues and solutions for the admin user management system in SkyPanelV2.

## Table of Contents

- [Authentication Issues](#authentication-issues)
- [Organization Management Issues](#organization-management-issues)
- [Member Management Issues](#member-management-issues)
- [User Detail Issues](#user-detail-issues)
- [API Error Handling](#api-error-handling)
- [Performance Issues](#performance-issues)
- [UI/UX Issues](#uiux-issues)
- [Database Issues](#database-issues)

## Authentication Issues

### Issue: "Admin access required" error

**Symptoms:**
- 403 Forbidden responses from admin endpoints
- User can access regular features but not admin panel

**Causes:**
- User role is not set to "admin"
- JWT token doesn't include admin role
- Token is expired or invalid

**Solutions:**

1. **Check user role in database:**
```sql
SELECT id, email, name, role FROM users WHERE email = 'admin@example.com';
```

2. **Promote user to admin:**
```bash
node scripts/promote-to-admin.js
```

3. **Verify JWT token payload:**
```javascript
// In browser console
const token = localStorage.getItem('token');
const payload = JSON.parse(atob(token.split('.')[1]));
console.log('User role:', payload.role);
```

4. **Refresh authentication:**
```javascript
// Force re-login to get updated token
localStorage.removeItem('token');
window.location.href = '/login';
```

### Issue: Token expiration during admin operations

**Symptoms:**
- Operations fail with 401 Unauthorized
- User gets logged out unexpectedly

**Solutions:**

1. **Implement token refresh:**
```javascript
// Add to API client
const refreshToken = async () => {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include'
  });
  
  if (response.ok) {
    const { token } = await response.json();
    localStorage.setItem('token', token);
    return token;
  }
  
  throw new Error('Token refresh failed');
};
```

2. **Extend token expiration for admins:**
```javascript
// In JWT configuration
const adminTokenExpiry = user.role === 'admin' ? '24h' : '7d';
```

## Organization Management Issues

### Issue: "Organization name already exists" error

**Symptoms:**
- Cannot create organization with desired name
- Error persists even with different names

**Causes:**
- Name uniqueness check is case-insensitive
- Deleted organizations may still reserve names
- Database constraint violation

**Solutions:**

1. **Check existing organizations:**
```sql
SELECT name, slug FROM organizations WHERE LOWER(name) = LOWER('Your Org Name');
```

2. **Clean up deleted organizations:**
```sql
-- Only if you're sure about permanent deletion
DELETE FROM organizations WHERE deleted_at IS NOT NULL;
```

3. **Use different name variation:**
```javascript
// Try variations
const variations = [
  'Acme Corporation',
  'Acme Corp',
  'Acme Company',
  'Acme Inc'
];
```

### Issue: Organization deletion fails

**Symptoms:**
- Delete operation returns 500 error
- Organization remains in database
- Partial deletion leaves orphaned data

**Causes:**
- Foreign key constraints prevent deletion
- Transaction rollback due to error
- Insufficient permissions

**Solutions:**

1. **Check foreign key constraints:**
```sql
-- Find dependent records
SELECT table_name, column_name 
FROM information_schema.key_column_usage 
WHERE referenced_table_name = 'organizations';
```

2. **Manual cleanup (development only):**
```sql
-- In development environment only
BEGIN;
DELETE FROM vps_instances WHERE organization_id = 'org-uuid';
DELETE FROM organization_members WHERE organization_id = 'org-uuid';
DELETE FROM wallets WHERE organization_id = 'org-uuid';
DELETE FROM organizations WHERE id = 'org-uuid';
COMMIT;
```

3. **Check deletion logs:**
```bash
# Check server logs for detailed error
tail -f logs/app.log | grep "delete organization"
```

### Issue: Slug generation conflicts

**Symptoms:**
- Auto-generated slugs conflict with existing ones
- Manual slug entry rejected

**Solutions:**

1. **Implement smart slug generation:**
```javascript
const generateUniqueSlug = async (baseName) => {
  let slug = baseName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  let counter = 1;
  
  while (await slugExists(slug)) {
    slug = `${baseName}-${counter}`;
    counter++;
  }
  
  return slug;
};
```

2. **Add timestamp to slug:**
```javascript
const timestampSlug = `${baseSlug}-${Date.now()}`;
```

## Member Management Issues

### Issue: Cannot remove organization owner

**Symptoms:**
- "Cannot remove organization owner" error
- Remove button disabled for owner

**Causes:**
- Business rule prevents owner removal
- Ownership must be transferred first

**Solutions:**

1. **Transfer ownership first:**
```javascript
// Step 1: Transfer ownership
await updateMemberRole(organizationId, newOwnerId, 'owner');

// Step 2: Remove former owner
await removeMember(organizationId, formerOwnerId);
```

2. **UI guidance:**
```tsx
{member.role === 'owner' ? (
  <Tooltip content="Transfer ownership before removing">
    <Button disabled variant="destructive">
      Cannot Remove Owner
    </Button>
  </Tooltip>
) : (
  <Button onClick={() => removeMember(member)}>
    Remove
  </Button>
)}
```

### Issue: User search returns no results

**Symptoms:**
- Search returns empty results
- Known users don't appear in search

**Causes:**
- Search query too restrictive
- Database indexing issues
- User already member of organization

**Solutions:**

1. **Check search implementation:**
```sql
-- Test search query directly
SELECT id, name, email 
FROM users 
WHERE (LOWER(name) LIKE LOWER('%search%') OR LOWER(email) LIKE LOWER('%search%'))
AND id NOT IN (
  SELECT user_id FROM organization_members WHERE organization_id = 'org-uuid'
);
```

2. **Improve search UX:**
```tsx
// Show existing members separately
const { availableUsers, existingMembers } = searchResults;

return (
  <>
    <UserList title="Available Users" users={availableUsers} />
    <UserList title="Already Members" users={existingMembers} disabled />
  </>
);
```

### Issue: Role changes not reflected immediately

**Symptoms:**
- UI shows old role after update
- Permissions don't update immediately

**Causes:**
- Cache not invalidated
- Optimistic updates not implemented
- State management issues

**Solutions:**

1. **Invalidate queries:**
```javascript
// After role update
queryClient.invalidateQueries(['organizations']);
queryClient.invalidateQueries(['organization', organizationId]);
```

2. **Implement optimistic updates:**
```javascript
const updateRoleMutation = useMutation({
  mutationFn: updateMemberRole,
  onMutate: async ({ userId, role }) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries(['organizations']);
    
    // Snapshot previous value
    const previousData = queryClient.getQueryData(['organizations']);
    
    // Optimistically update
    queryClient.setQueryData(['organizations'], (old) => 
      updateMemberInData(old, userId, role)
    );
    
    return { previousData };
  },
  onError: (err, variables, context) => {
    // Rollback on error
    queryClient.setQueryData(['organizations'], context.previousData);
  }
});
```

## User Detail Issues

### Issue: User detail page shows "User not found"

**Symptoms:**
- 404 error for valid user IDs
- Page shows error even for existing users

**Causes:**
- Invalid UUID format in URL
- User was deleted
- Database connection issues

**Solutions:**

1. **Validate UUID format:**
```javascript
const isValidUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// In component
if (!isValidUUID(userId)) {
  return <div>Invalid user ID format</div>;
}
```

2. **Check user existence:**
```sql
SELECT id, email, name, role FROM users WHERE id = 'user-uuid';
```

3. **Add better error handling:**
```tsx
const { data: userDetail, error, isLoading } = useQuery({
  queryKey: ['admin', 'users', userId, 'detail'],
  queryFn: () => fetchUserDetail(userId),
  retry: (failureCount, error) => {
    // Don't retry 404 errors
    if (error.status === 404) return false;
    return failureCount < 3;
  }
});

if (error?.status === 404) {
  return <UserNotFound userId={userId} />;
}
```

### Issue: User data loads slowly or incompletely

**Symptoms:**
- Long loading times
- Missing VPS or billing data
- Partial data display

**Causes:**
- Complex database queries
- Missing database indexes
- API timeout issues

**Solutions:**

1. **Optimize database queries:**
```sql
-- Add indexes for better performance
CREATE INDEX idx_vps_instances_user_id ON vps_instances(user_id);
CREATE INDEX idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
```

2. **Implement progressive loading:**
```tsx
// Load user data in stages
const { data: user } = useQuery(['user', userId]);
const { data: vpsInstances } = useQuery(['user', userId, 'vps'], {
  enabled: !!user
});
const { data: billing } = useQuery(['user', userId, 'billing'], {
  enabled: !!user
});
```

3. **Add loading skeletons:**
```tsx
if (isLoading) {
  return (
    <div className="space-y-6">
      <UserProfileSkeleton />
      <VPSListSkeleton />
      <BillingInfoSkeleton />
    </div>
  );
}
```

## API Error Handling

### Issue: Inconsistent error responses

**Symptoms:**
- Different error formats from different endpoints
- Missing error details
- Unclear error messages

**Solutions:**

1. **Standardize error middleware:**
```javascript
// Error handling middleware
const errorHandler = (err, req, res, next) => {
  const error = {
    error: err.message || 'Internal server error',
    ...(err.errors && { errors: err.errors })
  };
  
  res.status(err.status || 500).json(error);
};
```

2. **Create error response helper:**
```javascript
const createErrorResponse = (message, status = 400, errors = null) => {
  const response = { error: message };
  if (errors) response.errors = errors;
  return { status, response };
};
```

### Issue: Network errors not handled properly

**Symptoms:**
- App crashes on network failures
- No retry mechanism
- Poor user feedback

**Solutions:**

1. **Implement retry logic:**
```javascript
const apiClient = axios.create({
  timeout: 10000,
  retries: 3,
  retryDelay: (retryCount) => retryCount * 1000
});
```

2. **Add network error handling:**
```javascript
const handleApiError = (error) => {
  if (error.code === 'NETWORK_ERROR') {
    toast.error('Network connection failed. Please check your internet connection.');
  } else if (error.code === 'TIMEOUT') {
    toast.error('Request timed out. Please try again.');
  } else {
    toast.error(error.message || 'An unexpected error occurred.');
  }
};
```

## Performance Issues

### Issue: Slow organization list loading

**Symptoms:**
- Long wait times for organization data
- UI freezes during loading
- High memory usage

**Causes:**
- Large number of organizations
- Inefficient queries
- Missing pagination

**Solutions:**

1. **Implement pagination:**
```javascript
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ['organizations'],
  queryFn: ({ pageParam = 1 }) => fetchOrganizations({ page: pageParam }),
  getNextPageParam: (lastPage) => lastPage.nextPage
});
```

2. **Add virtual scrolling:**
```tsx
import { FixedSizeList as List } from 'react-window';

const OrganizationList = ({ organizations }) => (
  <List
    height={600}
    itemCount={organizations.length}
    itemSize={80}
    itemData={organizations}
  >
    {OrganizationRow}
  </List>
);
```

3. **Optimize queries:**
```sql
-- Use LIMIT and proper indexes
SELECT o.*, u.name as owner_name, u.email as owner_email,
       COUNT(om.user_id) as member_count
FROM organizations o
LEFT JOIN users u ON o.owner_id = u.id
LEFT JOIN organization_members om ON o.id = om.organization_id
GROUP BY o.id, u.name, u.email
ORDER BY o.created_at DESC
LIMIT 50 OFFSET 0;
```

### Issue: Memory leaks in admin interface

**Symptoms:**
- Browser becomes slow over time
- High memory usage
- Tab crashes

**Solutions:**

1. **Clean up subscriptions:**
```javascript
useEffect(() => {
  const subscription = eventSource.addEventListener('message', handler);
  
  return () => {
    subscription.removeEventListener('message', handler);
    eventSource.close();
  };
}, []);
```

2. **Cancel pending requests:**
```javascript
useEffect(() => {
  const controller = new AbortController();
  
  fetchData({ signal: controller.signal });
  
  return () => controller.abort();
}, []);
```

## UI/UX Issues

### Issue: Modals not responsive on mobile

**Symptoms:**
- Modals overflow screen on mobile
- Form fields not accessible
- Poor touch interaction

**Solutions:**

1. **Responsive modal styles:**
```css
.modal {
  @apply max-w-lg mx-4 sm:mx-auto;
  @apply max-h-[90vh] overflow-y-auto;
}

.modal-content {
  @apply p-4 sm:p-6;
}
```

2. **Touch-friendly interactions:**
```tsx
<Button
  className="min-h-[44px] min-w-[44px]" // Touch target size
  onClick={handleAction}
>
  Action
</Button>
```

### Issue: Form validation messages unclear

**Symptoms:**
- Generic error messages
- No field-specific guidance
- Poor error visibility

**Solutions:**

1. **Improve validation messages:**
```javascript
const validationSchema = z.object({
  name: z.string()
    .min(1, 'Organization name is required')
    .max(100, 'Name must be less than 100 characters')
    .regex(/^[a-zA-Z0-9\s-]+$/, 'Name can only contain letters, numbers, spaces, and hyphens'),
  
  email: z.string()
    .email('Please enter a valid email address')
    .min(1, 'Email is required')
});
```

2. **Better error display:**
```tsx
<div className="space-y-1">
  <Input
    {...register('name')}
    className={errors.name ? 'border-red-300' : ''}
  />
  {errors.name && (
    <p className="text-sm text-red-600 flex items-center gap-1">
      <AlertCircle className="w-4 h-4" />
      {errors.name.message}
    </p>
  )}
</div>
```

## Database Issues

### Issue: Foreign key constraint violations

**Symptoms:**
- Cannot delete organizations or users
- "violates foreign key constraint" errors
- Data inconsistency

**Solutions:**

1. **Check constraint dependencies:**
```sql
-- Find all foreign key constraints
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'organizations';
```

2. **Implement cascading deletes:**
```sql
-- Update foreign key constraints
ALTER TABLE organization_members 
DROP CONSTRAINT organization_members_organization_id_fkey;

ALTER TABLE organization_members 
ADD CONSTRAINT organization_members_organization_id_fkey 
FOREIGN KEY (organization_id) REFERENCES organizations(id) 
ON DELETE CASCADE;
```

### Issue: Database connection pool exhaustion

**Symptoms:**
- "too many connections" errors
- Slow query responses
- Connection timeouts

**Solutions:**

1. **Optimize connection pool:**
```javascript
// Database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

2. **Implement connection monitoring:**
```javascript
// Monitor pool status
setInterval(() => {
  console.log('Pool status:', {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount
  });
}, 30000);
```

## Debugging Tools

### Browser Developer Tools

1. **Network Tab**: Monitor API requests and responses
2. **Console**: Check for JavaScript errors and logs
3. **Application Tab**: Inspect localStorage and sessionStorage
4. **Performance Tab**: Profile component rendering

### Server-Side Debugging

1. **Database Query Logging:**
```javascript
// Enable query logging
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  log: (query) => console.log('Query:', query)
});
```

2. **API Request Logging:**
```javascript
// Request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, {
    body: req.body,
    user: req.user?.id
  });
  next();
});
```

### Testing Commands

```bash
# Test database connection
node scripts/test-connection.js

# Check admin users
node scripts/check-admin-users.js

# Test API endpoints
curl -X GET "http://localhost:3001/api/admin/organizations" \
  -H "Authorization: Bearer $TOKEN"

# Run component tests
npm test src/components/admin/

# Run API tests
npm test api/tests/admin-organizations.test.ts
```

## Getting Help

### Log Analysis

When reporting issues, include:

1. **Browser console errors**
2. **Network request details**
3. **Server logs** (if accessible)
4. **Steps to reproduce**
5. **Expected vs actual behavior**

### Common Log Locations

- **Browser Console**: F12 → Console tab
- **Server Logs**: `logs/app.log` or console output
- **Database Logs**: PostgreSQL logs (location varies)
- **PM2 Logs**: `pm2 logs` command

### Support Channels

1. **GitHub Issues**: For bugs and feature requests
2. **Documentation**: Check existing docs first
3. **Code Review**: For implementation questions
4. **Testing**: Verify issues in development environment

Remember to sanitize any sensitive information (passwords, tokens, personal data) before sharing logs or error messages.