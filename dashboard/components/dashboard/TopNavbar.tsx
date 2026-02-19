"use client";

import { useEffect } from "react";
import { ExternalLink, Hexagon, Radio } from "lucide-react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import type { DashboardSnapshot } from "@/types/dashboard";
import { Badge } from "@/components/ui/badge";
import { formatNumber, hashscanContractUrl, truncateAddress } from "@/lib/utils";

interface TopNavbarProps {
  snapshot: DashboardSnapshot;
  mcpConnected: boolean;
}

export function TopNavbar({ snapshot, mcpConnected }: TopNavbarProps) {
  const contractAddress = process.env.NEXT_PUBLIC_KNOWLEDGE_POOL_CONTRACT_ADDRESS;
  const txValue = useMotionValue(snapshot.liveStats.txPerSecond);
  const txSpring = useSpring(txValue, { stiffness: 110, damping: 22 });
  const txDisplay = useTransform(txSpring, (value) => value.toFixed(1));

  const circulatingValue = useMotionValue(snapshot.liveStats.circulatingHive);
  const circulatingSpring = useSpring(circulatingValue, { stiffness: 80, damping: 18 });
  const circulatingDisplay = useTransform(circulatingSpring, (value) => formatNumber(value, 0));

  useEffect(() => {
    txValue.set(snapshot.liveStats.txPerSecond);
    circulatingValue.set(snapshot.liveStats.circulatingHive);
  }, [circulatingValue, snapshot.liveStats.circulatingHive, snapshot.liveStats.txPerSecond, txValue]);

  return (
    <header className="border-b border-hive-border bg-hive-bg/90 px-6 py-4 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1700px] items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-gradient-to-br from-hive-primary to-hive-secondary p-2 text-hive-bg shadow-glow">
            <Hexagon className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-hive-text">HIVE Protocol</h1>
            <p className="text-xs text-hive-muted">Observer Dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-hive-border px-3 py-1.5 text-xs text-hive-text">
            <span className="h-2 w-2 animate-pulseDot rounded-full bg-hive-primary" />
            <span className="font-mono">HEDERA TESTNET</span>
            <Badge
              className={
                snapshot.mode === "LIVE"
                  ? "border-hive-primary/40 bg-hive-primary/10 text-hive-primary"
                  : "border-hive-warning/40 bg-hive-warning/10 text-hive-warning"
              }
            >
              <Radio className="mr-1 h-3 w-3" />
              {snapshot.mode === "LIVE" ? "LIVE" : "DEMO MODE"}
            </Badge>
          </div>

          {contractAddress ? (
            <a
              href={hashscanContractUrl(contractAddress)}
              target="_blank"
              rel="noreferrer"
              title={contractAddress}
              className="flex items-center gap-1 rounded-full border border-hive-border px-3 py-1.5 font-mono text-xs text-hive-secondary transition hover:border-hive-secondary/60 hover:text-hive-primary"
            >
              {truncateAddress(contractAddress, 8, 6)}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}

          <div
            className={`rounded-full border px-3 py-1.5 font-mono text-xs ${
              mcpConnected
                ? "border-green-500/40 bg-green-500/10 text-green-400"
                : "border-red-500/40 bg-red-500/10 text-red-400"
            }`}
          >
            ● {mcpConnected ? "MCP ONLINE" : "MCP OFFLINE"}
          </div>
        </div>

        <motion.div
          className="font-mono text-sm text-hive-muted"
          initial={{ opacity: 0.75 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          TX/s: <motion.span className="text-hive-secondary">{txDisplay}</motion.span>
          <span className="mx-2">|</span>
          Agents: <span className="text-hive-primary">{snapshot.liveStats.activeAgents}</span>
          <span className="mx-2">|</span>
          HBAR Circulating: <motion.span className="text-hive-text">{circulatingDisplay}</motion.span>
        </motion.div>
      </div>
      <div className="mx-auto mt-4 h-px w-full max-w-[1700px] bg-gradient-to-r from-hive-primary/20 via-hive-secondary/35 to-hive-primary/20" />
    </header>
  );
}