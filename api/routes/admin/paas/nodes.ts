/**
 * Admin PaaS Nodes Routes
 * Manage worker nodes
 */

import express from 'express';
import { NodeService } from '../../../services/paas/NodeService.js';

const router = express.Router();

/**
 * GET /api/admin/paas/nodes
 * List all worker nodes
 */
router.get('/', async (req, res) => {
  try {
    const nodes = await NodeService.getAllNodes();
    res.json({ success: true, nodes });
  } catch (error: any) {
    console.error('Error fetching nodes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/paas/nodes/:id
 * Get a single node by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const node = await NodeService.getNodeById(id);
    
    if (!node) {
      return res.status(404).json({ success: false, error: 'Node not found' });
    }

    res.json({ success: true, node });
  } catch (error: any) {
    console.error('Error fetching node:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/paas/nodes/register
 * Generate registration token for a new node
 */
router.post('/register', async (req, res) => {
  try {
    const { name, region, host_address } = req.body;

    // Validation
    if (!name || !region || !host_address) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: name, region, host_address' 
      });
    }

    const node = await NodeService.createNode({
      name,
      region,
      host_address
    });

    // Generate installation script
    const installScript = generateInstallScript(node.registration_token!, host_address);

    res.status(201).json({ 
      success: true, 
      node,
      registration_token: node.registration_token,
      install_script: installScript
    });
  } catch (error: any) {
    console.error('Error creating node:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/admin/paas/nodes/:id
 * Update a node
 */
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updateData: any = {};

    // Only include fields that are present in the request
    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.region !== undefined) updateData.region = req.body.region;
    if (req.body.host_address !== undefined) updateData.host_address = req.body.host_address;
    if (req.body.status !== undefined) updateData.status = req.body.status;

    const node = await NodeService.updateNode(id, updateData);

    if (!node) {
      return res.status(404).json({ success: false, error: 'Node not found' });
    }

    res.json({ success: true, node });
  } catch (error: any) {
    console.error('Error updating node:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/admin/paas/nodes/:id
 * Delete a node
 */
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const deleted = await NodeService.deleteNode(id);

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Node not found' });
    }

    res.json({ success: true, message: 'Node deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting node:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/paas/nodes/:id/metrics
 * Get detailed node metrics
 */
router.get('/:id/metrics', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const node = await NodeService.getNodeById(id);
    
    if (!node) {
      return res.status(404).json({ success: false, error: 'Node not found' });
    }

    const utilization = NodeService.getUtilizationPercentage(node);

    res.json({ 
      success: true, 
      metrics: {
        cpu_used: node.cpu_used,
        cpu_total: node.cpu_total,
        cpu_percent: node.cpu_total ? (node.cpu_used / node.cpu_total * 100).toFixed(2) : 0,
        memory_used: node.memory_used,
        memory_total: node.memory_total,
        memory_percent: node.memory_total ? (node.memory_used / node.memory_total * 100).toFixed(2) : 0,
        disk_used: node.disk_used,
        disk_total: node.disk_total,
        disk_percent: node.disk_total ? (node.disk_used / node.disk_total * 100).toFixed(2) : 0,
        container_count: node.container_count,
        utilization_percent: utilization.toFixed(2),
        last_heartbeat: node.last_heartbeat,
        status: node.status
      }
    });
  } catch (error: any) {
    console.error('Error fetching node metrics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Generate installation script for agent
 */
function generateInstallScript(registrationToken: string, controlPlaneUrl: string): string {
  return `#!/bin/bash
# SkyPanel PaaS Agent Installation Script
# Generated: ${new Date().toISOString()}

set -e

CONTROL_PLANE_URL="${controlPlaneUrl}"
REGISTRATION_TOKEN="${registrationToken}"

echo "Installing SkyPanel PaaS Agent..."

# Install Docker if not present
if ! command -v docker &> /dev/null; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi

# Install Node.js 20 if not present
if ! command -v node &> /dev/null; then
  echo "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# Download and install PaaS Agent
echo "Downloading PaaS Agent..."
mkdir -p /opt/skypanel-agent
cd /opt/skypanel-agent

# TODO: Replace with actual agent download URL
# curl -L "\${CONTROL_PLANE_URL}/agent/download" -o agent.tar.gz
# tar -xzf agent.tar.gz
# npm install --production

# Configure agent
cat > config.json <<EOF
{
  "controlPlaneUrl": "\${CONTROL_PLANE_URL}",
  "registrationToken": "\${REGISTRATION_TOKEN}"
}
EOF

# Install systemd service
cat > /etc/systemd/system/skypanel-agent.service <<EOF
[Unit]
Description=SkyPanel PaaS Agent
After=network.target docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/skypanel-agent
ExecStart=/usr/bin/node /opt/skypanel-agent/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Start agent
echo "Starting SkyPanel PaaS Agent..."
systemctl daemon-reload
systemctl enable skypanel-agent
systemctl start skypanel-agent

echo "PaaS Agent installed and started successfully!"
echo "Check status with: systemctl status skypanel-agent"
`;
}

export default router;
