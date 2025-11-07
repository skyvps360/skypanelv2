import { execSync } from 'child_process';
import { randomBytes } from 'crypto';
import logger from './logger.js';
import { createContainer, stopContainer, removeContainer } from './docker.js';

function generatePassword(length = 32) {
  return randomBytes(length).toString('base64').slice(0, length);
}

export async function provisionDatabase(dbConfig) {
  const { databaseId, dbType, version, name, port } = dbConfig;
  
  logger.info(`🗄️  Provisioning ${dbType} database: ${name}`);
  
  const username = `db_${name}_user`;
  const password = generatePassword();
  const containerName = `paas-db-${databaseId}`;
  const volumeName = `paas-db-${databaseId}-data`;
  
  let imageName, envVars, internalPort;
  
  switch (dbType) {
    case 'mysql':
      imageName = `mysql:${version || '8.0'}`;
      internalPort = 3306;
      envVars = {
        MYSQL_ROOT_PASSWORD: generatePassword(),
        MYSQL_DATABASE: name,
        MYSQL_USER: username,
        MYSQL_PASSWORD: password,
      };
      break;
      
    case 'postgresql':
      imageName = `postgres:${version || '15'}`;
      internalPort = 5432;
      envVars = {
        POSTGRES_DB: name,
        POSTGRES_USER: username,
        POSTGRES_PASSWORD: password,
      };
      break;
      
    case 'mongodb':
      imageName = `mongo:${version || '7'}`;
      internalPort = 27017;
      envVars = {
        MONGO_INITDB_ROOT_USERNAME: username,
        MONGO_INITDB_ROOT_PASSWORD: password,
        MONGO_INITDB_DATABASE: name,
      };
      break;
      
    case 'redis':
      imageName = `redis:${version || '7-alpine'}`;
      internalPort = 6379;
      envVars = {
        REDIS_PASSWORD: password,
      };
      break;
      
    default:
      throw new Error(`Unsupported database type: ${dbType}`);
  }
  
  try {
    // Create volume for persistent data
    try {
      execSync(`docker volume create ${volumeName}`, { stdio: 'pipe' });
      logger.info(`✅ Created volume: ${volumeName}`);
    } catch (err) {
      logger.warn(`Volume already exists: ${volumeName}`);
    }
    
    // Create and start database container
    const result = await createContainer({
      appId: databaseId,
      imageName,
      containerName,
      envVars,
      port: port || internalPort,
      cpuLimit: 1000, // 1 CPU core
      memoryLimit: 1024, // 1GB
      volumes: [
        {
          source: volumeName,
          target: getDatabaseDataPath(dbType)
        }
      ]
    });
    
    if (!result.success) {
      throw new Error(`Container creation failed: ${result.error}`);
    }
    
    // Wait for database to be ready
    await waitForDatabase(dbType, containerName);
    
    logger.info(`✅ Database provisioned: ${name}`);
    
    return {
      success: true,
      credentials: {
        host: containerName, // Docker network name
        port: internalPort,
        username,
        password,
        database: name,
      }
    };
  } catch (error) {
    logger.error(`❌ Database provisioning failed: ${error.message}`);
    
    // Cleanup on failure
    await stopContainer(containerName);
    await removeContainer(containerName);
    
    try {
      execSync(`docker volume rm ${volumeName}`, { stdio: 'pipe' });
    } catch (err) {
      // Ignore cleanup errors
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

export async function backupDatabase(dbConfig) {
  const { databaseId, dbType, name, credentials } = dbConfig;
  
  logger.info(`💾 Backing up ${dbType} database: ${name}`);
  
  const containerName = `paas-db-${databaseId}`;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = process.env.BACKUP_DIR || '/var/paas/backups';
  const backupFile = `${backupDir}/${dbType}-${name}-${timestamp}.sql`;
  
  try {
    let command;
    
    switch (dbType) {
      case 'mysql':
        command = `docker exec ${containerName} mysqldump -u${credentials.username} -p${credentials.password} ${name} > ${backupFile}`;
        break;
        
      case 'postgresql':
        command = `docker exec ${containerName} pg_dump -U ${credentials.username} ${name} > ${backupFile}`;
        break;
        
      case 'mongodb':
        command = `docker exec ${containerName} mongodump --username=${credentials.username} --password=${credentials.password} --db=${name} --archive > ${backupFile}`;
        break;
        
      default:
        throw new Error(`Backup not supported for ${dbType}`);
    }
    
    execSync(command, { encoding: 'utf-8' });
    
    logger.info(`✅ Backup created: ${backupFile}`);
    
    return {
      success: true,
      backupFile,
      timestamp
    };
  } catch (error) {
    logger.error(`❌ Backup failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function restoreDatabase(dbConfig, backupFile) {
  const { databaseId, dbType, name, credentials } = dbConfig;
  
  logger.info(`♻️  Restoring ${dbType} database: ${name}`);
  
  const containerName = `paas-db-${databaseId}`;
  
  try {
    let command;
    
    switch (dbType) {
      case 'mysql':
        command = `docker exec -i ${containerName} mysql -u${credentials.username} -p${credentials.password} ${name} < ${backupFile}`;
        break;
        
      case 'postgresql':
        command = `docker exec -i ${containerName} psql -U ${credentials.username} ${name} < ${backupFile}`;
        break;
        
      case 'mongodb':
        command = `docker exec -i ${containerName} mongorestore --username=${credentials.username} --password=${credentials.password} --db=${name} --archive < ${backupFile}`;
        break;
        
      default:
        throw new Error(`Restore not supported for ${dbType}`);
    }
    
    execSync(command, { encoding: 'utf-8' });
    
    logger.info(`✅ Database restored from: ${backupFile}`);
    
    return {
      success: true
    };
  } catch (error) {
    logger.error(`❌ Restore failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function deleteDatabase(dbConfig) {
  const { databaseId } = dbConfig;
  
  logger.info(`🗑️  Deleting database #${databaseId}`);
  
  const containerName = `paas-db-${databaseId}`;
  const volumeName = `paas-db-${databaseId}-data`;
  
  try {
    // Stop and remove container
    await stopContainer(containerName);
    await removeContainer(containerName);
    
    // Remove volume
    try {
      execSync(`docker volume rm ${volumeName}`, { stdio: 'pipe' });
      logger.info(`✅ Removed volume: ${volumeName}`);
    } catch (err) {
      logger.warn(`Volume removal failed: ${err.message}`);
    }
    
    logger.info(`✅ Database deleted: ${databaseId}`);
    
    return {
      success: true
    };
  } catch (error) {
    logger.error(`❌ Database deletion failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

function getDatabaseDataPath(dbType) {
  switch (dbType) {
    case 'mysql':
      return '/var/lib/mysql';
    case 'postgresql':
      return '/var/lib/postgresql/data';
    case 'mongodb':
      return '/data/db';
    case 'redis':
      return '/data';
    default:
      return '/data';
  }
}

async function waitForDatabase(dbType, containerName, maxRetries = 30) {
  logger.info(`⏳ Waiting for ${dbType} to be ready...`);
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      let command;
      
      switch (dbType) {
        case 'mysql':
          command = `docker exec ${containerName} mysqladmin ping -h localhost`;
          break;
        case 'postgresql':
          command = `docker exec ${containerName} pg_isready`;
          break;
        case 'mongodb':
          command = `docker exec ${containerName} mongosh --eval "db.adminCommand('ping')"`;
          break;
        case 'redis':
          command = `docker exec ${containerName} redis-cli ping`;
          break;
        default:
          // For unsupported types, just wait a bit
          await new Promise(resolve => setTimeout(resolve, 5000));
          return;
      }
      
      execSync(command, { stdio: 'pipe' });
      logger.info(`✅ ${dbType} is ready`);
      return;
    } catch (err) {
      // Not ready yet, wait and retry
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  throw new Error(`${dbType} failed to become ready after ${maxRetries} attempts`);
}
