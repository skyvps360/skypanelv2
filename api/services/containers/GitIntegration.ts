/**
 * Git Integration Service for SkyPanelV2
 * Handles Git repository operations for container builds
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

export interface GitCloneOptions {
  branch: string;
  commitSha?: string;
  sshKey?: string;
  accessToken?: string;
  shallow?: boolean;
  depth?: number;
}

export interface GitCloneResult {
  success: boolean;
  commitSha: string;
  branch: string;
  logs: string;
  error?: string;
}

export interface GitValidationResult {
  valid: boolean;
  provider?: 'github' | 'gitlab' | 'bitbucket' | 'other';
  protocol?: 'https' | 'ssh';
  error?: string;
}

export interface GitBranchInfo {
  name: string;
  commitSha: string;
  lastCommitMessage: string;
  lastCommitAuthor: string;
  lastCommitDate: Date;
}

export class GitIntegration {
  /**
   * Validate Git URL and branch access
   */
  static async validateGitUrl(repoUrl: string): Promise<GitValidationResult> {
    try {
      // Check for valid Git URL patterns
      const patterns = {
        github: {
          https: /^https:\/\/github\.com\/[\w-]+\/[\w.-]+(?:\.git)?$/,
          ssh: /^git@github\.com:[\w-]+\/[\w.-]+\.git$/,
        },
        gitlab: {
          https: /^https:\/\/gitlab\.com\/[\w-]+\/[\w.-]+(?:\.git)?$/,
          ssh: /^git@gitlab\.com:[\w-]+\/[\w.-]+\.git$/,
        },
        bitbucket: {
          https: /^https:\/\/bitbucket\.org\/[\w-]+\/[\w.-]+(?:\.git)?$/,
          ssh: /^git@bitbucket\.org:[\w-]+\/[\w.-]+\.git$/,
        },
      };

      // Detect provider and protocol
      let provider: 'github' | 'gitlab' | 'bitbucket' | 'other' = 'other';
      let protocol: 'https' | 'ssh' = 'https';

      for (const [providerName, providerPatterns] of Object.entries(patterns)) {
        if (providerPatterns.https.test(repoUrl)) {
          provider = providerName as any;
          protocol = 'https';
          break;
        }
        if (providerPatterns.ssh.test(repoUrl)) {
          provider = providerName as any;
          protocol = 'ssh';
          break;
        }
      }

      // Check for security issues
      if (repoUrl.includes('..') || repoUrl.includes('~')) {
        return {
          valid: false,
          error: 'Invalid Git URL: path traversal detected',
        };
      }

      // Check for command injection attempts
      if (repoUrl.includes(';') || repoUrl.includes('|') || repoUrl.includes('&')) {
        return {
          valid: false,
          error: 'Invalid Git URL: potential command injection detected',
        };
      }

      return {
        valid: true,
        provider,
        protocol,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown validation error',
      };
    }
  }

  /**
   * Validate branch access (check if branch exists)
   */
  static async validateBranchAccess(
    repoUrl: string,
    branch: string,
    options: { sshKey?: string; accessToken?: string } = {}
  ): Promise<{ accessible: boolean; error?: string }> {
    try {
      // Prepare authentication
      let authRepoUrl = repoUrl;
      if (options.accessToken && repoUrl.startsWith('https://')) {
        authRepoUrl = repoUrl.replace('https://', `https://oauth2:${options.accessToken}@`);
      }

      // Use git ls-remote to check branch without cloning
      const { stdout } = await execAsync(
        `git ls-remote --heads ${authRepoUrl} ${branch}`,
        {
          timeout: 30000, // 30 seconds
          env: {
            ...process.env,
            GIT_TERMINAL_PROMPT: '0',
          },
        }
      );

      if (!stdout || stdout.trim() === '') {
        return {
          accessible: false,
          error: `Branch '${branch}' not found in repository`,
        };
      }

      return { accessible: true };
    } catch (error) {
      return {
        accessible: false,
        error: error instanceof Error ? error.message : 'Failed to access branch',
      };
    }
  }

  /**
   * Clone repository with support for private repos via SSH keys/tokens
   */
  static async cloneRepository(
    repoUrl: string,
    targetDir: string,
    options: GitCloneOptions
  ): Promise<GitCloneResult> {
    let logs = '';

    try {
      // Validate URL
      const validation = await this.validateGitUrl(repoUrl);
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid Git URL');
      }

      logs += `[${new Date().toISOString()}] Cloning repository: ${repoUrl}\n`;
      logs += `[${new Date().toISOString()}] Branch: ${options.branch}\n`;
      logs += `[${new Date().toISOString()}] Protocol: ${validation.protocol}\n`;
      logs += `[${new Date().toISOString()}] Provider: ${validation.provider}\n`;

      // Prepare clone command
      let cloneCmd = 'git clone';

      // Shallow clone for faster builds
      if (options.shallow) {
        const depth = options.depth || 1;
        cloneCmd += ` --depth ${depth}`;
        logs += `[${new Date().toISOString()}] Using shallow clone (depth: ${depth})\n`;
      }

      cloneCmd += ` --branch ${options.branch}`;

      // Handle authentication
      let authRepoUrl = repoUrl;
      let sshKeyFile: string | undefined;

      if (validation.protocol === 'ssh' && options.sshKey) {
        // Create temporary SSH key file
        sshKeyFile = path.join('/tmp', `ssh-key-${Date.now()}`);
        await fs.writeFile(sshKeyFile, options.sshKey, { mode: 0o600 });
        logs += `[${new Date().toISOString()}] Using SSH key authentication\n`;

        // Set GIT_SSH_COMMAND to use the key
        cloneCmd = `GIT_SSH_COMMAND="ssh -i ${sshKeyFile} -o StrictHostKeyChecking=no" ${cloneCmd}`;
      } else if (validation.protocol === 'https' && options.accessToken) {
        // Inject access token for HTTPS URLs
        authRepoUrl = repoUrl.replace('https://', `https://oauth2:${options.accessToken}@`);
        logs += `[${new Date().toISOString()}] Using access token authentication\n`;
      }

      cloneCmd += ` ${authRepoUrl} ${targetDir}`;

      // Execute clone
      logs += `[${new Date().toISOString()}] Executing git clone...\n`;
      const { stdout, stderr } = await execAsync(cloneCmd, {
        timeout: 300000, // 5 minutes
        maxBuffer: 10 * 1024 * 1024,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0',
        },
      });

      logs += stdout || '';
      if (stderr) logs += stderr;
      logs += `[${new Date().toISOString()}] ✅ Repository cloned successfully\n`;

      // Get commit SHA
      const { stdout: commitShaOutput } = await execAsync('git rev-parse HEAD', { cwd: targetDir });
      const commitSha = commitShaOutput.trim();
      logs += `[${new Date().toISOString()}] Commit SHA: ${commitSha}\n`;

      // Get commit info for traceability
      const commitInfo = await this.getCommitInfo(targetDir, commitSha);
      logs += `[${new Date().toISOString()}] Commit message: ${commitInfo.message}\n`;
      logs += `[${new Date().toISOString()}] Commit author: ${commitInfo.author}\n`;
      logs += `[${new Date().toISOString()}] Commit date: ${commitInfo.date.toISOString()}\n`;

      // Cleanup SSH key file if created
      if (sshKeyFile) {
        await fs.unlink(sshKeyFile).catch(() => {});
      }

      return {
        success: true,
        commitSha,
        branch: options.branch,
        logs,
      };
    } catch (error) {
      logs += `[${new Date().toISOString()}] ❌ Failed to clone repository\n`;
      logs += error instanceof Error ? error.message : String(error);

      return {
        success: false,
        commitSha: '',
        branch: options.branch,
        logs,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get commit information for traceability
   */
  static async getCommitInfo(
    repoDir: string,
    commitSha: string
  ): Promise<{ message: string; author: string; date: Date; sha: string }> {
    try {
      // Get commit message
      const { stdout: message } = await execAsync(
        `git log -1 --format=%s ${commitSha}`,
        { cwd: repoDir }
      );

      // Get commit author
      const { stdout: author } = await execAsync(
        `git log -1 --format=%an ${commitSha}`,
        { cwd: repoDir }
      );

      // Get commit date
      const { stdout: dateStr } = await execAsync(
        `git log -1 --format=%aI ${commitSha}`,
        { cwd: repoDir }
      );

      return {
        message: message.trim(),
        author: author.trim(),
        date: new Date(dateStr.trim()),
        sha: commitSha,
      };
    } catch (error) {
      return {
        message: 'Unknown',
        author: 'Unknown',
        date: new Date(),
        sha: commitSha,
      };
    }
  }

  /**
   * List branches in repository
   */
  static async listBranches(
    repoUrl: string,
    options: { sshKey?: string; accessToken?: string } = {}
  ): Promise<GitBranchInfo[]> {
    try {
      // Prepare authentication
      let authRepoUrl = repoUrl;
      if (options.accessToken && repoUrl.startsWith('https://')) {
        authRepoUrl = repoUrl.replace('https://', `https://oauth2:${options.accessToken}@`);
      }

      // Get remote branches
      const { stdout } = await execAsync(
        `git ls-remote --heads ${authRepoUrl}`,
        {
          timeout: 30000,
          env: {
            ...process.env,
            GIT_TERMINAL_PROMPT: '0',
          },
        }
      );

      // Parse output
      const branches: GitBranchInfo[] = [];
      const lines = stdout.trim().split('\n');

      for (const line of lines) {
        const [commitSha, ref] = line.split('\t');
        const branchName = ref.replace('refs/heads/', '');

        branches.push({
          name: branchName,
          commitSha: commitSha.trim(),
          lastCommitMessage: '', // Would need to clone to get this
          lastCommitAuthor: '',
          lastCommitDate: new Date(),
        });
      }

      return branches;
    } catch (error) {
      console.error('Error listing branches:', error);
      return [];
    }
  }

  /**
   * Get latest commit SHA for a branch
   */
  static async getLatestCommitSha(
    repoUrl: string,
    branch: string,
    options: { sshKey?: string; accessToken?: string } = {}
  ): Promise<string | null> {
    try {
      // Prepare authentication
      let authRepoUrl = repoUrl;
      if (options.accessToken && repoUrl.startsWith('https://')) {
        authRepoUrl = repoUrl.replace('https://', `https://oauth2:${options.accessToken}@`);
      }

      // Get commit SHA for branch
      const { stdout } = await execAsync(
        `git ls-remote ${authRepoUrl} refs/heads/${branch}`,
        {
          timeout: 30000,
          env: {
            ...process.env,
            GIT_TERMINAL_PROMPT: '0',
          },
        }
      );

      if (!stdout || stdout.trim() === '') {
        return null;
      }

      const [commitSha] = stdout.trim().split('\t');
      return commitSha.trim();
    } catch (error) {
      console.error('Error getting latest commit SHA:', error);
      return null;
    }
  }

  /**
   * Check if repository is accessible
   */
  static async checkRepositoryAccess(
    repoUrl: string,
    options: { sshKey?: string; accessToken?: string } = {}
  ): Promise<{ accessible: boolean; error?: string }> {
    try {
      // Validate URL first
      const validation = await this.validateGitUrl(repoUrl);
      if (!validation.valid) {
        return {
          accessible: false,
          error: validation.error,
        };
      }

      // Prepare authentication
      let authRepoUrl = repoUrl;
      if (options.accessToken && repoUrl.startsWith('https://')) {
        authRepoUrl = repoUrl.replace('https://', `https://oauth2:${options.accessToken}@`);
      }

      // Try to list remote refs
      await execAsync(`git ls-remote ${authRepoUrl}`, {
        timeout: 30000,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0',
        },
      });

      return { accessible: true };
    } catch (error) {
      return {
        accessible: false,
        error: error instanceof Error ? error.message : 'Failed to access repository',
      };
    }
  }

  /**
   * Extract repository info from URL
   */
  static extractRepoInfo(repoUrl: string): {
    owner?: string;
    repo?: string;
    provider?: 'github' | 'gitlab' | 'bitbucket';
  } {
    try {
      // GitHub
      const githubMatch = repoUrl.match(/github\.com[:/]([\w-]+)\/([\w.-]+?)(?:\.git)?$/);
      if (githubMatch) {
        return {
          provider: 'github',
          owner: githubMatch[1],
          repo: githubMatch[2],
        };
      }

      // GitLab
      const gitlabMatch = repoUrl.match(/gitlab\.com[:/]([\w-]+)\/([\w.-]+?)(?:\.git)?$/);
      if (gitlabMatch) {
        return {
          provider: 'gitlab',
          owner: gitlabMatch[1],
          repo: gitlabMatch[2],
        };
      }

      // Bitbucket
      const bitbucketMatch = repoUrl.match(/bitbucket\.org[:/]([\w-]+)\/([\w.-]+?)(?:\.git)?$/);
      if (bitbucketMatch) {
        return {
          provider: 'bitbucket',
          owner: bitbucketMatch[1],
          repo: bitbucketMatch[2],
        };
      }

      return {};
    } catch (error) {
      return {};
    }
  }

  /**
   * Generate clone URL with authentication
   */
  static generateAuthenticatedUrl(
    repoUrl: string,
    accessToken: string
  ): string {
    if (repoUrl.startsWith('https://')) {
      return repoUrl.replace('https://', `https://oauth2:${accessToken}@`);
    }
    return repoUrl;
  }

  /**
   * Sanitize Git URL for logging (remove credentials)
   */
  static sanitizeUrlForLogging(repoUrl: string): string {
    // Remove access tokens from HTTPS URLs
    return repoUrl.replace(/https:\/\/[^@]+@/, 'https://***@');
  }
}
