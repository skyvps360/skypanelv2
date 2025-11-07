import { query } from '../../lib/database.js';

export interface PaaSBuild {
  id: number;
  application_id: number;
  build_number: number;
  git_commit_sha: string | null;
  git_commit_message: string | null;
  status: 'pending' | 'building' | 'success' | 'failed';
  build_log: string | null;
  image_tag: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
}

export class BuildService {
  async getByApplicationId(applicationId: number, limit = 50): Promise<PaaSBuild[]> {
    const result = await query(
      `SELECT * FROM paas_builds 
       WHERE application_id = $1 
       ORDER BY build_number DESC 
       LIMIT $2`,
      [applicationId, limit]
    );
    return result.rows;
  }

  async getById(id: number): Promise<PaaSBuild | null> {
    const result = await query(
      'SELECT * FROM paas_builds WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async getLatestByApplicationId(applicationId: number): Promise<PaaSBuild | null> {
    const result = await query(
      `SELECT * FROM paas_builds 
       WHERE application_id = $1 
       ORDER BY build_number DESC 
       LIMIT 1`,
      [applicationId]
    );
    return result.rows[0] || null;
  }

  async create(applicationId: number, gitData?: {
    commit_sha?: string;
    commit_message?: string;
  }): Promise<PaaSBuild> {
    const latestBuild = await this.getLatestByApplicationId(applicationId);
    const buildNumber = latestBuild ? latestBuild.build_number + 1 : 1;

    const result = await query(
      `INSERT INTO paas_builds 
       (application_id, build_number, git_commit_sha, git_commit_message, status, started_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [
        applicationId,
        buildNumber,
        gitData?.commit_sha || null,
        gitData?.commit_message || null,
        'pending'
      ]
    );

    return result.rows[0];
  }

  async updateStatus(
    id: number, 
    status: PaaSBuild['status'], 
    additionalData?: {
      build_log?: string;
      image_tag?: string;
    }
  ): Promise<PaaSBuild | null> {
    const fields = ['status = $2'];
    const values: any[] = [id, status];
    let paramCount = 3;

    if (status === 'building' && !additionalData?.build_log) {
      fields.push('started_at = NOW()');
    }

    if (status === 'success' || status === 'failed') {
      fields.push('completed_at = NOW()');
    }

    if (additionalData?.build_log !== undefined) {
      fields.push(`build_log = $${paramCount++}`);
      values.push(additionalData.build_log);
    }

    if (additionalData?.image_tag !== undefined) {
      fields.push(`image_tag = $${paramCount++}`);
      values.push(additionalData.image_tag);
    }

    const result = await query(
      `UPDATE paas_builds SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  async appendLog(id: number, logChunk: string): Promise<void> {
    await query(
      `UPDATE paas_builds 
       SET build_log = COALESCE(build_log, '') || $2 
       WHERE id = $1`,
      [id, logChunk]
    );
  }

  async delete(id: number): Promise<boolean> {
    const result = await query(
      'DELETE FROM paas_builds WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async deleteOldBuilds(applicationId: number, keepCount = 50): Promise<number> {
    const result = await query(
      `DELETE FROM paas_builds 
       WHERE application_id = $1 
         AND id NOT IN (
           SELECT id FROM paas_builds 
           WHERE application_id = $1 
           ORDER BY build_number DESC 
           LIMIT $2
         )`,
      [applicationId, keepCount]
    );
    return result.rowCount ?? 0;
  }
}

export const buildService = new BuildService();
