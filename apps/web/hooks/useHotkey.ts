"use client";

import { useEffect } from "react";

export function useHotkey(keys: string[], handler: (e: KeyboardEvent) => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const combo = keys.map((k) => k.toLowerCase());
      if (combo.includes("mod") ? mod : true) {
        const rest = combo.filter((k) => k !== "mod");
        if (rest.every((k) => (k === "shift" ? e.shiftKey : k === "alt" ? e.altKey : e.key.toLowerCase() === k)) && (!combo.includes("mod") || mod)) {
          e.preventDefault();
          handler(e);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [keys.join(","), handler, enabled]);
}
