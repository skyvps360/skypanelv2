import fetch from 'node-fetch';
import { createAuthHeaders } from './connection.js';
import logger from './logger.js';
import { cloneRepository, cleanupWorkspace } from './git.js';
import { generateDockerfile } from './buildpacks.js';
import { buildImage, createContainer, stopContainer, startContainer, restartContainer, removeContainer } from './docker.js';

let pollingTimer = null;

export function startTaskPolling(config) {
  // Poll immediately
  pollForTasks(config);

  // Then poll periodically
  pollingTimer = setInterval(() => {
    pollForTasks(config);
  }, config.taskPollInterval);
}

export function stopTaskPolling() {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}

async function pollForTasks(config) {
  try {
    const url = `${config.controlPlaneUrl}/api/paas/internal/nodes/${config.nodeId}/tasks`;
    
    const response = await fetch(url, {
      headers: createAuthHeaders(config),
    });

    if (!response.ok) {
      logger.error(`Task polling failed: ${response.status}`);
      return;
    }

    const data = await response.json();
    
    if (!data.success) {
      logger.error('Task polling error:', data.error);
      return;
    }

    const tasks = data.tasks || [];
    
    if (tasks.length > 0) {
      logger.info(`📥 Received ${tasks.length} task(s)`);
      
      // Process tasks sequentially
      for (const task of tasks) {
        await executeTask(config, task);
      }
    }
  } catch (error) {
    logger.error('Task polling error:', error.message);
  }
}

async function executeTask(config, task) {
  logger.info(`⚙️  Executing task #${task.id}: ${task.task_type} for app #${task.application_id}`);

  // Update task status to 'running'
  await updateTaskStatus(config, task.id, 'running', null, 'Task started');

  try {
    let result;

    switch (task.task_type) {
      case 'deploy':
        result = await executeDeploy(config, task);
        break;
      case 'restart':
        result = await executeRestart(config, task);
        break;
      case 'stop':
        result = await executeStop(config, task);
        break;
      case 'start':
        result = await executeStart(config, task);
        break;
      case 'scale':
        result = await executeScale(config, task);
        break;
      default:
        result = { success: false, error: `Unknown task type: ${task.task_type}` };
    }

    if (result.success) {
      await updateTaskStatus(config, task.id, 'completed', result.output || null, 'Task completed successfully');
      logger.info(`✅ Task #${task.id} completed`);
    } else {
      await updateTaskStatus(config, task.id, 'failed', null, result.error || 'Task failed');
      logger.error(`❌ Task #${task.id} failed: ${result.error}`);
    }
  } catch (error) {
    await updateTaskStatus(config, task.id, 'failed', null, error.message);
    logger.error(`💥 Task #${task.id} error:`, error.message);
  }
}

async function executeDeploy(config, task) {
  const taskData = task.task_data;
  const appId = task.application_id;

  logger.info(`🚀 Deploying app #${appId}`);

  // Step 1: Clone repository
  const cloneResult = await cloneRepository({
    appId,
    gitRepoUrl: taskData.git_repo_url,
    gitBranch: taskData.git_branch || 'main',
    gitOAuthToken: taskData.git_oauth_token,
  });

  if (!cloneResult.success) {
    return { success: false, error: `Git clone failed: ${cloneResult.error}` };
  }

  // Step 2: Generate Dockerfile if needed
  const dockerfilePath = generateDockerfile(cloneResult.workspacePath, taskData.runtime);

  // Step 3: Build Docker image
  const imageName = `paas-app-${appId}:latest`;
  const buildResult = await buildImage({
    appId,
    gitRepoPath: cloneResult.workspacePath,
    dockerfilePath: 'Dockerfile',
    imageName,
    buildArgs: {},
  });

  if (!buildResult.success) {
    cleanupWorkspace(appId);
    return { success: false, error: `Docker build failed: ${buildResult.error}` };
  }

  // Step 4: Stop and remove old container if exists
  const containerName = `paas-app-${appId}`;
  await removeContainer(containerName); // Ignore errors

  // Step 5: Create and start new container
  const createResult = await createContainer({
    appId,
    imageName,
    containerName,
    envVars: taskData.env_vars || {},
    port: taskData.port || 3000,
    cpuLimit: taskData.cpu_limit,
    memoryLimit: taskData.memory_limit,
    volumes: [],
  });

  // Cleanup workspace
  cleanupWorkspace(appId);

  if (!createResult.success) {
    return { success: false, error: `Container creation failed: ${createResult.error}` };
  }

  return {
    success: true,
    output: {
      containerId: createResult.containerId,
      hostPort: createResult.hostPort,
      commitSha: cloneResult.commitSha,
      commitMessage: cloneResult.commitMessage,
      buildLogs: buildResult.logs,
    },
  };
}

async function executeRestart(config, task) {
  const appId = task.application_id;
  const containerName = `paas-app-${appId}`;
  
  const result = await restartContainer(containerName);
  return result;
}

async function executeStop(config, task) {
  const appId = task.application_id;
  const containerName = `paas-app-${appId}`;
  
  const result = await stopContainer(containerName);
  return result;
}

async function executeStart(config, task) {
  const appId = task.application_id;
  const containerName = `paas-app-${appId}`;
  
  const result = await startContainer(containerName);
  return result;
}

async function executeScale(config, task) {
  // Scaling would require load balancer setup
  // For now, just return success
  logger.warn('⚠️  Scaling not yet implemented');
  return { success: true, output: 'Scaling queued (not implemented)' };
}

async function updateTaskStatus(config, taskId, status, output, message) {
  try {
    const url = `${config.controlPlaneUrl}/api/paas/internal/tasks/${taskId}/status`;
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: createAuthHeaders(config),
      body: JSON.stringify({
        status,
        output,
        message,
      }),
    });

    if (!response.ok) {
      logger.error(`Failed to update task status: ${response.status}`);
    }
  } catch (error) {
    logger.error('Failed to update task status:', error.message);
  }
}
