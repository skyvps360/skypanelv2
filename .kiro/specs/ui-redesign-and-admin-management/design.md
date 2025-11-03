# Design Document

## Overview

This design addresses three interconnected improvements to SkyPanelV2:
1. **Homepage Content Redesign**: Update marketing copy and visuals to accurately reflect VPS and container selling capabilities
2. **Admin User Management Page**: Create a dedicated user detail page at `/admin/user/:id` for comprehensive user management
3. **Consistent UI Design System**: Establish and apply a unified design language across all pages, removing gradient-heavy styling

The design prioritizes consistency, usability, and maintainability while leveraging the existing shadcn/ui component library and Tailwind CSS design system.

## Architecture

### Component Hierarchy

```
App
├── Public Routes
│   └── Home (redesigned)
├── Protected Routes
│   ├── Dashboard (redesigned layout)
│   ├── ContainerDashboard (redesigned layout)
│   ├── VPS (redesigned layout)
│   └── ... (other pages with consistent layout)
└── Admin Routes
    ├── Admin (existing with link to user details)
    └── AdminUserDetail (NEW at /admin/user/:id)
```

### Design System Components

```
src/components/
├── layouts/
│   ├── PageHeader.tsx (NEW - standardized page header)
│   ├── StatsGrid.tsx (NEW - standardized metrics display)
│   └── ContentCard.tsx (NEW - standardized card wrapper)
├── admin/
│   ├── UserDetailView.tsx (NEW - user detail page content)
│   ├── UserEditForm.tsx (NEW - user editing interface)
│   ├── UserVPSList.tsx (NEW - user's VPS instances)
│   ├── UserContainerList.tsx (NEW - user's containers)
│   └── UserBillingInfo.tsx (NEW - user's billing data)
└── ui/ (existing shadcn components)
```

## Components and Interfaces

### 1. Homepage Redesign

#### Hero Section
**Purpose**: Immediately communicate VPS and container selling capabilities

**Content Structure**:
- **Headline**: "Sell VPS and Container Services to Your Clients"
- **Subheadline**: "A complete reseller platform for managing cloud infrastructure across multiple providers"
- **Primary CTA**: "Start Selling" → `/register`
- **Secondary CTA**: "View Plans" → `/containers/plans` or `/vps`

**Visual Design**:
- Clean, minimal background (solid color or subtle pattern)
- Remove heavy gradients
- Feature cards showing VPS and Container offerings side-by-side
- Real-time metrics preview (optional): "X VPS instances managed", "Y containers deployed"

#### Feature Highlights Section
**VPS Features** (3-4 cards):
- Multi-provider support (Linode, DigitalOcean)
- Instant provisioning and management
- Flexible pricing with markup control
- SSH console access

**Container Features** (3-4 cards):
- Easypanel integration
- One-click application templates
- Resource quota management
- Project-based organization

#### Social Proof Section
- Testimonials focused on reseller use cases
- Metrics: "Trusted by X resellers", "Y VPS instances managed"

### 2. Admin User Management Page

#### Route Configuration
```typescript
// Add to App.tsx
<Route
  path="/admin/user/:id"
  element={
    <AdminRoute>
      <AdminUserDetail />
    </AdminRoute>
  }
/>
```

#### Page Layout
```
┌─────────────────────────────────────────────────┐
│ Header: User Name                               │
│ Breadcrumb: Admin > Users > [User Name]        │
│ Actions: [Edit] [Delete] [Impersonate]         │
├─────────────────────────────────────────────────┤
│ Profile Card                                    │
│ ├─ Name, Email, Role                           │
│ ├─ Organization(s)                             │
│ ├─ Account Status                              │
│ └─ Created/Updated dates                       │
├─────────────────────────────────────────────────┤
│ Tabs: Overview | VPS | Containers | Billing    │
│                                                 │
│ [Tab Content Area]                              │
│                                                 │
└─────────────────────────────────────────────────┘
```

#### Data Models

```typescript
interface AdminUserDetail {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  created_at: string;
  updated_at: string;
  organizations: Array<{
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    role: string;
  }>;
  vpsInstances: Array<{
    id: string;
    label: string;
    status: string;
    ip_address: string | null;
    plan_name: string;
    provider_name: string;
    created_at: string;
  }>;
  containerSubscription: {
    id: string;
    plan_name: string;
    status: string;
    created_at: string;
  } | null;
  containerProjects: Array<{
    id: string;
    projectName: string;
    status: string;
    serviceCount: number;
    created_at: string;
  }>;
  billing: {
    walletBalance: number;
    monthlySpend: number;
    totalPayments: number;
    lastPaymentDate: string | null;
    lastPaymentAmount: number | null;
  };
}
```

