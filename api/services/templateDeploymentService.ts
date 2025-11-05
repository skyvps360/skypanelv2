/**
 * Template Deployment Service for Dokploy
 * Translates stored template schema definitions into Dokploy API calls
 */

import type { ContainerTemplate } from './containerTemplateService.js';
import { dokployService } from './dokployService.js';

interface DeployTemplateOptions {
  projectId: string;
  projectName: string;
  organizationId: string;
  primaryServiceName: string;
  template: ContainerTemplate;
  overrides?: Record<string, any>;
}

interface DeployTemplateResult {
  primaryApplicationId: string;
  deployedServices: Array<{
    name: string;
    type: string;
    remoteId: string;
  }>;
  context: Record<string, string>;
}

interface TemplateServiceDefinition {
  name: string;
  type: string;
  config: Record<string, any>;
}

const RANDOM_CHARSET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

class TemplateDeploymentService {
  async deployTemplate(options: DeployTemplateOptions): Promise<DeployTemplateResult> {
    const { projectId, projectName, organizationId, primaryServiceName, template } = options;
    const schema = template.templateSchema as Record<string, any> | undefined;

    if (!schema || !Array.isArray(schema.services) || schema.services.length === 0) {
      throw new Error('Template schema must include at least one service definition');
    }

    const context = this.buildContext({
      projectId,
      projectName,
      organizationId,
      primaryServiceName,
      template,
    });
    const dynamicSecrets: Record<string, string> = {};

    const environment = await dokployService.ensureDefaultEnvironment(projectId);
    const deployedServices: Array<{ name: string; type: string; remoteId: string }> = [];
    let primaryApplicationId: string | null = null;

    for (const rawService of schema.services) {
      const resolvedService = this.resolveServiceDefinition(rawService, context, dynamicSecrets);

      switch (resolvedService.type) {
        case 'app':
        case 'application': {
          const app = await this.deployApplication(environment.environmentId, resolvedService, context);
          deployedServices.push({
            name: app.name,
            type: 'app',
            remoteId: app.applicationId,
          });

          if (!primaryApplicationId) {
            primaryApplicationId = app.applicationId;
          }

          context[`${app.name.toUpperCase()}_APPLICATION_ID`] = app.applicationId;
          break;
        }
        case 'mariadb':
        case 'mysql':
        case 'postgres':
        case 'mongo':
        case 'redis': {
          const db = await this.deployDatabase(environment.environmentId, resolvedService, context);
          deployedServices.push({
            name: resolvedService.name,
            type: resolvedService.type,
            remoteId: db.remoteId,
          });

          context[`${resolvedService.name.toUpperCase()}_SERVICE_ID`] = db.remoteId;
          break;
        }
        default:
          throw new Error(`Unsupported service type in template: ${resolvedService.type}`);
      }
    }

    if (!primaryApplicationId) {
      throw new Error('Template deployment did not create an application service');
    }

    return {
      primaryApplicationId,
      deployedServices,
      context,
    };
  }

  private buildContext(input: {
    projectId: string;
    projectName: string;
    organizationId: string;
    primaryServiceName: string;
    template: ContainerTemplate;
  }): Record<string, string> {
    const slug = this.slugify(input.projectName);

    const baseContext: Record<string, string> = {
      PROJECT_ID: input.projectId,
      PROJECT_NAME: input.projectName,
      PROJECT_SLUG: slug,
      ORGANIZATION_ID: input.organizationId,
      PRIMARY_SERVICE_NAME: input.primaryServiceName,
      PRIMARY_SERVICE_SLUG: this.slugify(input.primaryServiceName),
      TEMPLATE_NAME: input.template.templateName,
    };

    const variables = (input.template.templateSchema as any)?.variables;
    if (variables && typeof variables === 'object') {
      Object.entries(variables).forEach(([key, definition]) => {
        const value = this.resolveVariable(definition, baseContext);
        if (value !== undefined && value !== null) {
          baseContext[key.toUpperCase()] = value;
        }
      });
    }

    return baseContext;
  }

