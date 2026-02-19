"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import type { Agent, AgentState } from "@/types/dashboard";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { cn, formatRelativeTime, truncateAddress } from "@/lib/utils";

const stateStyles: Record<AgentState, string> = {
  IDLE: "border-slate-500/40 bg-slate-500/10 text-slate-300",
  ACTIVE: "border-hive-primary/40 bg-hive-primary/10 text-hive-primary",
  EXECUTING: "border-hive-warning/40 bg-hive-warning/10 text-hive-warning",
  SETTLED: "border-hive-secondary/40 bg-hive-secondary/10 text-hive-secondary",
};

interface AgentStatusPanelProps {
  agents: Agent[];
}

export function AgentStatusPanel({ agents }: AgentStatusPanelProps) {
  const [flashAgent, setFlashAgent] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [previousStates, setPreviousStates] = useState<Map<string, AgentState>>(new Map());
  const states = useMemo(() => new Map(agents.map((agent) => [agent.id, agent.state])), [agents]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    for (const agent of agents) {
      const previous = previousStates.get(agent.id);
      if (previous && previous !== agent.state) {
        setFlashAgent(agent.id);
        break;
      }
    }

    setPreviousStates(states);

    const timeout = setTimeout(() => {
      setFlashAgent(null);
    }, 800);

    return () => clearTimeout(timeout);
  }, [agents, previousStates, states]);

  return (
    <Panel title="Agent Status" className="h-full">
      <div className="space-y-3">
        {agents.map((agent) => {
          const chartData = agent.activitySparkline.map((value, index) => ({ point: index, value }));

          return (
            <motion.article
              key={agent.id}
              layout
              className={cn(
                "rounded-lg border border-hive-border/70 bg-hive-bg/50 p-3",
                flashAgent === agent.id && "shadow-glow",
              )}
              initial={{ opacity: 0.7, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28 }}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-hive-text">
                    <span className="mr-2">{agent.emoji}</span>
                    {agent.name}
                  </p>
                  <p className="font-mono text-xs text-hive-muted">{truncateAddress(agent.wallet)}</p>
                </div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={agent.state}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <Badge className={cn("gap-1", stateStyles[agent.state])}>
                      {(agent.state === "ACTIVE" || agent.state === "EXECUTING") && (
                        <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-current" />
                      )}
                      {agent.state}
                    </Badge>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="mb-2 flex items-center justify-between text-xs text-hive-muted">
                <span>Reputation</span>
                <span className="text-hive-text">{"★".repeat(agent.stars)}{"☆".repeat(5 - agent.stars)}</span>
              </div>
              <div className="mb-2 flex items-center justify-between text-xs text-hive-muted">
                <span>Last action</span>
                <span className="font-mono text-hive-text">{formatRelativeTime(agent.lastActionAt)}</span>
              </div>
              <div className="mb-2 flex items-center justify-between text-xs text-hive-muted">
                <span>Total tx</span>
                <span className="font-mono text-hive-text">{agent.totalTransactions}</span>
              </div>

              <div className="h-12 w-full">
                {isMounted ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={44}>
                    <AreaChart data={chartData}>
                      <Area type="monotone" dataKey="value" stroke="#00FFA3" fill="url(#sparkFill)" strokeWidth={1.5} />
                      <defs>
                        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00FFA3" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#00FFA3" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full w-full rounded-sm bg-hive-border/20" />
                )}
              </div>
            </motion.article>
          );
        })}
      </div>
    </Panel>
  );
}