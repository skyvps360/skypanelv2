# Implementation Plan

- [x] 1. Create reusable design system components


  - Create PageHeader component for standardized page headers with title, description, badge, and actions
  - Create StatsGrid component for displaying metrics in a consistent grid layout
  - Create ContentCard component for standardized card wrappers with headers and actions
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 2. Implement admin user detail API endpoint


  - [x] 2.1 Create GET /api/admin/users/:id/detail endpoint


    - Fetch user profile information from database
    - Fetch user's VPS instances with plan and provider details
    - Fetch user's container subscription and projects
    - Fetch user's billing information including wallet balance and payment history
    - Fetch recent activity for the user
    - Return comprehensive AdminUserDetailResponse
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 2.2 Create PUT /api/admin/users/:id endpoint

    - Validate request body for name, email, and role fields
    - Update user record in database
    - Return updated user information
    - _Requirements: 2.6_

  - [x] 2.3 Create DELETE /api/admin/users/:id endpoint

    - Verify admin authentication and permissions
    - Delete user's VPS instances
    - Delete user's container subscriptions and projects
    - Delete user's billing records
    - Delete user account
    - Return success response
    - _Requirements: 2.7, 2.8, 2.10_

- [x] 3. Build admin user detail page components


  - [x] 3.1 Create AdminUserDetail page component


    - Set up route at /admin/user/:id in App.tsx
    - Fetch user detail data using React Query
    - Implement loading and error states
    - Display breadcrumb navigation
    - Render page header with user name and action buttons
    - _Requirements: 2.1, 2.9_

  - [x] 3.2 Create UserProfileCard component


    - Display user name, email, role, and account status
    - Show organization memberships
    - Display created and updated timestamps
    - Style with consistent card design
    - _Requirements: 2.2_

  - [x] 3.3 Create tabbed interface for user details

    - Implement tabs for Overview, VPS, Containers, and Billing
    - Set up tab state management
    - Render appropriate content for each tab
    - _Requirements: 2.2, 2.3, 2.4, 2.5_

  - [x] 3.4 Create UserVPSList component


    - Display table of user's VPS instances
    - Show columns: Name, Status, IP, Plan, Provider, Created
    - Add status badges with consistent styling
    - Include links to VPS detail pages
    - _Requirements: 2.3_

  - [x] 3.5 Create UserContainerList component


    - Display container subscription status card
    - Show list of container projects
    - Display service counts and project status
    - Include links to project detail pages
    - _Requirements: 2.4_

  - [x] 3.6 Create UserBillingInfo component


    - Display wallet balance prominently
    - Show monthly spend and total payments
    - Render payment history table
    - Display last payment information
    - _Requirements: 2.5_

  - [x] 3.7 Implement user edit functionality


    - Create edit modal with form fields for name, email, and role
    - Add form validation for email format and required fields
    - Implement save handler calling PUT endpoint
    - Show loading state during save
    - Display success/error messages
    - _Requirements: 2.6_

  - [x] 3.8 Implement user delete functionality

    - Create delete confirmation dialog
    - Require typing user email to confirm deletion
    - Implement delete handler calling DELETE endpoint
    - Show loading state during deletion
    - Redirect to admin users list on success
    - _Requirements: 2.7, 2.8_

  - [x] 3.9 Add navigation from admin users list to detail page


    - Update UserActionMenu component to include "View Details" option
    - Add click handler to navigate to /admin/user/:id
    - Update admin users table to make rows clickable
    - _Requirements: 2.9_

- [x] 4. Redesign homepage content


  - [x] 4.1 Update hero section


    - Replace headline with "Sell VPS and Container Services to Your Clients"
    - Update subheadline to emphasize reseller platform capabilities
    - Change primary CTA to "Start Selling" linking to /register
    - Add secondary CTA "View Plans" linking to plans pages
    - Remove gradient backgrounds and replace with solid card design
    - _Requirements: 1.1, 1.5_

  - [x] 4.2 Rewrite VPS feature highlights


    - Create 3-4 feature cards focused on VPS provisioning and management
    - Highlight multi-provider support (Linode, DigitalOcean)
    - Emphasize instant provisioning capabilities
    - Mention flexible pricing with markup control
    - Include SSH console access feature
    - _Requirements: 1.2_

  - [x] 4.3 Rewrite container feature highlights

    - Create 3-4 feature cards focused on container deployment
    - Highlight Easypanel integration
    - Emphasize one-click application templates
    - Mention resource quota management
    - Include project-based organization feature
    - _Requirements: 1.3_

  - [x] 4.4 Update testimonials and use cases


    - Rewrite testimonials to reference VPS and container management workflows
    - Update customer quotes to reflect reseller use cases
    - Add metrics showing VPS instances managed and containers deployed
    - _Requirements: 1.4_