  private resolveVariable(definition: any, context: Record<string, string>): string | undefined {
    if (definition == null) {
      return undefined;
    }

    if (typeof definition === 'string') {
      return this.replacePlaceholders(definition, context, {});
    }

    if (typeof definition !== 'object') {
      return String(definition);
    }

    const type = String(definition.type || 'static').toLowerCase();

    switch (type) {
      case 'random': {
        const length = Number.isFinite(definition.length) ? Number(definition.length) : 16;
        const charset = typeof definition.charset === 'string' && definition.charset.length > 0
          ? definition.charset
          : RANDOM_CHARSET;
        return this.generateRandomString(length, charset);
      }
      case 'template': {
        const templateValue = typeof definition.value === 'string' ? definition.value : '';
        return this.replacePlaceholders(templateValue, context, {});
      }
      case 'static':
      default:
        if (definition.value === undefined || definition.value === null) {
          return undefined;
        }
        return String(definition.value);
    }
  }

  private resolveServiceDefinition(service: any, context: Record<string, string>, secrets: Record<string, string>): TemplateServiceDefinition {
    if (!service || typeof service !== 'object') {
      throw new Error('Invalid service definition in template schema');
    }

    const type = String(service.type || 'app').toLowerCase();
    const rawName = service.name || service.serviceName || type;
    const resolvedName = this.replacePlaceholders(String(rawName), context, secrets);
    const sourceConfig = service.configuration || service.data || {};
    const config = this.resolveValue(sourceConfig, context, secrets);

    return {
      name: resolvedName,
      type,
      config,
    };
  }

  private resolveValue<T>(value: T, context: Record<string, string>, secrets: Record<string, string>): T {
    if (typeof value === 'string') {
      return this.replacePlaceholders(value, context, secrets) as unknown as T;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.resolveValue(item, context, secrets)) as unknown as T;
    }

