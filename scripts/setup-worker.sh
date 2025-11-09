#!/bin/bash

# Worker Node Setup Script for Ubuntu 24.04 LTS
# This script is run on remote worker nodes to install Docker and join the Swarm cluster

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 SkyPanelV2 PaaS Worker Node Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run as root"
  exit 1
fi

# Check Ubuntu version
if [ ! -f /etc/os-release ]; then
  echo "❌ Cannot detect OS version"
  exit 1
fi

. /etc/os-release
if [ "$ID" != "ubuntu" ]; then
  echo "❌ This script is designed for Ubuntu only"
  exit 1
fi

echo "📋 Detected: $PRETTY_NAME"
echo ""

# Get Swarm join token and manager IP from arguments
SWARM_TOKEN="$1"
MANAGER_IP="$2"

if [ -z "$SWARM_TOKEN" ] || [ -z "$MANAGER_IP" ]; then
  echo "❌ Usage: $0 <swarm_token> <manager_ip>"
  echo "   Example: $0 SWMTKN-1-xxx 192.168.1.100"
  exit 1
fi

# Step 1: Update system
echo "📦 Step 1: Updating system packages..."
apt-get update
apt-get upgrade -y
echo "✅ System updated"
echo ""

# Step 2: Install Docker
echo "📦 Step 2: Installing Docker..."

# Install prerequisites
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    software-properties-common \
    gnupg \
    lsb-release

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Start and enable Docker
systemctl enable docker
systemctl start docker

echo "✅ Docker installed successfully"
echo ""

# Step 3: Configure firewall
echo "📦 Step 3: Configuring firewall..."

# Install UFW if not present
apt-get install -y ufw

# Allow SSH (important!)
ufw allow 22/tcp

# Allow Docker Swarm ports
ufw allow 2377/tcp  # Cluster management
ufw allow 7946/tcp  # Container network discovery
ufw allow 7946/udp
ufw allow 4789/udp  # Overlay network traffic

# Enable firewall
yes | ufw enable

echo "✅ Firewall configured"
echo ""

# Step 4: Join Swarm cluster
echo "📦 Step 4: Joining Docker Swarm cluster..."

docker swarm join --token "$SWARM_TOKEN" "$MANAGER_IP:2377"

echo "✅ Joined Swarm cluster successfully"
echo ""

# Step 5: Configure Docker logging
echo "📦 Step 5: Configuring Docker logging..."

cat > /etc/docker/daemon.json <<EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "metrics-addr": "0.0.0.0:9323",
  "experimental": true
}
EOF

systemctl restart docker

echo "✅ Docker logging configured"
echo ""

# Step 6: Install monitoring tools
echo "📦 Step 6: Installing monitoring tools..."

apt-get install -y \
    htop \
    iotop \
    nethogs \
    sysstat

echo "✅ Monitoring tools installed"
echo ""

# Print success message
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Worker Node Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Node Information:"
echo "  Hostname: $(hostname)"
echo "  IP Address: $(hostname -I | awk '{print $1}')"
echo "  Docker Version: $(docker --version)"
echo "  Swarm Status: $(docker info --format '{{.Swarm.LocalNodeState}}')"
echo ""
echo "This node is now part of your PaaS cluster and ready to run applications!"
echo ""
