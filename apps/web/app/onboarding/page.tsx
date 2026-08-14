"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Github, FolderGit2, ArrowRight, Layers, Loader2, Package, GitPullRequest, GitCommitHorizontal, Rocket } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/providers/session";
import { API_ORIGIN } from "@/lib/gql";
import { fetchAvailableRepositories, fetchRepositories, fetchSyncJob } from "@/graphql/queries/repositories";
import { fetchOverview } from "@/graphql/queries/overview";
import { connectRepository, syncWorkspace } from "@/graphql/mutations";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import type { SyncJob } from "@/types/graphql";

type Step = 1 | 2 | 3 | 4;

const PHASES = ["github", "repositories", "commits", "pull_requests", "issues", "dependencies", "security", "workflows", "deployments", "releases", "contributors"];

const PHASE_LABEL: Record<string, string> = {
  github: "Connected GitHub",
  repositories: "Fetching repositories",
  commits: "Analyzing commits",
  pull_requests: "Processing pull requests",
  issues: "Processing issues",
  dependencies: "Mapping dependencies",
  security: "Scanning security alerts",
  workflows: "Loading CI/CD runs",
  deployments: "Tracking deployments",
  releases: "Indexing releases",
  contributors: "Counting contributors",
};

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading } = useSession();
  const [step, setStep] = useState<Step>(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [jobs, setJobs] = useState<Record<string, SyncJob>>({});
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof fetchOverview>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const startedRef = useRef(false);

  const { data: available } = useQuery({
    queryKey: ["available-repositories"],
    queryFn: fetchAvailableRepositories,
    enabled: step >= 2,
    staleTime: 60_000,
  });

  const { data: repos } = useQuery({
    queryKey: ["repositories", "onboarding"],
    queryFn: () => fetchRepositories(undefined, { first: 50 }),
    enabled: step >= 3,
  });

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (user?.githubLogin && step === 1) {
      setStep(2);
    }
  }, [user, step]);

  const repositoryIds = useMemo(() => (repos?.edges ?? []).map((e) => e.node.id), [repos]);

  const handleSync = useCallback(
    async (ids: string[]) => {
      if (startedRef.current) return;
      startedRef.current = true;
      setStep(3);
      setError(null);
      try {
        const queued = await syncWorkspace();
        const byRepo: Record<string, SyncJob> = {};
        for (const q of queued) byRepo[q.repositoryId] = q;
        setJobs(byRepo);

        // Poll sync job status every 3 seconds instead of using WebSocket subscriptions
        const pollInterval = setInterval(async () => {
          try {
            const results = await Promise.all(
              ids.map((id) => fetchSyncJob(id).then((job) => ({ id, job }))),
            );
            const updated: Record<string, SyncJob> = {};
            let allDone = true;
            for (const { id, job } of results) {
              if (job) {
                updated[id] = job;
                if (job.status !== "COMPLETED" && job.status !== "FAILED") {
                  allDone = false;
                }
              } else {
                allDone = false;
              }
            }
            setJobs((prev) => ({ ...prev, ...updated }));
            if (allDone && Object.keys(updated).length >= ids.length) {
              clearInterval(pollInterval);
            }
          } catch {
            // Silently retry on next interval
          }
        }, 3000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Sync failed to start");
        setBusy(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (step !== 3 || !repositoryIds.length) return;
    const all = Object.values(jobs);
    if (all.length === 0) return;
    const done = all.filter((j) => j.status === "COMPLETED" || j.status === "FAILED").length;
    if (done === all.length && all.length >= repositoryIds.length) {
      const t = setTimeout(async () => {
        try {
          setOverview(await fetchOverview());
          setStep(4);
        } catch {
          setStep(4);
        }
      }, 600);
      return () => clearTimeout(t);
    }
  }, [jobs, repositoryIds.length, step]);

  const progress = useMemo(() => {
    const vals = Object.values(jobs);
    if (!vals.length) return { percent: 0, phase: "queued", current: 0, total: 0 };
    const percent = Math.round(vals.reduce((s, j) => s + (j.progress?.percent ?? 0), 0) / vals.length);
    const current = vals.reduce((s, j) => s + (j.progress?.current ?? 0), 0);
    const total = vals.reduce((s, j) => s + (j.progress?.total ?? 0), 0);
    const running = vals.find((j) => j.status === "RUNNING");
    return { percent, phase: running?.progress?.phase ?? "complete", current, total };
  }, [jobs]);

  if (loading || !user) return null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex items-center justify-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-accent text-accent-foreground">
            <Layers className="h-3.5 w-3.5" />
          </span>
          <span className="text-[15px] font-semibold tracking-[0.18em]">PARALLAX</span>
        </div>

        <AnimatePresence mode="wait">
          {/* STEP 1 — connect */}
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="panel p-6 text-center">
              <h1 className="text-lg font-semibold tracking-tight">Welcome to PARALLAX</h1>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">
                Your engineering system starts with GitHub. Connect an account to measure health, risk and delivery across your repositories.
              </p>
              <div className="mt-6 flex flex-col gap-2.5">
                <a href={`${API_ORIGIN}/auth/github`} className="btn btn-primary btn-md w-full gap-2">
                  <Github className="h-4 w-4" /> Connect GitHub
                </a>
                <Button variant="outline" className="w-full" onClick={() => setStep(2)}>
                  Continue with demo data
                </Button>
              </div>
            </motion.div>
          )}

          {/* STEP 2 — select repositories */}
          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="panel">
              <div className="border-b border-border p-5">
                <h1 className="text-lg font-semibold tracking-tight">Select repositories</h1>
                <p className="mt-1 text-[13px] text-muted">Choose which repositories to include in this workspace.</p>
              </div>
              <div className="max-h-80 divide-y divide-border overflow-y-auto scroll-thin">
                {available?.map((r) => {
                  const on = selected.has(r.githubId) || r.connected;
                  return (
                    <button
                      key={r.githubId}
                      className={cn("flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-raised", on && "bg-accent-dim/20")}
                      onClick={() => {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (on) next.delete(r.githubId);
                          else next.add(r.githubId);
                          return next;
                        });
                      }}
                      disabled={r.connected}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-xs border",
                          on ? "border-accent bg-accent text-accent-foreground" : "border-border-strong bg-raised",
                        )}
                        role="checkbox"
                        aria-checked={on}
                      >
                        {on && <Check className="h-3 w-3" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-[13px] font-medium text-foreground">{r.name}</span>
                        {r.description && <span className="block truncate text-xs text-muted">{r.description}</span>}
                      </span>
                      {r.language && <span className="shrink-0 font-mono text-[10.5px] text-faint">{r.language}</span>}
                      {r.connected && <span className="shrink-0 rounded-sm border border-success/30 bg-success/10 px-1.5 py-0.5 text-[10px] text-success">connected</span>}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between border-t border-border p-4">
                <p className="text-xs text-muted">
                  {selected.size + (available?.filter((r) => r.connected).length ?? 0)} selected
                </p>
                <Button
                  variant="primary"
                  disabled={selected.size === 0 && !(available?.some((r) => r.connected))}
                  loading={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      for (const githubId of selected) {
                        await connectRepository(githubId);
                      }
                      const q = await fetchRepositories(undefined, { first: 50 });
                      const ids = q.edges.map((e) => e.node.id);
                      if (ids.length === 0) {
                        setStep(4);
                        setBusy(false);
                        return;
                      }
                      await handleSync(ids);
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Failed to connect repositories");
                      setBusy(false);
                    }
                  }}
                >
                  Continue <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* STEP 3 — sync progress */}
          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="panel p-6">
              <h1 className="text-lg font-semibold tracking-tight">Preparing your engineering workspace</h1>
              <p className="mt-1 text-[13px] text-muted">Synchronizing repositories in the background. This page updates in real time.</p>

              <div className="mt-5">
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-3xl font-semibold text-accent">{progress.percent}%</span>
                  <span className="font-mono text-[11px] text-subtle">
                    {progress.current.toLocaleString()} / {progress.total.toLocaleString()}
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-raised">
                  <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${progress.percent}%` }} />
                </div>
              </div>

              <ul className="mt-6 space-y-2">
                {PHASES.map((p) => {
                  const done = progress.percent >= 100 || PHASES.indexOf(p) < PHASES.indexOf(progress.phase);
                  const active = p === progress.phase;
                  return (
                    <li key={p} className="flex items-center gap-2.5 text-[13px]">
                      {done ? (
                        <Check className="h-4 w-4 text-success" />
                      ) : active ? (
                        <Loader2 className="h-4 w-4 animate-spin text-accent" />
                      ) : (
                        <span className="h-4 w-4 rounded-full border border-border-strong" />
                      )}
                      <span className={cn(done ? "text-muted" : active ? "text-foreground" : "text-faint")}>
                        {PHASE_LABEL[p] ?? p}
                      </span>
                    </li>
                  );
                })}
              </ul>

              {error && <p className="mt-4 rounded-sm border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">{error}</p>}
            </motion.div>
          )}

          {/* STEP 4 — complete */}
          {step === 4 && (
            <motion.div key="s4" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="panel p-6 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-success/30 bg-success/10 text-success">
                <Check className="h-6 w-6" />
              </span>
              <h1 className="mt-4 text-lg font-semibold tracking-tight">Your engineering workspace is ready</h1>
              <p className="mt-1 text-[13px] text-muted">PARALLAX is now measuring and explaining your software system.</p>

              <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { icon: FolderGit2, label: "Repositories", value: overview?.repositories },
                  { icon: GitCommitHorizontal, label: "Commits (30d)", value: overview?.commits30d },
                  { icon: GitPullRequest, label: "Open PRs", value: overview?.openPrs },
                  { icon: Package, label: "Security alerts", value: overview?.securityAlerts },
                ].map((s) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className="rounded-sm border border-border bg-raised p-3">
                      <Icon className="mx-auto h-4 w-4 text-accent" />
                      <p className="mt-1.5 font-mono text-xl font-semibold">{s.value ?? "—"}</p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-wider text-faint">{s.label}</p>
                    </div>
                  );
                })}
              </div>

              <Button variant="primary" className="mt-6 w-full gap-2" onClick={() => router.push("/overview")}>
                <Rocket className="h-4 w-4" /> Open PARALLAX
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
