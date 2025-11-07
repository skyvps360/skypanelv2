import fetch from 'node-fetch';
import logger from './logger.js';

export async function registerNode(config) {
  const url = `${config.controlPlaneUrl}/api/paas/internal/nodes/register`;
  
  logger.info(`Registering with ${url}`);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      registration_token: config.registrationToken,
      name: config.nodeName,
      region: config.region,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Registration failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Registration failed');
  }

  return {
    nodeId: data.node.id,
    jwtSecret: data.jwt_secret,
  };
}

export function createAuthHeaders(config) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.jwtSecret}`,
  };
}
