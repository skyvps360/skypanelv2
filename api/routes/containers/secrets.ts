/**
 * Secrets Routes for Container Platform
 * Handles secret management with encryption and audit logging
 */
import { Router, Response } from 'express';
import { SecretService } from '../../services/containers/SecretService.js';
import { authenticateToken, AuthenticatedRequest, requireOrganization } from '../../middleware/auth.js';

const router = Router();
const secretService = new SecretService();

/**
 * List all secrets for the organization
 * GET /api/containers/secrets
 */
router.get('/', authenticateToken, requireOrganization, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user!.organizationId!;

    const secrets = await secretService.listSecrets(organizationId);

    res.json({
      success: true,
      data: secrets
    });
  } catch (error: any) {
    console.error('Error listing secrets:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SECRET_LIST_ERROR',
        message: error.message || 'Failed to list secrets'
      }
    });
  }
});

/**
 * Get secret details (without value)
 * GET /api/containers/secrets/:id
 */
router.get('/:id', authenticateToken, requireOrganization, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const organizationId = req.user!.organizationId!;

    const secret = await secretService.getSecret(id);

    if (!secret) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SECRET_NOT_FOUND',
          message: 'Secret not found'
        }
      });
    }

    // Verify secret belongs to user's organization
    if (secret.organizationId !== organizationId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied to this secret'
        }
      });
    }

    // Get usage information
    const usage = await secretService.getSecretUsage(id);

    res.json({
      success: true,
      data: {
        ...secret,
        usage
      }
    });
  } catch (error: any) {
    console.error('Error getting secret:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SECRET_GET_ERROR',
        message: error.message || 'Failed to get secret'
      }
    });
  }
});

/**
 * Create a new secret
 * POST /api/containers/secrets
 */
router.post('/', authenticateToken, requireOrganization, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user!.organizationId!;
    const userId = req.user!.id;
    const { name, value } = req.body;

    // Validate required fields
    if (!name || !value) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Secret name and value are required'
        }
      });
    }

    const secret = await secretService.createSecret({
      organizationId,
      name,
      value,
      createdBy: userId
    });

    // Return secret without encrypted value
    res.status(201).json({
      success: true,
      data: {
        id: secret.id,
        organizationId: secret.organizationId,
        name: secret.name,
        createdBy: secret.createdBy,
        lastRotatedAt: secret.lastRotatedAt,
        createdAt: secret.createdAt,
        updatedAt: secret.updatedAt
      }
    });
  } catch (error: any) {
    console.error('Error creating secret:', error);

    // Handle validation errors
    if (error.message.includes('must contain') || error.message.includes('already exists')) {
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
        code: 'SECRET_CREATE_ERROR',
        message: error.message || 'Failed to create secret'
      }
    });
  }
});

/**
 * Update secret value (rotation)
 * PATCH /api/containers/secrets/:id
 */
router.patch('/:id', authenticateToken, requireOrganization, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const organizationId = req.user!.organizationId!;
    const userId = req.user!.id;
    const { value, rotationStrategy } = req.body;

    // Validate required fields
    if (!value) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Secret value is required'
        }
      });
    }

    // Validate rotation strategy if provided
    if (rotationStrategy && !['automatic', 'manual', 'rolling'].includes(rotationStrategy)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid rotation strategy. Must be one of: automatic, manual, rolling'
        }
      });
    }

    // Verify secret belongs to user's organization
    const existingSecret = await secretService.getSecret(id);
    if (!existingSecret) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SECRET_NOT_FOUND',
          message: 'Secret not found'
        }
      });
    }

    if (existingSecret.organizationId !== organizationId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied to this secret'
        }
      });
    }

    const secret = await secretService.updateSecret(id, {
      value,
      updatedBy: userId,
      rotationStrategy: rotationStrategy || 'manual'
    });

    // Return secret without encrypted value
    res.json({
      success: true,
      data: {
        id: secret.id,
        organizationId: secret.organizationId,
        name: secret.name,
        createdBy: secret.createdBy,
        lastRotatedAt: secret.lastRotatedAt,
        createdAt: secret.createdAt,
        updatedAt: secret.updatedAt
      }
    });
  } catch (error: any) {
    console.error('Error updating secret:', error);

    // Handle not found
    if (error.message === 'Secret not found') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SECRET_NOT_FOUND',
          message: 'Secret not found'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'SECRET_UPDATE_ERROR',
        message: error.message || 'Failed to update secret'
      }
    });
  }
});

/**
 * Delete a secret
 * DELETE /api/containers/secrets/:id
 */
router.delete('/:id', authenticateToken, requireOrganization, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const organizationId = req.user!.organizationId!;
    const userId = req.user!.id;

    // Verify secret belongs to user's organization
    const existingSecret = await secretService.getSecret(id);
    if (!existingSecret) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SECRET_NOT_FOUND',
          message: 'Secret not found'
        }
      });
    }

    if (existingSecret.organizationId !== organizationId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied to this secret'
        }
      });
    }

    await secretService.deleteSecret(id, userId);

    res.json({
      success: true,
      message: 'Secret deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting secret:', error);

    // Handle not found
    if (error.message === 'Secret not found') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SECRET_NOT_FOUND',
          message: 'Secret not found'
        }
      });
    }

    // Handle in-use error
    if (error.message.includes('in use')) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'SECRET_IN_USE',
          message: error.message
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'SECRET_DELETE_ERROR',
        message: error.message || 'Failed to delete secret'
      }
    });
  }
});

export default router;
