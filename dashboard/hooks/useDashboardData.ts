"use client";

import { useEffect, useMemo } from "react";
import { dashboardLog, dashboardWarn } from "@/lib/debug";
import { useHederaData } from "@/hooks/useHederaData";
import { useMockData } from "@/hooks/useMockData";
import type { DashboardSnapshot, KnowledgeStatus } from "@/types/dashboard";

const EMPTY_LIVE_SNAPSHOT: DashboardSnapshot = {
  agents: [
    {
      id: "proposer",
      name: "ProposerAgent",
      emoji: "🧠",
      state: "IDLE",
      wallet: "n/a",
      reputation: 95,
      stars: 5,
      lastActionAt: Date.now(),
      totalTransactions: 0,
      activitySparkline: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      balance: 0,
      specialty: "Top Proposer",
    },
    {
      id: "executor",
      name: "ExecutorAgent",
      emoji: "⚙️",
      state: "IDLE",
      wallet: "n/a",
      reputation: 91,
      stars: 4,
      lastActionAt: Date.now(),
      totalTransactions: 0,
      activitySparkline: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      balance: 0,
      specialty: "Top Executor",
    },
    {
      id: "validator",
      name: "ValidatorAgent",
      emoji: "🔐",
      state: "IDLE",
      wallet: "n/a",
      reputation: 94,
      stars: 5,
      lastActionAt: Date.now(),
      totalTransactions: 0,
      activitySparkline: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      balance: 0,
      specialty: "Top Validator",
    },
  ],
  requests: [],
  hcsFeed: [],
  transfers: [],
  economy: {
    circulating: 0,
    inPools: 0,
    distributed: 0,
    staked: 0,
    flow24h: Array.from({ length: 12 }).map((_, index) => ({ hour: `${index * 2}h`, inflow: 0 })),
  },
  graph: { nodes: [], links: [] },
  liveStats: {
    txPerSecond: 0,
    activeAgents: 0,
    circulatingHive: 0,
    lastBlock: 48_000_000,
    lastHcsMessageAgo: "n/a",
    uptime: "00:00:00",
    totalArtifacts: 0,
  },
  mode: "LIVE",
  connected: false,
  updatedAt: Date.now(),
};

function countByStatus(target: KnowledgeStatus, requests: DashboardSnapshot["requests"]) {
  return requests.filter((request) => request.status === target).length;
}