#### API Endpoints

**GET /api/admin/users/:id/detail**
- Returns comprehensive user information including VPS, containers, and billing
- Requires admin authentication
- Response: `{ user: AdminUserDetail }`

**PUT /api/admin/users/:id**
- Updates user profile information
- Body: `{ name?: string, email?: string, role?: string }`
- Requires admin authentication

**DELETE /api/admin/users/:id**
- Deletes user account and associated data
- Requires admin authentication with confirmation
- Cascades to VPS instances, containers, billing records

#### Tab Content

**Overview Tab**:
- Quick stats: VPS count, Container count, Wallet balance
- Recent activity feed
- Account status indicators

**VPS Tab**:
- Table of user's VPS instances
- Columns: Name, Status, IP, Plan, Provider, Created
- Actions: View details, SSH console, Power controls

**Containers Tab**:
- Subscription status card
- List of container projects
- Resource usage visualization

**Billing Tab**:
- Wallet balance and top-up history
- Monthly spend chart
- Payment history table
- Invoice list

### 3. Consistent UI Design System

#### Design Tokens

**Colors** (using existing Tailwind/shadcn):
- Primary: `hsl(var(--primary))`
- Background: `hsl(var(--background))`
- Card: `hsl(var(--card))`
- Border: `hsl(var(--border))`
- Muted: `hsl(var(--muted))`

**Spacing**:
- Page padding: `px-4 sm:px-6 lg:px-8`
- Section gap: `space-y-8`
- Card padding: `p-6`
- Card gap: `gap-4 sm:gap-6`

**Typography**:
- Page title: `text-3xl font-semibold tracking-tight`
- Section title: `text-xl font-semibold`
- Card title: `text-lg font-semibold`
- Body text: `text-base text-muted-foreground`

#### Layout Components

**PageHeader Component**:
```typescript
interface PageHeaderProps {
  title: string;
  description?: string;
  badge?: {
    text: string;
    variant?: 'default' | 'secondary';
  };
  actions?: React.ReactNode;
}
```

**Usage**:
```tsx
<PageHeader
  title="Dashboard"
  description="Manage your VPS and container infrastructure"
  badge={{ text: "Welcome back", variant: "secondary" }}
  actions={<Button>Create VPS</Button>}
/>
```

**StatsGrid Component**:
```typescript
interface StatCardProps {
  label: string;
  value: string | number;
  description?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
}

interface StatsGridProps {
  stats: StatCardProps[];
  columns?: 2 | 3 | 4;
}
```

**ContentCard Component**:
```typescript
interface ContentCardProps {
  title: string;
  description?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}
```

#### Hero Section Pattern (No Gradients)

**Standard Hero**:
```tsx
<section className="rounded-3xl border border-border bg-card p-8 md:p-10">
  <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
    <div className="space-y-4">
      <Badge variant="secondary">Section Label</Badge>
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
        Page Title
      </h1>
      <p className="max-w-xl text-base text-muted-foreground">
        Description text
      </p>
      <div className="flex flex-wrap gap-3">
        <Button>Primary Action</Button>
        <Button variant="outline">Secondary Action</Button>
      </div>
    </div>
    {/* Optional: Stats or info card */}
  </div>
</section>
```

**Key Changes from Current Design**:
- Remove `bg-gradient-to-br from-primary/10 via-background to-background`
- Remove absolute positioned gradient blobs
- Use simple `bg-card` with `border-border`
- Maintain clean, professional appearance

#### Card Pattern

**Standard Card**:
```tsx
<Card className="border-border bg-card">
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Optional description</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>
```

**No gradient overlays or complex background treatments**

#### Status Badge Pattern

**Consistent Status Colors**:
```typescript
const statusVariants = {
  running: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  stopped: 'bg-slate-400/10 text-slate-400 border-slate-400/20',
  provisioning: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  error: 'bg-red-500/10 text-red-500 border-red-500/20',
  active: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  inactive: 'bg-muted text-muted-foreground border-muted',
};
```

## Data Models

### User Detail API Response
```typescript
interface AdminUserDetailResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    created_at: string;
    updated_at: string;
    organizations: Array<{
      organizationId: string;
      organizationName: string;
      organizationSlug: string;
      role: string;
    }>;
  };
  vpsInstances: Array<{
    id: string;
    label: string;
    status: string;
    ip_address: string | null;
    plan_name: string | null;
    provider_name: string | null;
    region_label: string | null;
    created_at: string;
  }>;
  containerSubscription: {
    id: string;
    plan_id: string;
    plan_name: string;
    status: string;
    created_at: string;
  } | null;
  containerProjects: Array<{
    id: string;
    project_name: string;
    status: string;
    service_count: number;
    created_at: string;
  }>;
  billing: {
    wallet_balance: number;
    monthly_spend: number;
    total_payments: number;
    last_payment_date: string | null;
    last_payment_amount: number | null;
    payment_history: Array<{
      id: string;
      amount: number;
      status: string;
      created_at: string;
    }>;
  };
  activity: Array<{
    id: string;
    event_type: string;
    message: string;
    created_at: string;
  }>;
}
```

