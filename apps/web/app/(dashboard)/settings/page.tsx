"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, Github, Plus, Trash2, RefreshCw, TerminalSquare } from "lucide-react";
import { useSession } from "@/providers/session";
import { fetchMembers, fetchGitHubAccount } from "@/graphql/queries/auth";
import { fetchRepositories } from "@/graphql/queries/repositories";
import { fetchNotificationPreferences, fetchAuditLogs } from "@/graphql/queries/recommendations";
import {
  addMember,
  disconnectGitHub,
  disconnectRepository,
  removeMember,
  syncRepository,
  updateMemberRole,
  updateNotificationPreferences,
  updateProfile,
  updateWorkspace,
} from "@/graphql/mutations";
import { API_ORIGIN, GRAPHQL_URL } from "@/lib/gql";
import { PageHeader } from "@/components/ui/primitives";
import { Card, CardHeader, Button, Input, Select } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/tabs";
import { LoadingRows } from "@/components/ui/feedback";
import { SyncStatusBadge } from "@/components/ui/badges";
import { formatDateTime, initials, timeAgo } from "@/lib/utils";
import type { NotificationType, Role } from "@/types/graphql";

type Tab = "profile" | "workspace" | "github" | "repositories" | "notifications" | "security" | "api";

const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email"),
});
const workspaceSchema = z.object({
  name: z.string().min(1, "Workspace name is required"),
  slug: z.string().regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only"),
  timezone: z.string().optional(),
});

const ALL_TYPES: NotificationType[] = [
  "PR_RISK",
  "SECURITY_VULNERABILITY",
  "CI_FAILURE",
  "DEPLOYMENT_FAILURE",
  "HEALTH_DROP",
  "DEPENDENCY_VULNERABILITY",
  "RECOMMENDATION",
  "SYNC_COMPLETE",
];

export default function SettingsPage() {
  return (
    <Suspense fallback={<LoadingRows rows={6} columns={3} />}>
      <SettingsInner />
    </Suspense>
  );
}

