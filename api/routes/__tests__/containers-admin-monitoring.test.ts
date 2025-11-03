/**
 * Container Admin Monitoring Routes Tests
 * Tests for the admin monitoring endpoints in the containers API
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import containerRoutes from '../containers.js';
import { query } from '../../lib/database.js';

// Mock the database query function
vi.mock('../../lib/database.js');

// Mock the authentication middleware
vi.mock('../../middleware/auth.js', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: 'test-admin-id', organizationId: 'test-org-id', role: 'admin' };
    next();
  },
  requireOrganization: (req: any, res: any, next: any) => next(),
  requireAdmin: (req: any, res: any, next: any) => next()
}));

const app = express();
app.use(express.json());
app.use('/api/containers', containerRoutes);

describe('Container Admin Monitoring Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/containers/admin/overview', () => {
    it('should return platform-wide statistics', async () => {
      // Mock database responses for overview statistics
      const mockSubscriptionStats = {
        rows: [{
          total_subscriptions: '10',
          active_subscriptions: '8',
          suspended_subscriptions: '1',
          cancelled_subscriptions: '1'
        }]
      };

      const mockProjectStats = {
        rows: [{
          total_projects: '25',
          active_projects: '23'
        }]
      };

      const mockServiceStats = {
        rows: [{
          total_services: '45',
          app_services: '30',
          postgres_services: '8',
          mysql_services: '3',
          mariadb_services: '2',
          mongo_services: '1',
          redis_services: '1'
        }]
      };

      const mockResourceStats = {
        rows: [{
          total_cpu_cores: '22.5',
          total_memory_gb: '64.0',
          total_storage_gb: '500.0'
        }]
      };

      const mockOrganizations = {
        rows: [
          {
            id: 'org-1',
            name: 'Test Organization 1',
            subscription_status: 'active',
            plan_name: 'Pro Plan',
            project_count: '3',
            service_count: '8',
            total_cpu_usage: '4.5',
            total_memory_usage: '12.0',
            total_storage_usage: '100.0',
            created_at: '2024-01-01T00:00:00Z'
          },
          {
            id: 'org-2',
            name: 'Test Organization 2',
            subscription_status: 'active',
            plan_name: 'Basic Plan',
            project_count: '1',
            service_count: '2',
            total_cpu_usage: '1.0',
            total_memory_usage: '2.0',
            total_storage_usage: '20.0',
            created_at: '2024-01-02T00:00:00Z'
          }
        ]
      };

      vi.mocked(query)
        .mockResolvedValueOnce(mockSubscriptionStats)
        .mockResolvedValueOnce(mockProjectStats)
        .mockResolvedValueOnce(mockServiceStats)
        .mockResolvedValueOnce(mockResourceStats)
        .mockResolvedValueOnce(mockOrganizations);

      const response = await request(app)
        .get('/api/containers/admin/overview')
        .expect(200);

      expect(response.body).toEqual({
        overview: {
          subscriptions: {
            total: 10,
            active: 8,
            suspended: 1,
            cancelled: 1
          },
          projects: {
            total: 25,
            active: 23
          },
          services: {
            total: 45,
            byType: {
              app: 30,
              postgres: 8,
              mysql: 3,
              mariadb: 2,
              mongo: 1,
              redis: 1
            }
          },
          resources: {
            totalCpuCores: 22.5,
            totalMemoryGb: 64.0,
            totalStorageGb: 500.0
          }
        },
        organizations: [
          {
            id: 'org-1',
            name: 'Test Organization 1',
            subscriptionStatus: 'active',
            planName: 'Pro Plan',
            projectCount: 3,
            serviceCount: 8,
            resourceUsage: {
              cpuCores: 4.5,
              memoryGb: 12.0,
              storageGb: 100.0
            },
            createdAt: '2024-01-01T00:00:00Z'
          },
          {
            id: 'org-2',
            name: 'Test Organization 2',
            subscriptionStatus: 'active',
            planName: 'Basic Plan',
            projectCount: 1,
            serviceCount: 2,
            resourceUsage: {
              cpuCores: 1.0,
              memoryGb: 2.0,
              storageGb: 20.0
            },
            createdAt: '2024-01-02T00:00:00Z'
          }
        ]
      });

      expect(query).toHaveBeenCalledTimes(5);
    });

    it('should handle database errors', async () => {
      vi.mocked(query).mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/containers/admin/overview')
        .expect(500);

      expect(response.body.error.code).toBe('ADMIN_OVERVIEW_FETCH_FAILED');
    });
  });

  describe('GET /api/containers/admin/subscriptions', () => {
    it('should return all subscriptions with pagination', async () => {
      const mockSubscriptions = {
        rows: [
          {
            id: 'sub-1',
            organization_id: 'org-1',
            organization_name: 'Test Organization 1',
            plan_id: 'plan-1',
            plan_name: 'Pro Plan',
            plan_price: '29.99',
            max_cpu_cores: 4,
            max_memory_gb: 8,
            max_storage_gb: 100,
            max_containers: 10,
            status: 'active',
            current_period_start: '2024-01-01T00:00:00Z',
            current_period_end: '2024-02-01T00:00:00Z',
            project_count: '3',
            service_count: '8',
            current_cpu_usage: '2.5',
            current_memory_usage: '4.0',
            current_storage_usage: '50.0',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          }
        ]
      };

      const mockCount = {
        rows: [{ total: '1' }]
      };

      vi.mocked(query)
        .mockResolvedValueOnce(mockSubscriptions)
        .mockResolvedValueOnce(mockCount);

      const response = await request(app)
        .get('/api/containers/admin/subscriptions')
        .expect(200);

      expect(response.body).toEqual({
        subscriptions: [
          {
            id: 'sub-1',
            organizationId: 'org-1',
            organizationName: 'Test Organization 1',
            planId: 'plan-1',
            plan: {
              id: 'plan-1',
              name: 'Pro Plan',
              priceMonthly: 29.99,
              maxCpuCores: 4,
              maxMemoryGb: 8,
              maxStorageGb: 100,
              maxContainers: 10
            },
            status: 'active',
            currentPeriodStart: '2024-01-01T00:00:00Z',
            currentPeriodEnd: '2024-02-01T00:00:00Z',
            projectCount: 3,
            serviceCount: 8,
            resourceUsage: {
              cpuCores: 2.5,
              memoryGb: 4.0,
              storageGb: 50.0,
              containerCount: 8
            },
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
          }
        ],
        pagination: {
          total: 1,
          limit: 50,
          offset: 0,
          hasMore: false
        }
      });

      expect(query).toHaveBeenCalledTimes(2);
    });

    it('should support filtering by status', async () => {
      const mockSubscriptions = { rows: [] };
      const mockCount = { rows: [{ total: '0' }] };

      vi.mocked(query)
        .mockResolvedValueOnce(mockSubscriptions)
        .mockResolvedValueOnce(mockCount);

      await request(app)
        .get('/api/containers/admin/subscriptions?status=active')
        .expect(200);

      // Verify that the query was called with status filter
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE cs.status = $1'),
        expect.arrayContaining(['active'])
      );
    });

    it('should support filtering by organization', async () => {
      const mockSubscriptions = { rows: [] };
      const mockCount = { rows: [{ total: '0' }] };

      vi.mocked(query)
        .mockResolvedValueOnce(mockSubscriptions)
        .mockResolvedValueOnce(mockCount);

      await request(app)
        .get('/api/containers/admin/subscriptions?organizationId=org-123')
        .expect(200);

      // Verify that the query was called with organization filter
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE cs.organization_id = $1'),
        expect.arrayContaining(['org-123'])
      );
    });
  });

  describe('GET /api/containers/admin/services', () => {
    it('should return all services with pagination', async () => {
      const mockServices = {
        rows: [
          {
            id: 'service-1',
            project_id: 'project-1',
            project_name: 'test-project',
            easypanel_project_name: 'org123-test-project',
            organization_id: 'org-1',
            organization_name: 'Test Organization',
            plan_id: 'plan-1',
            plan_name: 'Pro Plan',
            service_name: 'web-app',
            easypanel_service_name: 'web-app',
            service_type: 'app',
            status: 'running',
            cpu_limit: 1.0,
            memory_limit_gb: 2.0,
            storage_limit_gb: 10.0,
            configuration: '{"image": "nginx:latest"}',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          }
        ]
      };

      const mockCount = {
        rows: [{ total: '1' }]
      };

      vi.mocked(query)
        .mockResolvedValueOnce(mockServices)
        .mockResolvedValueOnce(mockCount);

      const response = await request(app)
        .get('/api/containers/admin/services')
        .expect(200);

      expect(response.body).toEqual({
        services: [
          {
            id: 'service-1',
            projectId: 'project-1',
            project: {
              id: 'project-1',
              projectName: 'test-project',
              easypanelProjectName: 'org123-test-project',
              organizationId: 'org-1'
            },
            organization: {
              id: 'org-1',
              name: 'Test Organization'
            },
            subscription: {
              planId: 'plan-1',
              planName: 'Pro Plan'
            },
            serviceName: 'web-app',
            easypanelServiceName: 'web-app',
            serviceType: 'app',
            status: 'running',
            resources: {
              cpuLimit: 1.0,
              memoryLimitGb: 2.0,
              storageLimitGb: 10.0
            },
            configuration: { image: 'nginx:latest' },
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
          }
        ],
        pagination: {
          total: 1,
          limit: 50,
          offset: 0,
          hasMore: false
        }
      });

      expect(query).toHaveBeenCalledTimes(2);
    });

    it('should support filtering by service type', async () => {
      const mockServices = { rows: [] };
      const mockCount = { rows: [{ total: '0' }] };

      vi.mocked(query)
        .mockResolvedValueOnce(mockServices)
        .mockResolvedValueOnce(mockCount);

      await request(app)
        .get('/api/containers/admin/services?serviceType=postgres')
        .expect(200);

      // Verify that the query was called with service type filter
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('cs.service_type = $'),
        expect.arrayContaining(['postgres'])
      );
    });

    it('should support filtering by organization', async () => {
      const mockServices = { rows: [] };
      const mockCount = { rows: [{ total: '0' }] };

      vi.mocked(query)
        .mockResolvedValueOnce(mockServices)
        .mockResolvedValueOnce(mockCount);

      await request(app)
        .get('/api/containers/admin/services?organizationId=org-123')
        .expect(200);

      // Verify that the query was called with organization filter
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('cp.organization_id = $'),
        expect.arrayContaining(['org-123'])
      );
    });

    it('should handle database errors', async () => {
      vi.mocked(query).mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/containers/admin/services')
        .expect(500);

      expect(response.body.error.code).toBe('ADMIN_SERVICES_FETCH_FAILED');
    });
  });
});