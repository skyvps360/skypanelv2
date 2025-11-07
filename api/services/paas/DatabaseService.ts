import { query } from '../../lib/database.js';
import { encrypt, decrypt } from '../../lib/crypto.js';
import crypto from 'crypto';

export interface PaaSDatabase {
  id: number;
  user_id: string;
  organization_id: string | null;
  name: string;
  db_type: 'mysql' | 'postgresql' | 'redis' | 'mongodb';
  version: string;
  plan_id: number | null;
  node_id: number | null;
  host: string | null;
  port: number | null;
  username: string | null;
  password: string | null;
  database_name: string | null;
  status: 'pending' | 'running' | 'stopped' | 'failed';
  container_id: string | null;
  volume_path: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateDatabaseData {
  user_id: string;
  organization_id?: string;
  name: string;
  db_type: PaaSDatabase['db_type'];
  version: string;
  plan_id: number;
  region: string;
}

export class DatabaseService {
  generatePassword(length = 32): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    const randomBytes = crypto.randomBytes(length);
    
    for (let i = 0; i < length; i++) {
      password += charset[randomBytes[i] % charset.length];
    }
    
    return password;
  }

  generateUsername(dbType: string): string {
    const prefix = dbType.substring(0, 3);
    const randomSuffix = crypto.randomBytes(4).toString('hex');
    return `${prefix}_${randomSuffix}`;
  }

  async getAll(userId?: string, organizationId?: string): Promise<PaaSDatabase[]> {
    let sql = 'SELECT * FROM paas_databases';
    const params: any[] = [];
    const conditions: string[] = [];

    if (userId) {
      conditions.push(`user_id = $${params.length + 1}`);
      params.push(userId);
    }

    if (organizationId) {
      conditions.push(`organization_id = $${params.length + 1}`);
      params.push(organizationId);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY created_at DESC';

    const result = await query(sql, params);
    return result.rows.map(row => ({
      ...row,
      password: row.password ? decrypt(row.password) : null
    }));
  }

  async getById(id: number): Promise<PaaSDatabase | null> {
    const result = await query(
      'SELECT * FROM paas_databases WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return null;
    }

    const db = result.rows[0];
    return {
      ...db,
      password: db.password ? decrypt(db.password) : null
    };
  }

  async create(data: CreateDatabaseData): Promise<PaaSDatabase> {
    const username = this.generateUsername(data.db_type);
    const password = this.generatePassword();
    const databaseName = `db_${crypto.randomBytes(8).toString('hex')}`;
    const encryptedPassword = encrypt(password);

    const result = await query(
      `INSERT INTO paas_databases 
       (user_id, organization_id, name, db_type, version, plan_id, username, password, database_name, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        data.user_id,
        data.organization_id || null,
        data.name,
        data.db_type,
        data.version,
        data.plan_id,
        username,
        encryptedPassword,
        databaseName,
        'pending'
      ]
    );

    return {
      ...result.rows[0],
      password
    };
  }

  async update(id: number, data: Partial<PaaSDatabase>): Promise<PaaSDatabase | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    const allowedFields = [
      'name', 'node_id', 'host', 'port', 'status', 'container_id', 'volume_path'
    ];

    for (const field of allowedFields) {
      if (data[field as keyof PaaSDatabase] !== undefined) {
        fields.push(`${field} = $${paramCount++}`);
        values.push(data[field as keyof PaaSDatabase]);
      }
    }

    if (fields.length === 0) {
      return this.getById(id);
    }

    values.push(id);
    const result = await query(
      `UPDATE paas_databases SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return null;
    }

    const db = result.rows[0];
    return {
      ...db,
      password: db.password ? decrypt(db.password) : null
    };
  }

  async updateStatus(id: number, status: PaaSDatabase['status']): Promise<void> {
    await query(
      'UPDATE paas_databases SET status = $1 WHERE id = $2',
      [status, id]
    );
  }

  async delete(id: number): Promise<boolean> {
    const result = await query(
      'DELETE FROM paas_databases WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getByNodeId(nodeId: number): Promise<PaaSDatabase[]> {
    const result = await query(
      'SELECT * FROM paas_databases WHERE node_id = $1',
      [nodeId]
    );
    return result.rows.map(row => ({
      ...row,
      password: row.password ? decrypt(row.password) : null
    }));
  }

  async linkToApplication(applicationId: number, databaseId: number, envVarPrefix = 'DATABASE'): Promise<void> {
    await query(
      `INSERT INTO paas_app_databases (application_id, database_id, env_var_prefix)
       VALUES ($1, $2, $3)
       ON CONFLICT (application_id, database_id) DO NOTHING`,
      [applicationId, databaseId, envVarPrefix]
    );
  }

  async unlinkFromApplication(applicationId: number, databaseId: number): Promise<boolean> {
    const result = await query(
      'DELETE FROM paas_app_databases WHERE application_id = $1 AND database_id = $2',
      [applicationId, databaseId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getLinkedDatabases(applicationId: number): Promise<Array<PaaSDatabase & { env_var_prefix: string }>> {
    const result = await query(
      `SELECT d.*, ad.env_var_prefix
       FROM paas_databases d
       JOIN paas_app_databases ad ON d.id = ad.database_id
       WHERE ad.application_id = $1`,
      [applicationId]
    );

    return result.rows.map(row => ({
      ...row,
      password: row.password ? decrypt(row.password) : null
    }));
  }

  getConnectionString(db: PaaSDatabase): string {
    if (!db.host || !db.port || !db.username || !db.password || !db.database_name) {
      return '';
    }

    switch (db.db_type) {
      case 'postgresql':
        return `postgresql://${db.username}:${db.password}@${db.host}:${db.port}/${db.database_name}`;
      case 'mysql':
        return `mysql://${db.username}:${db.password}@${db.host}:${db.port}/${db.database_name}`;
      case 'mongodb':
        return `mongodb://${db.username}:${db.password}@${db.host}:${db.port}/${db.database_name}`;
      case 'redis':
        return `redis://:${db.password}@${db.host}:${db.port}`;
      default:
        return '';
    }
  }

  async countByUser(userId: string): Promise<number> {
    const result = await query(
      'SELECT COUNT(*) as count FROM paas_databases WHERE user_id = $1',
      [userId]
    );
    return parseInt(result.rows[0].count, 10);
  }
}

export const databaseService = new DatabaseService();
