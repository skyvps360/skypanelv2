# EasyPanel Subscription Workflow Implementation Guide

## 1. Enhanced Container Plan Service Implementation

### 1.1 Enhanced Interfaces and Types

```typescript
// api/services/containerPlanService.ts

interface EasypanelUserCreationResult {
  id: string;
  email: string;
  isNew: boolean;
  encryptedPassword?: string;
}

interface ProjectCreationResult {
  projectName: string;
  easypanelProjectName: string;
  createdAt: string;
}

interface SubscriptionWorkflowResult {
  subscription: ContainerSubscription;
  easypanelUser: EasypanelUserCreationResult;
  projects: ProjectCreationResult[];
  billingCycle: BillingCycle;
}

interface CancellationResult {
  refundAmount: number;
  projectsDeleted: number;
  servicesDeleted: number;
  walletCredited: boolean;
}

interface IdempotencyRecord {
  id: string;
  operation: string;
  idempotencyKey: string;
  organizationId: string;
  requestHash: string;
  responseData: any;
  responseStatus: number;
  createdAt: Date;
  expiresAt: Date;
}
```

### 1.2 Enhanced Subscription Method

```typescript
/**
 * Enhanced subscribe method with idempotency and robust error handling
 */
static async subscribe(organizationId: string, planId: string): Promise<SubscriptionWorkflowResult> {
  const requestId = uuidv4();
  const startTime = Date.now();
  
  try {
    return await transaction(async (client) => {
      // Generate idempotency key for this operation
      const idempotencyKey = this.generateIdempotencyKey('subscribe', organizationId, planId);
      
      // Check for existing idempotent operation
      const existingOperation = await this.getIdempotentOperation('subscribe', idempotencyKey);
      if (existingOperation) {
        logger.info('Returning cached idempotent response', { requestId, idempotencyKey });
        return existingOperation.responseData;
      }

      // Step 1: Validate existing subscription
      const existingSubscription = await this.validateNoActiveSubscription(client, organizationId);
      
      // Step 2: Get and validate plan
      const plan = await this.getAndValidatePlan(client, planId);
      
      // Step 3: Check wallet balance
      await this.validateWalletBalance(client, organizationId, plan.priceMonthly);
      
      // Step 4: Get organization details
      const orgDetails = await this.getOrganizationDetails(client, organizationId);
      
      // Step 5: Create or get EasyPanel user
      const easypanelUser = await this.createOrGetEasypanelUser(
        orgDetails.ownerEmail,
        requestId,
        idempotencyKey
      );
      
      // Step 6: Process payment
      await this.processSubscriptionPayment(
        client,
        organizationId,
        plan.priceMonthly,
        plan.name,
        requestId
      );
      
      // Step 7: Create subscription record
      const subscription = await this.createSubscriptionRecord(
        client,
        organizationId,
        planId,
        easypanelUser,
        requestId
      );
      
      // Step 8: Create initial project
      const projects = await this.createInitialProjects(
        client,
        organizationId,
        subscription.id,
        orgDetails.orgName,
        easypanelUser.id,
        requestId,
        idempotencyKey
      );
      
      // Step 9: Create billing cycle
      const billingCycle = await this.createBillingCycle(
        client,
        subscription.id,
        organizationId,
        plan.priceMonthly,
        requestId
      );
      
      // Step 10: Store idempotent result
      const result: SubscriptionWorkflowResult = {
        subscription: this.mapSubscriptionToDomain(subscription),
        easypanelUser,
        projects,
        billingCycle
      };
      
      await this.storeIdempotentResult('subscribe', idempotencyKey, result, 200);
      
      // Log successful completion
      logger.info('Subscription workflow completed successfully', {
        requestId,
        organizationId,
        planId,
        subscriptionId: subscription.id,
        easypanelUserId: easypanelUser.id,
        projectsCreated: projects.length,
        durationMs: Date.now() - startTime
      });
      
      return result;
    });
    
  } catch (error) {
    // Enhanced error logging
    logger.error('Subscription workflow failed', {
      requestId,
      organizationId,
      planId,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error,
      durationMs: Date.now() - startTime
    });
    
    throw this.transformError(error);
  }
}
```

### 1.3 Idempotency Implementation

