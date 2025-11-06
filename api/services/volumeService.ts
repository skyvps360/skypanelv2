/**
 * Volume Management Service for SkyPanelV2
 * Handles persistent Docker volumes for container data persistence
 */

import { query } from '../lib/database.js';
import Dockerode from 'dockerode';
import { 
  ContainerServiceError, 
  ERROR_CODES 
} from '../lib/containerErrors.js';
import * as tar from 'tar';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const mkdir = promisify(fs.mkdir);
const rm = promisify(fs.rm);

// ============================================================
// Type Definitions
// ============================================================

export interface VolumeConfig {
  organizationId: string;
  serviceName: string;
  mountPath: string;
  sizeLimit?: number; // MB
  backupEnabled: boolean;
}

export interface Volume {
  id: string;
  name: string;
  organizationId: string;
  serviceName: string;
  mountPath: string;
  sizeLimit?: number;
  backupEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VolumeUsage {
  volumeId: string;
  volumeName: string;
  usedBytes: number;
  usedMB: number;
  limitMB?: number;
  percentUsed?: number;
}

export interface BackupResult {
  backupId: string;
  volumeId: string;
  volumeName: string;
  size: number;
  path: string;
  createdAt: string;
}

export interface VolumeBackup {
  id: string;
  volumeId: string;
  volumeName: string;
  size: number;
  path: string;
  createdAt: string;
}

// ============================================================
// Volume Service Class
// ============================================================

class VolumeService {
  private backupBasePath = '/var/lib/skypanel/backups';

  /**
   * Get Docker client
   */
  private getDockerClient(): Dockerode {
    return new Dockerode({ socketPath: '/var/run/docker.sock' });
  }

