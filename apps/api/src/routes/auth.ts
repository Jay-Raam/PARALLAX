import { randomBytes } from "node:crypto";
import { Router } from "express";
import { env, githubOAuthEnabled } from "../config/env.js";
import { logger } from "../config/logger.js";
import { User } from "../models/user.js";
import { Workspace, WorkspaceMember } from "../models/workspace.js";
import { GitHubAccount } from "../models/githubAccount.js";
import { encryptSecret } from "../lib/encryption.js";
import { createHandoffToken, verifyHandoffToken, writeSession, createStateToken, verifyStateToken } from "../lib/session.js";
import { AppError } from "../lib/errors.js";

// No server-side state store for OAuth: the `state` nonce is a signed,
// expiring token (validated by signature, so it survives restarts), and the
// session handoff is a signed token too. This avoids relying on SameSite=Lax
// cookies, which Chrome drops when github.com cross-site-redirects back to
// localhost, AND avoids shared in-memory state between processes.

export const authRouter = Router();

authRouter.get("/github", (req, res) => {
  if (!githubOAuthEnabled) {
    res.status(400).json({ error: { code: "OAUTH_DISABLED", message: "GitHub OAuth is not configured. Use demo login instead." } });
    return;
  }
  const state = createStateToken(randomBytes(24).toString("hex"));
  logger.info({ statePrefix: state.slice(0, 8) }, "OAuth state generated (signed token)");
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: env.GITHUB_OAUTH_REDIRECT_URI,
    scope: "read:user user:email repo read:org",
    state,
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
});

authRouter.get("/github/callback", async (req, res) => {
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;

  const stateValid = state ? verifyStateToken(state) : false;

  logger.info(
    {
      hasCode: Boolean(code),
      hasReturnedState: Boolean(state),
      stateValid,
      statePrefix: state ? state.slice(0, 8) : undefined,
      requestHost: req.get("host"),
      protocol: req.protocol,
    },
    "OAuth callback state diagnostics",
  );

  if (!code) {
    res.status(400).json({ error: { code: "OAUTH_ERROR", message: "Missing authorization code" } });
    return;
  }
  if (!state || !stateValid) {
    res.status(400).json({ error: { code: "OAUTH_STATE_MISMATCH", message: "Invalid OAuth state" } });
    return;
  }

  if (!githubOAuthEnabled) {
    res.status(400).json({ error: { code: "OAUTH_DISABLED", message: "GitHub OAuth is not configured" } });
    return;
  }

  try {
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: env.GITHUB_OAUTH_REDIRECT_URI,
      }),
    });
    const tokenData = (await tokenResponse.json()) as { access_token?: string; error?: string };
    if (!tokenData.access_token) {
      throw new AppError(`GitHub OAuth exchange failed: ${tokenData.error ?? "unknown"}`, "GITHUB_OAUTH_ERROR", 401);
    }

    const profile = (await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, "User-Agent": "parallax" },
    }).then((r) => r.json())) as { id: number; login: string; name: string | null; email: string | null; avatar_url: string | null };

    const email = profile.email ?? `${profile.login}@users.noreply.github.com`;

    let user = await User.findOne({ email }).lean().exec();
    if (!user) {
      const created = await User.create({
        email,
        name: profile.name ?? profile.login,
        githubLogin: profile.login,
        githubId: profile.id,
        avatarUrl: profile.avatar_url ?? undefined,
      });
      user = await User.findById(created._id).lean().exec();
    } else {
      await User.updateOne(
        { _id: user._id },
        { $set: { githubLogin: profile.login, githubId: profile.id, avatarUrl: profile.avatar_url ?? undefined } },
      ).exec();
    }

    const existing = await GitHubAccount.findOne({ userId: user!._id }).lean().exec();
    if (existing) {
      await GitHubAccount.updateOne(
        { _id: existing._id },
        { $set: { accessTokenEncrypted: encryptSecret(tokenData.access_token), githubLogin: profile.login, connectedAt: new Date() } },
      ).exec();
    } else {
      await GitHubAccount.create({
        userId: user!._id,
        githubLogin: profile.login,
        githubId: profile.id,
        accessTokenEncrypted: encryptSecret(tokenData.access_token),
      });
    }

    const membership = await WorkspaceMember.findOne({ userId: user!._id }).sort({ joinedAt: 1 }).lean().exec();
    let workspace = membership ? await Workspace.findById(membership.workspaceId).lean().exec() : null;
    if (!workspace) {
      const slug = `workspace-${user!._id.toString().slice(-6)}`;
      const created = await Workspace.create({ name: "Demo Workspace", slug, ownerId: user!._id, settings: {} });
      await WorkspaceMember.create({ workspaceId: created._id, userId: user!._id, role: "OWNER" });
      workspace = await Workspace.findById(created._id).lean().exec();
    }

    // Do NOT set the session cookie here: this response is inside the cross-site
    // github.com -> localhost redirect chain and Chrome would drop it. Instead
    // issue a short-lived SIGNED handoff token that the web app exchanges via a
    // same-site request (/auth/handoff), which is where the cookie is written.
    // Stateless on purpose: any API process (or a process restarted by tsx watch
    // between callback and exchange) can validate the signature without shared state.
    const handoff = createHandoffToken(String(user!._id), String(workspace!._id));

    logger.info(
      {
        userId: String(user!._id),
        login: profile.login,
        workspaceId: String(workspace!._id),
        handoffPrefix: handoff.slice(0, 8),
        redirectTarget: `${env.CORS_ORIGIN}/onboarding`,
      },
      "GitHub OAuth login complete, handoff issued",
    );
    res.redirect(`${env.CORS_ORIGIN}/onboarding?handoff=${handoff}`);
  } catch (err) {
    logger.error({ err: (err as Error).message }, "OAuth callback failed");
    res.status(500).json({ error: { code: "OAUTH_ERROR", message: "GitHub authorization failed" } });
  }
});

authRouter.get("/status", (req, res) => {
  res.json({ enabled: githubOAuthEnabled });
});

/**
 * Handoff exchange. Called by the web app via a same-site fetch
 * (localhost:3000 -> localhost:4000), so the session cookie set here is
 * accepted by the browser. The token is a signed, expiring value — verifying
 * the signature needs no shared state, so this works even if the API restarted
 * or the exchange hits a different process than the callback.
 */
authRouter.get("/handoff", (req, res) => {
  const code = req.query.code as string | undefined;
  const payload = code ? verifyHandoffToken(code) : null;
  logger.info(
    {
      hasCode: Boolean(code),
      codePrefix: code ? code.slice(0, 8) : undefined,
      valid: Boolean(payload),
      reason: !code ? "missing" : !payload ? "invalid_or_expired" : "ok",
    },
    "OAuth handoff exchange attempted",
  );
  if (!payload) {
    res.status(400).json({ error: { code: "INVALID_HANDOFF", message: "Invalid or expired login handoff. Please sign in again." } });
    return;
  }
  writeSession(res, { userId: payload.userId, workspaceId: payload.workspaceId, issuedAt: Date.now() });
  logger.info({ userId: payload.userId, workspaceId: payload.workspaceId }, "OAuth handoff exchanged, session cookie written");
  res.json({ ok: true });
});
