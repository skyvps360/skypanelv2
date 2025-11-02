# Implementation Plan

- [ ] 1. Database schema and migrations
  - Create database tables for container plans, subscriptions, projects, services, templates, billing cycles, and Easypanel configuration
  - Add indexes for performance optimization
  - Add triggers for updated_at columns
  - Update migrations/001_initial_schema.sql with all container-related tables
  - _Requirements: 1.4, 2.3, 5.6, 6.9, 7.11, 12.6, 13.7, 17.2, 18.6_

- [ ] 2. Environment configuration
  - Add EASYPANEL_API_URL and EASYPANEL_API_KEY to .env.example
  - Document configuration requirements in README
  - _Requirements: 1.2, 1.3_

- [ ] 3. Core Easypanel service implementation
  - [ ] 3.1 Create EasypanelService class in api/services/easypanelService.ts
    - Implement HTTP client with Bearer token authentication
    - Implement testConnection() method using auth.getUser endpoint
    - Implement getUser() method
    - Add error handling and response transformation
    - _Requirements: 1.5, 1.6, 1.7_

  - [ ] 3.2 Implement project management methods
    - Implement listProjects() method
    - Implement listProjectsAndServices() method
    - Implement inspectProject() method
    - Implement createProject() method
    - Implement destroyProject() method
    - Implement updateProjectEnv() method
    - _Requirements: 5.5, 5.7, 5.8, 8.2, 13.6_

  - [ ] 3.3 Implement app service management methods
    - Implement createAppService() method
    - Implement inspectAppService() method
    - Implement deployAppService() method
    - Implement startAppService() method
    - Implement stopAppService() method
    - Implement restartAppService() method
    - Implement destroyAppService() method
    - Implement updateAppEnv() method
    - Implement updateAppResources() method
    - _Requirements: 7.10, 9.2, 9.3, 9.4, 11.7, 12.5_

  - [ ] 3.4 Implement database service creation methods
    - Implement createPostgresService() method
    - Implement createMysqlService() method
    - Implement createMariadbService() method
    - Implement createMongoService() method
    - Implement createRedisService() method
    - _Requirements: 19.8_

  - [ ] 3.5 Implement template and monitoring methods
    - Implement createFromTemplate() method
    - Implement getDockerContainers() method
    - Implement getServiceError() method
    - _Requirements: 6.8, 10.2_

- [ ] 4. Container plan service implementation
  - [ ] 4.1 Create ContainerPlanService class in api/services/containerPlanService.ts
    - Implement listPlans() method with active filter
    - Implement getPlan() method
    - Implement createPlan() method with validation
    - Implement updatePlan() method
    - Implement activatePlan() method
    - Implement deactivatePlan() method
    - _Requirements: 2.2, 2.3, 2.5, 2.6, 2.7, 2.8_

  - [ ] 4.2 Implement subscription management methods
    - Implement subscribe() method with wallet balance check
    - Implement cancelSubscription() method with project validation
    - Implement getSubscription() method
    - Implement listSubscriptions() method for admin
    - _Requirements: 4.3, 4.4, 4.5, 4.6, 18.3, 18.4, 18.5, 18.6_

- [ ] 5. Resource quota service implementation
  - Create ResourceQuotaService class in api/services/resourceQuotaService.ts
  - Implement calculateCurrentUsage() method to aggregate service resources
  - Implement checkQuotaAvailability() method
  - Implement validateDeployment() method with quota checks
  - _Requirements: 6.4, 6.5, 7.8, 7.9, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8_

- [ ] 6. Container billing service implementation
  - Create ContainerBillingService class in api/services/containerBillingService.ts
  - Implement createBillingCycle() method
  - Implement processDueBillingCycles() method for automated billing
  - Implement chargeBillingCycle() method with wallet deduction
  - Implement suspendSubscriptionForNonPayment() method
  - Implement listBillingCycles() method
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8_

