import { Router } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

router.get('/download', async (req, res) => {
  try {
    const agentPath = join(__dirname, '../../../Paas-Agent');
    
    // In production, this would serve a pre-packaged tarball
    // For now, we'll send instructions
    res.setHeader('Content-Type', 'text/plain');
    res.send(`# SkyPanel PaaS Agent Download

The agent package needs to be manually packaged from the Paas-Agent directory.

To create the agent package:
1. cd Paas-Agent
2. tar -czf agent.tar.gz --exclude=node_modules --exclude=.git *
3. Move agent.tar.gz to a web-accessible location

Then update this endpoint to serve the actual tarball.
`);
  } catch (error: any) {
    console.error('Error downloading agent:', error);
    res.status(500).json({ success: false, error: 'Failed to download agent' });
  }
});

router.get('/install-script', async (req, res) => {
  try {
    const { registration_token, region = 'default' } = req.query;
    
    if (!registration_token) {
      return res.status(400).json({ success: false, error: 'Missing registration_token' });
    }
    
    const controlPlaneUrl = process.env.CONTROL_PLANE_URL || 
                           `${req.protocol}://${req.get('host')}`;
    
    const scriptPath = join(__dirname, '../../../scripts/install-paas-agent.sh');
    let script = readFileSync(scriptPath, 'utf-8');
    
    // The script already accepts parameters, so we just provide instructions
    const instructions = `#!/bin/bash
# SkyPanel PaaS Agent Installation
# Generated: ${new Date().toISOString()}

# Download and run the installation script
curl -fsSL ${controlPlaneUrl}/api/paas/agent/install-script-raw | bash -s "${controlPlaneUrl}" "${registration_token}" "${region}" "$(hostname)"
`;
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename="install-agent.sh"');
    res.send(instructions);
  } catch (error: any) {
    console.error('Error generating install script:', error);
    res.status(500).json({ success: false, error: 'Failed to generate install script' });
  }
});

router.get('/install-script-raw', async (req, res) => {
  try {
    const scriptPath = join(__dirname, '../../../scripts/install-paas-agent.sh');
    const script = readFileSync(scriptPath, 'utf-8');
    
    res.setHeader('Content-Type', 'text/plain');
    res.send(script);
  } catch (error: any) {
    console.error('Error serving install script:', error);
    res.status(500).json({ success: false, error: 'Failed to serve install script' });
  }
});

export default router;
