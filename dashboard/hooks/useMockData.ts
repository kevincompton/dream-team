"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { dashboardLog } from "@/lib/debug";
import type {
  Agent,
  AgentState,
  DashboardSnapshot,
  HcsMessage,
  HcsMessageType,
  KnowledgeRequest,
  KnowledgeStatus,
  TransferEvent,
} from "@/types/dashboard";
import { formatRelativeTime, randomHash } from "@/lib/utils";

const FLOW: KnowledgeStatus[] = ["PROPOSED", "FUNDED", "EXECUTING", "ATTESTED", "SETTLED"];
const FLOW_WINDOW_SECONDS = 24;
const REQUEST_INTERVAL_MS = 30_000;

interface UseMockDataOptions {
  enabled?: boolean;
}

const INITIAL_AGENTS: Agent[] = [
  {
    id: "proposer",
    name: "ProposerAgent",
    emoji: "🧠",
    state: "ACTIVE",
    wallet: "0x8Ac3f07eD9f2D4B21A9CD113e74A1C7204B4fA11",
    reputation: 95,
    stars: 5,
    lastActionAt: Date.now() - 4_000,
    totalTransactions: 132,
    activitySparkline: [5, 8, 7, 11, 9, 13, 16, 10, 8, 12],
    balance: 4224.4,
    specialty: "Top Proposer",
  },
  {
    id: "executor",
    name: "ExecutorAgent",
    emoji: "⚙️",
    state: "IDLE",
    wallet: "0x1a4a86F7088B5C4d61e8B9f6C48a7dE7A7b61b21",
    reputation: 91,
    stars: 4,
    lastActionAt: Date.now() - 10_000,
    totalTransactions: 156,
    activitySparkline: [2, 4, 5, 6, 5, 8, 10, 12, 8, 7],
    balance: 5177.2,
    specialty: "Top Executor",
  },
  {
    id: "validator",
    name: "ValidatorAgent",
    emoji: "🔐",
    state: "ACTIVE",
    wallet: "0x7be0F4D0AA963304B4f99FA69f3d6A3dD553FA12",
    reputation: 94,
    stars: 5,
    lastActionAt: Date.now() - 7_000,
    totalTransactions: 143,
    activitySparkline: [4, 6, 6, 7, 11, 9, 8, 14, 12, 10],
    balance: 4710.8,
    specialty: "Top Validator",
  },
];

const QUESTIONS = [
  "How can an autonomous agent improve retrieval quality with sparse reward feedback?",
  "Design a HIP-991 attestation path for deterministic execution over HCS.",
  "Which validator heuristics reduce hallucinations in decentralized knowledge proofs?",
  "How should HIVE pricing adapt to volatile query demand over 24-hour epochs?",
  "Propose a secure escrow strategy for multi-agent execution with delayed settlement.",
  "What architecture best links Knowledge NFTs to citation graphs for provenance?",
  "How can execution slashing signals be represented in agent reputation trajectories?",
];

function requestStatusFromAge(ageSeconds: number): KnowledgeStatus {
  if (ageSeconds < FLOW_WINDOW_SECONDS) return "PROPOSED";
  if (ageSeconds < FLOW_WINDOW_SECONDS * 2) return "FUNDED";
  if (ageSeconds < FLOW_WINDOW_SECONDS * 3) return "EXECUTING";
  if (ageSeconds < FLOW_WINDOW_SECONDS * 4) return "ATTESTED";
  return "SETTLED";
}

function createRequest(id: number, createdAt: number): KnowledgeRequest {
  const question = QUESTIONS[id % QUESTIONS.length];
  return {
    id,
    question,
    pool: 15 + (id % 6) * 4.25,
    status: "PROPOSED",
    createdAt,
    topicId: `0.0.${481200 + id}`,
    result: "Validated and attested through decentralized agent consensus.",
    funders: [
      { wallet: "0x89a4...0f11", amount: 12.5 },
      { wallet: "0x32ce...9d44", amount: 7.0 },
      { wallet: "0x0af1...ce88", amount: 5.75 },
    ],
    accessFee: 1.25 + (id % 3) * 0.4,
    timesAccessed: 4 + (id % 17),
  };
}

function createFeedLine(type: HcsMessageType, action: string, agent: string, seed: string): HcsMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: Date.now(),
    type,
    action,
    agent,
    hash: randomHash(seed),
  };
}

function toAgentState(has: Record<KnowledgeStatus, boolean>, previous: AgentState): AgentState {
  if (has.EXECUTING) return "EXECUTING";
  if (has.PROPOSED || has.FUNDED || has.ATTESTED) return "ACTIVE";
  if (has.SETTLED) return "SETTLED";
  return previous === "SETTLED" ? "SETTLED" : "IDLE";
}

