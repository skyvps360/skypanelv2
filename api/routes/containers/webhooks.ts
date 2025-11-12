/**
 * Git Webhook Routes for Container Platform
 * Handles webhooks from GitHub, GitLab, and Bitbucket for automatic deployments
 */
import { Router, type Request, type Response } from 'express';
import { WebhookService } from '../../services/containers/WebhookService.js';

const router = Router();

/**
 * GitHub Webhook Handler
 * POST /api/containers/webhooks/github/:serviceId
 */
router.post('/github/:serviceId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { serviceId } = req.params;
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    const event = req.headers['x-github-event'] as string | undefined;

    // Only process push events
    if (event !== 'push') {
      res.status(200).json({ message: 'Event ignored (not a push event)' });
      return;
    }

    // Get raw body for signature validation
    const rawBody = JSON.stringify(req.body);

    // Validate webhook signature
    const isValid = await WebhookService.validateWebhookSignature(
      'github',
      serviceId,
      rawBody,
      signature,
      undefined
    );

    if (!isValid) {
      res.status(401).json({ error: 'Invalid webhook signature' });
      return;
    }

    // Extract commit information
    const commitInfo = WebhookService.extractCommitInfo('github', req.body);

    if (!commitInfo) {
      res.status(400).json({ error: 'Invalid webhook payload' });
      return;
    }

    // Set service ID
    commitInfo.serviceId = serviceId;

    // Process webhook asynchronously (returns immediately)
    const result = await WebhookService.processWebhook('github', serviceId, commitInfo);

    // Return 200 OK immediately
    res.status(200).json({
      message: result.message,
      success: result.success,
    });
  } catch (error) {
    console.error('GitHub webhook error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GitLab Webhook Handler
 * POST /api/containers/webhooks/gitlab/:serviceId
 */
router.post('/gitlab/:serviceId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { serviceId } = req.params;
    const token = req.headers['x-gitlab-token'] as string | undefined;
    const event = req.headers['x-gitlab-event'] as string | undefined;

    // Only process push events
    if (event !== 'Push Hook') {
      res.status(200).json({ message: 'Event ignored (not a push event)' });
      return;
    }

    // Get raw body for signature validation
    const rawBody = JSON.stringify(req.body);

    // Validate webhook token
    const isValid = await WebhookService.validateWebhookSignature(
      'gitlab',
      serviceId,
      rawBody,
      undefined,
      token
    );

    if (!isValid) {
      res.status(401).json({ error: 'Invalid webhook token' });
      return;
    }

    // Extract commit information
    const commitInfo = WebhookService.extractCommitInfo('gitlab', req.body);

    if (!commitInfo) {
      res.status(400).json({ error: 'Invalid webhook payload' });
      return;
    }

    // Set service ID
    commitInfo.serviceId = serviceId;

    // Process webhook asynchronously (returns immediately)
    const result = await WebhookService.processWebhook('gitlab', serviceId, commitInfo);

    // Return 200 OK immediately
    res.status(200).json({
      message: result.message,
      success: result.success,
    });
  } catch (error) {
    console.error('GitLab webhook error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Bitbucket Webhook Handler
 * POST /api/containers/webhooks/bitbucket/:serviceId
 */
router.post('/bitbucket/:serviceId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { serviceId } = req.params;
    const signature = req.headers['x-hub-signature'] as string | undefined;
    const event = req.headers['x-event-key'] as string | undefined;

    // Only process push events
    if (event !== 'repo:push') {
      res.status(200).json({ message: 'Event ignored (not a push event)' });
      return;
    }

    // Get raw body for signature validation
    const rawBody = JSON.stringify(req.body);

    // Validate webhook signature
    const isValid = await WebhookService.validateWebhookSignature(
      'bitbucket',
      serviceId,
      rawBody,
      signature,
      undefined
    );

    if (!isValid) {
      res.status(401).json({ error: 'Invalid webhook signature' });
      return;
    }

    // Extract commit information
    const commitInfo = WebhookService.extractCommitInfo('bitbucket', req.body);

    if (!commitInfo) {
      res.status(400).json({ error: 'Invalid webhook payload' });
      return;
    }

    // Set service ID
    commitInfo.serviceId = serviceId;

    // Process webhook asynchronously (returns immediately)
    const result = await WebhookService.processWebhook('bitbucket', serviceId, commitInfo);

    // Return 200 OK immediately
    res.status(200).json({
      message: result.message,
      success: result.success,
    });
  } catch (error) {
    console.error('Bitbucket webhook error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get webhook URL for a service
 * GET /api/containers/services/:serviceId/webhook-url
 */
router.get('/services/:serviceId/webhook-url', async (req: Request, res: Response): Promise<void> => {
  try {
    const { serviceId } = req.params;
    const { provider } = req.query;

    if (!provider || !['github', 'gitlab', 'bitbucket'].includes(provider as string)) {
      res.status(400).json({ error: 'Invalid or missing provider parameter (github, gitlab, or bitbucket)' });
      return;
    }

    // Generate webhook URL
    const webhookUrl = WebhookService.generateWebhookUrl(
      serviceId,
      provider as 'github' | 'gitlab' | 'bitbucket'
    );

    // Get or generate webhook secret
    let secret = await WebhookService.getWebhookSecret(serviceId);
    if (!secret) {
      secret = await WebhookService.generateWebhookSecret(serviceId);
    }

    res.status(200).json({
      webhookUrl,
      secret,
      provider,
      instructions: {
        github: 'Add this URL to your GitHub repository settings under Webhooks. Set Content type to application/json and use the secret for signature validation.',
        gitlab: 'Add this URL to your GitLab project settings under Webhooks. Use the secret as the Secret Token.',
        bitbucket: 'Add this URL to your Bitbucket repository settings under Webhooks. Use the secret for signature validation.',
      }[provider as string],
    });
  } catch (error) {
    console.error('Error getting webhook URL:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
