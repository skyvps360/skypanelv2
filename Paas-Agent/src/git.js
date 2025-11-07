import simpleGit from 'simple-git';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const WORKSPACE_DIR = process.env.WORKSPACE_DIR || join(__dirname, '..', 'workspaces');

export async function cloneRepository(taskData) {
  const { appId, gitRepoUrl, gitBranch, gitOAuthToken } = taskData;
  const workspacePath = join(WORKSPACE_DIR, `app-${appId}`);

  logger.info(`📦 Cloning repository: ${gitRepoUrl} (${gitBranch})`);

  // Clean up existing workspace
  if (existsSync(workspacePath)) {
    rmSync(workspacePath, { recursive: true, force: true });
  }

  mkdirSync(workspacePath, { recursive: true });

  try {
    const git = simpleGit();

    // Build repo URL with auth token if provided
    let repoUrl = gitRepoUrl;
    if (gitOAuthToken && gitRepoUrl.startsWith('https://')) {
      // Insert token into URL
      repoUrl = gitRepoUrl.replace('https://', `https://${gitOAuthToken}@`);
    }

    await git.clone(repoUrl, workspacePath, ['--branch', gitBranch, '--single-branch', '--depth', '1']);

    // Get commit info
    const gitRepo = simpleGit(workspacePath);
    const log = await gitRepo.log(['-1']);
    const latestCommit = log.latest;

    logger.info(`✅ Repository cloned: ${latestCommit.hash.substring(0, 7)}`);

    return {
      success: true,
      workspacePath,
      commitSha: latestCommit.hash,
      commitMessage: latestCommit.message,
    };
  } catch (error) {
    logger.error(`❌ Clone failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

export function getWorkspacePath(appId) {
  return join(WORKSPACE_DIR, `app-${appId}`);
}

export function cleanupWorkspace(appId) {
  const workspacePath = getWorkspacePath(appId);
  if (existsSync(workspacePath)) {
    logger.info(`🧹 Cleaning up workspace: ${workspacePath}`);
    rmSync(workspacePath, { recursive: true, force: true });
  }
}