function SettingsInner() {
  const params = useSearchParams();
  const initial = (params.get("tab") as Tab | null) ?? "profile";
  const [tab, setTab] = useState<Tab>(["profile", "workspace", "github", "repositories", "notifications", "security", "api"].includes(initial) ? initial : "profile");
  const { user, workspace, refresh } = useSession();

  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name ?? "", email: user?.email ?? "" },
  });
  const workspaceForm = useForm({
    resolver: zodResolver(workspaceSchema),
    defaultValues: {
      name: workspace?.name ?? "",
      slug: workspace?.slug ?? "",
      timezone: workspace?.settings?.timezone ?? "UTC",
    },
  });

  const { data: members } = useQuery({ queryKey: ["members"], queryFn: fetchMembers, placeholderData: (prev) => prev });
  const { data: githubAccount } = useQuery({ queryKey: ["github-account"], queryFn: fetchGitHubAccount, placeholderData: (prev) => prev });
  const { data: repos } = useQuery({ queryKey: ["repositories", "settings"], queryFn: () => fetchRepositories(undefined, { first: 100 }), placeholderData: (prev) => prev });
  const { data: prefs } = useQuery({ queryKey: ["notification-prefs"], queryFn: fetchNotificationPreferences, placeholderData: (prev) => prev });
  const { data: auditLogs } = useQuery({ queryKey: ["audit-logs"], queryFn: () => fetchAuditLogs({ first: 30 }), placeholderData: (prev) => prev });

  const queryClient = useQueryClient();
  const invalidate = (keys: string[][]) => keys.forEach((k) => void queryClient.invalidateQueries({ queryKey: k }));

  const tabs: Array<{ value: Tab; label: string }> = [
    { value: "profile", label: "Profile" },
    { value: "workspace", label: "Workspace" },
    { value: "github", label: "GitHub" },
    { value: "repositories", label: "Repositories" },
    { value: "notifications", label: "Notifications" },
    { value: "security", label: "Security" },
    { value: "api", label: "API" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" subtitle="Profile, workspace, integrations and preferences." />

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === "profile" && (
        <div className="max-w-lg">
          <Card>
            <CardHeader title="Profile" subtitle="How you appear across PARALLAX" />
            <form
              className="space-y-3 p-4"
              onSubmit={profileForm.handleSubmit(async (v) => {
                await updateProfile(v);
                invalidate([["me"]]);
              })}
            >
              <div>
                <label className="label" htmlFor="p-name">Name</label>
                <Input id="p-name" className="mt-1" {...profileForm.register("name")} />
                {profileForm.formState.errors.name && <p className="mt-1 text-[11px] text-danger">{profileForm.formState.errors.name.message}</p>}
              </div>
              <div>
                <label className="label" htmlFor="p-email">Email</label>
                <Input id="p-email" className="mt-1" type="email" {...profileForm.register("email")} />
                {profileForm.formState.errors.email && <p className="mt-1 text-[11px] text-danger">{profileForm.formState.errors.email.message}</p>}
              </div>
              <div className="flex justify-end">
                <Button variant="primary" type="submit" loading={profileForm.formState.isSubmitting}>Save changes</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {tab === "workspace" && (
        <div className="grid gap-3 xl:grid-cols-2">
          <Card>
            <CardHeader title="Workspace" subtitle={`${workspace?.name ?? ""} · ${workspace?.slug ?? ""}`} />
            <form
              className="space-y-3 p-4"
              onSubmit={workspaceForm.handleSubmit(async (v) => {
                if (!workspace) return;
                await updateWorkspace(workspace.id, { name: v.name, slug: v.slug, settings: { timezone: v.timezone } });
                await refresh();
              })}
            >
              <div>
                <label className="label" htmlFor="w-name">Name</label>
                <Input id="w-name" className="mt-1" {...workspaceForm.register("name")} />
                {workspaceForm.formState.errors.name && <p className="mt-1 text-[11px] text-danger">{workspaceForm.formState.errors.name.message}</p>}
              </div>
              <div>
                <label className="label" htmlFor="w-slug">Slug</label>
                <Input id="w-slug" className="mt-1 font-mono" {...workspaceForm.register("slug")} />
                {workspaceForm.formState.errors.slug && <p className="mt-1 text-[11px] text-danger">{workspaceForm.formState.errors.slug.message}</p>}
              </div>
              <div>
                <label className="label" htmlFor="w-tz">Timezone</label>
                <Select id="w-tz" className="mt-1" {...workspaceForm.register("timezone")}>
                  {["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Asia/Kolkata", "Asia/Singapore", "Australia/Sydney"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </Select>
              </div>
              <div className="flex justify-end">
                <Button variant="primary" type="submit" loading={workspaceForm.formState.isSubmitting}>Save workspace</Button>
              </div>
            </form>
          </Card>

          <Card>
            <CardHeader title="Members" subtitle="Roles: OWNER, ADMIN, MEMBER, VIEWER" />
            <div className="divide-y divide-border">
              {(members ?? []).map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-raised font-mono text-[10px] text-muted">{initials(m.user.name)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-foreground">{m.user.name ?? m.user.email}</p>
                    <p className="truncate font-mono text-[10.5px] text-subtle">{m.user.email}</p>
                  </div>
                  <Select
                    value={m.role}
                    onChange={(e) => void updateMemberRole({ userId: m.userId, role: e.target.value as Role }).then(() => invalidate([["members"]]))}
                    className="w-auto min-w-28 py-1 text-xs"
                    aria-label={`Role for ${m.user.name}`}
                  >
                    {["OWNER", "ADMIN", "MEMBER", "VIEWER"].map((r) => <option key={r} value={r}>{r}</option>)}
                  </Select>
                  {m.userId !== user?.id && (
                    <button className="rounded-sm p-1 text-faint hover:bg-danger/10 hover:text-danger" onClick={() => void removeMember(m.userId).then(() => invalidate([["members"]]))} aria-label={`Remove ${m.user.name}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <AddMemberForm onAdded={() => invalidate([["members"]])} />
          </Card>
        </div>
      )}

      {tab === "github" && (
        <div className="max-w-lg">
          <Card>
            <CardHeader title="GitHub" subtitle="OAuth connection used for synchronization" />
            <div className="p-4">
              {githubAccount ? (
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-raised text-accent">
                    <Github className="h-4 w-4" />
                  </span>
                  <div className="flex-1">
                    <p className="text-[13px] font-medium text-foreground">@{githubAccount.githubLogin}</p>
                    <p className="font-mono text-[10.5px] text-subtle">
                      connected {timeAgo(githubAccount.connectedAt)}
                      {githubAccount.lastSyncAt ? ` · last sync ${timeAgo(githubAccount.lastSyncAt)}` : ""}
                    </p>
                  </div>
                  <Button variant="danger" size="sm" onClick={() => void disconnectGitHub().then(() => invalidate([["github-account"]]))}>
                    Disconnect
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-[13px] text-muted">
                    No GitHub account connected. Connect one to sync real repository data. Without it, PARALLAX runs against the mock data source.
                  </p>
                  <a href={`${API_ORIGIN}/auth/github`} className="btn btn-primary btn-sm gap-2">
                    <Github className="h-3.5 w-3.5" /> Connect GitHub
                  </a>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {tab === "repositories" && (
        <Card className="overflow-hidden">
          <CardHeader title="Connected repositories" subtitle={`${repos?.totalCount ?? 0} repositories`} />
          <div className="divide-y divide-border">
            {(repos?.edges ?? []).map((e) => {
              const r = e.node;
              return (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[13px] font-medium text-foreground">{r.name}</p>
                    <p className="truncate text-[11px] text-subtle">
                      {r.language ?? "unknown"} · last synced {timeAgo(r.lastSyncedAt)} · source {r.source}
                    </p>
                  </div>
                  <SyncStatusBadge status={r.syncStatus} />
                  <Button variant="ghost" size="sm" onClick={() => void syncRepository(r.id, true)} title="Sync now">
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-faint hover:text-danger" onClick={() => void disconnectRepository(r.id).then(() => invalidate([["repositories"]]))} title="Disconnect">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
            {(repos?.edges ?? []).length === 0 && <p className="px-4 py-8 text-center text-xs text-muted">No repositories connected.</p>}
          </div>
        </Card>
      )}

      {tab === "notifications" && (
        <div className="max-w-lg">
          <Card>
            <CardHeader title="Notifications" subtitle="Which events should appear in your notification center" />
            <div className="space-y-2 p-4">
              {ALL_TYPES.map((t) => {
                const enabled = prefs?.types.includes(t) ?? true;
                return (
                  <label key={t} className="flex cursor-pointer items-center gap-3 rounded-sm border border-border px-3 py-2.5 hover:bg-raised/60">
                    <input
                      type="checkbox"
                      checked={enabled}
                      className="h-3.5 w-3.5 accent-[var(--color-accent)]"
                      onChange={(e) => {
                        const next = e.target.checked ? [...(prefs?.types ?? ALL_TYPES), t] : (prefs?.types ?? ALL_TYPES).filter((x) => x !== t);
                        void updateNotificationPreferences({ enabled: true, types: next }).then(() => invalidate([["notification-prefs"]]));
                      }}
                    />
                    <span className="text-[13px] text-foreground">{t.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}</span>
                  </label>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {tab === "security" && (
        <div className="grid gap-3 xl:grid-cols-2">
          <Card>
            <CardHeader title="Security" subtitle="How PARALLAX protects your workspace" />
            <ul className="space-y-2 p-4 text-xs text-muted">
              <li className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /> GitHub OAuth tokens are encrypted at rest and never reach the browser.</li>
              <li className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /> Sessions use httpOnly cookies with a 30-day lifetime.</li>
              <li className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /> All GraphQL operations are authorized per workspace role (RBAC).</li>
              <li className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /> Webhooks are verified with HMAC signatures and deduplicated.</li>
              <li className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /> Query depth and complexity limits protect the API.</li>
              <li className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /> Every sensitive action is written to the audit log.</li>
            </ul>
          </Card>
          <Card>
            <CardHeader title="Audit log" subtitle="Recent workspace events" />
            <div className="max-h-96 divide-y divide-border overflow-y-auto scroll-thin">
              {(auditLogs?.edges ?? []).map((e) => (
                <div key={e.node.id} className="flex items-start gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[11px] text-foreground">{e.node.action.replace(/_/g, " ")}</p>
                    <p className="truncate text-[11px] text-subtle">
                      {e.node.actorName ?? "system"} · {e.node.targetType ? `${e.node.targetType}:${e.node.targetId?.slice(0, 8)}` : "workspace"}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] text-faint">{formatDateTime(e.node.createdAt)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === "api" && (
        <div className="max-w-2xl space-y-3">
          <Card>
            <CardHeader title="GraphQL API" subtitle="The typed API behind every screen in PARALLAX" />
            <div className="space-y-3 p-4">
              <div>
                <p className="label">Endpoint</p>
                <code className="mt-1 block rounded-sm border border-border bg-raised px-3 py-2 font-mono text-[12px] text-accent">{GRAPHQL_URL}</code>
              </div>
              <div>
                <p className="label">Webhook endpoint</p>
                <code className="mt-1 block rounded-sm border border-border bg-raised px-3 py-2 font-mono text-[12px] text-accent">{API_ORIGIN}/webhooks/github</code>
              </div>
              <div>
                <p className="label">Example</p>
                <pre className="mt-1 overflow-x-auto rounded-sm border border-border bg-raised p-3 font-mono text-[11px] leading-relaxed text-muted">{`curl ${GRAPHQL_URL} \\\n  -H 'Content-Type: application/json' \\\n  -d '{"query":"{ engineeringOverview { health topRisks } }"}'`}</pre>
              </div>
              <p className="flex items-center gap-1.5 text-[11px] text-faint">
                <TerminalSquare className="h-3 w-3" /> Queries and mutations are documented in the GraphQL schema (packages/graphql).
              </p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function AddMemberForm({ onAdded }: { onAdded: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("MEMBER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await addMember({ email: email.trim(), role });
      setEmail("");
      onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add member");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2 border-t border-border p-3">
      <Input placeholder="member@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1" aria-label="Member email" />
      <Select value={role} onChange={(e) => setRole(e.target.value as Role)} className="w-auto min-w-28" aria-label="Role">
        {["ADMIN", "MEMBER", "VIEWER"].map((r) => <option key={r} value={r}>{r}</option>)}
      </Select>
      <Button variant="primary" size="sm" onClick={() => void submit()} loading={busy} disabled={!email.trim()}>
        <Plus className="h-3.5 w-3.5" /> Add
      </Button>
      {error && <span className="text-[11px] text-danger">{error}</span>}
    </div>
  );
}
