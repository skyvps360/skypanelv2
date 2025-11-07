import { nodeService } from './NodeService.js';
import { applicationService } from './ApplicationService.js';
import { buildService } from './BuildService.js';
import { taskService, DeploymentTask } from './TaskService.js';
import { planService } from './PlanService.js';
import { runtimeService } from './RuntimeService.js';
import { environmentService } from './EnvironmentService.js';
import { databaseService } from './DatabaseService.js';

export class DeploymentScheduler {
  async scheduleDeployment(applicationId: number, gitCommit?: {
    sha: string;
    message: string;
  }): Promise<{ success: boolean; buildId?: number; error?: string }> {
    const app = await applicationService.getById(applicationId);
    if (!app) {
      return { success: false, error: 'Application not found' };
    }

    const plan = await planService.getById(app.plan_id!);
    if (!plan) {
      return { success: false, error: 'Plan not found' };
    }

    const runtime = await runtimeService.getById(app.runtime_id!);
    if (!runtime) {
      return { success: false, error: 'Runtime not found' };
    }

    const node = await this.selectNode(app.region, plan);
    if (!node) {
      return { success: false, error: 'No available nodes in region' };
    }

    const build = await buildService.create(applicationId, gitCommit);

    await applicationService.update(applicationId, {
      status: 'building',
      current_build_id: build.id,
      node_id: node.id
    });

    const envVars = await environmentService.getDecryptedMap(applicationId);
    
    const linkedDatabases = await databaseService.getLinkedDatabases(applicationId);
    for (const db of linkedDatabases) {
      const connectionString = databaseService.getConnectionString(db);
      envVars[`${db.env_var_prefix}_URL`] = connectionString;
      envVars[`${db.env_var_prefix}_HOST`] = db.host || '';
      envVars[`${db.env_var_prefix}_PORT`] = db.port?.toString() || '';
      envVars[`${db.env_var_prefix}_USER`] = db.username || '';
      envVars[`${db.env_var_prefix}_PASSWORD`] = db.password || '';
      envVars[`${db.env_var_prefix}_NAME`] = db.database_name || '';
    }

    const oauthToken = await applicationService.getDecryptedOAuthToken(app);

    const deploymentPayload: DeploymentTask = {
      taskId: `deploy-${build.id}-${Date.now()}`,
      type: 'deploy',
      applicationId: app.id,
      buildId: build.id,
      gitRepoUrl: app.git_repo_url!,
      gitBranch: app.git_branch,
      gitCommitSha: gitCommit?.sha,
      gitOAuthToken: oauthToken || undefined,
      runtimeType: runtime.runtime_type,
      runtimeVersion: runtime.version,
      baseImage: runtime.base_image,
      buildCommand: runtime.default_build_cmd || undefined,
      startCommand: runtime.default_start_cmd || undefined,
      cpuLimit: plan.cpu_limit,
      memoryLimit: plan.memory_limit,
      storageLimit: plan.storage_limit,
      instanceCount: app.instance_count,
      environmentVars: envVars,
      systemDomain: app.system_domain!,
      customDomains: app.custom_domains || [],
      port: 3000
    };

    await taskService.create(
      node.id,
      'deploy',
      'application',
      applicationId,
      deploymentPayload,
      3
    );

    return { success: true, buildId: build.id };
  }

  async selectNode(region: string, plan: any): Promise<any> {
    const nodes = await nodeService.getCapacityForScheduling(region);
    
    if (nodes.length === 0) {
      return null;
    }

    for (const node of nodes) {
      const availableMemory = (node.memory_total || 0) - node.memory_used;
      const availableCpu = (node.cpu_total || 0) - node.cpu_used;

      if (availableMemory >= plan.memory_limit && availableCpu >= plan.cpu_limit) {
        return node;
      }
    }

    return null;
  }

  async scheduleRestart(applicationId: number): Promise<{ success: boolean; error?: string }> {
    const app = await applicationService.getById(applicationId);
    if (!app || !app.node_id) {
      return { success: false, error: 'Application not found or not deployed' };
    }

    await taskService.create(
      app.node_id,
      'restart',
      'application',
      applicationId,
      { applicationId },
      5
    );

    return { success: true };
  }

  async scheduleStop(applicationId: number): Promise<{ success: boolean; error?: string }> {
    const app = await applicationService.getById(applicationId);
    if (!app || !app.node_id) {
      return { success: false, error: 'Application not found or not deployed' };
    }

    await taskService.create(
      app.node_id,
      'stop',
      'application',
      applicationId,
      { applicationId },
      5
    );

    await applicationService.updateStatus(applicationId, 'stopped');

    return { success: true };
  }

  async scheduleStart(applicationId: number): Promise<{ success: boolean; error?: string }> {
    const app = await applicationService.getById(applicationId);
    if (!app || !app.node_id) {
      return { success: false, error: 'Application not found or not deployed' };
    }

    await taskService.create(
      app.node_id,
      'start',
      'application',
      applicationId,
      { applicationId },
      5
    );

    return { success: true };
  }

  async scheduleScale(applicationId: number, instanceCount: number): Promise<{ success: boolean; error?: string }> {
    const app = await applicationService.getById(applicationId);
    if (!app || !app.node_id) {
      return { success: false, error: 'Application not found or not deployed' };
    }

    await applicationService.scale(applicationId, instanceCount);

    await taskService.create(
      app.node_id,
      'scale',
      'application',
      applicationId,
      { applicationId, instanceCount },
      4
    );

    return { success: true };
  }

  async scheduleDelete(applicationId: number): Promise<{ success: boolean; error?: string }> {
    const app = await applicationService.getById(applicationId);
    if (!app) {
      return { success: false, error: 'Application not found' };
    }

    if (app.node_id) {
      await taskService.create(
        app.node_id,
        'delete',
        'application',
        applicationId,
        { applicationId },
        2
      );
    }

    await taskService.cancelPendingTasks('application', applicationId);

    return { success: true };
  }

  async scheduleDatabaseCreation(databaseId: number): Promise<{ success: boolean; error?: string }> {
    const db = await databaseService.getById(databaseId);
    if (!db) {
      return { success: false, error: 'Database not found' };
    }

    const plan = db.plan_id ? await planService.getById(db.plan_id) : null;
    const region = 'default';

    const node = await this.selectNode(region, plan || { memory_limit: 512, cpu_limit: 500 });
    if (!node) {
      return { success: false, error: 'No available nodes' };
    }

    await databaseService.update(databaseId, { node_id: node.id });

    await taskService.create(
      node.id,
      'deploy',
      'database',
      databaseId,
      {
        databaseId: db.id,
        dbType: db.db_type,
        version: db.version,
        username: db.username,
        password: db.password,
        databaseName: db.database_name,
        memoryLimit: plan?.memory_limit || 512,
        cpuLimit: plan?.cpu_limit || 500
      },
      5
    );

    return { success: true };
  }

  async scheduleDatabaseDelete(databaseId: number): Promise<{ success: boolean; error?: string }> {
    const db = await databaseService.getById(databaseId);
    if (!db) {
      return { success: false, error: 'Database not found' };
    }

    if (db.node_id) {
      await taskService.create(
        db.node_id,
        'delete',
        'database',
        databaseId,
        { databaseId },
        2
      );
    }

    await taskService.cancelPendingTasks('database', databaseId);

    return { success: true };
  }
}

export const deploymentScheduler = new DeploymentScheduler();
