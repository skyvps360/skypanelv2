import { Router } from 'express';
import { authenticateToken } from '../../../middleware/auth.js';
import { query } from '../../../lib/database.js';
import { encrypt, decrypt } from '../../../lib/crypto.js';

const router = Router();

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const GITHUB_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL || '';

// Initiate GitHub OAuth flow
router.get('/authorize', authenticateToken, async (req, res) => {
  try {
    if (!GITHUB_CLIENT_ID) {
      return res.status(500).json({ 
        success: false, 
        error: 'GitHub OAuth not configured. Set GITHUB_CLIENT_ID environment variable.' 
      });
    }

    const state = Buffer.from(JSON.stringify({
      userId: req.user!.id,
      timestamp: Date.now()
    })).toString('base64');

    const scope = 'repo';
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(GITHUB_CALLBACK_URL)}&scope=${scope}&state=${state}`;

    res.json({ success: true, authUrl });
  } catch (error: any) {
    console.error('Error initiating GitHub OAuth:', error);
    res.status(500).json({ success: false, error: 'Failed to initiate GitHub authorization' });
  }
});

// GitHub OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).send('Missing code or state parameter');
    }

    // Decode state
    const stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
    const { userId, timestamp } = stateData;

    // Verify state timestamp (5 minute expiry)
    if (Date.now() - timestamp > 300000) {
      return res.status(400).send('OAuth state expired. Please try again.');
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: GITHUB_CALLBACK_URL
      })
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('GitHub OAuth error:', tokenData);
      return res.status(400).send(`GitHub OAuth error: ${tokenData.error_description}`);
    }

    const accessToken = tokenData.access_token;

    // Store encrypted token for user
    const encryptedToken = encrypt(accessToken);
    
    await query(
      `INSERT INTO user_oauth_tokens (user_id, provider, access_token, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, provider) 
       DO UPDATE SET access_token = $3, updated_at = NOW()`,
      [userId, 'github', encryptedToken]
    );

    // Redirect to frontend with success
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/paas?github_auth=success`);
  } catch (error: any) {
    console.error('Error in GitHub OAuth callback:', error);
    res.status(500).send('GitHub OAuth failed. Please try again.');
  }
});

// Get list of repositories for authenticated user
router.get('/repositories', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;

    // Get GitHub token
    const tokenResult = await query(
      'SELECT access_token FROM user_oauth_tokens WHERE user_id = $1 AND provider = $2',
      [userId, 'github']
    );

    if (tokenResult.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        error: 'GitHub not connected. Please authorize GitHub access first.' 
      });
    }

    const accessToken = decrypt(tokenResult.rows[0].access_token);

    // Fetch repositories from GitHub
    const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const repos = await response.json();

    const formattedRepos = repos.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      private: repo.private,
      clone_url: repo.clone_url,
      ssh_url: repo.ssh_url,
      default_branch: repo.default_branch,
      updated_at: repo.updated_at
    }));

    res.json({ success: true, repositories: formattedRepos });
  } catch (error: any) {
    console.error('Error fetching repositories:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch repositories' });
  }
});

// Get branches for a repository
router.get('/repositories/:owner/:repo/branches', authenticateToken, async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const userId = req.user!.id;

    // Get GitHub token
    const tokenResult = await query(
      'SELECT access_token FROM user_oauth_tokens WHERE user_id = $1 AND provider = $2',
      [userId, 'github']
    );

    if (tokenResult.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        error: 'GitHub not connected' 
      });
    }

    const accessToken = decrypt(tokenResult.rows[0].access_token);

    // Fetch branches from GitHub
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const branches = await response.json();

    const formattedBranches = branches.map((branch: any) => ({
      name: branch.name,
      protected: branch.protected,
      commit_sha: branch.commit?.sha
    }));

    res.json({ success: true, branches: formattedBranches });
  } catch (error: any) {
    console.error('Error fetching branches:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch branches' });
  }
});

// Disconnect GitHub
router.delete('/disconnect', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;

    await query(
      'DELETE FROM user_oauth_tokens WHERE user_id = $1 AND provider = $2',
      [userId, 'github']
    );

    res.json({ success: true, message: 'GitHub disconnected' });
  } catch (error: any) {
    console.error('Error disconnecting GitHub:', error);
    res.status(500).json({ success: false, error: 'Failed to disconnect GitHub' });
  }
});

// Check GitHub connection status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;

    const tokenResult = await query(
      'SELECT created_at, updated_at FROM user_oauth_tokens WHERE user_id = $1 AND provider = $2',
      [userId, 'github']
    );

    const connected = tokenResult.rows.length > 0;

    res.json({ 
      success: true, 
      connected,
      connectedAt: connected ? tokenResult.rows[0].created_at : null
    });
  } catch (error: any) {
    console.error('Error checking GitHub status:', error);
    res.status(500).json({ success: false, error: 'Failed to check GitHub status' });
  }
});

export default router;