function getInitialSnapshot(): DashboardSnapshot {
  const now = Date.now();
  const seededRequests = [
     createRequest(1, now - 10_000),
     createRequest(2, now - 40_000),
     createRequest(3, now - 70_000),
     createRequest(4, now - 100_000),
     createRequest(5, now - 130_000),
  ];

  const updatedRequests = seededRequests.map((req) => ({
    ...req,
    status: requestStatusFromAge((now - req.createdAt) / 1000),
  }));

  return {
    agents: INITIAL_AGENTS,
    requests: updatedRequests,
    hcsFeed: [
      createFeedLine("request", "New Knowledge Request posted", "ProposerAgent", "a1"),
      createFeedLine("executor", "Executor commissioned", "ExecutorAgent", "b2"),
      createFeedLine("success", "Attestation reached quorum", "ValidatorAgent", "c3"),
      createFeedLine("general", "HCS topic heartbeat", "System", "d4"),
    ],
    transfers: [],
    economy: {
      circulating: 847_293,
      inPools: 212_440,
      distributed: 454_180,
      staked: 180_673,
      flow24h: Array.from({ length: 12 }).map((_, index) => ({
        hour: `${index * 2}h`,
        inflow: 18 + Math.round(Math.random() * 22),
      })),
    },
    graph: {
      nodes: updatedRequests.slice(0, 8).map((request, index) => ({
        id: `k-${request.id}`,
        name: `NFT-${request.id}`,
        topicId: request.topicId,
        question: request.question,
        val: 5 + (index % 3),
      })),
      links: [
        { source: "k-1", target: "k-2" },
        { source: "k-2", target: "k-3" },
        { source: "k-3", target: "k-4" },
        { source: "k-3", target: "k-5" },
      ],
    },
    liveStats: {
      txPerSecond: 4.2,
      activeAgents: 3,
      circulatingHive: 847_293,
      lastBlock: 48_291_847,
      lastHcsMessageAgo: "2s ago",
      uptime: "02:14:33",
      totalArtifacts: 7,
    },
    mode: "DEMO",
    connected: true,
    updatedAt: now,
  };
}