- [ ] 7. Container template service implementation
  - Create ContainerTemplateService class in api/services/containerTemplateService.ts
  - Implement listEnabledTemplates() method
  - Implement listAllTemplates() method for admin
  - Implement getTemplate() method
  - Implement createTemplate() method
  - Implement updateTemplate() method
  - Implement enableTemplate() method
  - Implement disableTemplate() method
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [ ] 8. Container API routes - Configuration
  - [ ] 8.1 Create api/routes/containers.ts with authentication middleware
    - Set up Express router with authenticateToken and requireOrganization
    - Add admin role check middleware for admin routes
    - _Requirements: All requirements require authentication_

  - [ ] 8.2 Implement Easypanel configuration routes
    - GET /api/containers/admin/config - Get Easypanel configuration
    - POST /api/containers/admin/config - Update Easypanel configuration with encryption
    - POST /api/containers/admin/config/test - Test Easypanel connection
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [ ] 9. Container API routes - Plans and subscriptions
  - [ ] 9.1 Implement plan management routes
    - GET /api/containers/plans - List active plans for users
    - GET /api/containers/admin/plans - List all plans for admin
    - POST /api/containers/admin/plans - Create plan
    - PUT /api/containers/admin/plans/:id - Update plan
    - POST /api/containers/admin/plans/:id/activate - Activate plan
    - POST /api/containers/admin/plans/:id/deactivate - Deactivate plan
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 4.1_

  - [ ] 9.2 Implement subscription management routes
    - GET /api/containers/subscription - Get current subscription
    - POST /api/containers/subscription - Subscribe to plan with wallet check
    - DELETE /api/containers/subscription - Cancel subscription
    - GET /api/containers/subscription/usage - Get resource usage
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8_

- [ ] 10. Container API routes - Projects
  - Implement GET /api/containers/projects - List user projects
  - Implement POST /api/containers/projects - Create project with name validation
  - Implement GET /api/containers/projects/:projectName - Get project details
  - Implement DELETE /api/containers/projects/:projectName - Delete project with service check
  - Implement PUT /api/containers/projects/:projectName/env - Update project environment
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9_

- [ ] 11. Container API routes - Services
  - [ ] 11.1 Implement service listing and details routes
    - GET /api/containers/projects/:projectName/services - List services
    - GET /api/containers/projects/:projectName/services/:serviceName - Get service details
    - GET /api/containers/projects/:projectName/services/:serviceName/logs - Get logs
    - _Requirements: 8.4, 8.5, 8.6, 8.7, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_

  - [ ] 11.2 Implement service deployment routes
    - POST /api/containers/projects/:projectName/services/app - Deploy app service with quota validation
    - POST /api/containers/projects/:projectName/services/database - Deploy database service with quota validation
    - POST /api/containers/projects/:projectName/services/template - Deploy from template with quota validation
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8, 19.9, 19.10_

  - [ ] 11.3 Implement service lifecycle routes
    - POST /api/containers/projects/:projectName/services/:serviceName/start - Start service
    - POST /api/containers/projects/:projectName/services/:serviceName/stop - Stop service
    - POST /api/containers/projects/:projectName/services/:serviceName/restart - Restart service
    - DELETE /api/containers/projects/:projectName/services/:serviceName - Delete service
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9_

  - [ ] 11.4 Implement service configuration routes
    - PUT /api/containers/projects/:projectName/services/:serviceName/env - Update environment variables
    - PUT /api/containers/projects/:projectName/services/:serviceName/resources - Update resource limits
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9_

- [ ] 12. Container API routes - Templates
  - Implement GET /api/containers/templates - List enabled templates for users
  - Implement GET /api/containers/admin/templates - List all templates for admin
  - Implement POST /api/containers/admin/templates - Create template
  - Implement PUT /api/containers/admin/templates/:id - Update template
  - Implement POST /api/containers/admin/templates/:id/enable - Enable template
  - Implement POST /api/containers/admin/templates/:id/disable - Disable template
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [ ] 13. Container API routes - Admin monitoring
  - Implement GET /api/containers/admin/overview - Platform-wide statistics
  - Implement GET /api/containers/admin/subscriptions - All subscriptions
  - Implement GET /api/containers/admin/services - All services across organizations
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8_

