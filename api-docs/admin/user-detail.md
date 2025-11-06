# Admin User Detail API

Admin endpoint for retrieving comprehensive user information in SkyPanelV2.

## Authentication

Requires:
- Valid JWT token
- Admin role (`role: "admin"`)

## Endpoint

### Get User Detail

Retrieve comprehensive information about a specific user, including profile data, VPS instances, billing information, and activity statistics.

**GET** `/api/admin/users/:id/detail`

#### Path Parameters

- `id` (required): UUID of the user

#### Example Request

```bash
curl -X GET /api/admin/users/550e8400-e29b-41d4-a716-446655440000/detail \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

#### Response

**Status: 200 OK**

```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "john.doe@example.com",
    "name": "John Doe",
    "role": "user",
    "phone": "+1-555-0123",
    "timezone": "America/New_York",
    "preferences": {
      "theme": "dark",
      "notifications": {
        "email": true,
        "sms": false
      }
    },
    "created_at": "2024-01-10T08:00:00.000Z",
    "updated_at": "2024-01-15T14:30:00.000Z",
    "organizations": [
      {
        "organizationId": "123e4567-e89b-12d3-a456-426614174000",
        "organizationName": "Acme Corporation",
        "organizationSlug": "acme-corp",
        "role": "member",
        "joinedAt": "2024-01-12T10:00:00.000Z"
      },
      {
        "organizationId": "789e4567-e89b-12d3-a456-426614174001",
        "organizationName": "Tech Startup Inc",
        "organizationSlug": "tech-startup",
        "role": "owner",
        "joinedAt": "2024-01-10T08:30:00.000Z"
      }
    ]
  },
  "vpsInstances": [
    {
      "id": "vps_123456789",
      "name": "web-server-01",
      "provider": "linode",
      "region": "us-east",
      "plan": "nanode-1gb",
      "status": "running",
      "ipv4": "192.168.1.100",
      "ipv6": "2001:db8::1",
      "created_at": "2024-01-12T09:00:00.000Z",
      "monthly_cost": 5.00,
      "organization": {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "name": "Acme Corporation"
      }
    }
  ],
  "billing": {
    "walletBalance": 45.67,
    "currency": "USD",
    "totalSpent": 234.56,
    "monthlySpent": 15.00,
    "lastPayment": {
      "amount": 50.00,
      "date": "2024-01-10T12:00:00.000Z",
      "method": "paypal",
      "status": "completed"
    },
    "upcomingCharges": [
      {
        "description": "VPS web-server-01 (Jan 15-16)",
        "amount": 0.21,
        "dueDate": "2024-01-16T00:00:00.000Z"
      }
    ]
  },
  "activity": [
    {
      "id": "act_789012345",
      "event": "vps.create",
      "description": "Created VPS instance web-server-01",
      "timestamp": "2024-01-12T09:00:00.000Z",
      "metadata": {
        "vpsId": "vps_123456789",
        "provider": "linode",
        "plan": "nanode-1gb"
      }
    },
    {
      "id": "act_789012346",
      "event": "billing.payment",
      "description": "Added $50.00 to wallet via PayPal",
      "timestamp": "2024-01-10T12:00:00.000Z",
      "metadata": {
        "amount": 50.00,
        "method": "paypal",
        "transactionId": "PAYPAL123456"
      }
    }
  ],
  "statistics": {
    "totalVPS": 1,
    "activeVPS": 1,
    "totalSpend": 234.56,
    "monthlySpend": 15.00,
    "organizationCount": 2,
    "ownedOrganizations": 1,
    "accountAge": 5,
    "lastLogin": "2024-01-15T08:30:00.000Z"
  }
}
```

#### Response Fields

**User Object:**
- `id`: User's unique identifier
- `email`: User's email address
- `name`: User's display name
- `role`: User's system role (`user`, `admin`)
- `phone`: User's phone number (optional)
- `timezone`: User's timezone preference (optional)
- `preferences`: User's application preferences (JSON object)
- `created_at`: Account creation timestamp
- `updated_at`: Last profile update timestamp
- `organizations`: Array of organizations the user belongs to

**Organization Membership Object:**
- `organizationId`: Organization's unique identifier
- `organizationName`: Organization's display name
- `organizationSlug`: Organization's URL slug
- `role`: User's role within the organization (`owner`, `admin`, `member`)
- `joinedAt`: Timestamp when user joined the organization

**VPS Instance Object:**
- `id`: VPS instance identifier
- `name`: User-defined VPS name
- `provider`: Cloud provider (`linode`, `digitalocean`)
- `region`: Deployment region
- `plan`: VPS plan/size identifier
- `status`: Current status (`running`, `stopped`, `provisioning`, etc.)
- `ipv4`: IPv4 address (if assigned)
- `ipv6`: IPv6 address (if assigned)
- `created_at`: VPS creation timestamp
- `monthly_cost`: Monthly cost in USD
- `organization`: Organization that owns this VPS

**Billing Object:**
- `walletBalance`: Current wallet balance in USD
- `currency`: Wallet currency (always "USD")
- `totalSpent`: Total amount spent by user
- `monthlySpent`: Amount spent in current month
- `lastPayment`: Details of most recent payment
- `upcomingCharges`: Array of pending charges

**Activity Log Object:**
- `id`: Activity log entry identifier
- `event`: Event type (e.g., `vps.create`, `billing.payment`)
- `description`: Human-readable description
- `timestamp`: Event timestamp
- `metadata`: Additional event-specific data

**Statistics Object:**
- `totalVPS`: Total number of VPS instances ever created
- `activeVPS`: Number of currently active VPS instances
- `totalSpend`: Total amount spent (same as billing.totalSpent)
- `monthlySpend`: Current month spending (same as billing.monthlySpent)
- `organizationCount`: Number of organizations user belongs to
- `ownedOrganizations`: Number of organizations user owns
- `accountAge`: Account age in days
- `lastLogin`: Timestamp of last login

#### Error Responses

**Status: 404 Not Found**
```json
{
  "error": "User not found"
}
```

**Status: 400 Bad Request**
```json
{
  "error": "Invalid user ID format"
}
```

**Status: 500 Internal Server Error**
```json
{
  "error": "Failed to retrieve user details"
}
```

## Data Sources

The endpoint aggregates data from multiple sources:

1. **User Profile**: `users` table with preferences and settings
2. **Organization Membership**: `organization_members` table with role information
3. **VPS Instances**: `vps_instances` table with current status and costs
4. **Billing Data**: `wallets`, `transactions`, and `billing_records` tables
5. **Activity Logs**: `activity_logs` table filtered by user
6. **Statistics**: Calculated from various tables

## Performance Considerations

1. **Complex Query**: This endpoint performs multiple JOINs and aggregations
2. **Caching**: Consider caching frequently accessed user details
3. **Pagination**: Activity logs are limited to recent entries (last 50)
4. **Indexing**: Ensure proper indexes on user_id foreign keys

## Use Cases

### Admin User Management

This endpoint supports various admin operations:

1. **User Profile Review**: Complete user information for support
2. **Billing Investigation**: Wallet balance and transaction history
3. **Resource Audit**: VPS instances and organization memberships
4. **Activity Monitoring**: Recent user actions and events
5. **Account Analysis**: Usage patterns and statistics

### Example Integration

```javascript
// Fetch comprehensive user details
const getUserDetail = async (userId) => {
  const response = await fetch(`/api/admin/users/${userId}/detail`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('User not found');
    }
    throw new Error('Failed to fetch user details');
  }
  
  return await response.json();
};

// Usage in admin interface
try {
  const userDetail = await getUserDetail('550e8400-e29b-41d4-a716-446655440000');
  
  // Display user profile
  console.log(`User: ${userDetail.user.name} (${userDetail.user.email})`);
  console.log(`Wallet Balance: $${userDetail.billing.walletBalance}`);
  console.log(`Active VPS: ${userDetail.statistics.activeVPS}`);
  console.log(`Organizations: ${userDetail.statistics.organizationCount}`);
  
} catch (error) {
  console.error('Error fetching user details:', error.message);
}
```

## Security Considerations

1. **Admin Only**: Endpoint requires admin privileges due to sensitive data exposure
2. **Complete Access**: Returns comprehensive user information including billing data
3. **Audit Logging**: Access to user details should be logged for compliance
4. **Data Privacy**: Ensure proper handling of personal information (PII)
5. **Rate Limiting**: Standard admin rate limits apply

## Related Endpoints

- **GET** `/api/admin/users` - List all users (summary view)
- **PUT** `/api/admin/users/:id` - Update user information
- **DELETE** `/api/admin/users/:id` - Delete user account
- **POST** `/api/admin/users/:id/impersonate` - Impersonate user session