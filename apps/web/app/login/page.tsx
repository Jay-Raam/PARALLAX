"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Github, Layers, Sparkles } from "lucide-react";
import { useSession } from "@/providers/session";
import { API_ORIGIN } from "@/lib/gql";
import { fetchRepositories } from "@/graphql/queries/repositories";
import { Button, Input } from "@/components/ui/primitives";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const enter = async (email: string) => {
    setBusy(true);
    setError(null);
    try {
      await login(email);
      const repos = await fetchRepositories(undefined, { first: 1 });
      router.push(repos.totalCount > 0 ? "/overview" : "/onboarding");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in failed");
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <Layers className="h-5 w-5" />
          </span>
          <div className="text-center">
            <h1 className="text-lg font-semibold tracking-tight">Welcome to PARALLAX</h1>
            <p className="mt-1 text-[13px] text-muted">Your engineering system starts with GitHub.</p>
          </div>
        </div>

        <div className="panel p-5">
          <a href={`${API_ORIGIN}/auth/github`} className="btn btn-primary btn-md w-full gap-2">
            <Github className="h-4 w-4" /> Connect GitHub
          </a>

          <div className="my-4 flex items-center gap-3 text-[10px] uppercase tracking-wider text-faint">
            <span className="h-px flex-1 bg-border" /> or continue with email <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit((v) => void enter(v.email))} className="space-y-3">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <Input id="email" type="email" autoComplete="email" className="mt-1" placeholder="you@company.com" {...register("email")} />
              {errors.email && <p className="mt-1 text-[11px] text-danger">{errors.email.message}</p>}
            </div>
            {error && (
              <p className="rounded-sm border border-danger/30 bg-danger/10 px-2.5 py-1.5 text-[12px] text-danger">{error}</p>
            )}
            <Button variant="primary" type="submit" className="w-full" loading={busy}>
              Continue <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </form>

          <button
            className="mt-3 flex w-full items-center justify-center gap-1.5 text-[12px] text-muted hover:text-foreground"
            onClick={() => void enter("jay@parallax.dev")}
            disabled={busy}
          >
            <Sparkles className="h-3 w-3 text-warning" /> Explore the seeded demo workspace
          </button>
        </div>

        <p className="mt-5 text-center text-[11px] text-faint">
          <Link href="/" className="hover:text-muted">← Back to home</Link>
        </p>
      </div>
    </main>
  );
}
