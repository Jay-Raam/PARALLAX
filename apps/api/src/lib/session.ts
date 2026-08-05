import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

const COOKIE_NAME = "parallax_session";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SessionPayload {
  userId: string;
  workspaceId?: string;
  issuedAt: number;
}

function sign(data: string): string {
  return createHmac("sha256", env.SESSION_SECRET).update(data).digest("base64url");
}

export function createSessionCookie(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifySessionCookie(token: string): SessionPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) {
    logger.warn({ hasBody: Boolean(body), hasSig: Boolean(sig) }, "Session cookie malformed");
    return null;
  }
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    logger.warn("Session cookie signature verification failed");
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.userId) {
      logger.warn("Session cookie payload missing userId");
      return null;
    }
    return payload;
  } catch (e) {
    logger.warn({ err: e instanceof Error ? e.message : String(e) }, "Session cookie payload JSON parsing failed");
    return null;
  }
}

/**
 * Stateless one-time OAuth handoff token. Signed with the same secret as the
 * session cookie, so ANY api process can validate it — no shared in-memory
 * state, and it survives `tsx watch` restarts. Short-lived (10 min): long
 * enough to survive a slow GitHub sign-in (password entry, 2FA, consent
 * screen), short enough to be useless to an attacker who grabs the URL.
 */
export interface HandoffPayload {
  userId: string;
  workspaceId: string;
  exp: number;
}

const HANDOFF_TTL_MS = 10 * 60_000;

export function createHandoffToken(userId: string, workspaceId: string): string {
  const payload: HandoffPayload = { userId, workspaceId, exp: Date.now() + HANDOFF_TTL_MS };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyHandoffToken(token: string): HandoffPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) {
    logger.warn("Handoff token malformed");
    return null;
  }
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    logger.warn("Handoff token signature verification failed");
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as HandoffPayload;
    if (!payload.userId || !payload.workspaceId || typeof payload.exp !== "number") {
      logger.warn("Handoff token payload invalid structure");
      return null;
    }
    if (Date.now() > payload.exp) {
      logger.warn({ exp: payload.exp, now: Date.now() }, "Handoff token expired");
      return null; // expired
    }
    return payload;
  } catch (e) {
    logger.warn({ err: e instanceof Error ? e.message : String(e) }, "Handoff token payload JSON parsing failed");
    return null;
  }
}

/**
 * Stateless CSRF state token for the OAuth authorize step. Signed so any
 * process can validate it after the round-trip through GitHub — survives
 * restarts between /auth/github and /auth/github/callback.
 */
export function createStateToken(nonce: string, ttlMs = 10 * 60_000): string {
  const body = Buffer.from(JSON.stringify({ n: nonce, exp: Date.now() + ttlMs }), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyStateToken(token: string): boolean {
  const [body, sig] = token.split(".");
  if (!body || !sig) return false;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { exp?: number };
    return typeof payload.exp === "number" && Date.now() <= payload.exp;
  } catch {
    return false;
  }
}

export function readSession(req: Request): SessionPayload | null {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token || typeof token !== "string") return null;
  return verifySessionCookie(token);
}

export function writeSession(res: Response, payload: SessionPayload): void {
  const token = createSessionCookie(payload);

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: Boolean(res.req.secure),
    sameSite: "lax",
    maxAge: MAX_AGE_MS,
    path: "/",
  });
}

export function clearSession(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    path: "/",
    secure: Boolean(res.req.secure),
    sameSite: "lax",
  });
}
