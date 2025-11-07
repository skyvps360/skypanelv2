import Docker from 'dockerode';
import tar from 'tar-fs';
import logger from './logger.js';

const docker = new Docker();

export async function getDockerStats() {
  try {
    const containers = await docker.listContainers({ all: false });
    return {
      containerCount: containers.length,
      containers: containers.map(c => ({
        id: c.Id,
        name: c.Names[0],
        image: c.Image,
        state: c.State,
      })),
    };
  } catch (error) {
    logger.error('Failed to get Docker stats:', error.message);
    return { containerCount: 0, containers: [] };
  }
}

export async function buildImage(buildContext) {
  const { appId, gitRepoPath, dockerfilePath, imageName, buildArgs } = buildContext;
  
  logger.info(`🔨 Building image: ${imageName}`);
  
  try {
    // Create tarball of the build context
    const tarStream = tar.pack(gitRepoPath);
    
    const stream = await docker.buildImage(tarStream, {
      t: imageName,
      dockerfile: dockerfilePath || 'Dockerfile',
      buildargs: buildArgs || {},
    });

    // Collect build logs
    let buildLogs = '';
    await new Promise((resolve, reject) => {
      docker.modem.followProgress(stream, 
        (err, output) => {
          if (err) reject(err);
          else resolve(output);
        },
        (event) => {
          if (event.stream) {
            buildLogs += event.stream;
            logger.debug(event.stream.trim());
          }
          if (event.error) {
            buildLogs += `ERROR: ${event.error}\n`;
          }
        }
      );
    });

    logger.info(`✅ Image built: ${imageName}`);
    return { success: true, logs: buildLogs };
  } catch (error) {
    logger.error(`❌ Build failed: ${error.message}`);
    return { success: false, error: error.message, logs: error.toString() };
  }
}

export async function createContainer(containerConfig) {
  const { 
    appId, 
    imageName, 
    containerName, 
    envVars, 
    port, 
    cpuLimit, 
    memoryLimit,
    volumes 
  } = containerConfig;

  logger.info(`🐳 Creating container: ${containerName}`);

  try {
    const container = await docker.createContainer({
      Image: imageName,
      name: containerName,
      Env: Object.entries(envVars || {}).map(([k, v]) => `${k}=${v}`),
      ExposedPorts: {
        [`${port}/tcp`]: {}
      },
      HostConfig: {
        PortBindings: {
          [`${port}/tcp`]: [{ HostPort: '0' }] // Dynamic port
        },
        CpuQuota: cpuLimit ? cpuLimit * 1000 : undefined,
        Memory: memoryLimit ? memoryLimit * 1024 * 1024 : undefined,
        Binds: volumes || [],
        RestartPolicy: {
          Name: 'unless-stopped',
          MaximumRetryCount: 3
        }
      },
      Labels: {
        'paas.app.id': appId.toString(),
        'paas.managed': 'true',
      }
    });

    await container.start();
    
    const info = await container.inspect();
    const hostPort = info.NetworkSettings.Ports[`${port}/tcp`]?.[0]?.HostPort || '0';

    logger.info(`✅ Container started: ${containerName} (port ${hostPort})`);
    
    return { 
      success: true, 
      containerId: container.id,
      hostPort: parseInt(hostPort),
    };
  } catch (error) {
    logger.error(`❌ Container creation failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

export async function stopContainer(containerName) {
  logger.info(`🛑 Stopping container: ${containerName}`);
  
  try {
    const container = docker.getContainer(containerName);
    await container.stop();
    logger.info(`✅ Container stopped: ${containerName}`);
    return { success: true };
  } catch (error) {
    logger.error(`❌ Stop failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

export async function startContainer(containerName) {
  logger.info(`▶️  Starting container: ${containerName}`);
  
  try {
    const container = docker.getContainer(containerName);
    await container.start();
    logger.info(`✅ Container started: ${containerName}`);
    return { success: true };
  } catch (error) {
    logger.error(`❌ Start failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

export async function restartContainer(containerName) {
  logger.info(`🔄 Restarting container: ${containerName}`);
  
  try {
    const container = docker.getContainer(containerName);
    await container.restart();
    logger.info(`✅ Container restarted: ${containerName}`);
    return { success: true };
  } catch (error) {
    logger.error(`❌ Restart failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

export async function removeContainer(containerName) {
  logger.info(`🗑️  Removing container: ${containerName}`);
  
  try {
    const container = docker.getContainer(containerName);
    await container.remove({ force: true });
    logger.info(`✅ Container removed: ${containerName}`);
    return { success: true };
  } catch (error) {
    logger.debug(`Remove container note: ${error.message}`);
    return { success: true };
  }
}

export async function getContainerLogs(containerName, tail = 100) {
  try {
    const container = docker.getContainer(containerName);
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail,
      timestamps: true,
    });
    return { success: true, logs: logs.toString() };
  } catch (error) {
    logger.error(`❌ Failed to get logs: ${error.message}`);
    return { success: false, error: error.message };
  }
}