  /**
   * Create a persistent volume for a service
   */
  async createVolume(config: VolumeConfig): Promise<Volume> {
    try {
      const docker = this.getDockerClient();
      
      // Generate unique volume name
      const volumeName = `skypanel-${config.organizationId}-${config.serviceName}-${Date.now()}`;
      
      // Create Docker volume
      await docker.createVolume({
        Name: volumeName,
        Driver: 'local',
        Labels: {
          'skypanel.organization': config.organizationId,
          'skypanel.service': config.serviceName,
          'skypanel.mountPath': config.mountPath,
          'skypanel.managed': 'true'
        }
      });

      // Store volume metadata in database
      const result = await query(
        `INSERT INTO container_volumes 
         (name, organization_id, service_name, mount_path, size_limit_mb, backup_enabled, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING id, name, organization_id, service_name, mount_path, size_limit_mb, backup_enabled, created_at, updated_at`,
        [volumeName, config.organizationId, config.serviceName, config.mountPath, config.sizeLimit, config.backupEnabled]
      );

      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        organizationId: row.organization_id,
        serviceName: row.service_name,
        mountPath: row.mount_path,
        sizeLimit: row.size_limit_mb,
        backupEnabled: row.backup_enabled,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } catch (error) {
      console.error('Error creating volume:', error);
      throw new ContainerServiceError(
        ERROR_CODES.VOLUME_CREATE_FAILED,
        'Failed to create volume',
        500,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * List volumes for an organization
   */
  async listVolumes(organizationId: string): Promise<Volume[]> {
    try {
      const result = await query(
        `SELECT id, name, organization_id, service_name, mount_path, size_limit_mb, backup_enabled, created_at, updated_at
         FROM container_volumes
         WHERE organization_id = $1
         ORDER BY created_at DESC`,
        [organizationId]
      );

      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        organizationId: row.organization_id,
        serviceName: row.service_name,
        mountPath: row.mount_path,
        sizeLimit: row.size_limit_mb,
        backupEnabled: row.backup_enabled,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      console.error('Error listing volumes:', error);
      return [];
    }
  }

  /**
   * Get volume usage statistics
   */
  async getVolumeUsage(volumeId: string): Promise<VolumeUsage | null> {
    try {
      const docker = this.getDockerClient();
      
      // Get volume metadata from database
      const result = await query(
        'SELECT id, name, size_limit_mb FROM container_volumes WHERE id = $1',
        [volumeId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const volumeData = result.rows[0];
      const volumeName = volumeData.name;

      // Get Docker volume info
      const volume = docker.getVolume(volumeName);
      const info = await volume.inspect();

      // Calculate usage (this is an approximation as Docker doesn't provide exact usage)
      // In production, you might want to use a more accurate method
      let usedBytes = 0;
      if (info.Mountpoint) {
        try {
          const stats = await this.getDirectorySize(info.Mountpoint);
          usedBytes = stats;
        } catch (e) {
          // If we can't access the mount point, estimate based on container data
          console.warn('Could not access volume mount point:', e);
        }
      }

      const usedMB = Math.round(usedBytes / (1024 * 1024));
      const limitMB = volumeData.size_limit_mb;
      const percentUsed = limitMB ? Math.round((usedMB / limitMB) * 100) : undefined;

      return {
        volumeId: volumeData.id,
        volumeName,
        usedBytes,
        usedMB,
        limitMB,
        percentUsed
      };
    } catch (error) {
      console.error('Error getting volume usage:', error);
      return null;
    }
  }

  /**
   * Helper to get directory size
   */
  private async getDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;

    try {
      const files = await fs.promises.readdir(dirPath, { withFileTypes: true });
      
      for (const file of files) {
        const filePath = path.join(dirPath, file.name);
        
        if (file.isDirectory()) {
          totalSize += await this.getDirectorySize(filePath);
        } else if (file.isFile()) {
          const stats = await fs.promises.stat(filePath);
          totalSize += stats.size;
        }
      }
    } catch (error) {
      // Permission denied or other error
      console.warn('Error reading directory:', error);
    }

    return totalSize;
  }

  /**
   * Backup volume data
   */
  async backupVolume(volumeId: string): Promise<BackupResult> {
    try {
      const docker = this.getDockerClient();
      
      // Get volume metadata
      const result = await query(
        'SELECT id, name, organization_id FROM container_volumes WHERE id = $1',
        [volumeId]
      );

      if (result.rows.length === 0) {
        throw new Error('Volume not found');
      }

      const volumeData = result.rows[0];
      const volumeName = volumeData.name;

      // Create backup directory if it doesn't exist
      const orgBackupPath = path.join(this.backupBasePath, volumeData.organization_id);
      await mkdir(orgBackupPath, { recursive: true });

      // Generate backup filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFilename = `${volumeName}-${timestamp}.tar.gz`;
      const backupPath = path.join(orgBackupPath, backupFilename);

      // Get volume info
      const volume = docker.getVolume(volumeName);
      const info = await volume.inspect();

      // Create tar archive of volume data
      if (info.Mountpoint) {
        await tar.create(
          {
            gzip: true,
            file: backupPath,
            cwd: path.dirname(info.Mountpoint)
          },
          [path.basename(info.Mountpoint)]
        );
      }

      // Get backup file size
      const stats = await fs.promises.stat(backupPath);
      const size = stats.size;

      // Store backup metadata
      const backupResult = await query(
        `INSERT INTO container_volume_backups 
         (volume_id, volume_name, size, path, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING id, volume_id, volume_name, size, path, created_at`,
        [volumeId, volumeName, size, backupPath]
      );

      const backup = backupResult.rows[0];

      return {
        backupId: backup.id,
        volumeId: backup.volume_id,
        volumeName: backup.volume_name,
        size: backup.size,
        path: backup.path,
        createdAt: backup.created_at
      };
    } catch (error) {
      console.error('Error backing up volume:', error);
      throw new ContainerServiceError(
        ERROR_CODES.VOLUME_BACKUP_FAILED,
        'Failed to backup volume',
        500,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Restore volume from backup
   */
  async restoreVolume(volumeId: string, backupId: string): Promise<void> {
    try {
      const docker = this.getDockerClient();
      
      // Get backup metadata
      const backupResult = await query(
        'SELECT path, volume_name FROM container_volume_backups WHERE id = $1 AND volume_id = $2',
        [backupId, volumeId]
      );

      if (backupResult.rows.length === 0) {
        throw new Error('Backup not found');
      }

      const backupData = backupResult.rows[0];
      const backupPath = backupData.path;
      const volumeName = backupData.volume_name;

      // Check if backup file exists
      if (!fs.existsSync(backupPath)) {
        throw new Error('Backup file not found');
      }

      // Get volume info
      const volume = docker.getVolume(volumeName);
      const info = await volume.inspect();

      if (!info.Mountpoint) {
        throw new Error('Volume mount point not found');
      }

      // Clear existing volume data
      const files = await fs.promises.readdir(info.Mountpoint);
      for (const file of files) {
        await rm(path.join(info.Mountpoint, file), { recursive: true, force: true });
      }

      // Extract backup to volume
      await tar.extract({
        file: backupPath,
        cwd: path.dirname(info.Mountpoint)
      });

      // Update volume metadata
      await query(
        'UPDATE container_volumes SET updated_at = NOW() WHERE id = $1',
        [volumeId]
      );
    } catch (error) {
      console.error('Error restoring volume:', error);
      throw new ContainerServiceError(
        ERROR_CODES.VOLUME_RESTORE_FAILED,
        'Failed to restore volume',
        500,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * List backups for a volume
   */
  async listBackups(volumeId: string): Promise<VolumeBackup[]> {
    try {
      const result = await query(
        `SELECT id, volume_id, volume_name, size, path, created_at
         FROM container_volume_backups
         WHERE volume_id = $1
         ORDER BY created_at DESC`,
        [volumeId]
      );

      return result.rows.map(row => ({
        id: row.id,
        volumeId: row.volume_id,
        volumeName: row.volume_name,
        size: row.size,
        path: row.path,
        createdAt: row.created_at
      }));
    } catch (error) {
      console.error('Error listing backups:', error);
      return [];
    }
  }

  /**
   * Delete a volume
   */
  async deleteVolume(volumeId: string): Promise<void> {
    try {
      const docker = this.getDockerClient();
      
      // Get volume metadata
      const result = await query(
        'SELECT name FROM container_volumes WHERE id = $1',
        [volumeId]
      );

      if (result.rows.length === 0) {
        throw new Error('Volume not found');
      }

      const volumeName = result.rows[0].name;

      // Remove Docker volume
      try {
        const volume = docker.getVolume(volumeName);
        await volume.remove({ force: true });
      } catch (error: any) {
        // Volume might not exist in Docker
        console.warn('Volume not found in Docker:', error.message);
      }

      // Delete from database
      await query('DELETE FROM container_volumes WHERE id = $1', [volumeId]);
    } catch (error) {
      console.error('Error deleting volume:', error);
      throw new ContainerServiceError(
        ERROR_CODES.VOLUME_DELETE_FAILED,
        'Failed to delete volume',
        500,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Delete a backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    try {
      // Get backup metadata
      const result = await query(
        'SELECT path FROM container_volume_backups WHERE id = $1',
        [backupId]
      );

      if (result.rows.length === 0) {
        throw new Error('Backup not found');
      }

      const backupPath = result.rows[0].path;

      // Delete backup file
      if (fs.existsSync(backupPath)) {
        await fs.promises.unlink(backupPath);
      }

      // Delete from database
      await query('DELETE FROM container_volume_backups WHERE id = $1', [backupId]);
    } catch (error) {
      console.error('Error deleting backup:', error);
      throw new ContainerServiceError(
        ERROR_CODES.BACKUP_DELETE_FAILED,
        'Failed to delete backup',
        500,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }
}

// Export singleton instance
export const volumeService = new VolumeService();