- [ ] 14. Activity logging integration
  - Add container event types to activity logger
  - Log subscription create/cancel events
  - Log project create/delete events
  - Log service create/start/stop/restart/delete events
  - Log billing charge/failed events
  - _Requirements: 4.7, 5.8, 6.10, 9.8, 11.9, 12.8, 13.8, 17.8, 18.8, 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 20.9, 20.10_

- [ ] 15. Frontend - Type definitions
  - Create src/types/containers.ts with all TypeScript interfaces
  - Define ContainerPlan, ContainerSubscription, ContainerProject, ContainerService types
  - Define ContainerTemplate, ResourceUsage, QuotaCheckResult types
  - Define API request/response types
  - _Requirements: All requirements need type definitions_

- [ ] 16. Frontend - API client
  - Create src/services/containerService.ts with API client methods
  - Implement plan fetching methods
  - Implement subscription management methods
  - Implement project CRUD methods
  - Implement service CRUD and lifecycle methods
  - Implement template fetching methods
  - Implement admin methods
  - Add error handling and response transformation
  - _Requirements: All requirements need API client_

- [ ] 17. Frontend - User dashboard pages
  - [ ] 17.1 Create ContainerDashboard page
    - Create src/pages/ContainerDashboard.tsx
    - Display subscription status and resource usage
    - Display projects list with service counts
    - Add create project button
    - Add quick actions for common tasks
    - _Requirements: 8.1, 8.2, 8.3, 16.1_

  - [ ] 17.2 Create ProjectDetail page
    - Create src/pages/ProjectDetail.tsx
    - Display project information and metadata
    - Display services list within project
    - Add deploy service button
    - Add project actions (delete, update env)
    - _Requirements: 8.4, 8.5, 8.6, 8.7_

  - [ ] 17.3 Create ServiceDetail page
    - Create src/pages/ServiceDetail.tsx
    - Display service configuration and status
    - Add service lifecycle buttons (start, stop, restart, delete)
    - Display environment variables with edit capability
    - Display resource usage metrics
    - Add logs viewer section
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 12.1_

- [ ] 18. Frontend - User dashboard components
  - [ ] 18.1 Create ResourceUsageWidget component
    - Create src/components/containers/ResourceUsageWidget.tsx
    - Display CPU, memory, storage, container count usage
    - Show progress bars with percentages
    - Add warning indicators for high usage (>80%)
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8_

  - [ ] 18.2 Create ProjectsList component
    - Create src/components/containers/ProjectsList.tsx
    - Display projects in grid or list view
    - Show project name, service count, creation date
    - Add create project button
    - Add project action menu
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ] 18.3 Create ServicesList component
    - Create src/components/containers/ServicesList.tsx
    - Display services in grid or list view
    - Show service name, type, status, resource usage
    - Add status indicators (running, stopped, error)
    - Add service action buttons
    - _Requirements: 8.4, 8.5, 8.6, 8.7_

  - [ ] 18.4 Create DeployServiceModal component
    - Create src/components/containers/DeployServiceModal.tsx
    - Multi-step wizard for deployment options
    - Step 1: Choose deployment type (template, custom app, database)
    - Step 2: Configure service based on type
    - Step 3: Review and confirm
    - Add form validation and quota checking
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8, 19.9, 19.10_

  - [ ] 18.5 Create TemplateSelector component
    - Create src/components/containers/TemplateSelector.tsx
    - Display templates in grid with categories
    - Add search and filter functionality
    - Show template details on selection
    - Display required resources and configuration
    - _Requirements: 6.2, 6.3_

  - [ ] 18.6 Create ServiceLogsViewer component
    - Create src/components/containers/ServiceLogsViewer.tsx
    - Display logs with timestamps and levels
    - Add log level filter
    - Add text search functionality
    - Add refresh and download buttons
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_

  - [ ] 18.7 Create EnvironmentVariablesEditor component
    - Create src/components/containers/EnvironmentVariablesEditor.tsx
    - Display environment variables as key-value pairs
    - Add/edit/delete functionality
    - Add save button with confirmation
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9_

