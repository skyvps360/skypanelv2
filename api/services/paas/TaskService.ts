import { query } from '../../lib/database.js';

export interface PaaSTask {
  id: number;
  node_id: number;
  task_type: 'deploy' | 'restart' | 'stop' | 'start' | 'scale' | 'backup' | 'restore' | 'delete';
  resource_type: 'application' | 'database';
  resource_id: number;
  payload: any;
  status: 'pending' | 'sent' | 'acknowledged' | 'in_progress' | 'completed' | 'failed';
  result: any;
  priority: number;
  created_at: Date;
  sent_at: Date | null;
  acknowledged_at: Date | null;
  completed_at: Date | null;
}

export interface DeploymentTask {
  taskId: string;
  type: 'deploy';
  applicationId: number;
  buildId: number;
  gitRepoUrl: string;
  gitBranch: string;
  gitCommitSha?: string;
  gitOAuthToken?: string;
  runtimeType: string;
  runtimeVersion: string;
  baseImage: string;
  buildCommand?: string;
  startCommand?: string;
  cpuLimit: number;
  memoryLimit: number;
  storageLimit: number;
  instanceCount: number;
  environmentVars: Record<string, string>;
  systemDomain: string;
  customDomains: string[];
  port: number;
}

export class TaskService {
  async create(
    nodeId: number,
    taskType: PaaSTask['task_type'],
    resourceType: PaaSTask['resource_type'],
    resourceId: number,
    payload: any,
    priority = 5
  ): Promise<PaaSTask> {
    const result = await query(
      `INSERT INTO paas_tasks 
       (node_id, task_type, resource_type, resource_id, payload, priority, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [nodeId, taskType, resourceType, resourceId, JSON.stringify(payload), priority, 'pending']
    );

    return result.rows[0];
  }

  async getById(id: number): Promise<PaaSTask | null> {
    const result = await query(
      'SELECT * FROM paas_tasks WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async getPendingForNode(nodeId: number, limit = 10): Promise<PaaSTask[]> {
    const result = await query(
      `SELECT * FROM paas_tasks 
       WHERE node_id = $1 AND status = 'pending'
       ORDER BY priority ASC, created_at ASC
       LIMIT $2`,
      [nodeId, limit]
    );
    return result.rows;
  }

  async markAsSent(id: number): Promise<void> {
    await query(
      'UPDATE paas_tasks SET status = $1, sent_at = NOW() WHERE id = $2',
      ['sent', id]
    );
  }

  async markAsAcknowledged(id: number): Promise<void> {
    await query(
      'UPDATE paas_tasks SET status = $1, acknowledged_at = NOW() WHERE id = $2',
      ['acknowledged', id]
    );
  }

  async markAsInProgress(id: number): Promise<void> {
    await query(
      'UPDATE paas_tasks SET status = $1 WHERE id = $2',
      ['in_progress', id]
    );
  }

  async markAsCompleted(id: number, result?: any): Promise<void> {
    await query(
      'UPDATE paas_tasks SET status = $1, completed_at = NOW(), result = $2 WHERE id = $3',
      ['completed', result ? JSON.stringify(result) : null, id]
    );
  }

  async markAsFailed(id: number, error: any): Promise<void> {
    await query(
      'UPDATE paas_tasks SET status = $1, completed_at = NOW(), result = $2 WHERE id = $3',
      ['failed', JSON.stringify({ error }), id]
    );
  }

  async getByResourceId(
    resourceType: PaaSTask['resource_type'],
    resourceId: number,
    limit = 50
  ): Promise<PaaSTask[]> {
    const result = await query(
      `SELECT * FROM paas_tasks 
       WHERE resource_type = $1 AND resource_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [resourceType, resourceId, limit]
    );
    return result.rows;
  }

  async deleteOldTasks(olderThanDays = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await query(
      `DELETE FROM paas_tasks 
       WHERE status IN ('completed', 'failed') 
         AND completed_at < $1`,
      [cutoffDate]
    );

    return result.rowCount ?? 0;
  }

  async cancelPendingTasks(
    resourceType: PaaSTask['resource_type'],
    resourceId: number
  ): Promise<number> {
    const result = await query(
      `UPDATE paas_tasks 
       SET status = 'failed', 
           completed_at = NOW(), 
           result = '{"error": "Task cancelled"}'
       WHERE resource_type = $1 
         AND resource_id = $2 
         AND status IN ('pending', 'sent')`,
      [resourceType, resourceId]
    );

    return result.rowCount ?? 0;
  }

  async getPendingTasksForNode(nodeId: number, limit = 10): Promise<any[]> {
    const result = await query(
      `SELECT 
        t.*,
        CASE 
          WHEN t.resource_type = 'application' THEN (
            SELECT row_to_json(app_data) FROM (
              SELECT 
                a.id,
                a.name,
                a.slug,
                a.system_domain,
                a.custom_domains,
                a.git_repo_url,
                a.git_branch,
                a.git_oauth_token,
                a.instance_count,
                r.name as runtime_name,
                r.runtime_type,
                r.version,
                r.base_image as docker_image,
                r.default_build_cmd as build_command,
                r.default_start_cmd as start_command,
                p.cpu_limit,
                p.memory_limit,
                p.storage_limit
              FROM paas_applications a
              JOIN paas_runtimes r ON a.runtime_id = r.id
              JOIN paas_plans p ON a.plan_id = p.id
              WHERE a.id = t.resource_id
            ) app_data
          )
        END as resource_data
      FROM paas_tasks t
      WHERE t.node_id = $1 AND t.status = 'pending'
      ORDER BY t.priority ASC, t.created_at ASC
      LIMIT $2`,
      [nodeId, limit]
    );

    return result.rows.map(row => {
      const task = {
        id: row.id,
        task_type: row.task_type,
        application_id: row.resource_type === 'application' ? row.resource_id : null,
        task_data: {}
      };

      if (row.resource_data) {
        const data = row.resource_data;
        task.task_data = {
          slug: data.slug,
          system_domain: data.system_domain,
          custom_domains: data.custom_domains || [],
          git_repo_url: data.git_repo_url,
          git_branch: data.git_branch || 'main',
          git_oauth_token: data.git_oauth_token,
          port: 3000,
          instance_count: data.instance_count || 1,
          current_instance_count: data.instance_count || 1,
          runtime: {
            name: data.runtime_name,
            runtime_type: data.runtime_type,
            version: data.version,
            docker_image: data.docker_image,
            build_command: data.build_command,
            start_command: data.start_command
          },
          cpu_limit: data.cpu_limit,
          memory_limit: data.memory_limit,
          storage_limit: data.storage_limit,
          env_vars: JSON.parse(row.payload || '{}').environmentVars || {}
        };
      }

      return task;
    });
  }

  async updateStatus(
    taskId: number,
    status: string,
    output?: any,
    message?: string
  ): Promise<void> {
    const updates: string[] = ['status = $1'];
    const values: any[] = [status];
    let paramIndex = 2;

    if (output !== undefined) {
      updates.push(`result = $${paramIndex}`);
      values.push(JSON.stringify(output));
      paramIndex++;
    }

    if (message !== undefined) {
      updates.push(`result = jsonb_set(COALESCE(result, '{}'::jsonb), '{message}', $${paramIndex})`);
      values.push(JSON.stringify(message));
      paramIndex++;
    }

    if (status === 'in_progress') {
      updates.push('acknowledged_at = NOW()');
    } else if (status === 'completed' || status === 'failed') {
      updates.push('completed_at = NOW()');
    }

    values.push(taskId);

    await query(
      `UPDATE paas_tasks SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values
    );
  }
}

export const taskService = new TaskService();
