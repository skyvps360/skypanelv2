import { promisify } from 'util';
import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { PaasSettingsService } from './settingsService.js';

const execAsync = promisify(exec);

type GitAuthStrategy = 'none' | 'https' | 'ssh';

interface GitConfig {
  strategy: GitAuthStrategy;
  token?: string;
  username?: string;
  sshPrivateKey?: string;
  knownHosts?: string;
}

interface GitContext {
  url: string;
  env: NodeJS.ProcessEnv;
  cleanup: (() => Promise<void>)[];
}

export class GitService {
  static async validateRepository(gitUrl: string, branch: string): Promise<void> {
    await this.withGitContext(gitUrl, async ({ url, env }) => {
      await execAsync(`git ls-remote --heads ${url} ${branch}`, { env });
    });
  }

  static async cloneRepository(gitUrl: string, branch: string, targetDir: string): Promise<void> {
    await this.withGitContext(gitUrl, async ({ url, env }) => {
      await execAsync(`git clone --depth 1 --branch ${branch} ${url} ${targetDir}`, { env });
    });
  }

  private static async withGitContext<T>(
    gitUrl: string,
    fn: (ctx: GitContext) => Promise<T>
  ): Promise<T> {
    const config = await this.getGitConfig();
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
    };
    const cleanup: (() => Promise<void>)[] = [];
    const preparedUrl = gitUrl;

    if (this.isSshUrl(gitUrl)) {
      await this.applySshConfig(env, config, cleanup);
    } else if (this.isHttpsUrl(gitUrl)) {
      this.applyHttpsConfig(env, config);
    } else {
      throw new Error('Unsupported git URL protocol. Use HTTPS or SSH.');
    }

    try {
      return await fn({ url: preparedUrl, env, cleanup });
    } finally {
      for (const task of cleanup) {
        await task();
      }
    }
  }

  private static async getGitConfig(): Promise<GitConfig> {
    const raw = await PaasSettingsService.getGitConfig();
    return {
      strategy: raw.authType,
      token: raw.token,
      username: raw.username || 'oauth2',
      sshPrivateKey: raw.sshPrivateKey,
      knownHosts: raw.knownHosts,
    };
  }

  private static isHttpsUrl(url: string): boolean {
    return /^https?:\/\//i.test(url);
  }

  private static isSshUrl(url: string): boolean {
    return url.startsWith('git@') || url.startsWith('ssh://');
  }

  private static applyHttpsConfig(env: NodeJS.ProcessEnv, config: GitConfig): void {
    if (config.strategy !== 'https' || !config.token) {
      return;
    }

    const authHeader = Buffer.from(`${config.username ?? 'oauth2'}:${config.token}`, 'utf8').toString('base64');
    env.GIT_HTTP_EXTRA_HEADER = `Authorization: Basic ${authHeader}`;
  }

  private static async applySshConfig(
    env: NodeJS.ProcessEnv,
    config: GitConfig,
    cleanup: (() => Promise<void>)[]
  ): Promise<void> {
    if (!config.sshPrivateKey) {
      throw new Error('SSH authentication requested but no private key configured');
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'paas-git-'));
    const keyPath = path.join(tempDir, 'id_rsa');
    await fs.writeFile(keyPath, config.sshPrivateKey, { mode: 0o600 });

    let sshCommand = `ssh -i ${keyPath} -o StrictHostKeyChecking=no`;

    if (config.knownHosts) {
      const knownHostsPath = path.join(tempDir, 'known_hosts');
      await fs.writeFile(knownHostsPath, config.knownHosts, { mode: 0o644 });
      sshCommand = `ssh -i ${keyPath} -o StrictHostKeyChecking=yes -o UserKnownHostsFile=${knownHostsPath}`;
      cleanup.push(() => fs.rm(knownHostsPath, { force: true }));
    }

    env.GIT_SSH_COMMAND = sshCommand;
    cleanup.push(() => fs.rm(keyPath, { force: true }));
    cleanup.push(() => fs.rm(tempDir, { recursive: true, force: true }).catch(() => {}));
  }
}