- [x] 5. Apply consistent layout to Dashboard page


  - [x] 5.1 Update Dashboard hero section


    - Replace gradient background with solid card design using bg-card and border-border
    - Remove absolute positioned gradient blobs
    - Apply PageHeader component for title and description
    - Maintain existing functionality while updating visual design
    - _Requirements: 3.1, 3.5, 3.6, 3.7_

  - [x] 5.2 Standardize Dashboard stat cards


    - Apply StatsGrid component for metrics display
    - Ensure consistent card padding, borders, and shadows
    - Use standardized status badge colors
    - _Requirements: 3.6, 3.10_

  - [x] 5.3 Update Dashboard content cards


    - Apply ContentCard component to VPS fleet and billing sections
    - Ensure consistent spacing and typography
    - Standardize button styles and hover states
    - _Requirements: 3.6, 3.8_

- [x] 6. Apply consistent layout to ContainerDashboard page



  - [x] 6.1 Update ContainerDashboard hero section


    - Replace gradient background with solid card design
    - Remove absolute positioned gradient blobs
    - Apply PageHeader component
    - Maintain resource usage card with consistent styling
    - _Requirements: 3.2, 3.5, 3.6, 3.7_



  - [ ] 6.2 Standardize ContainerDashboard stat cards
    - Apply StatsGrid component for metrics
    - Ensure consistent styling with Dashboard page
    - Use standardized status badge colors


    - _Requirements: 3.6, 3.10_

  - [ ] 6.3 Update ContainerDashboard content cards
    - Apply ContentCard component to projects list and quick actions
    - Ensure consistent spacing and typography
    - Standardize button styles
    - _Requirements: 3.6, 3.8_

- [ ] 7. Apply consistent layout to VPS pages
  - [ ] 7.1 Update VPS list page
    - Apply PageHeader component
    - Standardize card designs
    - Ensure consistent table styling
    - Use standardized status badges
    - _Requirements: 3.3, 3.6, 3.9, 3.10_

  - [ ] 7.2 Update VPSDetail page
    - Apply PageHeader component
    - Standardize metric cards
    - Ensure consistent button styling
    - Use standardized status badges
    - _Requirements: 3.3, 3.6, 3.8, 3.10_

- [ ] 8. Apply consistent layout to admin pages
  - [ ] 8.1 Update Admin dashboard section
    - Apply PageHeader component to admin dashboard
    - Standardize strategic panel cards
    - Ensure consistent spacing and typography
    - _Requirements: 3.4, 3.6, 3.7_

  - [ ] 8.2 Update admin management sections
    - Apply consistent card styling to all admin sections
    - Standardize table designs across admin pages
    - Ensure consistent button and badge styling
    - _Requirements: 3.4, 3.6, 3.8, 3.9, 3.10_

- [ ] 9. Update remaining pages for consistency
  - [ ] 9.1 Update Billing page
    - Apply PageHeader component
    - Standardize card designs
    - Ensure consistent table styling
    - _Requirements: 3.6, 3.8, 3.9_

  - [ ] 9.2 Update Support page
    - Apply PageHeader component
    - Standardize card designs
    - Ensure consistent form styling
    - _Requirements: 3.6, 3.8_

  - [ ] 9.3 Update Settings page
    - Apply PageHeader component
    - Standardize card designs
    - Ensure consistent form styling
    - _Requirements: 3.6, 3.8_

  - [ ] 9.4 Audit all remaining pages
    - Review all pages for gradient usage and remove
    - Ensure consistent spacing and typography
    - Verify status badge consistency
    - Check button and card styling
    - _Requirements: 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

- [ ] 10. Testing and validation
  - [ ] 10.1 Test admin user detail page functionality
    - Verify user detail page loads correctly
    - Test user edit form submission and validation
    - Test user deletion flow with confirmation
    - Verify navigation from admin users list
    - Test tab switching and data display
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

  - [ ] 10.2 Verify homepage content accuracy
    - Confirm VPS and container messaging is prominent
    - Verify CTAs link to correct pages
    - Check feature highlights for accuracy
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ] 10.3 Validate UI consistency across pages
    - Verify no gradient backgrounds remain
    - Check card styling consistency
    - Verify status badge color consistency
    - Check button styling consistency
    - Verify spacing and typography consistency
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

  - [ ] 10.4 Run accessibility checks
    - Verify keyboard navigation works on all pages
    - Check screen reader compatibility
    - Verify color contrast meets WCAG AA standards
    - Test focus indicators visibility
    - _Requirements: All_

  - [ ] 10.5 Performance testing
    - Measure page load times before and after changes
    - Verify React Query caching works correctly
    - Check for unnecessary re-renders
    - Test lazy loading of admin user detail page
    - _Requirements: All_