    if (value && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, any>).map(([key, val]) => [
        key,
        this.resolveValue(val, context, secrets),
      ]);
      return Object.fromEntries(entries) as T;
    }

    return value;
  }

  private replacePlaceholders(input: string, context: Record<string, string>, secrets: Record<string, string>): string {
    if (!input.includes('{{')) {
      return input;
    }

    return input.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_match, key) => {
      const upperKey = String(key).toUpperCase();

      if (context[upperKey] !== undefined) {
        return context[upperKey];
      }

      if (secrets[upperKey] !== undefined) {
        return secrets[upperKey];
      }

      if (upperKey.startsWith('RANDOM_PASSWORD')) {
        const lengthMatch = upperKey.match(/RANDOM_PASSWORD_(\d+)/);
        const length = lengthMatch ? parseInt(lengthMatch[1], 10) : 16;
        const generated = this.generateRandomString(length, RANDOM_CHARSET);
        secrets[upperKey] = generated;
        return generated;
      }

      // Default: leave placeholder blank to avoid leaking template tokens downstream
      return '';
    });
  }

  private generateRandomString(length: number, charset: string): string {
    if (length <= 0) {
      return '';
    }

    let result = '';
    for (let i = 0; i < length; i++) {
      const index = Math.floor(Math.random() * charset.length);
      result += charset.charAt(index);
    }
    return result;
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  }

  private async deployApplication(environmentId: string, service: TemplateServiceDefinition, _context: Record<string, string>) {
    const config = service.config || {};
    const source = config.source || {};
    const env = config.env || {};
    const mounts = Array.isArray(config.mounts) ? config.mounts : [];
    const resources = config.resources || {};

    const app = await dokployService.createApplication(environmentId, {
      serviceName: service.name,
      source,
      env,
      domains: [],
      mounts: [],
      deploy: {},
      resources,
    });

    if (source && typeof source === 'object') {
      const image = source.image || source.dockerImage || source.reference;
      if (image) {
        await dokployService.configureDockerProvider(app.applicationId, {
          image: String(image),
          username: source.username || source.registryUsername || null,
          password: source.password || source.registryPassword || null,
          registryUrl: source.registryUrl || null,
        });
      }
    }

    if (env && (typeof env === 'object' || typeof env === 'string')) {
      await dokployService.saveApplicationEnvironment(app.applicationId, env);
    }

    if (resources && (resources.cpuLimit !== undefined || resources.memoryLimit !== undefined || resources.memoryReservation !== undefined || resources.cpuReservation !== undefined)) {
      await dokployService.updateApplicationSettings(app.applicationId, {
        name: app.name,
        appName: app.appName,
        cpuLimit: resources.cpuLimit,
        cpuReservation: resources.cpuReservation,
        memoryLimit: resources.memoryLimit,
        memoryReservation: resources.memoryReservation,
        description: config.description,
      });
    }

    for (const mount of mounts) {
      if (!mount || typeof mount !== 'object') {
        continue;
      }

      const type = String(mount.type || 'volume').toLowerCase();
      if (type !== 'volume' && type !== 'bind' && type !== 'file') {
        continue;
      }

      await dokployService.createApplicationMount(app.applicationId, {
        type: type as 'volume' | 'bind' | 'file',
        mountPath: String(mount.mountPath || mount.path || '/data'),
        volumeName: mount.name || mount.volumeName || null,
        hostPath: mount.hostPath || null,
        content: type === 'file' ? (mount.content || '') : null,
        filePath: type === 'file' ? (mount.filePath || null) : null,
      });
    }

    await dokployService.deployApplication(app.applicationId);

    return app;
  }

  private async deployDatabase(environmentId: string, service: TemplateServiceDefinition, _context: Record<string, string>) {
    const config = service.config || {};
    const defaults = {
      database: String(config.database || `${service.name}`),
      user: String(config.user || config.username || service.name),
      password: String(config.password || config.secret || ''),
      rootPassword: String(config.rootPassword || config.root_secret || config.root || ''),
    };

    switch (service.type) {
      case 'mariadb': {
        if (!defaults.password) {
          defaults.password = this.generateRandomString(20, RANDOM_CHARSET);
        }
        if (!defaults.rootPassword) {
          defaults.rootPassword = this.generateRandomString(24, RANDOM_CHARSET);
        }
        const result = await dokployService.createMariadbService(environmentId, {
          serviceName: service.name,
          databaseName: defaults.database,
          databaseUser: defaults.user,
          databasePassword: defaults.password,
          rootPassword: defaults.rootPassword,
          dockerImage: config.dockerImage,
          description: config.description,
        });
        return { remoteId: result.serviceId };
      }
      case 'mysql': {
        if (!defaults.password) {
          defaults.password = this.generateRandomString(20, RANDOM_CHARSET);
        }
        if (!defaults.rootPassword) {
          defaults.rootPassword = this.generateRandomString(24, RANDOM_CHARSET);
        }
        const result = await dokployService.createMysqlService(environmentId, {
          serviceName: service.name,
          databaseName: defaults.database,
          databaseUser: defaults.user,
          databasePassword: defaults.password,
          rootPassword: defaults.rootPassword,
          dockerImage: config.dockerImage,
          description: config.description,
        });
        return { remoteId: result.serviceId };
      }
      case 'postgres': {
        if (!defaults.password) {
          defaults.password = this.generateRandomString(20, RANDOM_CHARSET);
        }
        const result = await dokployService.createPostgresService(environmentId, {
          serviceName: service.name,
          databaseName: defaults.database,
          databaseUser: defaults.user,
          databasePassword: defaults.password,
          dockerImage: config.dockerImage,
          description: config.description,
        });
        return { remoteId: result.serviceId };
      }
      case 'mongo': {
        if (!defaults.password) {
          defaults.password = this.generateRandomString(20, RANDOM_CHARSET);
        }
        const result = await dokployService.createMongoService(environmentId, {
          serviceName: service.name,
          password: defaults.password,
          database: config.database || defaults.database,
          user: config.user || defaults.user,
          dockerImage: config.dockerImage,
          description: config.description,
        });
        return { remoteId: result.serviceId };
      }
      case 'redis': {
        const result = await dokployService.createRedisService(environmentId, {
          serviceName: service.name,
          password: config.password,
          dockerImage: config.dockerImage,
          description: config.description,
        });
        return { remoteId: result.serviceId };
      }
      default:
        throw new Error(`Unsupported database service type: ${service.type}`);
    }
  }
}

export const templateDeploymentService = new TemplateDeploymentService();
