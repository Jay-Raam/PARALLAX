"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { API_ORIGIN } from "@/lib/gql";
import { fetchMe, fetchWorkspaces } from "@/graphql/queries/auth";
import { login as loginMutation, logout as logoutMutation, switchWorkspace as switchWorkspaceMutation } from "@/graphql/mutations";
import type { User, Workspace } from "@/types/graphql";

const WORKSPACE_KEY = "parallax.activeWorkspace";

interface SessionContextValue {
  user: User | null;
  workspaces: Workspace[];
  workspace: Workspace | null;
  loading: boolean;
  error: string | null;
  login: (email: string) => Promise<Workspace>;
  logout: () => Promise<void>;
  switchWorkspace: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // One-time OAuth handoff: the GitHub callback cannot set the session
      // cookie inside the cross-site redirect chain (Chrome drops SameSite=Lax
      // cookies there), so it redirects here with ?handoff=<code>. Exchange it
      // via a same-site request before fetching the session.
      let hadHandoff = false;
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const handoff = params.get("handoff");
        if (handoff) {
          hadHandoff = true;
          try {
            const exchange = await fetch(`${API_ORIGIN}/auth/handoff?code=${encodeURIComponent(handoff)}`, { credentials: "include" });
            console.info("[session] handoff exchange", exchange.status, exchange.ok ? "ok" : "failed");
            // Allow browser a moment to commit the cookie to the cookie jar
            await new Promise((resolve) => setTimeout(resolve, 150));
          } catch (e) {
            console.warn("[session] handoff exchange threw", e);
          }
          params.delete("handoff");
          const qs = params.toString();
          window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
        }
      }
      let me = null;
      let ws: Workspace[] = [];
      try {
        const [meRes, wsRes] = await Promise.all([fetchMe(), fetchWorkspaces()]);
        me = meRes;
        ws = wsRes;
      } catch (e) {
        console.warn("[session] initial session fetch failed", e);
      }

      if (!me && hadHandoff) {
        console.info("[session] me is null after handoff, retrying in 500ms to allow cookie to commit...");
        await new Promise((resolve) => setTimeout(resolve, 500));
        try {
          const [meRes, wsRes] = await Promise.all([fetchMe(), fetchWorkspaces()]);
          me = meRes;
          ws = wsRes;
          console.info("[session] retry result:", me ? "success" : "failed");
        } catch (e) {
          console.warn("[session] retry session fetch failed", e);
        }
      }

      if (!me) {
        setUser(null);
        setWorkspaces([]);
        return;
      }
      setUser(me);
      setWorkspaces(ws);
      const stored = typeof window !== "undefined" ? window.localStorage.getItem(WORKSPACE_KEY) : null;
      const target = stored && ws.some((w) => w.id === stored) ? stored : (ws[0]?.id ?? null);
      if (target && target !== stored) {
        window.localStorage.setItem(WORKSPACE_KEY, target);
      }
      setActiveWorkspaceId(target);
      if (stored && target !== stored) {
        // server session cookie may point elsewhere — align it
        try {
          await switchWorkspaceMutation(target);
        } catch {
          /* non-fatal */
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load session");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const login = useCallback(
    async (email: string) => {
      const payload = await loginMutation(email);
      setUser(payload.user);
      const ws = await fetchWorkspaces();
      setWorkspaces(ws);
      const target = ws[0]?.id ?? payload.workspace.id;
      window.localStorage.setItem(WORKSPACE_KEY, target);
      setActiveWorkspaceId(target);
      return payload.workspace;
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await logoutMutation();
    } catch {
      /* ignore */
    }
    window.localStorage.removeItem(WORKSPACE_KEY);
    setUser(null);
    setWorkspaces([]);
    setActiveWorkspaceId(null);
    router.push("/login");
  }, [router]);

  const switchWorkspace = useCallback(async (id: string) => {
    await switchWorkspaceMutation(id);
    window.localStorage.setItem(WORKSPACE_KEY, id);
    setActiveWorkspaceId(id);
  }, []);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  const workspace = useMemo(() => workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0] ?? null, [workspaces, activeWorkspaceId]);

  const value = useMemo(
    () => ({ user, workspaces, workspace, loading, error, login, logout, switchWorkspace, refresh }),
    [user, workspaces, workspace, loading, error, login, logout, switchWorkspace, refresh],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