```typescript
/**
 * Generate idempotency key for operations
 */
private static generateIdempotencyKey(
  operation: string, 
  organizationId: string, 
  ...additionalParams: string[]
): string {
  const timestamp = new Date().toISOString().slice(0, 19); // YYYY-MM-DDTHH:MM:SS
  const params = [operation, organizationId, ...additionalParams].join('-');
  const randomSuffix = crypto.randomBytes(8).toString('hex');
  return `skypanel-${params}-${timestamp}-${randomSuffix}`;
}

/**
 * Check for existing idempotent operation
 */
private static async getIdempotentOperation(
  operation: string, 
  idempotencyKey: string
): Promise<IdempotencyRecord | null> {
  try {
    const result = await query(`
      SELECT id, response_data, response_status, expires_at
      FROM easypanel_idempotency_keys
      WHERE operation = $1 AND idempotency_key = $2
      AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `, [operation, idempotencyKey]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      operation,
      idempotencyKey,
      responseData: row.response_data,
      responseStatus: row.response_status,
      expiresAt: new Date(row.expires_at)
    };
  } catch (error) {
    logger.error('Error checking idempotent operation', { operation, idempotencyKey, error });
    return null;
  }
}

/**
 * Store idempotent operation result
 */
private static async storeIdempotentResult(
  operation: string,
  idempotencyKey: string,
  responseData: any,
  responseStatus: number
): Promise<void> {
  try {
    await query(`
      INSERT INTO easypanel_idempotency_keys (
        operation, idempotency_key, organization_id, request_hash,
        response_data, response_status, expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '24 hours')
    `, [
      operation,
      idempotencyKey,
      responseData.subscription?.organizationId || null,
      crypto.createHash('sha256').update(JSON.stringify(responseData)).digest('hex'),
      JSON.stringify(responseData),
      responseStatus
    ]);
  } catch (error) {
    logger.error('Error storing idempotent result', { operation, idempotencyKey, error });
    // Don't throw - this is not critical to the main operation
  }
}
```

### 1.4 Enhanced EasyPanel User Creation

```typescript
/**
 * Create or get existing EasyPanel user with idempotency
 */
private static async createOrGetEasypanelUser(
  email: string,
  requestId: string,
  idempotencyKey: string
): Promise<EasypanelUserCreationResult> {
  const userOperationKey = `${idempotencyKey}-user`;
  
  // Check for existing idempotent user creation
  const existingUserOp = await this.getIdempotentOperation('createUser', userOperationKey);
  if (existingUserOp) {
    return existingUserOp.responseData;
  }
  
  const startTime = Date.now();
  
  try {
    // Generate secure password
    const password = crypto.randomBytes(32).toString('base64');
    const encryptedPassword = encryptSecret(password);
    
    // Attempt to create user
    logger.info('Creating EasyPanel user', { requestId, email });
    
    const user = await easypanelService.createUser(email, password, false);
    
    const result: EasypanelUserCreationResult = {
      id: user.id,
      email: user.email,
      isNew: true,
      encryptedPassword
    };
    
    // Log successful creation
    logger.info('EasyPanel user created successfully', {
      requestId,
      email,
      userId: user.id,
      elapsedMs: Date.now() - startTime
    });
    
    await this.storeIdempotentResult('createUser', userOperationKey, result, 200);
    return result;
    
  } catch (error: any) {
    // Check if user already exists
    if (error.message?.toLowerCase().includes('already exists') || 
        error.message?.toLowerCase().includes('duplicate')) {
      
      logger.info('EasyPanel user already exists, retrieving details', { requestId, email });
      
      try {
        // List users to find existing one
        const users = await easypanelService.listUsers();
        const existingUser = users.find(u => u.email === email);
        
        if (existingUser) {
          const result: EasypanelUserCreationResult = {
            id: existingUser.id,
            email: existingUser.email,
            isNew: false
          };
          
          logger.info('Found existing EasyPanel user', {
            requestId,
            email,
            userId: existingUser.id
          });
          
          await this.storeIdempotentResult('createUser', userOperationKey, result, 200);
          return result;
        }
      } catch (listError) {
        logger.error('Failed to list EasyPanel users', { requestId, email, error: listError });
      }
    }
    
    // Log error and re-throw
    logger.error('EasyPanel user creation failed', {
      requestId,
      email,
      error: error instanceof Error ? error.message : error,
      elapsedMs: Date.now() - startTime
    });
    
    throw new ContainerServiceError(
      ERROR_CODES.EASYPANEL_USER_CREATION_FAILED,
      `Failed to create or retrieve EasyPanel user: ${error.message}`,
      500,
      { email, originalError: error.message }
    );
  }
}
```

