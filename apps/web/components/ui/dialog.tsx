"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

function useLockBody(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  width?: string;
}) {
  useLockBody(open);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh]">
          <motion.div
            className="absolute inset-0 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === "string" ? title : "Dialog"}
            className={cn("relative w-full rounded-md border border-border-strong bg-surface shadow-pop", width)}
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-[13px] font-semibold">{title}</h2>
              <button className="rounded-sm p-1 text-muted hover:bg-raised hover:text-foreground" onClick={onClose} aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-4">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  side = "right",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  side?: "left" | "right";
}) {
  useLockBody(open);
  const x = side === "right" ? "100%" : "-100%";
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            className="absolute inset-0 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === "string" ? title : "Drawer"}
            className={cn("absolute top-0 flex h-full w-[min(420px,92vw)] flex-col border-border bg-surface", side === "right" ? "right-0 border-l" : "left-0 border-r")}
            initial={{ x }}
            animate={{ x: 0 }}
            exit={{ x }}
            transition={{ type: "tween", duration: 0.18, ease: "easeOut" }}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-[13px] font-semibold">{title}</h2>
              <button className="rounded-sm p-1 text-muted hover:bg-raised hover:text-foreground" onClick={onClose} aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
