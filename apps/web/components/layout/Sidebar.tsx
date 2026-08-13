"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderGit2,
  Activity,
  GitPullRequest,
  CircleDot,
  Package,
  ShieldCheck,
  Workflow,
  Tag,
  Users,
  BarChart3,
  Lightbulb,
  Settings,
  Command,
  Layers,
} from "lucide-react";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { RepoSwitcher } from "./RepoSwitcher";
import { UserMenu } from "./UserMenu";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/repositories", label: "Repositories", icon: FolderGit2 },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/pull-requests", label: "Pull Requests", icon: GitPullRequest },
  { href: "/issues", label: "Issues", icon: CircleDot },
  { href: "/dependencies", label: "Dependencies", icon: Package },
  { href: "/security", label: "Security", icon: ShieldCheck },
  { href: "/cicd", label: "CI/CD", icon: Workflow },
  { href: "/releases", label: "Releases", icon: Tag },
  { href: "/contributors", label: "Contributors", icon: Users },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/recommendations", label: "Recommendations", icon: Lightbulb },
];

export function Sidebar({ onNavigate, openPalette }: { onNavigate?: () => void; openPalette: () => void }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-surface">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 pb-3 pt-4">
        <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-accent text-accent-foreground">
          <Layers className="h-3.5 w-3.5" />
        </span>
        <span className="text-[15px] font-semibold tracking-[0.18em] text-foreground">PARALLAX</span>
      </div>

      {/* Workspace + repo switchers */}
      <div className="space-y-2 px-3 pb-3">
        <WorkspaceSwitcher />
        <RepoSwitcher />
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-3 scroll-thin" aria-label="Main navigation">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/overview" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn("nav-item", active && "nav-item-active")}
              aria-current={active ? "page" : undefined}
            >
              <Icon className={cn("h-4 w-4", active ? "text-accent" : "text-subtle")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3">
        <button onClick={openPalette} className="nav-item w-full justify-between" aria-label="Open command palette">
          <span className="flex items-center gap-2.5">
            <Command className="h-4 w-4 text-subtle" />
            Command palette
          </span>
          <span className="kbd">⌘K</span>
        </button>
        <Link href="/settings" className="nav-item mt-0.5">
          <Settings className="h-4 w-4 text-subtle" />
          Settings
        </Link>
        <UserMenu />
      </div>
    </aside>
  );
}
