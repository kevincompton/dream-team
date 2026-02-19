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

function normalizeWallet(value?: string) {
  return (value ?? "").trim().toLowerCase();
}

function isEvmAddress(value?: string) {
  return /^0x[0-9a-f]{40}$/i.test((value ?? "").trim());
}

function selectRoleRequests(
  requests: DashboardSnapshot["requests"],
  role: "proposer" | "validator" | "executor",
  wallet?: string,
) {
  const normalizedWallet = normalizeWallet(wallet);

  const walletMatches = requests.filter((request) => {
    if (!normalizedWallet || !isEvmAddress(normalizedWallet)) return false;
    if (role === "proposer") return normalizeWallet(request.proposer) === normalizedWallet;
    if (role === "validator") return normalizeWallet(request.validator) === normalizedWallet;
    return normalizeWallet(request.executor) === normalizedWallet;
  });

  if (walletMatches.length > 0) {
    return walletMatches;
  }

  if (role === "proposer") {
    return requests;
  }

  if (role === "validator") {
    return requests.filter((request) => !!request.validator);
  }

  return requests.filter((request) => !!request.executor || request.status === "SETTLED");
}

function toStars(reputation: number) {
  return Math.max(1, Math.min(5, Math.round(reputation / 20)));
}

function toReputation(
  role: "proposer" | "validator" | "executor",
  relatedRequests: DashboardSnapshot["requests"],
  allRequests: DashboardSnapshot["requests"],
) {
  if (relatedRequests.length === 0 || allRequests.length === 0) {
    return 55;
  }

  const settled = relatedRequests.filter((request) => request.status === "SETTLED").length;
  const executing = relatedRequests.filter((request) => request.status === "EXECUTING").length;
  const funded = relatedRequests.filter((request) => request.status === "FUNDED").length;
  const proposed = relatedRequests.filter((request) => request.status === "PROPOSED").length;
  const attested = relatedRequests.filter((request) => request.status === "ATTESTED").length;

  const participation = relatedRequests.length / Math.max(1, allRequests.length);
  const settledRatio = settled / Math.max(1, relatedRequests.length);

  const roleScore =
    role === "proposer"
      ? settled * 2.2 + funded * 1.1 + proposed * 0.8
      : role === "validator"
        ? settled * 2.6 + attested * 1.8 + executing * 0.6
        : settled * 2.8 + executing * 1.4;

  const volumeScore = Math.min(20, relatedRequests.length * 0.9);
  const participationScore = Math.min(14, participation * 14);
  const qualityScore = Math.min(16, settledRatio * 16);

  const raw = 45 + roleScore + volumeScore + participationScore + qualityScore;
  return Math.max(40, Math.min(99, Math.round(raw)));
}

function buildRoleSparkline(
  relatedRequests: DashboardSnapshot["requests"],
) {
  const now = Date.now();
  const bucketMs = 30 * 60 * 1000;

  const values = Array.from({ length: 10 }).map((_, index) => {
    const start = now - (10 - index) * bucketMs;
    const end = start + bucketMs;

    return relatedRequests.filter((request) => {
      const createdAt = request.createdAt;
      return createdAt >= start && createdAt < end;
    }).length;
  });

  if (values.some((value) => value > 0)) {
    return values;
  }

  const fallbackBase = relatedRequests.length;

  return Array.from({ length: 10 }).map((_, index) => Math.max(0, fallbackBase - (9 - index)));
}

function latestRoleActionAt(
  relatedRequests: DashboardSnapshot["requests"],
) {
  if (relatedRequests.length === 0) return Date.now();
  return Math.max(...relatedRequests.map((request) => request.createdAt));
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

    const proposerRequests = selectRoleRequests(hedera.requests, "proposer", proposerAccount);
    const validatorRequests = selectRoleRequests(hedera.requests, "validator", validatorAccount);
    const executorRequests = selectRoleRequests(hedera.requests, "executor", executorAccount);

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
          reputation: toReputation("proposer", proposerRequests, hedera.requests),
          stars: toStars(toReputation("proposer", proposerRequests, hedera.requests)),
          lastActionAt: latestRoleActionAt(proposerRequests),
          totalTransactions: proposerRequests.length,
          balance: hedera.accountBalances[proposerAccount] ?? 0,
          activitySparkline: buildRoleSparkline(proposerRequests),
        },
        {
          ...EMPTY_LIVE_SNAPSHOT.agents[1],
          state: executing > 0 ? "EXECUTING" : settled > 0 ? "SETTLED" : "IDLE",
          wallet: executorAccount,
          reputation: toReputation("executor", executorRequests, hedera.requests),
          stars: toStars(toReputation("executor", executorRequests, hedera.requests)),
          lastActionAt: latestRoleActionAt(executorRequests),
          totalTransactions: executorRequests.length,
          balance: hedera.accountBalances[executorAccount] ?? 0,
          activitySparkline: buildRoleSparkline(executorRequests),
        },
        {
          ...EMPTY_LIVE_SNAPSHOT.agents[2],
          state: executing > 0 ? "ACTIVE" : settled > 0 ? "SETTLED" : "IDLE",
          wallet: validatorAccount,
          reputation: toReputation("validator", validatorRequests, hedera.requests),
          stars: toStars(toReputation("validator", validatorRequests, hedera.requests)),
          lastActionAt: latestRoleActionAt(validatorRequests),
          totalTransactions: validatorRequests.length,
          balance: hedera.accountBalances[validatorAccount] ?? 0,
          activitySparkline: buildRoleSparkline(validatorRequests),
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