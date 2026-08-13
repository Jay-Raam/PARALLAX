"use client";

import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import type { DeliveryFunnel, DeliveryFunnelStage } from "@/types/graphql";
import { formatDurationShort, formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function DeliveryFunnelChart({ funnel }: { funnel: DeliveryFunnel }) {
  if (!funnel.stages.length) {
    return <p className="px-4 py-8 text-center text-xs text-muted">Not enough merged pull requests to build a funnel yet.</p>;
  }

  const max = Math.max(1, ...funnel.stages.map((s) => s.count));
  return (
    <div className="space-y-3 p-4">
      {funnel.stages.map((stage, i) => (
        <StageRow key={`${stage.stage}-${i}`} stage={stage} max={max} index={i} />
      ))}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <div className="text-xs text-muted">
          Cycle time:{" "}
          <span className="font-mono text-[13px] text-foreground">{formatDurationShort(funnel.currentCycleTimeMs)}</span>
          {funnel.cycleTimeChangePct !== 0 && (
            <span className={cn("ml-1.5 font-mono", (funnel.cycleTimeChangePct ?? 0) > 0 ? "text-danger" : "text-success")}>
              {(funnel.cycleTimeChangePct ?? 0) > 0 ? "▲" : "▼"} {Math.abs(funnel.cycleTimeChangePct ?? 0).toFixed(1)}%
            </span>
          )}
        </div>
        {funnel.bottleneck && <BottleneckChip stage={funnel.bottleneck} />}
      </div>
    </div>
  );
}

function StageRow({ stage, max, index }: { stage: DeliveryFunnelStage; max: number; index: number }) {
  const width = Math.max(8, (stage.count / max) * 100);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-mono text-[10px] text-faint">{index + 1}</span>
          <span className="font-medium text-foreground">{stage.stage}</span>
          {stage.isBottleneck && (
            <span className="flex items-center gap-0.5 rounded-sm border border-danger/30 bg-danger/10 px-1 py-px text-[10px] font-medium text-danger">
              <AlertTriangle className="h-2.5 w-2.5" /> bottleneck
            </span>
          )}
        </div>
        <span className="font-mono text-[11px] text-subtle">
          {formatNumber(stage.count)} · avg {formatDurationShort(stage.averageMs)}
          {stage.changePct !== null && stage.changePct !== undefined && (
            <span className={cn("ml-1", stage.changePct > 0 ? "text-danger" : "text-success")}>
              {stage.changePct > 0 ? "+" : ""}
              {stage.changePct.toFixed(0)}%
            </span>
          )}
        </span>
      </div>
      <motion.div
        className="h-2 rounded-sm"
        style={{ width: `${width}%`, background: stage.isBottleneck ? "var(--color-danger)" : "var(--color-accent)", opacity: 1 - index * 0.06 }}
        initial={{ width: 0 }}
        animate={{ width: `${width}%` }}
        transition={{ duration: 0.4, delay: index * 0.05, ease: "easeOut" }}
      />
    </div>
  );
}

function BottleneckChip({ stage }: { stage: DeliveryFunnelStage }) {
  return (
    <div className="flex items-center gap-2 rounded-sm border border-danger/30 bg-danger/10 px-2 py-1 text-xs text-danger">
      <AlertTriangle className="h-3.5 w-3.5" />
      <span>
        Bottleneck: <span className="font-medium">{stage.stage}</span> ({formatDurationShort(stage.averageMs)})
      </span>
    </div>
  );
}