### 1.5 Enhanced Project Creation

```typescript
/**
 * Create initial projects with retry and collision handling
 */
private static async createInitialProjects(
  client: any,
  organizationId: string,
  subscriptionId: string,
  orgName: string,
  easypanelUserId: string,
  requestId: string,
  idempotencyKey: string
): Promise<ProjectCreationResult[]> {
  const projects: ProjectCreationResult[] = [];
  const baseProjectName = this.sanitizeProjectName(orgName);
  
  // Try to create primary project
  const primaryProject = await this.createProjectWithRetry(
    client,
    organizationId,
    subscriptionId,
    baseProjectName,
    `${baseProjectName}-project`,
    easypanelUserId,
    requestId,
    `${idempotencyKey}-project-1`
  );
  
  if (primaryProject) {
    projects.push(primaryProject);
  }
  
  return projects;
}

/**
 * Create individual project with retry logic
 */
private static async createProjectWithRetry(
  client: any,
  organizationId: string,
  subscriptionId: string,
  projectName: string,
  easypanelProjectName: string,
  easypanelUserId: string,
  requestId: string,
  idempotencyKey: string,
  maxRetries: number = 3
): Promise<ProjectCreationResult | null> {
  const startTime = Date.now();
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const attemptProjectName = attempt === 1 
      ? easypanelProjectName 
      : `${easypanelProjectName}-${attempt}`;
    
    try {
      logger.info('Creating EasyPanel project', {
        requestId,
        attempt,
        projectName: attemptProjectName
      });
      
      // Create project in EasyPanel
      const project = await easypanelService.createProject(attemptProjectName);
      
      // Grant user access to project
      await easypanelService.updateProjectAccess(attemptProjectName, easypanelUserId, true);
      
      // Store in database
      const projectRecord = await this.createProjectRecord(
        client,
        organizationId,
        subscriptionId,
        projectName,
        attemptProjectName,
        requestId
      );
      
      const result: ProjectCreationResult = {
        projectName,
        easypanelProjectName: attemptProjectName,
        createdAt: project.createdAt
      };
      
      logger.info('EasyPanel project created successfully', {
        requestId,
        attempt,
        projectName: attemptProjectName,
        projectId: projectRecord.id,
        elapsedMs: Date.now() - startTime
      });
      
      return result;
      
    } catch (error: any) {
      logger.warn('EasyPanel project creation failed', {
        requestId,
        attempt,
        projectName: attemptProjectName,
        error: error instanceof Error ? error.message : error,
        elapsedMs: Date.now() - startTime
      });
      
      // Check if it's a name collision
      if (error.message?.toLowerCase().includes('already exists') || 
          error.message?.toLowerCase().includes('duplicate')) {
        
        if (attempt < maxRetries) {
          logger.info('Retrying with different project name', {
            requestId,
            nextAttempt: attempt + 1
          });
          continue;
        }
      }
      
      // For other errors, don't retry if it's the last attempt
      if (attempt === maxRetries) {
        logger.error('All project creation attempts failed', {
          requestId,
          projectName: attemptProjectName,
          attempts: maxRetries,
          elapsedMs: Date.now() - startTime
        });
        
        // Don't fail the entire subscription if project creation fails
        return null;
      }
      
      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt) * 1000; // 2, 4, 8 seconds
        logger.info('Waiting before retry', { requestId, waitTimeMs: waitTime });
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  return null;
}
```

### 1.6 Enhanced Cancellation Method

