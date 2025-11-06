import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { query } from '../lib/database.js';

// Mock the database
vi.mock('../lib/database.js', () => ({
  query: vi.fn(),
}));

const mockQuery = vi.mocked(query);

describe('Admin Organizations API', () => {
  const mockAdminToken = 'mock-admin-token';
  const mockUserId = '1';
  const mockOrgId = '1';

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

  describe('POST /api/admin/organizations', () => {
    it('creates a new organization successfully', async () => {
      const mockOrgData = {
        name: 'Test Organization',
        slug: 'test-organization',
        ownerId: '2',
        description: 'Test description',
      };

      // Mock database queries
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // Check if slug exists
        .mockResolvedValueOnce({ rows: [{ id: '2', name: 'John Doe', email: 'john@test.com' }] }) // Get owner info
        .mockResolvedValueOnce({ rows: [{ id: mockOrgId, ...mockOrgData }] }) // Insert organization
        .mockResolvedValueOnce({ rows: [] }); // Insert owner as member

      const response = await request(app)
        .post('/api/admin/organizations')
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .send(mockOrgData)
        .expect(201);

      expect(response.body).toHaveProperty('organization');
      expect(response.body.organization.name).toBe(mockOrgData.name);
      expect(response.body.organization.slug).toBe(mockOrgData.slug);
    });

    it('returns 400 for duplicate slug', async () => {
      const mockOrgData = {
        name: 'Test Organization',
        slug: 'existing-slug',
        ownerId: '2',
      };

      // Mock slug already exists
      mockQuery.mockResolvedValueOnce({ rows: [{ id: '1' }] });

      const response = await request(app)
        .post('/api/admin/organizations')
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .send(mockOrgData)
        .expect(400);

      expect(response.body.error).toContain('slug already exists');
    });

    it('returns 400 for invalid owner ID', async () => {
      const mockOrgData = {
        name: 'Test Organization',
        slug: 'test-organization',
        ownerId: 'invalid-id',
      };

      // Mock slug doesn't exist but owner doesn't exist
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // Check slug
        .mockResolvedValueOnce({ rows: [] }); // Check owner

      const response = await request(app)
        .post('/api/admin/organizations')
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .send(mockOrgData)
        .expect(400);

      expect(response.body.error).toContain('Owner not found');
    });

    it('returns 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/admin/organizations')
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .send({})
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('PUT /api/admin/organizations/:id', () => {
    it('updates organization successfully', async () => {
      const updateData = {
        name: 'Updated Organization',
        description: 'Updated description',
      };

      // Mock organization exists and update
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: mockOrgId, name: 'Old Name' }] }) // Check exists
        .mockResolvedValueOnce({ rows: [] }) // Check slug uniqueness (if changed)
        .mockResolvedValueOnce({ rows: [{ id: mockOrgId, ...updateData }] }); // Update

      const response = await request(app)
        .put(`/api/admin/organizations/${mockOrgId}`)
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('organization');
      expect(response.body.organization.name).toBe(updateData.name);
    });

    it('returns 404 for non-existent organization', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .put('/api/admin/organizations/999')
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(response.body.error).toContain('Organization not found');
    });
  });

  describe('DELETE /api/admin/organizations/:id', () => {
    it('deletes organization successfully', async () => {
      // Mock organization exists and deletion
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: mockOrgId, name: 'Test Org' }] }) // Check exists
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // VPS count
        .mockResolvedValueOnce({ rows: [{ count: '3' }] }) // Member count
        .mockResolvedValueOnce({ rows: [] }) // Delete VPS instances
        .mockResolvedValueOnce({ rows: [] }) // Delete members
        .mockResolvedValueOnce({ rows: [] }); // Delete organization

      const response = await request(app)
        .delete(`/api/admin/organizations/${mockOrgId}`)
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('returns 404 for non-existent organization', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .delete('/api/admin/organizations/999')
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .expect(404);

      expect(response.body.error).toContain('Organization not found');
    });
  });

  describe('POST /api/admin/organizations/:id/members', () => {
    it('adds member to organization successfully', async () => {
      const memberData = {
        userId: '3',
        role: 'member',
      };

      // Mock organization exists, user exists, not already member
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: mockOrgId }] }) // Check org exists
        .mockResolvedValueOnce({ rows: [{ id: '3', name: 'Jane Doe' }] }) // Check user exists
        .mockResolvedValueOnce({ rows: [] }) // Check not already member
        .mockResolvedValueOnce({ rows: [{ ...memberData, userName: 'Jane Doe' }] }); // Add member

      const response = await request(app)
        .post(`/api/admin/organizations/${mockOrgId}/members`)
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .send(memberData)
        .expect(201);

      expect(response.body).toHaveProperty('member');
      expect(response.body.member.userId).toBe(memberData.userId);
      expect(response.body.member.role).toBe(memberData.role);
    });

    it('returns 400 if user is already a member', async () => {
      const memberData = {
        userId: '3',
        role: 'member',
      };

      // Mock user already member
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: mockOrgId }] }) // Check org exists
        .mockResolvedValueOnce({ rows: [{ id: '3' }] }) // Check user exists
        .mockResolvedValueOnce({ rows: [{ userId: '3' }] }); // Already member

      const response = await request(app)
        .post(`/api/admin/organizations/${mockOrgId}/members`)
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .send(memberData)
        .expect(400);

      expect(response.body.error).toContain('already a member');
    });
  });

  describe('PUT /api/admin/organizations/:id/members/:userId', () => {
    it('updates member role successfully', async () => {
      const updateData = { role: 'admin' };

      // Mock member exists and update
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: mockOrgId }] }) // Check org exists
        .mockResolvedValueOnce({ rows: [{ userId: '3', role: 'member' }] }) // Check member exists
        .mockResolvedValueOnce({ rows: [{ userId: '3', role: 'admin' }] }); // Update role

      const response = await request(app)
        .put(`/api/admin/organizations/${mockOrgId}/members/3`)
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('member');
      expect(response.body.member.role).toBe('admin');
    });

    it('handles ownership transfer correctly', async () => {
      const updateData = { role: 'owner' };

      // Mock current owner and member
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: mockOrgId }] }) // Check org exists
        .mockResolvedValueOnce({ rows: [{ userId: '3', role: 'member' }] }) // Check member exists
        .mockResolvedValueOnce({ rows: [{ userId: '2', role: 'owner' }] }) // Get current owner
        .mockResolvedValueOnce({ rows: [] }) // Update current owner to admin
        .mockResolvedValueOnce({ rows: [{ userId: '3', role: 'owner' }] }); // Update new owner

      const response = await request(app)
        .put(`/api/admin/organizations/${mockOrgId}/members/3`)
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.member.role).toBe('owner');
    });
  });

  describe('DELETE /api/admin/organizations/:id/members/:userId', () => {
    it('removes member successfully', async () => {
      // Mock member exists and is not owner
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: mockOrgId }] }) // Check org exists
        .mockResolvedValueOnce({ rows: [{ userId: '3', role: 'member' }] }) // Check member exists
        .mockResolvedValueOnce({ rows: [] }); // Remove member

      const response = await request(app)
        .delete(`/api/admin/organizations/${mockOrgId}/members/3`)
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('prevents removing organization owner', async () => {
      // Mock member is owner
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: mockOrgId }] }) // Check org exists
        .mockResolvedValueOnce({ rows: [{ userId: '2', role: 'owner' }] }); // Check member is owner

      const response = await request(app)
        .delete(`/api/admin/organizations/${mockOrgId}/members/2`)
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .expect(400);

      expect(response.body.error).toContain('Cannot remove organization owner');
    });
  });

  describe('GET /api/admin/users/search', () => {
    it('searches users successfully', async () => {
      const searchQuery = 'john';
      const mockUsers = [
        { id: '1', name: 'John Doe', email: 'john@test.com', role: 'user' },
        { id: '2', name: 'Johnny Smith', email: 'johnny@test.com', role: 'admin' },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockUsers });

      const response = await request(app)
        .get(`/api/admin/users/search?q=${searchQuery}`)
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('users');
      expect(response.body.users).toHaveLength(2);
      expect(response.body.users[0].name).toBe('John Doe');
    });

    it('returns empty array for no matches', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/admin/users/search?q=nonexistent')
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .expect(200);

      expect(response.body.users).toHaveLength(0);
    });

    it('includes organization membership status when organizationId provided', async () => {
      const mockUsers = [
        { 
          id: '1', 
          name: 'John Doe', 
          email: 'john@test.com', 
          role: 'user',
          isAlreadyMember: false,
          organizations: []
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockUsers });

      const response = await request(app)
        .get(`/api/admin/users/search?q=john&organizationId=${mockOrgId}`)
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .expect(200);

      expect(response.body.users[0]).toHaveProperty('isAlreadyMember');
      expect(response.body.users[0]).toHaveProperty('organizations');
    });
  });

  describe('Authentication and Authorization', () => {
    it('returns 401 for missing token', async () => {
      const response = await request(app)
        .get('/api/admin/users/search?q=test')
        .expect(401);

      expect(response.body.error).toContain('No token provided');
    });

    it('returns 403 for non-admin user', async () => {
      // Mock JWT verification to return regular user
      vi.doMock('jsonwebtoken', () => ({
        verify: vi.fn(() => ({ userId: mockUserId, role: 'user' })),
      }));

      const response = await request(app)
        .get('/api/admin/users/search?q=test')
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .expect(403);

      expect(response.body.error).toContain('Admin access required');
    });
  });

  describe('Error Handling', () => {
    it('handles database errors gracefully', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/admin/users/search?q=test')
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .expect(500);

      expect(response.body.error).toBeDefined();
    });

    it('validates request parameters', async () => {
      const response = await request(app)
        .post('/api/admin/organizations')
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .send({ name: '' }) // Empty name
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });
});