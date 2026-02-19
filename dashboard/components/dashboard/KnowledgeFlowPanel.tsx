"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { KnowledgeRequest, KnowledgeStatus } from "@/types/dashboard";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { cn, formatRelativeTime } from "@/lib/utils";

const FLOW: KnowledgeStatus[] = ["PROPOSED", "FUNDED", "EXECUTING", "ATTESTED", "SETTLED"];

const statusStyles: Record<KnowledgeStatus, string> = {
  PROPOSED: "border-slate-500/35 bg-slate-500/10 text-slate-300",
  FUNDED: "border-hive-secondary/35 bg-hive-secondary/10 text-hive-secondary",
  EXECUTING: "border-hive-warning/35 bg-hive-warning/10 text-hive-warning",
  ATTESTED: "border-hive-primary/35 bg-hive-primary/10 text-hive-primary",
  SETTLED: "border-hive-primary/35 bg-hive-primary/10 text-hive-primary",
};

interface KnowledgeFlowPanelProps {
  requests: KnowledgeRequest[];
  flowCounts: Array<{ status: KnowledgeStatus; count: number }>;
}

export function KnowledgeFlowPanel({ requests, flowCounts }: KnowledgeFlowPanelProps) {
  const latest = requests[0];

  return (
    <div className="grid h-full min-h-0 grid-rows-[1fr] gap-4">
      <Panel title="Knowledge Flow" className="h-full min-h-0" contentClassName="min-h-0 overflow-y-auto pr-1">
        <div className="mb-6 grid grid-cols-5 items-center gap-3">
          {FLOW.map((status, index) => {
            const isActive = latest?.status === status;
            const count = flowCounts.find((flowItem) => flowItem.status === status)?.count ?? 0;

            return (
              <div key={status} className="relative">
                <motion.div
                  className={cn(
                    "rounded-lg border border-hive-border bg-hive-bg/40 px-2 py-3 text-center",
                    isActive && "border-hive-primary/60 shadow-glow",
                  )}
                  animate={isActive ? { scale: [1, 1.02, 1], opacity: [0.9, 1, 0.9] } : { scale: 1, opacity: 0.9 }}
                  transition={{ duration: 1.2, repeat: isActive ? Infinity : 0 }}
                >
                  <p className="text-xs font-semibold text-hive-muted">{status}</p>
                  <motion.p className="mt-1 text-lg font-semibold text-hive-text" key={count} initial={{ y: -4 }} animate={{ y: 0 }}>
                    {count}
                  </motion.p>
                </motion.div>
                {index < FLOW.length - 1 && (
                  <div className="absolute left-[calc(100%+6px)] top-1/2 hidden h-[2px] w-3 -translate-y-1/2 bg-hive-border md:block">
                    {isActive && (
                      <motion.span
                        className="absolute left-0 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-hive-primary"
                        initial={{ x: 0 }}
                        animate={{ x: 10 }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-2">
          <AnimatePresence>
            {requests.slice(0, 5).map((request) => (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="grid grid-cols-[50px_1fr_90px_100px_72px] items-center gap-2 rounded-md border border-hive-border/70 bg-hive-bg/40 px-2 py-2 text-xs"
              >
                <span className="font-mono text-hive-secondary">#{request.id}</span>
                <span className="truncate text-hive-text" title={request.question}>{request.question}</span>
                <span className="font-mono text-hive-primary">{request.pool.toFixed(2)} HBAR</span>
                <Badge className={statusStyles[request.status]}>{request.status}</Badge>
                <span className="text-right text-hive-muted">{formatRelativeTime(request.createdAt)}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </Panel>
    </div>
  );
}