- [ ] 19. Frontend - Subscription management
  - [ ] 19.1 Create ContainerPlansPage
    - Create src/pages/ContainerPlansPage.tsx
    - Display available plans in cards
    - Show plan details (price, resources, limits)
    - Add subscribe button with wallet balance check
    - Display current subscription if exists
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [ ] 19.2 Create SubscriptionManagement component
    - Create src/components/containers/SubscriptionManagement.tsx
    - Display current subscription details
    - Show next billing date and amount
    - Add cancel subscription button
    - Add upgrade/downgrade options
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8_

- [ ] 20. Frontend - Admin pages
  - [ ] 20.1 Create ContainerPlansManagement page
    - Create src/pages/admin/ContainerPlansManagement.tsx
    - Display all plans in table with edit/delete actions
    - Add create plan form with validation
    - Add activate/deactivate toggles
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [ ] 20.2 Create ContainerTemplatesManagement page
    - Create src/pages/admin/ContainerTemplatesManagement.tsx
    - Display all templates in table
    - Add enable/disable toggles
    - Add template configuration editor
    - Add create template form
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ] 20.3 Create ContainerMonitoring page
    - Create src/pages/admin/ContainerMonitoring.tsx
    - Display platform-wide statistics
    - Show total subscriptions, projects, services
    - Display aggregate resource usage
    - List all organizations with subscriptions
    - Add drill-down to organization details
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8_

  - [ ] 20.4 Create EasypanelConfig page
    - Create src/pages/admin/EasypanelConfig.tsx
    - Add API URL and API key input fields
    - Add connection test button
    - Display connection status
    - Add save button with encryption
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [ ] 21. Frontend - Navigation integration
  - Add "Containers" menu item to user navigation
  - Add "Container Plans" submenu under Plan Management in admin navigation
  - Add "Container Templates" submenu under Plan Management in admin navigation
  - Add "Container Monitoring" to admin dashboard
  - Add "Easypanel Config" to Platform Settings in admin navigation
  - Update routing in src/App.tsx
  - _Requirements: All requirements need navigation access_

- [ ] 22. Billing automation
  - Create scheduled job for processing billing cycles
  - Implement daily check for due billing cycles
  - Process charges and create new cycles
  - Handle failed payments and suspension
  - Add job to ecosystem.config.cjs or separate cron
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8_

- [ ] 23. Error handling and validation
  - Add input validation for all API routes
  - Implement error transformation for Easypanel API errors
  - Add user-friendly error messages in frontend
  - Add error logging for debugging
  - _Requirements: All requirements need error handling_

- [ ] 24. Documentation
  - Update README with Easypanel integration instructions
  - Document environment variables
  - Document API endpoints
  - Create admin guide for configuration
  - Create user guide for container deployment
  - _Requirements: All requirements need documentation_

- [ ] 25. Testing
  - [ ] 25.1 Write unit tests for backend services
    - Test EasypanelService methods with mocked API
    - Test ResourceQuotaService calculations
    - Test ContainerBillingService logic
    - Test ContainerPlanService CRUD operations
    - _Requirements: All requirements need testing_

  - [ ] 25.2 Write integration tests for API routes
    - Test authentication and authorization
    - Test plan management endpoints
    - Test subscription endpoints
    - Test project and service endpoints
    - Test quota enforcement
    - _Requirements: All requirements need testing_

  - [ ] 25.3 Write frontend component tests
    - Test DeployServiceModal form validation
    - Test ResourceUsageWidget calculations
    - Test ServicesList action handlers
    - Test EnvironmentVariablesEditor CRUD
    - _Requirements: All requirements need testing_

  - [ ] 25.4 Perform end-to-end testing
    - Test complete user workflow (subscribe, deploy, manage, cancel)
    - Test admin workflow (configure, create plans, monitor)
    - Test quota enforcement scenarios
    - Test billing cycle processing
    - _Requirements: All requirements need testing_
