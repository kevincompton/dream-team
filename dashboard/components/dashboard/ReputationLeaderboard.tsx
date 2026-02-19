"use client";

import { motion } from "framer-motion";
import type { Agent } from "@/types/dashboard";
import { Panel } from "@/components/ui/panel";

const medals = ["🥇", "🥈", "🥉"];

interface ReputationLeaderboardProps {
  agents: Agent[];
}

export function ReputationLeaderboard({ agents }: ReputationLeaderboardProps) {
  const ranked = [...agents].sort((a, b) => b.reputation - a.reputation).slice(0, 3);

  return (
    <Panel title="Reputation Leaderboard" className="h-full min-h-0" contentClassName="min-h-0 overflow-y-auto pr-1">
      <div className="space-y-2">
        {ranked.map((agent, index) => {
          const width = Math.min(100, agent.reputation);
          return (
            <div key={agent.id} className="rounded-md border border-hive-border/70 bg-hive-bg/50 p-2">
              <div className="mb-1 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span>{medals[index]}</span>
                  <span className="font-semibold text-hive-text">{agent.name}</span>
                </div>
                <motion.span
                  className="font-mono text-hive-primary"
                  initial={{ opacity: 0.5 }}
                  animate={{ opacity: 1 }}
                >
                  {agent.reputation}
                </motion.span>
              </div>
              <div className="mb-1 h-2 overflow-hidden rounded-full bg-hive-border/40">
                <motion.div
                  className="h-full bg-gradient-to-r from-hive-secondary to-hive-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${width}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <p className="text-[11px] text-hive-muted" title={agent.specialty}>{agent.specialty}</p>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}