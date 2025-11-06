import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { query } from '../lib/database.js';

// Mock the database
vi.mock('../lib/database.js', () => ({
  query: vi.fn(),
}));

const mockQuery = vi.mocked(query);

describe('Admin User Detail API', () => {
  const mockAdminToken = 'mock-admin-token';
  const mockUserId = '1';
  const mockTargetUserId = '2';

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock JWT verification to return admin user
    vi.doMock('jsonwebtoken', () => ({
      verify: vi.fn(() => ({ userId: mockUserId, role: 'admin' })),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/admin/users/:id/detail', () => {
    it('returns comprehensive user details successfully', async () => {
      const mockUserData = {
        id: mockTargetUserId,
        email: 'user@test.com',
        name: 'Test User',
        role: 'user',
        phone: '+1234567890',
        timezone: 'UTC',
        preferences: JSON.stringify({ theme: 'dark' }),
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      };

      const mockOrganizations = [
        {
          organizationId: '1',
          organizationName: 'Test Org',
          organizationSlug: 'test-org',
          role: 'member',
          joinedAt: '2024-01-01T00:00:00Z',
        },
      ];

      const mockVPSInstances = [
        {
          id: '1',
          name: 'test-vps',
          status: 'running',
          provider: 'linode',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      const mockBilling = {
        balance: 100.50,
        totalSpent: 250.75,
        lastPayment: '2024-01-01T00:00:00Z',
      };

      const mockActivity = [
        {
          id: '1',
          action: 'login',
          timestamp: '2024-01-02T00:00:00Z',
          details: 'User logged in',
        },
      ];

      const mockStatistics = {
        totalVPS: 1,
        activeVPS: 1,
        totalSpend: 250.75,
        monthlySpend: 50.25,
      };

      // Mock all database queries
      mockQuery
        .mockResolvedValueOnce({ rows: [mockUserData] }) // Get user
        .mockResolvedValueOnce({ rows: mockOrganizations }) // Get organizations
        .mockResolvedValueOnce({ rows: mockVPSInstances }) // Get VPS instances
        .mockResolvedValueOnce({ rows: [mockBilling] }) // Get billing info
        .mockResolvedValueOnce({ rows: mockActivity }) // Get activity
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }) // Total VPS count
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }) // Active VPS count
        .mockResolvedValueOnce({ rows: [{ total: '250.75' }] }) // Total spend
        .mockResolvedValueOnce({ rows: [{ monthly: '50.25' }] }); // Monthly spend

      const response = await request(app)
        .get(`/api/admin/users/${mockTargetUserId}/detail`)
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('vpsInstances');
      expect(response.body).toHaveProperty('billing');
      expect(response.body).toHaveProperty('activity');
      expect(response.body).toHaveProperty('statistics');

      expect(response.body.user.id).toBe(mockTargetUserId);
      expect(response.body.user.email).toBe(mockUserData.email);
      expect(response.body.user.organizations).toHaveLength(1);
      expect(response.body.vpsInstances).toHaveLength(1);
      expect(response.body.statistics.totalVPS).toBe(1);
    });

    it('returns 404 for non-existent user', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/admin/users/999/detail')
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .expect(404);

      expect(response.body.error).toContain('User not found');
    });

    it('handles invalid user ID format', async () => {
      const response = await request(app)
        .get('/api/admin/users/invalid-id/detail')
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .expect(400);

      expect(response.body.error).toContain('Invalid user ID');
    });

    it('returns user with empty organizations array when user has no organizations', async () => {
      const mockUserData = {
        id: mockTargetUserId,
        email: 'user@test.com',
        name: 'Test User',
        role: 'user',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      };

      // Mock user exists but has no organizations, VPS, etc.
      mockQuery
        .mockResolvedValueOnce({ rows: [mockUserData] }) // Get user
        .mockResolvedValueOnce({ rows: [] }) // No organizations
        .mockResolvedValueOnce({ rows: [] }) // No VPS instances
        .mockResolvedValueOnce({ rows: [{ balance: 0, totalSpent: 0 }] }) // Empty billing
        .mockResolvedValueOnce({ rows: [] }) // No activity
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // No VPS
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // No active VPS
        .mockResolvedValueOnce({ rows: [{ total: '0' }] }) // No spend
        .mockResolvedValueOnce({ rows: [{ monthly: '0' }] }); // No monthly spend

      const response = await request(app)
        .get(`/api/admin/users/${mockTargetUserId}/detail`)
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .expect(200);

      expect(response.body.user.organizations).toEqual([]);
      expect(response.body.vpsInstances).toEqual([]);
      expect(response.body.activity).toEqual([]);
      expect(response.body.statistics.totalVPS).toBe(0);
    });

    it('handles database errors gracefully', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .get(`/api/admin/users/${mockTargetUserId}/detail`)
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .expect(500);

      expect(response.body.error).toBeDefined();
    });

    it('parses JSON preferences correctly', async () => {
      const mockUserData = {
        id: mockTargetUserId,
        email: 'user@test.com',
        name: 'Test User',
        role: 'user',
        preferences: JSON.stringify({ theme: 'dark', language: 'en' }),
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockUserData] })
        .mockResolvedValueOnce({ rows: [] }) // Organizations
        .mockResolvedValueOnce({ rows: [] }) // VPS
        .mockResolvedValueOnce({ rows: [{ balance: 0 }] }) // Billing
        .mockResolvedValueOnce({ rows: [] }) // Activity
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // Stats
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({ rows: [{ monthly: '0' }] });

      const response = await request(app)
        .get(`/api/admin/users/${mockTargetUserId}/detail`)
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .expect(200);

      expect(response.body.user.preferences).toEqual({ theme: 'dark', language: 'en' });
    });

    it('handles malformed JSON preferences gracefully', async () => {
      const mockUserData = {
        id: mockTargetUserId,
        email: 'user@test.com',
        name: 'Test User',
        role: 'user',
        preferences: 'invalid-json',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockUserData] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ balance: 0 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({ rows: [{ monthly: '0' }] });

      const response = await request(app)
        .get(`/api/admin/users/${mockTargetUserId}/detail`)
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .expect(200);

      expect(response.body.user.preferences).toEqual({});
    });
  });

  describe('Authentication and Authorization', () => {
    it('returns 401 for missing token', async () => {
      const response = await request(app)
        .get(`/api/admin/users/${mockTargetUserId}/detail`)
        .expect(401);

      expect(response.body.error).toContain('No token provided');
    });

    it('returns 403 for non-admin user', async () => {
      // Mock JWT verification to return regular user
      vi.doMock('jsonwebtoken', () => ({
        verify: vi.fn(() => ({ userId: mockUserId, role: 'user' })),
      }));

      const response = await request(app)
        .get(`/api/admin/users/${mockTargetUserId}/detail`)
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .expect(403);

      expect(response.body.error).toContain('Admin access required');
    });
  });

  describe('Data Consistency', () => {
    it('ensures statistics match returned data', async () => {
      const mockUserData = {
        id: mockTargetUserId,
        email: 'user@test.com',
        name: 'Test User',
        role: 'user',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      };

      const mockVPSInstances = [
        { id: '1', status: 'running' },
        { id: '2', status: 'stopped' },
        { id: '3', status: 'running' },
      ];

      mockQuery
        .mockResolvedValueOnce({ rows: [mockUserData] })
        .mockResolvedValueOnce({ rows: [] }) // Organizations
        .mockResolvedValueOnce({ rows: mockVPSInstances }) // VPS instances
        .mockResolvedValueOnce({ rows: [{ balance: 100 }] }) // Billing
        .mockResolvedValueOnce({ rows: [] }) // Activity
        .mockResolvedValueOnce({ rows: [{ count: '3' }] }) // Total VPS
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // Active VPS
        .mockResolvedValueOnce({ rows: [{ total: '300' }] }) // Total spend
        .mockResolvedValueOnce({ rows: [{ monthly: '50' }] }); // Monthly spend

      const response = await request(app)
        .get(`/api/admin/users/${mockTargetUserId}/detail`)
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .expect(200);

      expect(response.body.vpsInstances).toHaveLength(3);
      expect(response.body.statistics.totalVPS).toBe(3);
      expect(response.body.statistics.activeVPS).toBe(2);
    });
  });
});