```typescript
/**
 * Enhanced cancellation with comprehensive cleanup
 */
static async cancelSubscription(subscriptionId: string): Promise<CancellationResult> {
  const requestId = uuidv4();
  const startTime = Date.now();
  
  try {
    return await transaction(async (client) => {
      // Get subscription details
      const subscription = await this.getSubscriptionForUpdate(client, subscriptionId);
      
      // Calculate prorated refund
      const refundAmount = this.calculateProratedRefund(subscription);
      
      // Perform cascading delete of EasyPanel resources
      const cleanupResult = await this.performCascadingDelete(
        client,
        subscription.organizationId,
        requestId
      );
      
      // Process refund if applicable
      const walletCredited = await this.processRefund(
        client,
        subscription.organizationId,
        refundAmount,
        subscriptionId,
        requestId
      );
      
      // Update subscription status
      await this.updateSubscriptionStatus(client, subscriptionId, 'cancelled');
      
      const result: CancellationResult = {
        refundAmount,
        projectsDeleted: cleanupResult.projectsDeleted,
        servicesDeleted: cleanupResult.servicesDeleted,
        walletCredited
      };
      
      logger.info('Subscription cancellation completed successfully', {
        requestId,
        subscriptionId,
        organizationId: subscription.organizationId,
        refundAmount,
        projectsDeleted: cleanupResult.projectsDeleted,
        servicesDeleted: cleanupResult.servicesDeleted,
        walletCredited,
        durationMs: Date.now() - startTime
      });
      
      return result;
    });
    
  } catch (error) {
    logger.error('Subscription cancellation failed', {
      requestId,
      subscriptionId,
      error: error instanceof Error ? error.message : error,
      durationMs: Date.now() - startTime
    });
    
    throw this.transformError(error);
  }
}

/**
 * Perform cascading delete of all EasyPanel resources
 */
private static async performCascadingDelete(
  client: any,
  organizationId: string,
  requestId: string
): Promise<{ projectsDeleted: number; servicesDeleted: number }> {
  const projects = await this.getOrganizationProjects(client, organizationId);
  let projectsDeleted = 0;
  let servicesDeleted = 0;
  
  logger.info('Starting cascading delete of EasyPanel resources', {
    requestId,
    organizationId,
    totalProjects: projects.length
  });
  
  for (const project of projects) {
    try {
      logger.info('Deleting EasyPanel project', {
        requestId,
        projectName: project.easypanelProjectName,
        projectId: project.id
      });
      
      // Get services in project
      const services = await this.getProjectServices(client, project.id);
      
      // Delete services first (if individual service deletion is supported)
      for (const service of services) {
        try {
          await this.deleteEasypanelService(project.easypanelProjectName, service.serviceName);
          servicesDeleted++;
          
          logger.info('Deleted EasyPanel service', {
            requestId,
            projectName: project.easypanelProjectName,
            serviceName: service.serviceName
          });
          
        } catch (error) {
          logger.error('Failed to delete EasyPanel service', {
            requestId,
            projectName: project.easypanelProjectName,
            serviceName: service.serviceName,
            error: error instanceof Error ? error.message : error
          });
          // Continue with other services
        }
      }
      
      // Delete the project
      await easypanelService.destroyProject(project.easypanelProjectName);
      projectsDeleted++;
      
      // Remove from database
      await client.query(`
        DELETE FROM container_projects
        WHERE id = $1 AND organization_id = $2
      `, [project.id, organizationId]);
      
      logger.info('Deleted EasyPanel project successfully', {
        requestId,
        projectName: project.easypanelProjectName,
        projectId: project.id
      });
      
    } catch (error) {
      logger.error('Failed to delete EasyPanel project', {
        requestId,
        projectName: project.easypanelProjectName,
        projectId: project.id,
        error: error instanceof Error ? error.message : error
      });
      // Continue with other projects
    }
  }
  
  logger.info('Cascading delete completed', {
    requestId,
    organizationId,
    projectsDeleted,
    servicesDeleted
  });
  
  return { projectsDeleted, servicesDeleted };
}
```

## 2. Enhanced EasyPanel Service

### 2.1 Structured Logging Wrapper

```typescript
// api/services/easypanelService.ts

/**
 * Enhanced makeRequest with structured logging and idempotency
 */
private async makeRequestWithLogging(
  endpoint: string,
  options: {
    method?: string;
    body?: any;
    idempotencyKey?: string;
    requestId?: string;
  } = {}
): Promise<any> {
  const { method = 'POST', body, idempotencyKey, requestId } = options;
  const startTime = Date.now();
  
  // Prepare request with idempotency key if provided
  const requestBody = idempotencyKey ? { ...body, idempotencyKey } : body;
  
  const logContext = {
    requestId,
    endpoint,
    method,
    hasBody: !!body,
    hasIdempotencyKey: !!idempotencyKey
  };
  
  logger.info('EasyPanel API request started', logContext);
  
  try {
    const response = await this.makeRequest(endpoint, { method, body: requestBody });
    
    logger.info('EasyPanel API request completed successfully', {
      ...logContext,
      elapsedMs: Date.now() - startTime,
      responseType: typeof response,
      hasResponseData: !!response
    });
    
    return response;
    
  } catch (error: any) {
    logger.error('EasyPanel API request failed', {
      ...logContext,
      elapsedMs: Date.now() - startTime,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 3).join('\n')
      } : error,
      statusCode: error.statusCode || error.status
    });
    
    throw error;
  }
}
```

