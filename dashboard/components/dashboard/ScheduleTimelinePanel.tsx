"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Panel } from "@/components/ui/panel";
import { hashscanScheduleUrl } from "@/lib/utils";

interface ScheduleEntry {
  scheduleAddress: string;
  entityId?: string;
  pulseId: number;
  createdAt: number;
  status: "PENDING" | "EXECUTED" | "DELETED" | "EXPIRED" | "UNKNOWN";
  executedAt?: number;
}

const MIRROR_BASE = "https://testnet.mirrornode.hedera.com";
// keccak256("PulseScheduled(address,uint256,uint256)")
const PULSE_SCHEDULED_TOPIC0 =
  "0xae7eda3bfd045c913dc5d827c70e2ebb2b695207304ba18fb2cc5ab10d3466f7";

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_KNOWLEDGE_POOL_CONTRACT_ADDRESS ??
  process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS;

function decodeAbiWord(data: string, wordIndex: number): string {
  const start = 2 + wordIndex * 64;
  return data.slice(start, start + 64);
}

async function fetchPulseScheduledEvents(
  contractAddr: string,
): Promise<ScheduleEntry[]> {
  const url = `${MIRROR_BASE}/api/v1/contracts/${contractAddr}/results/logs?order=desc&limit=50`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  const logs: Array<{ topics: string[]; data: string; timestamp: string }> =
    json.logs || [];

  const entries: ScheduleEntry[] = [];
  for (const log of logs) {
    if ((log.topics[0] ?? "").toLowerCase() !== PULSE_SCHEDULED_TOPIC0) continue;
    if (log.data.length < 194) continue; // need 3 x 32-byte words + 0x prefix

    try {
      const addrHex = decodeAbiWord(log.data, 0);
      const rawAddr = "0x" + addrHex.slice(24);
      const pulseId = parseInt(decodeAbiWord(log.data, 1), 16);
      if (rawAddr === "0x" + "0".repeat(40)) continue;

      entries.push({
        scheduleAddress: rawAddr,
        pulseId,
        createdAt: parseFloat(log.timestamp) * 1000,
        status: "UNKNOWN",
      });
    } catch {
      // skip malformed logs
    }
  }
  return entries;
}

function evmAddrToEntityNum(evmAddr: string): string | null {
  const hex = evmAddr.replace(/^0x/, "").toLowerCase();
  if (hex.length !== 40) return null;
  const entityNum = parseInt(hex, 16);
  if (!entityNum || entityNum > 0xffffffff) return null;
  return `0.0.${entityNum}`;
}

async function fetchScheduleStatus(
  scheduleAddr: string,
): Promise<{ status: string; executedAt?: number; entityId?: string }> {
  try {
    const entityId = evmAddrToEntityNum(scheduleAddr);
    if (!entityId) return { status: "UNKNOWN" };

    const schedUrl = `${MIRROR_BASE}/api/v1/schedules/${entityId}`;
    const schedRes = await fetch(schedUrl);
    if (!schedRes.ok) return { status: "PENDING", entityId };
    const sched = await schedRes.json();

    const executed = sched.executed_timestamp;
    const deleted = sched.deleted;

    if (executed) {
      return {
        status: "EXECUTED",
        executedAt: parseFloat(executed) * 1000,
        entityId,
      };
    }
    if (deleted) return { status: "DELETED", entityId };
    return { status: "PENDING", entityId };
  } catch {
    return { status: "UNKNOWN" };
  }
}

const statusConfig: Record<
  string,
  { icon: string; label: string; className: string }
> = {
  EXECUTED: { icon: "✅", label: "Executed", className: "text-emerald-400" },
  PENDING: { icon: "⏳", label: "Pending...", className: "text-amber-400" },
  DELETED: { icon: "🗑️", label: "Deleted", className: "text-red-400" },
  EXPIRED: { icon: "⌛", label: "Expired", className: "text-slate-400" },
  UNKNOWN: { icon: "❓", label: "Unknown", className: "text-slate-500" },
};

function formatTime(ms: number) {
  if (!ms) return "—";
  return new Date(ms).toLocaleTimeString();
}

export function ScheduleTimelinePanel() {
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!CONTRACT_ADDRESS) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const raw = await fetchPulseScheduledEvents(CONTRACT_ADDRESS!);
        if (cancelled) return;

        const enriched = await Promise.all(
          raw.slice(0, 10).map(async (entry) => {
            const { status, executedAt, entityId } =
              await fetchScheduleStatus(entry.scheduleAddress);
            return {
              ...entry,
              status: status as ScheduleEntry["status"],
              executedAt,
              entityId: entityId ?? evmAddrToEntityNum(entry.scheduleAddress) ?? undefined,
            };
          }),
        );

        if (!cancelled) {
          setEntries(enriched);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };

    poll();
    pollRef.current = setInterval(poll, 10_000);

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const pendingCount = entries.filter((e) => e.status === "PENDING").length;

  return (
    <Panel
      title="Schedule Timeline (HIP-755)"
      rightSlot={
        pendingCount > 0 ? (
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-400">
            {pendingCount} pending
          </span>
        ) : null
      }
      className="h-full min-h-0"
      contentClassName="min-h-0"
    >
      <div className="h-full overflow-y-auto rounded-md border border-hive-border/60 bg-hive-terminal p-3 font-mono text-xs">
        {loading && (
          <div className="flex h-full items-center justify-center text-slate-500">
            Loading schedules...
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div className="flex h-full items-center justify-center text-slate-500">
            {CONTRACT_ADDRESS
              ? "No pulse schedules found"
              : "Contract address not configured"}
          </div>
        )}

        {!loading && entries.length > 0 && (
          <div className="space-y-1.5">
            {entries.map((entry, index) => {
              const cfg = statusConfig[entry.status] ?? statusConfig.UNKNOWN;
              return (
                <motion.div
                  key={entry.scheduleAddress + entry.pulseId}
                  className="flex items-center gap-3 rounded px-2 py-1.5 hover:bg-white/5"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15, delay: index * 0.03 }}
                >
                  <span className="shrink-0 text-slate-500 tabular-nums">
                    #{entry.pulseId}
                  </span>

                  <span className="shrink-0 text-slate-400 tabular-nums">
                    {formatTime(entry.createdAt)}
                  </span>

                  <span className="mx-1 text-slate-600">→</span>

                  <span
                    className={`shrink-0 tabular-nums ${entry.executedAt ? "text-slate-400" : "text-slate-600"}`}
                  >
                    {entry.executedAt ? formatTime(entry.executedAt) : "—"}
                  </span>

                  <span className={`shrink-0 ${cfg.className}`}>
                    {cfg.icon}
                  </span>

                  <a
                    href={hashscanScheduleUrl(entry.entityId ?? entry.scheduleAddress)}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto shrink-0 text-[10px] text-hive-primary underline decoration-dotted opacity-70 hover:opacity-100"
                  >
                    HashScan ↗
                  </a>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </Panel>
  );
}
