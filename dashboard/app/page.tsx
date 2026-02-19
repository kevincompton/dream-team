"use client";

import { useEffect, useMemo, useState } from "react";
import { AgentStatusPanel } from "@/components/dashboard/AgentStatusPanel";
import { BottomStatusBar } from "@/components/dashboard/BottomStatusBar";
import { EconomyPanel } from "@/components/dashboard/EconomyPanel";
import { HcsFeedPanel } from "@/components/dashboard/HcsFeedPanel";
import { KnowledgeFlowPanel } from "@/components/dashboard/KnowledgeFlowPanel";
import { KnowledgeGraphPanel } from "@/components/dashboard/KnowledgeGraphPanel";
import { ReputationLeaderboard } from "@/components/dashboard/ReputationLeaderboard";
import { TopNavbar } from "@/components/dashboard/TopNavbar";
import { TransferAnimationOverlay } from "@/components/dashboard/TransferAnimationOverlay";
import { UserHistoryPanel } from "@/components/dashboard/UserHistoryPanel";
import { useDashboardData } from "@/hooks/useDashboardData";
import { dashboardLog } from "@/lib/debug";

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);
  const { snapshot, flowCounts, mcpConnected } = useDashboardData();
  const latestTransfer = useMemo(() => snapshot.transfers[0], [snapshot.transfers]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    dashboardLog("PAGE", "Dashboard mounted");
    return () => dashboardLog("PAGE", "Dashboard unmounted");
  }, []);

  useEffect(() => {
    dashboardLog("PAGE", "Snapshot updated", {
      mode: snapshot.mode,
      connected: snapshot.connected,
      requests: snapshot.requests.length,
      feed: snapshot.hcsFeed.length,
      txPerSecond: snapshot.liveStats.txPerSecond,
      lastBlock: snapshot.liveStats.lastBlock,
    }, { key: "page:snapshot:updated", throttleMs: 30_000 });
  }, [snapshot]);

  useEffect(() => {
    const layoutDebugEnabled = process.env.NEXT_PUBLIC_DASHBOARD_LAYOUT_DEBUG === "true";
    if (!layoutDebugEnabled) {
      return;
    }

    const detectOverlap = () => {
      const panels = Array.from(document.querySelectorAll<HTMLElement>("[data-panel-id]"));
      const rects = panels.map((panel) => ({ id: panel.dataset.panelId || "unknown", rect: panel.getBoundingClientRect() }));

      dashboardLog(
        "LAYOUT",
        "Panel bounds",
        rects.map((entry) => ({
          id: entry.id,
          x: Math.round(entry.rect.x),
          y: Math.round(entry.rect.y),
          w: Math.round(entry.rect.width),
          h: Math.round(entry.rect.height),
        })),
        { key: "layout:panel:bounds", throttleMs: 30_000 },
      );

      const overlaps: Array<{ a: string; b: string }> = [];
      for (let i = 0; i < rects.length; i += 1) {
        for (let j = i + 1; j < rects.length; j += 1) {
          const a = rects[i];
          const b = rects[j];

          const intersects =
            a.rect.left < b.rect.right &&
            a.rect.right > b.rect.left &&
            a.rect.top < b.rect.bottom &&
            a.rect.bottom > b.rect.top;

          if (intersects) {
            overlaps.push({ a: a.id, b: b.id });
          }
        }
      }

      if (overlaps.length > 0) {
        dashboardLog("LAYOUT", "Overlap detected", overlaps);
      }
    };

    const timer = setInterval(detectOverlap, 5000);
    detectOverlap();
    return () => clearInterval(timer);
  }, []);

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-hive-bg text-hive-text">
        <main className="mx-auto w-full max-w-[1700px] px-6 py-8">
          <div className="h-8 w-56 animate-pulse rounded bg-hive-border/30" />
          <div className="mt-4 h-[760px] animate-pulse rounded-xl border border-hive-border bg-hive-card/40" />
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-hive-bg text-hive-text">
      <TopNavbar snapshot={snapshot} mcpConnected={mcpConnected} />

      <main className="mx-auto w-full max-w-[1700px] px-6 py-4 pb-8">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(300px,1fr)_minmax(520px,2fr)_minmax(300px,1fr)]">
          <section data-panel-id="left-column" className="min-h-0">
            <AgentStatusPanel agents={snapshot.agents} />
          </section>

          <section
            data-panel-id="center-column"
            className="grid min-h-0 grid-rows-[minmax(360px,auto)_minmax(360px,auto)] gap-4"
          >
            <KnowledgeFlowPanel requests={snapshot.requests} flowCounts={flowCounts} />
            <HcsFeedPanel messages={snapshot.hcsFeed} />
          </section>

          <section
            data-panel-id="right-column"
            className="grid min-h-0 grid-rows-[minmax(320px,auto)_minmax(280px,auto)_minmax(240px,auto)_minmax(280px,auto)] gap-4"
          >
            <EconomyPanel economy={snapshot.economy} />
            <KnowledgeGraphPanel nodes={snapshot.graph.nodes} links={snapshot.graph.links} />
            <ReputationLeaderboard agents={snapshot.agents} />
            <UserHistoryPanel requests={snapshot.requests} />
          </section>
        </div>
      </main>

      <BottomStatusBar liveStats={snapshot.liveStats} />
      <TransferAnimationOverlay transfer={latestTransfer} />
    </div>
  );
}
