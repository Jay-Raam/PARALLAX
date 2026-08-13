"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { SamplingBar } from "./SamplingBar";
import { CommandPalette } from "./CommandPalette";
import { useSession } from "@/providers/session";
import { useHotkey } from "@/hooks/useHotkey";
import { PageLoading } from "@/components/ui/feedback";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useSession();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useHotkey(
    ["mod", "k"],
    () => {
      setPaletteOpen((v) => !v);
    },
    true,
  );

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-start justify-center p-10">
        <div className="w-full max-w-5xl">
          <PageLoading />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden lg:block">
        <Sidebar openPalette={() => setPaletteOpen(true)} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMenu={() => setMenuOpen(true)} openPalette={() => setPaletteOpen(true)} />
        <SamplingBar />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1400px] px-4 py-5 lg:px-6">{children}</div>
        </main>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div className="absolute inset-0 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMenuOpen(false)} />
            <motion.div
              className="absolute left-0 top-0 h-full"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.18, ease: "easeOut" }}
            >
              <div className="h-full w-64 border-r border-border bg-surface">
                <Sidebar onNavigate={() => setMenuOpen(false)} openPalette={() => setPaletteOpen(true)} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
