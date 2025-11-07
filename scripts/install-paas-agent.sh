#!/bin/bash
set -e

# SkyPanel PaaS Agent Installation Script
# This script installs and configures the PaaS Agent on a worker node

echo "🚀 SkyPanel PaaS Agent Installation"
echo "===================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo "❌ This script must be run as root"
  echo "Please run: sudo $0"
  exit 1
fi

# Configuration from arguments
CONTROL_PLANE_URL="${1:-}"
REGISTRATION_TOKEN="${2:-}"
REGION="${3:-default}"
NODE_NAME="${4:-$(hostname)}"

if [ -z "$CONTROL_PLANE_URL" ] || [ -z "$REGISTRATION_TOKEN" ]; then
  echo "Usage: $0 <control_plane_url> <registration_token> [region] [node_name]"
  echo ""
  echo "Example:"
  echo "  $0 https://panel.example.com abc123token us-east worker-1"
  echo ""
  exit 1
fi

echo "📋 Configuration:"
echo "  Control Plane: $CONTROL_PLANE_URL"
echo "  Region: $REGION"
echo "  Node Name: $NODE_NAME"
echo ""

# Install Docker if not present
if ! command -v docker &> /dev/null; then
  echo "🐳 Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  echo "✅ Docker installed"
else
  echo "✅ Docker already installed"
fi

# Install Node.js 20 if not present
if ! command -v node &> /dev/null; then
  echo "📦 Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  echo "✅ Node.js installed"
else
  echo "✅ Node.js already installed ($(node --version))"
fi

# Install Nginx if not present
if ! command -v nginx &> /dev/null; then
  echo "🌐 Installing Nginx..."
  apt-get update
  apt-get install -y nginx
  systemctl enable nginx
  systemctl start nginx
  echo "✅ Nginx installed"
else
  echo "✅ Nginx already installed"
fi

# Install Certbot for SSL certificates
if ! command -v certbot &> /dev/null; then
  echo "🔐 Installing Certbot..."
  apt-get install -y certbot
  echo "✅ Certbot installed"
else
  echo "✅ Certbot already installed"
fi

# Create directories
echo "📁 Creating directories..."
mkdir -p /opt/skypanel-agent
mkdir -p /var/www/certbot
mkdir -p /var/paas/backups
chmod 755 /var/www/certbot
chmod 755 /var/paas/backups

# Download and install PaaS Agent
echo "⬇️  Downloading PaaS Agent..."
cd /opt/skypanel-agent

# Download agent package from control plane
curl -L "${CONTROL_PLANE_URL}/api/paas/agent/download" -o agent.tar.gz || {
  echo "❌ Failed to download agent package"
  echo "Please ensure the control plane URL is correct and accessible"
  exit 1
}

# Extract agent
tar -xzf agent.tar.gz || {
  echo "❌ Failed to extract agent package"
  exit 1
}

rm agent.tar.gz

# Install dependencies
echo "📦 Installing agent dependencies..."
npm install --production --quiet || {
  echo "❌ Failed to install dependencies"
  exit 1
}

# Configure agent
echo "⚙️  Configuring agent..."
cat > config.json <<EOF
{
  "controlPlaneUrl": "${CONTROL_PLANE_URL}",
  "registrationToken": "${REGISTRATION_TOKEN}",
  "nodeId": null,
  "jwtSecret": null,
  "region": "${REGION}",
  "nodeName": "${NODE_NAME}",
  "maxContainers": 50,
  "maxCpuPercent": 90,
  "maxMemoryPercent": 90,
  "heartbeatInterval": 30000,
  "taskPollInterval": 10000,
  "logLevel": "info"
}
EOF

# Create systemd service
echo "🔧 Creating systemd service..."
cat > /etc/systemd/system/skypanel-agent.service <<EOF
[Unit]
Description=SkyPanel PaaS Agent
After=network.target docker.service nginx.service
Requires=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/skypanel-agent
ExecStart=/usr/bin/node /opt/skypanel-agent/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment="NODE_ENV=production"

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
systemctl daemon-reload

# Start agent
echo "🚀 Starting PaaS Agent..."
systemctl enable skypanel-agent
systemctl start skypanel-agent

# Wait a moment for startup
sleep 3

# Check status
if systemctl is-active --quiet skypanel-agent; then
  echo ""
  echo "✅ PaaS Agent installed and started successfully!"
  echo ""
  echo "📊 Status: systemctl status skypanel-agent"
  echo "📜 Logs:   journalctl -u skypanel-agent -f"
  echo "🔄 Restart: systemctl restart skypanel-agent"
  echo ""
  echo "The agent will now register with the control plane and start processing tasks."
else
  echo ""
  echo "❌ Agent failed to start. Check logs with:"
  echo "   journalctl -u skypanel-agent -n 50"
  echo ""
  exit 1
fi

# Configure Docker network for PaaS
echo "🌐 Configuring Docker network..."
docker network create paas-network 2>/dev/null || echo "Network already exists"

echo ""
echo "🎉 Installation complete!"
echo ""
echo "Next steps:"
echo "  1. Check the admin panel to verify node registration"
echo "  2. Monitor agent logs: journalctl -u skypanel-agent -f"
echo "  3. Deploy your first application!"
echo ""
