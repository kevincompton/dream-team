"use client";

import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { EconomyData } from "@/types/dashboard";
import { Panel } from "@/components/ui/panel";
import { formatNumber } from "@/lib/utils";

interface EconomyPanelProps {
  economy: EconomyData;
}

export function EconomyPanel({ economy }: EconomyPanelProps) {
  const [isMounted, setIsMounted] = useState(false);
  const trackedTotal = economy.inPools + economy.distributed + economy.staked;
  const progress = trackedTotal > 0 ? Math.min(100, (economy.inPools / trackedTotal) * 100) : 0;
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <Panel title="HBAR Economy" className="h-full min-h-0" contentClassName="min-h-0 overflow-y-auto pr-1">
      <div className="relative mb-4 flex items-center justify-center">
        <svg className="h-36 w-36 -rotate-90">
          <circle cx="72" cy="72" r={radius} stroke="#1E2D3D" strokeWidth="10" fill="none" />
          <motion.circle
            cx="72"
            cy="72"
            r={radius}
            stroke="#00FFA3"
            strokeWidth="10"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.7 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="font-mono text-xl text-hive-text">{formatNumber(economy.circulating, 6)}</p>
          <p className="text-xs text-hive-muted">HBAR in Pool</p>
        </div>
      </div>

      <div className="mb-4 space-y-2 text-xs">
        <div className="flex items-center justify-between text-hive-muted">
          <span>In Pools</span>
          <span className="flex items-center gap-1 font-mono text-hive-primary">
            <ArrowUpRight className="h-3 w-3" />
            {formatNumber(economy.inPools, 6)}
          </span>
        </div>
        <div className="flex items-center justify-between text-hive-muted">
          <span>Distributed</span>
          <span className="flex items-center gap-1 font-mono text-hive-secondary">
            <ArrowUpRight className="h-3 w-3" />
            {formatNumber(economy.distributed, 6)}
          </span>
        </div>
        <div className="flex items-center justify-between text-hive-muted">
          <span>Staked</span>
          <span className="flex items-center gap-1 font-mono text-hive-warning">
            <ArrowDownRight className="h-3 w-3" />
            {formatNumber(economy.staked, 6)}
          </span>
        </div>
        <div className="flex items-center justify-between text-hive-muted">
          <span>Pool Share</span>
          <span className="font-mono text-hive-text">{formatNumber(progress, 2)}%</span>
        </div>
      </div>

      <div className="h-28 rounded-md border border-hive-border/70 bg-hive-bg/40 p-2">
        {isMounted ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={100}>
            <BarChart data={economy.flow24h}>
              <XAxis dataKey="hour" stroke="#64748B" tick={{ fontSize: 10 }} />
              <YAxis hide />
              <Bar dataKey="inflow" fill="#00D4FF" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full w-full rounded-sm bg-hive-border/20" />
        )}
      </div>
    </Panel>
  );
}