export function useMockData({ enabled = true }: UseMockDataOptions = {}) {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(getInitialSnapshot);
  const requestCounterRef = useRef(6);
  const lastRequestAtRef = useRef(Date.now());
  const bootRef = useRef(Date.now());

  useEffect(() => {
    if (!enabled) {
      return;
    }

    dashboardLog("MOCK", "Mock simulation started", {
      requestIntervalMs: REQUEST_INTERVAL_MS,
      flowWindowSeconds: FLOW_WINDOW_SECONDS,
    });

    const timer = setInterval(() => {
      setSnapshot((previous) => {
        const now = Date.now();
        let requests = previous.requests.map((request) => {
          const age = (now - request.createdAt) / 1000;
          const nextStatus = requestStatusFromAge(age);
          return {
            ...request,
            status: nextStatus,
            timesAccessed: request.timesAccessed + (Math.random() > 0.72 ? 1 : 0),
          };
        });

        if (now - lastRequestAtRef.current >= REQUEST_INTERVAL_MS) {
          const newRequest = createRequest(requestCounterRef.current++, now);
          requests = [newRequest, ...requests].slice(0, 20);
          lastRequestAtRef.current = now;
        }

        const previousById = new Map(previous.requests.map((request) => [request.id, request.status]));
        const changes = requests
          .map((request) => ({
            id: request.id,
            status: request.status,
            previousStatus: previousById.get(request.id),
            question: request.question,
          }))
          .filter((entry) => entry.previousStatus && entry.previousStatus !== entry.status);

        if (changes.length > 0) {
          dashboardLog(
            "MOCK",
            "Request transitions detected",
            changes.map((change) => ({ id: change.id, from: change.previousStatus, to: change.status })),
          );
        }

        const newTransferEvents: TransferEvent[] = changes
          .filter((change) => change.status === "SETTLED")
          .map((change) => ({
            id: `${change.id}-${now}`,
            fromAgentId: "proposer",
            toAgentId: "executor",
            amount: 8 + Math.round(Math.random() * 8),
            timestamp: now,
          }));

        if (newTransferEvents.length > 0) {
          dashboardLog("MOCK", "Transfer events emitted", newTransferEvents);
        }

        const feedLines = [...previous.hcsFeed];
        for (const change of changes) {
          if (change.status === "EXECUTING") {
            feedLines.unshift(
              createFeedLine("executor", `Executor commissioned for KR-${change.id}`, "ExecutorAgent", `exec-${change.id}`),
            );
          } else if (change.status === "ATTESTED") {
            feedLines.unshift(
              createFeedLine("success", `Attestation completed for KR-${change.id}`, "ValidatorAgent", `att-${change.id}`),
            );
          } else if (change.status === "SETTLED") {
            feedLines.unshift(
              createFeedLine("success", `Settlement finalized for KR-${change.id}`, "System", `set-${change.id}`),
            );
          }
        }

        if (requests[0] && !previousById.has(requests[0].id)) {
          feedLines.unshift(
            createFeedLine("request", `New knowledge request KR-${requests[0].id}`, "ProposerAgent", `req-${requests[0].id}`),
          );
        }

        const statusFlags = {
          PROPOSED: requests.some((request) => request.status === "PROPOSED"),
          FUNDED: requests.some((request) => request.status === "FUNDED"),
          EXECUTING: requests.some((request) => request.status === "EXECUTING"),
          ATTESTED: requests.some((request) => request.status === "ATTESTED"),
          SETTLED: requests.some((request) => request.status === "SETTLED"),
        };

        const nextAgents = previous.agents.map((agent) => {
          const stateByAgent: Record<string, AgentState> = {
            proposer: toAgentState(
              {
                PROPOSED: statusFlags.PROPOSED,
                FUNDED: statusFlags.FUNDED,
                EXECUTING: false,
                ATTESTED: false,
                SETTLED: statusFlags.SETTLED,
              },
              agent.state,
            ),
            validator: toAgentState(
              {
                PROPOSED: false,
                FUNDED: statusFlags.FUNDED,
                EXECUTING: false,
                ATTESTED: statusFlags.ATTESTED,
                SETTLED: statusFlags.SETTLED,
              },
              agent.state,
            ),
            executor: toAgentState(
              {
                PROPOSED: false,
                FUNDED: false,
                EXECUTING: statusFlags.EXECUTING,
                ATTESTED: false,
                SETTLED: statusFlags.SETTLED,
              },
              agent.state,
            ),
          };

          const incoming = newTransferEvents
            .filter((event) => event.toAgentId === agent.id)
            .reduce((sum, event) => sum + event.amount, 0);

          return {
            ...agent,
            state: stateByAgent[agent.id] ?? agent.state,
            lastActionAt: changes.length > 0 ? now : agent.lastActionAt,
            totalTransactions: agent.totalTransactions + Math.floor(changes.length / 2),
            activitySparkline: [...agent.activitySparkline.slice(1), Math.max(1, Math.floor(Math.random() * 16))],
            balance: Number((agent.balance + incoming).toFixed(2)),
          };
        });

        const settledCount = requests.filter((request) => request.status === "SETTLED").length;
        const executingCount = requests.filter((request) => request.status === "EXECUTING").length;

        const nextGraphNodes = [...previous.graph.nodes];
        const latestRequest = requests[0];
        if (latestRequest && !nextGraphNodes.some((node) => node.id === `k-${latestRequest.id}`)) {
          nextGraphNodes.unshift({
            id: `k-${latestRequest.id}`,
            name: `NFT-${latestRequest.id}`,
            topicId: latestRequest.topicId,
            question: latestRequest.question,
            val: 6,
          });
        }

        const nextGraphLinks = [...previous.graph.links];
        if (nextGraphNodes.length > 2 && Math.random() > 0.55) {
          nextGraphLinks.push({ source: nextGraphNodes[0].id, target: nextGraphNodes[1 + Math.floor(Math.random() * 2)].id });
        }

        const uptimeSeconds = Math.floor((now - bootRef.current) / 1000);
        const hh = String(Math.floor(uptimeSeconds / 3600)).padStart(2, "0");
        const mm = String(Math.floor((uptimeSeconds % 3600) / 60)).padStart(2, "0");
        const ss = String(uptimeSeconds % 60).padStart(2, "0");

        return {
          ...previous,
          agents: nextAgents,
          requests,
          hcsFeed: feedLines.slice(0, 50),
          transfers: [...newTransferEvents, ...previous.transfers].slice(0, 8),
          economy: {
            ...previous.economy,
            circulating: previous.economy.circulating + Math.round(Math.random() * 3),
            inPools: Math.max(100_000, previous.economy.inPools + (Math.random() > 0.5 ? 12 : -9)),
            distributed: previous.economy.distributed + settledCount,
            staked: previous.economy.staked + (Math.random() > 0.7 ? 1 : 0),
            flow24h: previous.economy.flow24h.map((item, index, all) => {
              if (index !== all.length - 1) return item;
              return { ...item, inflow: Math.max(8, Math.round(item.inflow + (Math.random() - 0.5) * 6)) };
            }),
          },
          graph: {
            nodes: nextGraphNodes.slice(0, 20),
            links: nextGraphLinks.slice(-24),
          },
          liveStats: {
            txPerSecond: Number((3.6 + Math.random() * 1.4).toFixed(1)),
            activeAgents: nextAgents.filter((agent) => agent.state !== "IDLE").length,
            circulatingHive: previous.economy.circulating,
            lastBlock: previous.liveStats.lastBlock + 1,
            lastHcsMessageAgo: formatRelativeTime(feedLines[0]?.timestamp ?? now),
            uptime: `${hh}:${mm}:${ss}`,
            totalArtifacts: 7 + settledCount + executingCount,
          },
          connected: true,
          mode: "DEMO",
          updatedAt: now,
        };
      });
    }, 3000);

    return () => {
      clearInterval(timer);
      dashboardLog("MOCK", "Mock simulation stopped");
    };
  }, [enabled]);

  const flowCounts = useMemo(() => {
    return FLOW.map((status) => ({
      status,
      count: snapshot.requests.filter((request) => request.status === status).length,
    }));
  }, [snapshot.requests]);

  return { snapshot, flowCounts };
}