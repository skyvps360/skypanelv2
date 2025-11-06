import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { query } from '../lib/database.js';

// Mock database
const mockQuery = vi.fn();
vi.mock('../lib/database.js', () => ({
  query: mockQuery,
}));

// Mock JWT verification
vi.mock('jsonwebtoken', () => ({
  verify: vi.fn(() => ({ id: '1', role: 'admin' })),
}));

describe('Admin Organization API Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/admin/organizations', () => {
    it('creates a new organization with valid data', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // Check name uniqueness
        .mockResolvedValueOnce({ rows: [] }) // Check slug uniqueness
        .mockResolvedValueOnce({ 
          rows: [{ id: '1', name: 'Test Organization', slug: 'test-org' }] 
        }); // Insert organization

      const response = await request(app)
        .post('/api/admin/organizations')
        .set('Authorization', 'Bearer valid-token')
        .send({
          name: 'Test Organization',
          slug: 'test-org',
          ownerId: 'user-1',
          description: 'Test description',
        });

      expect(response.status).toBe(201);
      expect(response.body.organization).toBeDefined();
      expect(response.body.organization.name).toBe('Test Organization');
    });

    it('returns 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/admin/organizations')
        .set('Authorization', 'Bearer valid-token')
        .send({
          name: 'Test Organization',
          // Missing slug and ownerId
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('returns 409 for duplicate organization name', async () => {
      mockQuery.mockResolvedValueOnce({ 
        rows: [{ id: '1', name: 'Test Organization' }] 
      }); // Name already exists

      const response = await request(app)
        .post('/api/admin/organizations')
        .set('Authorization', 'Bearer valid-token')
        .send({
          name: 'Test Organization',
          slug: 'test-org',
          ownerId: 'user-1',
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already exists');
    });

    it('returns 401 for missing authorization', async () => {
      const response = await request(app)
        .post('/api/admin/organizations')
        .send({
          name: 'Test Organization',
          slug: 'test-org',
          ownerId: 'user-1',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/admin/organizations/:id', () => {
    it('updates organization with valid data', async () => {
      mockQuery
        .mockResolvedValueOnce({ 
          rows: [{ id: '1', name: 'Old Name', slug: 'old-slug' }] 
        }) // Get existing organization
        .mockResolvedValueOnce({ rows: [] }) // Check name uniqueness
        .mockResolvedValueOnce({ 
          rows: [{ id: '1', name: 'Updated Organization', slug: 'updated-slug' }] 
        }); // Update organization

      const response = await request(app)
        .put('/api/admin/organizations/1')
        .set('Authorization', 'Bearer valid-token')
        .send({
          name: 'Updated Organization',
          slug: 'updated-slug',
        });

      expect(response.status).toBe(200);
      expect(response.body.organization.name).toBe('Updated Organization');
    });

    it('returns 404 for non-existent organization', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // Organization not found

      const response = await request(app)
        .put('/api/admin/organizations/999')
        .set('Authorization', 'Bearer valid-token')
        .send({
          name: 'Updated Organization',
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });
  });

  describe('DELETE /api/admin/organizations/:id', () => {
    it('deletes organization successfully', async () => {
      mockQuery
        .mockResolvedValueOnce({ 
          rows: [{ id: '1', name: 'Test Organization' }] 
        }) // Get organization
        .mockResolvedValueOnce({ rows: [] }); // Delete organization

      const response = await request(app)
        .delete('/api/admin/organizations/1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('returns 404 for non-existent organization', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // Organization not found

      const response = await request(app)
        .delete('/api/admin/organizations/999')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/admin/organizations/:id/members', () => {
    it('adds member to organization', async () => {
      mockQuery
        .mockResolvedValueOnce({ 
          rows: [{ id: '1', name: 'Test Organization' }] 
        }) // Get organization
        .mockResolvedValueOnce({ 
          rows: [{ id: 'user-1', name: 'John Doe', email: 'john@test.com' }] 
        }) // Get user
        .mockResolvedValueOnce({ rows: [] }) // Check if already member
        .mockResolvedValueOnce({ 
          rows: [{ userId: 'user-1', role: 'member' }] 
        }); // Add member

      const response = await request(app)
        .post('/api/admin/organizations/1/members')
        .set('Authorization', 'Bearer valid-token')
        .send({
          userId: 'user-1',
          role: 'member',
        });

      expect(response.status).toBe(201);
      expect(response.body.member).toBeDefined();
      expect(response.body.member.role).toBe('member');
    });

    it('returns 400 for invalid role', async () => {
      const response = await request(app)
        .post('/api/admin/organizations/1/members')
        .set('Authorization', 'Bearer valid-token')
        .send({
          userId: 'user-1',
          role: 'invalid-role',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('role');
    });

    it('returns 409 if user is already a member', async () => {
      mockQuery
        .mockResolvedValueOnce({ 
          rows: [{ id: '1', name: 'Test Organization' }] 
        }) // Get organization
        .mockResolvedValueOnce({ 
          rows: [{ id: 'user-1', name: 'John Doe' }] 
        }) // Get user
        .mockResolvedValueOnce({ 
          rows: [{ userId: 'user-1', role: 'member' }] 
        }); // User is already member

      const response = await request(app)
        .post('/api/admin/organizations/1/members')
        .set('Authorization', 'Bearer valid-token')
        .send({
          userId: 'user-1',
          role: 'member',
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already a member');
    });
  });

  describe('PUT /api/admin/organizations/:id/members/:userId', () => {
    it('updates member role', async () => {
      mockQuery
        .mockResolvedValueOnce({ 
          rows: [{ id: '1', name: 'Test Organization' }] 
        }) // Get organization
        .mockResolvedValueOnce({ 
          rows: [{ userId: 'user-1', role: 'member' }] 
        }) // Get current member
        .mockResolvedValueOnce({ 
          rows: [{ userId: 'user-1', role: 'admin' }] 
        }); // Update member role

      const response = await request(app)
        .put('/api/admin/organizations/1/members/user-1')
        .set('Authorization', 'Bearer valid-token')
        .send({
          role: 'admin',
        });

      expect(response.status).toBe(200);
      expect(response.body.member.role).toBe('admin');
    });

    it('handles ownership transfer', async () => {
      mockQuery
        .mockResolvedValueOnce({ 
          rows: [{ id: '1', name: 'Test Organization', ownerId: 'current-owner' }] 
        }) // Get organization
        .mockResolvedValueOnce({ 
          rows: [{ userId: 'user-1', role: 'member' }] 
        }) // Get current member
        .mockResolvedValueOnce({ rows: [] }) // Update current owner to admin
        .mockResolvedValueOnce({ rows: [] }) // Update new owner
        .mockResolvedValueOnce({ rows: [] }) // Update organization owner
        .mockResolvedValueOnce({ 
          rows: [{ userId: 'user-1', role: 'owner' }] 
        }); // Return updated member

      const response = await request(app)
        .put('/api/admin/organizations/1/members/user-1')
        .set('Authorization', 'Bearer valid-token')
        .send({
          role: 'owner',
        });

      expect(response.status).toBe(200);
      expect(response.body.member.role).toBe('owner');
    });
  });

  describe('DELETE /api/admin/organizations/:id/members/:userId', () => {
    it('removes member from organization', async () => {
      mockQuery
        .mockResolvedValueOnce({ 
          rows: [{ id: '1', name: 'Test Organization', ownerId: 'owner-1' }] 
        }) // Get organization
        .mockResolvedValueOnce({ 
          rows: [{ userId: 'user-1', role: 'member' }] 
        }) // Get member (not owner)
        .mockResolvedValueOnce({ rows: [] }); // Remove member

      const response = await request(app)
        .delete('/api/admin/organizations/1/members/user-1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('prevents removing organization owner', async () => {
      mockQuery
        .mockResolvedValueOnce({ 
          rows: [{ id: '1', name: 'Test Organization', ownerId: 'owner-1' }] 
        }) // Get organization
        .mockResolvedValueOnce({ 
          rows: [{ userId: 'owner-1', role: 'owner' }] 
        }); // Get member (is owner)

      const response = await request(app)
        .delete('/api/admin/organizations/1/members/owner-1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('owner');
    });
  });

  describe('GET /api/admin/users/search', () => {
    it('searches users by query', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { 
            id: 'user-1', 
            name: 'John Doe', 
            email: 'john@test.com', 
            role: 'user' 
          },
          { 
            id: 'user-2', 
            name: 'Jane Smith', 
            email: 'jane@test.com', 
            role: 'admin' 
          },
        ],
      });

      const response = await request(app)
        .get('/api/admin/users/search?q=john')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(2);
      expect(response.body.users[0].name).toBe('John Doe');
    });

    it('includes organization membership status', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            { 
              id: 'user-1', 
              name: 'John Doe', 
              email: 'john@test.com', 
              role: 'user' 
            },
          ],
        }) // Search users
        .mockResolvedValueOnce({
          rows: [
            { userId: 'user-1', organizationId: '1', role: 'member' }
          ],
        }); // Get organization memberships

      const response = await request(app)
        .get('/api/admin/users/search?q=john&organizationId=1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.users[0].isAlreadyMember).toBe(true);
    });

    it('returns empty array for no matches', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/admin/users/search?q=nonexistent')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('handles database connection errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/admin/organizations')
        .set('Authorization', 'Bearer valid-token')
        .send({
          name: 'Test Organization',
          slug: 'test-org',
          ownerId: 'user-1',
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Internal server error');
    });

    it('validates input data types', async () => {
      const response = await request(app)
        .post('/api/admin/organizations')
        .set('Authorization', 'Bearer valid-token')
        .send({
          name: 123, // Should be string
          slug: 'test-org',
          ownerId: 'user-1',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('validation');
    });
  });
});