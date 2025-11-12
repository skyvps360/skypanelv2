/**
 * Template Routes for Container Platform
 * Handles application template CRUD operations
 */
import { Router, Response } from 'express';
import { TemplateService } from '../../services/containers/TemplateService.js';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth.js';

const router = Router();

/**
 * List all templates
 * GET /api/containers/templates
 * Query params: category, isActive, search
 */
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { category, isActive, search } = req.query;

    const filters: any = {};
    if (category) filters.category = category as string;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (search) filters.search = search as string;

    const templates = await TemplateService.listTemplates(filters);

    res.json({
      success: true,
      data: templates
    });
  } catch (error: any) {
    console.error('Error listing templates:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'TEMPLATE_LIST_ERROR',
        message: error.message || 'Failed to list templates'
      }
    });
  }
});

/**
 * Get template details
 * GET /api/containers/templates/:id
 */
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const template = await TemplateService.getTemplate(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TEMPLATE_NOT_FOUND',
          message: 'Template not found'
        }
      });
    }

    res.json({
      success: true,
      data: template
    });
  } catch (error: any) {
    console.error('Error getting template:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'TEMPLATE_GET_ERROR',
        message: error.message || 'Failed to get template'
      }
    });
  }
});

/**
 * Create new template (admin only)
 * POST /api/containers/templates
 */
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only administrators can create templates'
        }
      });
    }

    const {
      name,
      description,
      category,
      iconUrl,
      nixExpression,
      defaultEnvVars,
      defaultResourceLimits,
      isActive,
      displayOrder,
      isMultiService,
      services
    } = req.body;

    // Validate required fields
    if (!name || !description || !category || !nixExpression || !defaultResourceLimits) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields: name, description, category, nixExpression, defaultResourceLimits'
        }
      });
    }

    // Validate category
    const validCategories = ['web', 'api', 'worker', 'database', 'static', 'custom'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid category. Must be one of: ${validCategories.join(', ')}`
        }
      });
    }

    const template = await TemplateService.createTemplate({
      name,
      description,
      category,
      iconUrl,
      nixExpression,
      defaultEnvVars,
      defaultResourceLimits,
      isActive,
      displayOrder,
      isMultiService,
      services
    });

    res.status(201).json({
      success: true,
      data: template
    });
  } catch (error: any) {
    console.error('Error creating template:', error);

    // Handle validation errors
    if (error.message.includes('expression') || error.message.includes('balanced')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'TEMPLATE_CREATE_ERROR',
        message: error.message || 'Failed to create template'
      }
    });
  }
});

/**
 * Update template (admin only)
 * PATCH /api/containers/templates/:id
 */
router.patch('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only administrators can update templates'
        }
      });
    }

    const { id } = req.params;
    const updates = req.body;

    // Validate category if provided
    if (updates.category) {
      const validCategories = ['web', 'api', 'worker', 'database', 'static', 'custom'];
      if (!validCategories.includes(updates.category)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid category. Must be one of: ${validCategories.join(', ')}`
          }
        });
      }
    }

    const template = await TemplateService.updateTemplate(id, updates);

    res.json({
      success: true,
      data: template
    });
  } catch (error: any) {
    console.error('Error updating template:', error);

    // Handle not found
    if (error.message === 'Template not found') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TEMPLATE_NOT_FOUND',
          message: 'Template not found'
        }
      });
    }

    // Handle validation errors
    if (error.message.includes('expression') || error.message.includes('balanced')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'TEMPLATE_UPDATE_ERROR',
        message: error.message || 'Failed to update template'
      }
    });
  }
});

/**
 * Deploy service from template
 * POST /api/containers/templates/:id/deploy
 */
router.post('/:id/deploy', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, environmentVars, resourceLimits, groupName } = req.body;

    // Get organization ID from authenticated user
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ORGANIZATION_REQUIRED',
          message: 'User must belong to an organization'
        }
      });
    }

    // Check if this is a multi-service deployment
    const template = await TemplateService.getTemplate(id);
    if (!template) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TEMPLATE_NOT_FOUND',
          message: 'Template not found'
        }
      });
    }

    // Handle multi-service template
    if (template.isMultiService) {
      if (!groupName) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'groupName is required for multi-service templates'
          }
        });
      }

      const result = await TemplateService.deployMultiServiceTemplate(
        organizationId,
        id,
        groupName,
        {
          environmentVars,
          resourceLimits
        }
      );

      return res.status(201).json({
        success: true,
        data: {
          services: result.services,
          deploymentOrder: result.deploymentOrder,
          groupName
        }
      });
    }

    // Handle single-service template
    const { ContainerServiceManager } = await import('../../services/containers/ContainerService.js');

    const service = await ContainerServiceManager.deployFromTemplate(
      organizationId,
      id,
      {
        name,
        environmentVars,
        resourceLimits
      }
    );

    res.status(201).json({
      success: true,
      data: service
    });
  } catch (error: any) {
    console.error('Error deploying from template:', error);

    // Handle not found
    if (error.message === 'Template not found') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TEMPLATE_NOT_FOUND',
          message: 'Template not found'
        }
      });
    }

    // Handle inactive template
    if (error.message === 'Template is not active') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TEMPLATE_INACTIVE',
          message: 'Template is not active'
        }
      });
    }

    // Handle multi-service errors
    if (error.message.includes('multi-service')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message
        }
      });
    }

    // Handle quota errors
    if (error.message.includes('quota exceeded')) {
      return res.status(507).json({
        success: false,
        error: {
          code: 'QUOTA_EXCEEDED',
          message: error.message
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'TEMPLATE_DEPLOY_ERROR',
        message: error.message || 'Failed to deploy from template'
      }
    });
  }
});

/**
 * Delete multi-service group
 * DELETE /api/containers/templates/groups/:groupName
 */
router.delete('/groups/:groupName', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { groupName } = req.params;
    const { confirmed } = req.query;

    // Get organization ID from authenticated user
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ORGANIZATION_REQUIRED',
          message: 'User must belong to an organization'
        }
      });
    }

    const result = await TemplateService.deleteMultiServiceGroup(
      organizationId,
      groupName,
      confirmed === 'true'
    );

    if (result.requiresConfirmation) {
      return res.status(200).json({
        success: true,
        requiresConfirmation: true,
        message: 'Please confirm deletion of all services in this group'
      });
    }

    res.json({
      success: true,
      data: {
        deleted: result.deleted,
        count: result.deleted.length
      }
    });
  } catch (error: any) {
    console.error('Error deleting multi-service group:', error);

    // Handle not found
    if (error.message === 'No services found in group') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'GROUP_NOT_FOUND',
          message: 'No services found in group'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'GROUP_DELETE_ERROR',
        message: error.message || 'Failed to delete multi-service group'
      }
    });
  }
});

/**
 * Delete template (admin only)
 * DELETE /api/containers/templates/:id
 */
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only administrators can delete templates'
        }
      });
    }

    const { id } = req.params;

    await TemplateService.deleteTemplate(id);

    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting template:', error);

    // Handle not found
    if (error.message === 'Template not found') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TEMPLATE_NOT_FOUND',
          message: 'Template not found'
        }
      });
    }

    // Handle in-use error
    if (error.message.includes('in use')) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'TEMPLATE_IN_USE',
          message: error.message
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'TEMPLATE_DELETE_ERROR',
        message: error.message || 'Failed to delete template'
      }
    });
  }
});

export default router;
