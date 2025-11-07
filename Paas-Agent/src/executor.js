import fetch from 'node-fetch';
import { createAuthHeaders } from './connection.js';
import logger from './logger.js';
import { cloneRepository, cleanupWorkspace } from './git.js';
import { generateDockerfile } from './buildpacks.js';
import { buildImage, createContainer, stopContainer, startContainer, restartContainer, removeContainer } from './docker.js';
import { updateAppConfig, removeAppConfig } from './nginx.js';
import { ensureCertificateForApp } from './ssl.js';
import { provisionDatabase, backupDatabase, restoreDatabase, deleteDatabase } from './database.js';

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
  const isAppTask = task.resource_type === 'application';
  const isDatabaseTask = task.resource_type === 'database';
  
  const resourceId = isAppTask ? task.application_id : task.database_id;
  logger.info(`⚙️  Executing task #${task.id}: ${task.task_type} for ${task.resource_type} #${resourceId}`);

  // Update task status to 'running'
  await updateTaskStatus(config, task.id, 'running', null, 'Task started');

  try {
    let result;

    if (isAppTask) {
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
        case 'delete':
          result = await executeDelete(config, task);
          break;
        default:
          result = { success: false, error: `Unknown application task: ${task.task_type}` };
      }
    } else if (isDatabaseTask) {
      switch (task.task_type) {
        case 'provision':
          result = await executeProvisionDatabase(config, task);
          break;
        case 'backup':
          result = await executeBackupDatabase(config, task);
          break;
        case 'restore':
          result = await executeRestoreDatabase(config, task);
          break;
        case 'delete':
          result = await executeDeleteDatabase(config, task);
          break;
        default:
          result = { success: false, error: `Unknown database task: ${task.task_type}` };
      }
    } else {
      result = { success: false, error: `Unknown resource type: ${task.resource_type}` };
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
    userId: taskData.user_id || null
  });

  // Cleanup workspace
  cleanupWorkspace(appId);

  if (!createResult.success) {
    return { success: false, error: `Container creation failed: ${createResult.error}` };
  }

  // Step 6: Update Nginx configuration
  const appConfig = {
    slug: taskData.slug || `app-${appId}`,
    systemDomain: taskData.system_domain,
    customDomains: taskData.custom_domains || [],
    port: taskData.port || 3000,
    instanceCount: taskData.instance_count || 1,
  };
  
  updateAppConfig(appConfig);

  // Step 7: Request SSL certificate
  if (taskData.system_domain) {
    ensureCertificateForApp(appConfig).catch(err => {
      logger.warn(`SSL certificate request failed (will retry): ${err.message}`);
    });
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
  const taskData = task.task_data;
  const appId = task.application_id;
  const targetCount = taskData.instance_count || 1;
  const currentCount = taskData.current_instance_count || 1;
  
  logger.info(`📊 Scaling app #${appId} from ${currentCount} to ${targetCount} instances`);
  
  const imageName = `paas-app-${appId}:latest`;
  const slug = taskData.slug || `app-${appId}`;
  
  try {
    if (targetCount > currentCount) {
      // Scale up: create new instances
      for (let i = currentCount; i < targetCount; i++) {
        const containerName = `paas-${slug}-${i}`;
        
        await createContainer({
          appId,
          imageName,
          containerName,
          envVars: taskData.env_vars || {},
          port: taskData.port || 3000,
          cpuLimit: taskData.cpu_limit,
          memoryLimit: taskData.memory_limit,
          volumes: [],
          userId: taskData.user_id || null
        });
        
        logger.info(`✅ Created instance ${i + 1} of ${targetCount}`);
      }
    } else if (targetCount < currentCount) {
      // Scale down: remove excess instances
      for (let i = targetCount; i < currentCount; i++) {
        const containerName = `paas-${slug}-${i}`;
        await stopContainer(containerName);
        await removeContainer(containerName);
        
        logger.info(`✅ Removed instance ${i + 1}`);
      }
    }
    
    // Update Nginx configuration for load balancing
    const appConfig = {
      slug,
      systemDomain: taskData.system_domain,
      customDomains: taskData.custom_domains || [],
      port: taskData.port || 3000,
      instanceCount: targetCount,
    };
    
    updateAppConfig(appConfig);
    
    return { 
      success: true, 
      output: `Scaled to ${targetCount} instances` 
    };
  } catch (error) {
    return { 
      success: false, 
      error: `Scaling failed: ${error.message}` 
    };
  }
}

async function executeDelete(config, task) {
  const taskData = task.task_data;
  const appId = task.application_id;
  const slug = taskData.slug || `app-${appId}`;
  const instanceCount = taskData.instance_count || 1;
  
  logger.info(`🗑️  Deleting app #${appId}`);
  
  try {
    // Remove all container instances
    if (instanceCount > 1) {
      for (let i = 0; i < instanceCount; i++) {
        const containerName = `paas-${slug}-${i}`;
        await stopContainer(containerName);
        await removeContainer(containerName);
      }
    } else {
      const containerName = `paas-app-${appId}`;
      await stopContainer(containerName);
      await removeContainer(containerName);
    }
    
    // Remove Nginx configuration
    removeAppConfig(slug);
    
    // Clean up Docker image
    try {
      const imageName = `paas-app-${appId}:latest`;
      await removeContainer(imageName); // This will remove the image
    } catch (err) {
      logger.warn(`Failed to remove image: ${err.message}`);
    }
    
    logger.info(`✅ App #${appId} deleted successfully`);
    
    return { 
      success: true, 
      output: 'Application deleted' 
    };
  } catch (error) {
    return { 
      success: false, 
      error: `Deletion failed: ${error.message}` 
    };
  }
}

async function executeProvisionDatabase(config, task) {
  const taskData = task.task_data;
  const databaseId = task.database_id;
  
  logger.info(`🗄️  Provisioning database #${databaseId}`);
  
  const result = await provisionDatabase({
    databaseId,
    dbType: taskData.db_type,
    version: taskData.version,
    name: taskData.database_name,
    port: taskData.port
  });
  
  return result;
}

async function executeBackupDatabase(config, task) {
  const taskData = task.task_data;
  const databaseId = task.database_id;
  
  logger.info(`💾 Backing up database #${databaseId}`);
  
  const result = await backupDatabase({
    databaseId,
    dbType: taskData.db_type,
    name: taskData.database_name,
    credentials: {
      username: taskData.username,
      password: taskData.password
    }
  });
  
  return result;
}

async function executeRestoreDatabase(config, task) {
  const taskData = task.task_data;
  const databaseId = task.database_id;
  
  logger.info(`♻️  Restoring database #${databaseId}`);
  
  const result = await restoreDatabase({
    databaseId,
    dbType: taskData.db_type,
    name: taskData.database_name,
    credentials: {
      username: taskData.username,
      password: taskData.password
    }
  }, taskData.backup_file);
  
  return result;
}

async function executeDeleteDatabase(config, task) {
  const databaseId = task.database_id;
  
  logger.info(`🗑️  Deleting database #${databaseId}`);
  
  const result = await deleteDatabase({
    databaseId
  });
  
  return result;
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
