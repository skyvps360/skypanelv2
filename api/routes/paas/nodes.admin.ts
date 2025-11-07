import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../../../middleware/auth.js';
import { nodeService } from '../../../services/paas/index.js';

const router = Router();

router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const nodes = await nodeService.getAll();
    
    const nodesWithSafeData = nodes.map(node => ({
      ...node,
      registration_token: node.status === 'pending' ? node.registration_token : undefined,
      jwt_secret: undefined
    }));

    res.json({ success: true, nodes: nodesWithSafeData });
  } catch (error: any) {
    console.error('Error fetching PaaS nodes:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch nodes' });
  }
});

router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const node = await nodeService.getById(parseInt(req.params.id));
    if (!node) {
      return res.status(404).json({ success: false, error: 'Node not found' });
    }

    const safeNode = {
      ...node,
      jwt_secret: undefined
    };

    res.json({ success: true, node: safeNode });
  } catch (error: any) {
    console.error('Error fetching PaaS node:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch node' });
  }
});

router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, region, host_address } = req.body;

    if (!name || !region) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const { node, token } = await nodeService.create({ name, region, host_address });

    const controlPlaneUrl = process.env.CONTROL_PLANE_URL || `${req.protocol}://${req.get('host')}`;
    
    const installScript = `#!/bin/bash
# SkyPanel PaaS Agent Installation Script
# Generated: ${new Date().toISOString()}

set -e

CONTROL_PLANE_URL="${controlPlaneUrl}"
REGISTRATION_TOKEN="${token}"

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
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# Download and install PaaS Agent
echo "Downloading PaaS Agent..."
mkdir -p /opt/skypanel-agent
cd /opt/skypanel-agent
curl -L "\${CONTROL_PLANE_URL}/api/paas/agent/download" -o agent.tar.gz
tar -xzf agent.tar.gz
npm install --production

# Configure agent
cat > config.json <<EOF
{
  "controlPlaneUrl": "\${CONTROL_PLANE_URL}",
  "registrationToken": "\${REGISTRATION_TOKEN}",
  "nodeId": null,
  "jwtSecret": null,
  "region": "${region}",
  "maxContainers": 50,
  "maxCpuPercent": 90,
  "maxMemoryPercent": 90,
  "ingressType": "nginx",
  "sslProvider": "letsencrypt",
  "logLevel": "info"
}
EOF

# Install systemd service
cat > /etc/systemd/system/skypanel-agent.service <<'EOF'
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
systemctl daemon-reload
systemctl enable skypanel-agent
systemctl start skypanel-agent

echo "PaaS Agent installed and started successfully!"
echo "Check status with: systemctl status skypanel-agent"
`;

    res.status(201).json({ 
      success: true, 
      node: {
        ...node,
        jwt_secret: undefined
      },
      registration_token: token,
      install_script: installScript
    });
  } catch (error: any) {
    console.error('Error creating PaaS node:', error);
    res.status(500).json({ success: false, error: 'Failed to create node' });
  }
});

router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;

    if (status && !['online', 'offline', 'disabled'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const node = await nodeService.updateStatus(id, status);
    
    if (!node) {
      return res.status(404).json({ success: false, error: 'Node not found' });
    }

    res.json({ success: true, node: { ...node, jwt_secret: undefined } });
  } catch (error: any) {
    console.error('Error updating PaaS node:', error);
    res.status(500).json({ success: false, error: 'Failed to update node' });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const success = await nodeService.delete(id);
    
    if (!success) {
      return res.status(404).json({ success: false, error: 'Node not found' });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting PaaS node:', error);
    res.status(500).json({ success: false, error: 'Failed to delete node' });
  }
});

router.get('/:id/metrics', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const node = await nodeService.getById(parseInt(req.params.id));
    if (!node) {
      return res.status(404).json({ success: false, error: 'Node not found' });
    }

    const cpuPercent = node.cpu_total ? (node.cpu_used / node.cpu_total) * 100 : 0;
    const memoryPercent = node.memory_total ? (node.memory_used / node.memory_total) * 100 : 0;
    const diskPercent = node.disk_total ? (node.disk_used / node.disk_total) * 100 : 0;

    res.json({
      success: true,
      metrics: {
        cpu: {
          used: node.cpu_used,
          total: node.cpu_total,
          percent: Math.round(cpuPercent * 100) / 100
        },
        memory: {
          used: node.memory_used,
          total: node.memory_total,
          percent: Math.round(memoryPercent * 100) / 100
        },
        disk: {
          used: node.disk_used,
          total: node.disk_total,
          percent: Math.round(diskPercent * 100) / 100
        },
        containers: node.container_count,
        last_heartbeat: node.last_heartbeat
      }
    });
  } catch (error: any) {
    console.error('Error fetching node metrics:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch metrics' });
  }
});

export default router;
