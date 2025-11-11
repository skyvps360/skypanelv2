import Queue from 'bull';

const REDIS_URL =
  process.env.REDIS_URL ||
  (process.env.REDIS_HOST ? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || '6379'}` : 'redis://127.0.0.1:6379');

const defaultJobOptions = {
  removeOnComplete: true,
  removeOnFail: false,
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 5000,
  },
};

const queueOptions = {
  redis: REDIS_URL,
  defaultJobOptions,
};

export interface BuildJobData {
  applicationId: string;
  gitUrl: string;
  gitBranch: string;
  gitCommit?: string;
  buildpack?: string;
  userId?: string;
  replicas?: number;
}

export interface DeployJobData {
  deploymentId: string;
  replicas?: number;
  cachedSlugPath?: string;
}

export const buildQueue = new Queue<BuildJobData>('paas-build', queueOptions);
export const deployQueue = new Queue<DeployJobData>('paas-deploy', queueOptions);
export const billingQueue = new Queue('paas-billing', {
  redis: REDIS_URL,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export const redisUrl = REDIS_URL;