export function useDashboardData() {
  const useMock = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
  const topicId = process.env.NEXT_PUBLIC_HCS_TOPIC_ID;
  const accountIds = useMemo(
    () =>
      (process.env.NEXT_PUBLIC_AGENT_ACCOUNT_IDS ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    [],
  );

  const { snapshot } = useMockData({ enabled: useMock });
  const hedera = useHederaData({ enabled: !useMock, topicId, accountIds });

  useEffect(() => {
    dashboardLog("DATA", "Hook initialized", {
      mode: useMock ? "DEMO" : "LIVE",
      topicId: topicId || "(none)",
      accountCount: accountIds.length,
    });
  }, [accountIds.length, topicId, useMock]);

  const merged = useMemo(() => {
    if (useMock) {
      dashboardLog("DATA", "Using mock snapshot", {
        requests: snapshot.requests.length,
        feed: snapshot.hcsFeed.length,
      });

      return {
        ...snapshot,
        mode: "DEMO" as const,
        connected: true,
      };
    }

    if (!hedera.connected) {
      dashboardWarn("DATA", "Live mode unavailable; returning empty LIVE snapshot", {
        txCount: hedera.txCount,
        feed: hedera.hcsFeed.length,
      }, { key: "data:live:unavailable", throttleMs: 15_000 });

      return {
        ...EMPTY_LIVE_SNAPSHOT,
        connected: false,
        updatedAt: Date.now(),
      };
    }

    dashboardLog("DATA", "Using LIVE snapshot", {
      txCount: hedera.txCount,
      feed: hedera.hcsFeed.length,
      lastBlock: hedera.lastBlock,
    }, { key: "data:live:snapshot", throttleMs: 30_000 });

    const proposerAccount = accountIds[0] ?? "0.0.n/a";
    const executorAccount = accountIds[1] ?? "0.0.n/a";
    const validatorAccount = accountIds[2] ?? "0.0.n/a";

    const executing = hedera.requests.filter((request) => request.status === "EXECUTING").length;
    const settled = hedera.requests.filter((request) => request.status === "SETTLED").length;
    const proposed = hedera.requests.filter((request) => request.status === "PROPOSED").length;

    const nextSnapshot: DashboardSnapshot = {
      ...EMPTY_LIVE_SNAPSHOT,
      mode: "LIVE",
      connected: true,
      requests: hedera.requests,
      hcsFeed: hedera.hcsFeed,
      economy: {
        circulating: hedera.poolBalance,
        inPools: hedera.poolBalance,
        distributed: settled * hedera.rewardPerTask,
        staked: 0,
        flow24h: Array.from({ length: 12 }).map((_, index) => ({
          hour: `${index * 2}h`,
          inflow: Number((hedera.txCount / 2 + index % 3).toFixed(2)),
        })),
      },
      graph: {
        nodes: hedera.requests.slice(0, 20).map((request) => ({
          id: `k-${request.id}`,
          name: `NFT-${request.id}`,
          topicId: request.topicId,
          question: request.question,
          val: request.status === "SETTLED" ? 7 : 5,
        })),
        links: hedera.requests.slice(1, 12).map((request, index) => ({
          source: `k-${hedera.requests[index].id}`,
          target: `k-${request.id}`,
        })),
      },
      agents: [
        {
          ...EMPTY_LIVE_SNAPSHOT.agents[0],
          state: proposed > 0 ? "ACTIVE" : "IDLE",
          wallet: proposerAccount,
          lastActionAt: Date.now(),
          totalTransactions: hedera.requests.length,
          balance: hedera.accountBalances[proposerAccount] ?? 0,
          activitySparkline: Array.from({ length: 10 }).map((_, index) => (index % 2 === 0 ? proposed : executing)),
        },
        {
          ...EMPTY_LIVE_SNAPSHOT.agents[1],
          state: executing > 0 ? "EXECUTING" : settled > 0 ? "SETTLED" : "IDLE",
          wallet: executorAccount,
          lastActionAt: Date.now(),
          totalTransactions: settled,
          balance: hedera.accountBalances[executorAccount] ?? 0,
          activitySparkline: Array.from({ length: 10 }).map((_, index) => (index % 2 === 0 ? executing : settled)),
        },
        {
          ...EMPTY_LIVE_SNAPSHOT.agents[2],
          state: executing > 0 ? "ACTIVE" : settled > 0 ? "SETTLED" : "IDLE",
          wallet: validatorAccount,
          lastActionAt: Date.now(),
          totalTransactions: hedera.requests.filter((request) => request.validator).length,
          balance: hedera.accountBalances[validatorAccount] ?? 0,
          activitySparkline: Array.from({ length: 10 }).map((_, index) =>
            index % 2 === 0 ? hedera.requests.filter((request) => !!request.validator).length : executing,
          ),
        },
      ],
      liveStats: {
        txPerSecond: Number((Math.max(hedera.txCount / 3, 0.2)).toFixed(1)),
        activeAgents: [proposed > 0, executing > 0, hedera.requests.some((request) => !!request.validator)].filter(Boolean).length,
        circulatingHive: hedera.poolBalance,
        lastBlock: hedera.lastBlock,
        lastHcsMessageAgo: hedera.lastHcsMessageAgo,
        uptime: "LIVE",
        totalArtifacts: hedera.knowledgeCount,
      },
      updatedAt: hedera.updatedAt,
    };

    return nextSnapshot;
  }, [accountIds, hedera, snapshot, useMock]);

  const flowCounts = useMemo(() => {
    const statuses: KnowledgeStatus[] = ["PROPOSED", "FUNDED", "EXECUTING", "ATTESTED", "SETTLED"];
    return statuses.map((status) => ({
      status,
      count: countByStatus(status, merged.requests),
    }));
  }, [merged.requests]);

  return {
    snapshot: merged,
    flowCounts,
    mcpConnected: hedera.mcpConnected,
  };
}