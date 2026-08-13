"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Layers, Github } from "lucide-react";
import { useSession } from "@/providers/session";
import { API_ORIGIN } from "@/lib/gql";

const PIPELINE = ["RAW DATA", "NORMALIZATION", "ANALYTICS", "INTELLIGENCE", "EXPLANATION", "RECOMMENDATION"];

const FEATURES = [
  { title: "Engineering Health", desc: "A single score per repository and workspace, with the reasons behind every change.", metric: "87/100" },
  { title: "Pull Request Risk", desc: "Deterministic risk scoring for every PR before it merges — diff size, auth paths, missing tests.", metric: "64/100" },
  { title: "Dependency Radar", desc: "Every outdated and vulnerable package, prioritized by update risk.", metric: "128 pkgs" },
  { title: "Delivery Funnel", desc: "Commit → review → merge → deploy → release, with the bottleneck called out.", metric: "8 stages" },
  { title: "Security Center", desc: "Dependabot, secret scanning and workflow security in one view.", metric: "88/100" },
  { title: "Recommendations", desc: "Measurable findings with evidence and a suggested action for each.", metric: "30 recs" },
];

export default function LandingPage() {
  const router = useRouter();
  const { user, loading } = useSession();

  useEffect(() => {
    if (!loading && user) router.replace("/overview");
  }, [loading, user, router]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* hairline graticule backdrop */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 75%)",
        }}
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6">
        {/* nav */}
        <nav className="flex items-center justify-between py-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-accent text-accent-foreground">
              <Layers className="h-3.5 w-3.5" />
            </span>
            <span className="font-display text-[15px] font-medium tracking-[0.22em]">PARALLAX</span>
            <span className="relative flex h-1.5 w-1.5" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
            </span>
          </div>
          <Link href="/login" className="btn btn-ghost btn-md">
            Sign in
          </Link>
        </nav>

        {/* hero */}
        <section className="flex flex-1 flex-col items-center justify-center py-16 text-center">
          <p className="mb-5 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.3em] text-accent">
            <span aria-hidden>◍</span> Sampling the GitHub signal
          </p>
          <h1 className="font-display max-w-3xl text-4xl font-medium leading-[1.08] tracking-tight sm:text-6xl">
            Engineering intelligence from your <span className="text-accent">GitHub activity</span>.
          </h1>
          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-muted">
            Understand what is happening inside your software system. PARALLAX turns commits, pull requests and
            deployments into measurable health, risk and recommendations.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
            <a href={`${API_ORIGIN}/auth/github`} className="btn btn-primary btn-md gap-2 !px-5 !py-2.5">
              <Github className="h-4 w-4" /> Connect GitHub
            </a>
            <Link href="/login" className="btn btn-outline btn-md gap-2 !px-5 !py-2.5">
              View demo <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-9 gap-y-3 font-mono text-[11px] text-subtle">
            <span className="flex items-baseline gap-1.5">
              <span className="text-sm text-accent">8</span> repositories
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-sm text-accent">5,200+</span> commits
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-sm text-accent">440+</span> pull requests
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-sm text-accent">800+</span> issues
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-sm text-accent">91</span> dependencies
            </span>
          </div>
        </section>

        {/* pipeline strip */}
        <section className="border-y border-border py-5">
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2">
            {PIPELINE.map((p, i) => (
              <span key={p} className="flex items-center gap-2">
                <span className="rounded-sm border border-border bg-surface px-2 py-1 font-mono text-[10.5px] tracking-wider text-muted">{p}</span>
                {i < PIPELINE.length - 1 && <ArrowRight className="h-3 w-3 text-accent/70" />}
              </span>
            ))}
          </div>
        </section>

        {/* features */}
        <section className="grid gap-3 py-14 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="panel panel-interactive relative p-5">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" aria-hidden />
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-[13px] font-medium">{f.title}</h3>
                <span className="font-mono text-xs text-accent">{f.metric}</span>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        {/* footer */}
        <footer className="border-t border-border py-8 text-center font-mono text-[11px] text-faint">
          GitHub records what happened. PARALLAX explains what it means.
        </footer>
      </div>
    </main>
  );
}