### 2.2 Enhanced Error Handling

```typescript
/**
 * Transform EasyPanel errors to standardized format
 */
export function transformEasypanelError(error: any): ContainerServiceError {
  const errorMessage = error.message || 'EasyPanel API error';
  const errorDetails = {
    originalError: errorMessage,
    statusCode: error.statusCode || error.status,
    endpoint: error.endpoint
  };
  
  // Handle specific error types
  if (errorMessage.toLowerCase().includes('authentication')) {
    return new ContainerServiceError(
      ERROR_CODES.EASYPANEL_AUTH_FAILED,
      'EasyPanel authentication failed',
      401,
      errorDetails
    );
  }
  
  if (errorMessage.toLowerCase().includes('already exists')) {
    return new ContainerServiceError(
      ERROR_CODES.EASYPANEL_RESOURCE_EXISTS,
      'Resource already exists in EasyPanel',
      409,
      errorDetails
    );
  }
  
  if (errorMessage.toLowerCase().includes('not found')) {
    return new ContainerServiceError(
      ERROR_CODES.EASYPANEL_RESOURCE_NOT_FOUND,
      'Resource not found in EasyPanel',
      404,
      errorDetails
    );
  }
  
  if (errorMessage.toLowerCase().includes('rate limit')) {
    return new ContainerServiceError(
      ERROR_CODES.EASYPANEL_RATE_LIMITED,
      'EasyPanel rate limit exceeded',
      429,
      errorDetails
    );
  }
  
  // Default error
  return new ContainerServiceError(
    ERROR_CODES.EASYPANEL_API_ERROR,
    `EasyPanel API error: ${errorMessage}`,
    error.statusCode || 500,
    errorDetails
  );
}
```

## 3. Database Schema Extensions

### 3.1 Migration Script

```sql
-- migrations/026_enhanced_easypanel_integration.sql

-- Create idempotency keys table
CREATE TABLE IF NOT EXISTS easypanel_idempotency_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation VARCHAR(100) NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    request_hash VARCHAR(64) NOT NULL,
    response_data JSONB,
    response_status INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Create indexes for efficient lookup
CREATE INDEX idx_easypanel_idempotency_lookup ON easypanel_idempotency_keys(operation, idempotency_key);
CREATE INDEX idx_easypanel_idempotency_org ON easypanel_idempotency_keys(organization_id);
CREATE INDEX idx_easypanel_idempotency_expires ON easypanel_idempotency_keys(expires_at);

-- Enhance container_projects table
ALTER TABLE container_projects 
ADD COLUMN IF NOT EXISTS easypanel_user_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS created_via_api BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS api_creation_error TEXT,
ADD COLUMN IF NOT EXISTS last_api_sync TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deletion_scheduled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deletion_error TEXT;

-- Add tracking for subscription workflow
ALTER TABLE container_subscriptions
ADD COLUMN IF NOT EXISTS easypanel_user_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS easypanel_user_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS easypanel_password_encrypted TEXT,
ADD COLUMN IF NOT EXISTS workflow_version INTEGER DEFAULT 2;

-- Create audit log table for EasyPanel operations
CREATE TABLE IF NOT EXISTS easypanel_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    operation VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_name VARCHAR(255) NOT NULL,
    request_id VARCHAR(255) NOT NULL,
    idempotency_key VARCHAR(255),
    request_data JSONB,
    response_data JSONB,
    response_status INTEGER,
    error_message TEXT,
    elapsed_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for audit log
CREATE INDEX idx_easypanel_audit_org ON easypanel_audit_log(organization_id);
CREATE INDEX idx_easypanel_audit_operation ON easypanel_audit_log(operation, created_at);
CREATE INDEX idx_easypanel_audit_request ON easypanel_audit_log(request_id);

-- Create trigger for updated_at on new tables
CREATE TRIGGER update_easypanel_idempotency_keys_updated_at
BEFORE UPDATE ON easypanel_idempotency_keys
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_easypanel_audit_log_updated_at
BEFORE UPDATE ON easypanel_audit_log
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## 4. API Response Enhancement

### 4.1 Enhanced Response Format

```typescript
// api/routes/containers.ts

