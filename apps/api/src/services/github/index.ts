import { GitHubAccount } from "../../models/githubAccount.js";
import { decryptSecret } from "../../lib/encryption.js";
import { MockGitHubClient } from "./mock.js";
import { RealGitHubClient } from "./real.js";
import type { GitHubClient } from "./types.js";
import { NotFoundError } from "../../lib/errors.js";

export type { GitHubClient } from "./types.js";

export function createMockGitHubClient(): GitHubClient {
  return new MockGitHubClient();
}

export async function createGitHubClientForUser(userId: string): Promise<GitHubClient> {
  const account = await GitHubAccount.findOne({ userId }).lean().exec();
  if (!account) {
    return new MockGitHubClient();
  }
  try {
    const token = decryptSecret(account.accessTokenEncrypted);
    return new RealGitHubClient(token, {
      login: account.githubLogin,
      name: account.githubLogin,
    });
  } catch {
    // fall back to mock mode if the stored token cannot be decrypted
    return new MockGitHubClient();
  }
}

export async function requireGitHubClient(userId: string): Promise<GitHubClient> {
  const account = await GitHubAccount.findOne({ userId }).lean().exec();
  if (!account) {
    throw new NotFoundError("No GitHub account connected. Connect GitHub to sync repositories.");
  }
  const token = decryptSecret(account.accessTokenEncrypted);
  return new RealGitHubClient(token, {
    login: account.githubLogin,
    name: account.githubLogin,
  });
}

export function isMockMode(client: GitHubClient): boolean {
  return client.mode === "mock";
}
