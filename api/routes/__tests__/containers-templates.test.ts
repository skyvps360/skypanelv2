/**
 * Container Template Routes Tests
 * Tests for the template management endpoints in the containers API
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import containerRoutes from '../containers.js';
import { ContainerTemplateService } from '../../services/containerTemplateService.js';

// Mock the services
vi.mock('../../services/containerTemplateService.js');
vi.mock('../../services/activityLogger.js');
vi.mock('../../middleware/auth.js', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-id', organizationId: 'test-org-id', role: 'admin' };
    next();
  },
  requireOrganization: (req: any, res: any, next: any) => next(),
  requireAdmin: (req: any, res: any, next: any) => next()
}));

const app = express();
app.use(express.json());
app.use('/api/containers', containerRoutes);

describe('Container Template Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/containers/templates', () => {
    it('should return enabled templates for users', async () => {
      const mockTemplates = [
        {
          id: 'template-1',
          templateName: 'wordpress',
          displayName: 'WordPress',
          description: 'WordPress CMS',
          category: 'cms',
          templateSchema: { services: [{ name: 'wordpress', type: 'app', configuration: {} }] },
          enabled: true,
          displayOrder: 0,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        }
      ];

      vi.mocked(ContainerTemplateService.listEnabledTemplates).mockResolvedValue(mockTemplates);

      const response = await request(app)
        .get('/api/containers/templates')
        .expect(200);

      expect(response.body).toEqual({
        templates: mockTemplates
      });
      expect(ContainerTemplateService.listEnabledTemplates).toHaveBeenCalledOnce();
    });

    it('should handle service errors', async () => {
      vi.mocked(ContainerTemplateService.listEnabledTemplates).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/containers/templates')
        .expect(500);

      expect(response.body.error.code).toBe('TEMPLATES_FETCH_FAILED');
    });
  });

  describe('GET /api/containers/admin/templates', () => {
    it('should return all templates for admin', async () => {
      const mockTemplates = [
        {
          id: 'template-1',
          templateName: 'wordpress',
          displayName: 'WordPress',
          description: 'WordPress CMS',
          category: 'cms',
          templateSchema: { services: [{ name: 'wordpress', type: 'app', configuration: {} }] },
          enabled: true,
          displayOrder: 0,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        },
        {
          id: 'template-2',
          templateName: 'nextjs',
          displayName: 'Next.js',
          description: 'Next.js application',
          category: 'framework',
          templateSchema: { services: [{ name: 'nextjs', type: 'app', configuration: {} }] },
          enabled: false,
          displayOrder: 1,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        }
      ];

      vi.mocked(ContainerTemplateService.listAllTemplates).mockResolvedValue(mockTemplates);

      const response = await request(app)
        .get('/api/containers/admin/templates')
        .expect(200);

      expect(response.body).toEqual({
        templates: mockTemplates
      });
      expect(ContainerTemplateService.listAllTemplates).toHaveBeenCalledOnce();
    });
  });

  describe('POST /api/containers/admin/templates', () => {
    it('should create a new template', async () => {
      const templateData = {
        templateName: 'nodejs',
        displayName: 'Node.js',
        description: 'Node.js application',
        category: 'runtime',
        templateSchema: {
          services: [
            {
              name: 'nodejs-app',
              type: 'app',
              configuration: {
                image: 'node:18',
                ports: [3000]
              }
            }
          ]
        },
        displayOrder: 0
      };

      const mockCreatedTemplate = {
        id: 'new-template-id',
        ...templateData,
        enabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      vi.mocked(ContainerTemplateService.createTemplate).mockResolvedValue(mockCreatedTemplate);

      const response = await request(app)
        .post('/api/containers/admin/templates')
        .send(templateData)
        .expect(201);

      expect(response.body).toEqual({
        template: mockCreatedTemplate
      });
      expect(ContainerTemplateService.createTemplate).toHaveBeenCalledWith(templateData);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/containers/admin/templates')
        .send({
          displayName: 'Test Template'
          // Missing templateName and templateSchema
        })
        .expect(400);

      expect(response.body.error.code).toBe('MISSING_REQUIRED_FIELDS');
    });

    it('should validate template name pattern', async () => {
      const response = await request(app)
        .post('/api/containers/admin/templates')
        .send({
          templateName: 'Invalid Name!',
          displayName: 'Test Template',
          templateSchema: {
            services: [{ name: 'test', type: 'app', configuration: {} }]
          }
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_TEMPLATE_NAME');
    });

    it('should validate template schema', async () => {
      const response = await request(app)
        .post('/api/containers/admin/templates')
        .send({
          templateName: 'test-template',
          displayName: 'Test Template',
          templateSchema: {
            services: [] // Empty services array
          }
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_TEMPLATE_SCHEMA');
    });
  });

  describe('PUT /api/containers/admin/templates/:id', () => {
    it('should update an existing template', async () => {
      const templateId = '123e4567-e89b-12d3-a456-426614174000';
      const updateData = {
        displayName: 'Updated Template Name',
        description: 'Updated description'
      };

      const mockUpdatedTemplate = {
        id: templateId,
        templateName: 'test-template',
        displayName: 'Updated Template Name',
        description: 'Updated description',
        category: 'test',
        templateSchema: { services: [{ name: 'test', type: 'app', configuration: {} }] },
        enabled: true,
        displayOrder: 0,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      vi.mocked(ContainerTemplateService.updateTemplate).mockResolvedValue(mockUpdatedTemplate);

      const response = await request(app)
        .put(`/api/containers/admin/templates/${templateId}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({
        template: mockUpdatedTemplate
      });
      expect(ContainerTemplateService.updateTemplate).toHaveBeenCalledWith(templateId, updateData);
    });

    it('should validate UUID format', async () => {
      const response = await request(app)
        .put('/api/containers/admin/templates/invalid-uuid')
        .send({ displayName: 'Updated Name' })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_TEMPLATE_ID');
    });
  });

  describe('POST /api/containers/admin/templates/:id/enable', () => {
    it('should enable a template', async () => {
      const templateId = '123e4567-e89b-12d3-a456-426614174000';
      
      const mockTemplate = {
        id: templateId,
        templateName: 'test-template',
        displayName: 'Test Template',
        description: 'Test description',
        category: 'test',
        templateSchema: { services: [{ name: 'test', type: 'app', configuration: {} }] },
        enabled: true,
        displayOrder: 0,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      vi.mocked(ContainerTemplateService.enableTemplate).mockResolvedValue(undefined);
      vi.mocked(ContainerTemplateService.getTemplate).mockResolvedValue(mockTemplate);

      const response = await request(app)
        .post(`/api/containers/admin/templates/${templateId}/enable`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(ContainerTemplateService.enableTemplate).toHaveBeenCalledWith(templateId);
    });
  });

  describe('POST /api/containers/admin/templates/:id/disable', () => {
    it('should disable a template', async () => {
      const templateId = '123e4567-e89b-12d3-a456-426614174000';
      
      const mockTemplate = {
        id: templateId,
        templateName: 'test-template',
        displayName: 'Test Template',
        description: 'Test description',
        category: 'test',
        templateSchema: { services: [{ name: 'test', type: 'app', configuration: {} }] },
        enabled: false,
        displayOrder: 0,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      vi.mocked(ContainerTemplateService.disableTemplate).mockResolvedValue(undefined);
      vi.mocked(ContainerTemplateService.getTemplate).mockResolvedValue(mockTemplate);

      const response = await request(app)
        .post(`/api/containers/admin/templates/${templateId}/disable`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(ContainerTemplateService.disableTemplate).toHaveBeenCalledWith(templateId);
    });
  });
});