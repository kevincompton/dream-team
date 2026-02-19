"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Panel } from "@/components/ui/panel";
import { useDashboardData } from "@/hooks/useDashboardData";
import { hashscanSearchUrl, truncateAddress } from "@/lib/utils";

export default function AgentsPage() {
  const [isMounted, setIsMounted] = useState(false);
  const { snapshot } = useDashboardData();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <main className="min-h-screen bg-hive-bg px-6 py-6 text-hive-text">
      <div className="mx-auto min-w-[1280px] space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Agents Detail</h1>
          <Link href="/" className="text-sm text-hive-secondary hover:text-hive-primary">
            ← Back to Dashboard
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {snapshot.agents.map((agent) => (
            <Panel key={agent.id} title={`${agent.emoji} ${agent.name}`} className="h-full">
              <div className="space-y-2 text-sm">
                <p className="font-mono text-hive-muted">{truncateAddress(agent.wallet)}</p>
                <p>State: <span className="text-hive-primary">{agent.state}</span></p>
                <p>Total transactions: <span className="font-mono">{agent.totalTransactions}</span></p>
                <p>Reputation: <span className="font-mono text-hive-secondary">{agent.reputation}</span></p>
                <p>Specialty: <span className="text-hive-muted">{agent.specialty}</span></p>
              </div>
            </Panel>
          ))}
        </div>

        <Panel title="All Transactions">
          <div className="max-h-[260px] overflow-auto rounded-md border border-hive-border/70 bg-hive-bg/40">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-hive-card text-hive-muted">
                <tr>
                  <th className="px-3 py-2">Timestamp</th>
                  <th className="px-3 py-2">Agent</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Hash</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.hcsFeed.map((message) => (
                  <tr key={message.id} className="border-t border-hive-border/60">
                    <td className="px-3 py-2 font-mono text-hive-muted">{new Date(message.timestamp).toLocaleTimeString()}</td>
                    <td className="px-3 py-2">{message.agent}</td>
                    <td className="px-3 py-2">{message.action}</td>
                    <td className="px-3 py-2 font-mono text-hive-secondary">
                      <a href={hashscanSearchUrl(message.hash)} target="_blank" rel="noreferrer" className="underline decoration-dotted">
                        {truncateAddress(message.hash, 10, 6)}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Reputation History">
          <div className="h-64 rounded-md border border-hive-border/70 bg-hive-bg/40 p-2">
            {isMounted ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
                <LineChart
                  data={Array.from({ length: 12 }).map((_, index) => ({
                    epoch: index,
                    proposer: 80 + Math.round(Math.random() * 18),
                    executor: 78 + Math.round(Math.random() * 20),
                    validator: 82 + Math.round(Math.random() * 16),
                  }))}
                >
                  <XAxis dataKey="epoch" stroke="#64748B" />
                  <YAxis stroke="#64748B" domain={[70, 100]} />
                  <Line type="monotone" dataKey="proposer" stroke="#00FFA3" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="executor" stroke="#FFB800" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="validator" stroke="#00D4FF" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full rounded-sm bg-hive-border/20" />
            )}
          </div>
        </Panel>
      </div>
    </main>
  );
}