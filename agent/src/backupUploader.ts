import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { AgentConfig } from './config'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

interface UploadResult {
  storagePath: string
  size: number
}

let s3Client: S3Client | null = null

export async function uploadBackup(cfg: AgentConfig, filePath: string, databaseId: string): Promise<UploadResult> {
  const stats = await fsp.stat(filePath)
  if (cfg.backupProvider === 's3' && cfg.backupS3Bucket && cfg.backupS3Region && cfg.backupS3AccessKey && cfg.backupS3SecretKey) {
    if (!s3Client) {
      s3Client = new S3Client({
        region: cfg.backupS3Region,
        credentials: {
          accessKeyId: cfg.backupS3AccessKey,
          secretAccessKey: cfg.backupS3SecretKey,
        },
      })
    }
    const key = `paas-backups/${databaseId}/${path.basename(filePath)}`
    const body = fs.createReadStream(filePath)
    await s3Client.send(
      new PutObjectCommand({
        Bucket: cfg.backupS3Bucket,
        Key: key,
        Body: body,
      })
    )
    await fsp.rm(filePath, { force: true })
    return { storagePath: `s3://${cfg.backupS3Bucket}/${key}`, size: stats.size }
  }

  return { storagePath: filePath, size: stats.size }
}