## Error Handling

### User Not Found
- Display 404 page with "User not found" message
- Provide link back to admin users list

### Permission Denied
- Display 403 page with "Access denied" message
- Only admins can access `/admin/user/:id`

### Delete Confirmation
- Two-step confirmation process
- First: Modal with warning about data deletion
- Second: Type user email to confirm
- Show loading state during deletion
- Redirect to admin users list on success

### Edit Validation
- Email format validation
- Name required (min 2 characters)
- Role must be 'admin' or 'user'
- Show inline error messages
- Disable save button while saving

## Testing Strategy

### Unit Tests
- PageHeader component rendering
- StatsGrid component with various configurations
- ContentCard component
- Status badge color mapping
- User detail data transformation

### Integration Tests
- Admin user detail page loads correctly
- User edit form submission
- User deletion flow
- Navigation from admin users list to detail page
- Tab switching on user detail page

### Visual Regression Tests
- Homepage before/after redesign
- Dashboard layout consistency
- Container dashboard layout consistency
- Admin user detail page layout
- Card component consistency across pages

### E2E Tests
- Admin navigates to user detail page
- Admin edits user information
- Admin deletes user account
- Admin impersonates user from detail page
- Homepage displays correct VPS/container messaging

## Performance Considerations

### Code Splitting
- Lazy load admin user detail page
- Lazy load chart components on billing tab
- Lazy load heavy components (SSH console, etc.)

### Data Fetching
- Use React Query for caching user detail data
- Implement optimistic updates for user edits
- Prefetch user details on hover in admin users list

### Component Reusability
- Extract common layout components
- Share stat card component across pages
- Reuse table components with consistent styling

## Accessibility

### Keyboard Navigation
- All interactive elements keyboard accessible
- Tab order follows visual hierarchy
- Focus indicators visible on all focusable elements

### Screen Readers
- Proper heading hierarchy (h1 → h2 → h3)
- ARIA labels for icon-only buttons
- Status announcements for async operations
- Table headers properly associated with cells

### Color Contrast
- All text meets WCAG AA standards (4.5:1 for normal text)
- Status colors distinguishable without color alone
- Focus indicators have sufficient contrast

## Migration Strategy

### Phase 1: Design System Components
1. Create PageHeader, StatsGrid, ContentCard components
2. Document usage patterns
3. Add Storybook stories (optional)

### Phase 2: Homepage Redesign
1. Update hero section content
2. Rewrite feature highlights
3. Update CTAs and navigation
4. Remove gradient styling

### Phase 3: Admin User Detail Page
1. Create API endpoint `/api/admin/users/:id/detail`
2. Build AdminUserDetail page component
3. Add route to App.tsx
4. Update admin users list with links to detail page

### Phase 4: Consistent Layout Application
1. Update Dashboard page
2. Update ContainerDashboard page
3. Update VPS pages
4. Update remaining admin pages
5. Audit all pages for consistency

### Phase 5: Testing and Refinement
1. Run visual regression tests
2. Conduct accessibility audit
3. Performance testing
4. User acceptance testing
5. Bug fixes and polish

## Design Decisions and Rationales

### Why Remove Gradients?
- **Consistency**: Gradients are applied inconsistently across pages
- **Professionalism**: Solid colors with proper borders look more enterprise-ready
- **Maintainability**: Simpler styling is easier to maintain and extend
- **Performance**: Fewer complex CSS calculations
- **Accessibility**: Better contrast ratios with solid backgrounds

### Why Dedicated User Detail Page?
- **Scalability**: Easier to add more user management features
- **Deep Linking**: Admins can share direct links to user profiles
- **Context**: More space to display comprehensive user information
- **UX**: Clearer navigation and information hierarchy

### Why Reusable Layout Components?
- **Consistency**: Enforces uniform spacing and structure
- **Velocity**: Faster to build new pages
- **Maintainability**: Single source of truth for layout patterns
- **Flexibility**: Props allow customization while maintaining consistency

### Why Keep Existing shadcn/ui Components?
- **Proven**: Already tested and accessible
- **Familiar**: Team knows how to use them
- **Comprehensive**: Covers most UI needs
- **Customizable**: Tailwind classes allow easy styling