/**
 * Enhanced subscription endpoint with immediate UI updates
 */
router.post('/subscription', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  
  try {
    const { planId } = req.body;
    const organizationId = req.user!.organizationId;
    
    // Validate input
    if (!planId) {
      return res.status(400).json({
        success: false,
        error: 'Plan ID is required',
        requestId
      });
    }
    
    logger.info('Container subscription request received', {
      requestId,
      organizationId,
      planId,
      userId: req.user!.id
    });
    
    // Execute subscription workflow
    const result = await ContainerPlanService.subscribe(organizationId, planId);
    
    // Prepare enhanced response
    const response = {
      success: true,
      data: {
        subscription: {
          id: result.subscription.id,
          status: result.subscription.status,
          planId: result.subscription.planId,
          currentPeriodStart: result.subscription.currentPeriodStart,
          currentPeriodEnd: result.subscription.currentPeriodEnd
        },
        easypanel: {
          userId: result.easypanelUser.id,
          email: result.easypanelUser.email,
          isNew: result.easypanelUser.isNew
        },
        projects: result.projects.map(project => ({
          name: project.projectName,
          easypanelProjectName: project.easypanelProjectName,
          createdAt: project.createdAt
        })),
        billingCycle: {
          id: result.billingCycle.id,
          status: result.billingCycle.status,
          monthlyRate: result.billingCycle.monthlyRate
        }
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime
      }
    };
    
    logger.info('Container subscription completed successfully', {
      requestId,
      organizationId,
      planId,
      subscriptionId: result.subscription.id,
      projectsCreated: result.projects.length,
      durationMs: Date.now() - startTime
    });
    
    // Return response with immediate data for UI update
    res.status(201).json(response);
    
  } catch (error) {
    logger.error('Container subscription failed', {
      requestId,
      organizationId: req.user!.organizationId,
      error: error instanceof Error ? error.message : error,
      durationMs: Date.now() - startTime
    });
    
    const transformedError = transformContainerError(error);
    
    res.status(transformedError.statusCode).json({
      success: false,
      error: transformedError.message,
      requestId,
      details: transformedError.details
    });
  }
});
```

## 5. Frontend Integration

### 5.1 Enhanced Subscription Handler

```typescript
// src/services/containerService.ts

/**
 * Enhanced subscribe method with immediate UI feedback
 */
async subscribe(planId: string): Promise<{
  success: boolean;
  data?: {
    subscription: ContainerSubscription;
    easypanel: {
      userId: string;
      email: string;
      isNew: boolean;
    };
    projects: Array<{
      name: string;
      easypanelProjectName: string;
      createdAt: string;
    }>;
    billingCycle: BillingCycle;
  };
  error?: string;
  requestId?: string;
}> {
  try {
    const response = await apiClient.post('/containers/subscription', { planId });
    
    // Immediate cache invalidation for UI update
    queryClient.invalidateQueries({ queryKey: ['container-subscription'] });
    queryClient.invalidateQueries({ queryKey: ['container-projects'] });
    
    return {
      success: true,
      data: response.data
    };
    
  } catch (error: any) {
    logger.error('Container subscription failed', {
      planId,
      error: error.message,
      response: error.response?.data
    });
    
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to subscribe to container plan',
      requestId: error.response?.data?.requestId
    };
  }
}
```

### 5.2 Enhanced UI Component

```typescript
// src/pages/ContainerPlansPage.tsx

const handleSubscribe = async (plan: ContainerPlan) => {
  setIsLoading(true);
  setError(null);
  
  try {
    const result = await containerService.subscribe(plan.id);
    
    if (result.success && result.data) {
      // Show success notification with details
      toast.success(`Successfully subscribed to ${plan.name}!`, {
        description: `Created ${result.data.projects.length} project(s) and EasyPanel account.`,
        duration: 5000,
      });
      
      // Navigate to containers page with new data
      navigate('/containers');
      
    } else {
      setError(result.error || 'Subscription failed');
      
      // Log for debugging
      logger.error('Subscription failed', {
        planId: plan.id,
        error: result.error,
        requestId: result.requestId
      });
    }
    
  } catch (error) {
    setError('An unexpected error occurred');
    logger.error('Subscription error', error);
    
  } finally {
    setIsLoading(false);
  }
};
```

This implementation guide provides the complete code structure for implementing the robust subscription workflow with all the required enhancements including idempotency, structured logging
