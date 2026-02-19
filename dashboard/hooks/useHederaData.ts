"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import { dashboardLog, dashboardWarn } from "@/lib/debug";
import type { HcsMessage, KnowledgeRequest } from "@/types/dashboard";
import { formatRelativeTime, randomHash } from "@/lib/utils";

interface MirrorTopicMessage {
  consensus_timestamp: string;
  message: string;
  running_hash: string;
  payer_account_id?: string;
}

interface MirrorTransaction {
  consensus_timestamp: string;
  transaction_id: string;
  result: string;
  name: string;
  entity_id?: string;
}

interface HederaDataOptions {
  enabled: boolean;
  topicId?: string;
  accountIds?: string[];
}

interface McpRecentItem {
  id: number;
  content: string;
  timestamp: number;
  validated: boolean;
  executed: boolean;
  proposer?: string;
  validator?: string;
  executor?: string;
}

interface HederaPollResult {
  connected: boolean;
  mcpConnected: boolean;
  hcsFeed: HcsMessage[];
  requests: KnowledgeRequest[];
  accountBalances: Record<string, number>;
  txCount: number;
  lastBlock: number;
  poolBalance: number;
  rewardPerTask: number;
  knowledgeCount: number;
  updatedAt: number;
}

const HBAR_DECIMALS = 8;
const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_KNOWLEDGE_POOL_CONTRACT_ADDRESS ?? process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS;

const CONTRACT_ABI = [
  "function knowledgeCount() public view returns (uint256)",
  "function getKnowledge(uint256 id) public view returns (address, string memory, uint256, bool, bool, address, address)",
  "function poolBalance() public view returns (uint256)",
  "function totalRewardPerTask() public view returns (uint256)",
];

function isZeroAddress(value?: string) {
  return !value || /^0x0{40}$/i.test(value);
}

function toKnowledgeStatus(validated: boolean, executed: boolean): KnowledgeRequest["status"] {
  if (validated && executed) return "SETTLED";
  if (validated && !executed) return "EXECUTING";
  return "PROPOSED";
}

async function fetchContractRequests(contractAddress: string): Promise<{
  requests: KnowledgeRequest[];
  poolBalance: number;
  rewardPerTask: number;
  knowledgeCount: number;
}> {
  const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
  const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, provider);

  const [knowledgeCountBn, poolBalanceBn, rewardPerTaskBn] = await Promise.all([
    contract.knowledgeCount(),
    contract.poolBalance(),
    contract.totalRewardPerTask(),
  ]);

  const knowledgeCount = Number(knowledgeCountBn);
  const poolBalance = Number(ethers.formatUnits(poolBalanceBn, HBAR_DECIMALS));
  const rewardPerTask = Number(ethers.formatUnits(rewardPerTaskBn, HBAR_DECIMALS));

  const requests: KnowledgeRequest[] = [];
  const fromId = Math.max(1, knowledgeCount - 49);

  for (let id = knowledgeCount; id >= fromId; id -= 1) {
    const [proposer, content, timestamp, validated, executed, validator, executor] = await contract.getKnowledge(id);
    requests.push({
      id,
      question: content,
      pool: rewardPerTask,
      status: toKnowledgeStatus(validated, executed),
      createdAt: Number(timestamp) * 1000,
      topicId: process.env.NEXT_PUBLIC_HCS_TOPIC_ID || "N/A",
      proposer,
      validator: isZeroAddress(validator) ? undefined : validator,
      executor: isZeroAddress(executor) ? undefined : executor,
      result: executed ? "Execution settled on-chain" : undefined,
      funders: [],
      accessFee: rewardPerTask,
      timesAccessed: 0,
    });
  }

  return {
    requests,
    poolBalance,
    rewardPerTask,
    knowledgeCount,
  };
}

function decodeBase64(value: string) {
  try {
    return atob(value);
  } catch {
    return "HCS payload";
  }
}

function formatHcsMessages(messages: MirrorTopicMessage[]): HcsMessage[] {
  return messages.map((message, index) => {
    const text = decodeBase64(message.message);
    const type = text.toLowerCase().includes("attest")
      ? "success"
      : text.toLowerCase().includes("request")
        ? "request"
        : text.toLowerCase().includes("execute")
          ? "executor"
          : "general";

    return {
      id: `${message.consensus_timestamp}-${index}`,
      timestamp: Number(message.consensus_timestamp.split(".")[0]) * 1000,
      agent: message.payer_account_id ?? "HCS",
      action: text.slice(0, 120),
      hash: message.running_hash || randomHash("hcs"),
      type,
    };
  });
}

function mapMcpItemsToRequests(items: McpRecentItem[], rewardPerTask: number): KnowledgeRequest[] {
  return items
    .slice()
    .sort((a, b) => b.id - a.id)
    .map((item) => ({
      id: item.id,
      question: item.content,
      pool: rewardPerTask,
      status: toKnowledgeStatus(item.validated, item.executed),
      createdAt: Number(item.timestamp) * 1000,
      topicId: process.env.NEXT_PUBLIC_HCS_TOPIC_ID || "N/A",
      proposer: item.proposer,
      validator: item.validator,
      executor: item.executor,
      result: item.executed ? "Execution settled on-chain" : undefined,
      funders: [],
      accessFee: rewardPerTask,
      timesAccessed: 0,
    }));
}

export function useHederaData({ enabled, topicId, accountIds = [] }: HederaDataOptions) {
  const lastBlockRef = useRef(48_000_000);
  const lastPollSummaryRef = useRef("");
  const lastPollLogAtRef = useRef(0);
  const mcpStatusRef = useRef<{ knowledgeCount: number; recentItems: McpRecentItem[] }>({
    knowledgeCount: 0,
    recentItems: [],
  });
  const [mcpConnected, setMcpConnected] = useState(false);
  const [state, setState] = useState<HederaPollResult>({
    connected: false,
    mcpConnected: false,
    hcsFeed: [],
    requests: [],
    accountBalances: {},
    txCount: 0,
    lastBlock: 48_000_000,
    poolBalance: 0,
    rewardPerTask: 0,
    knowledgeCount: 0,
    updatedAt: Date.now(),
  });

  useEffect(() => {
    if (!enabled) {
      setMcpConnected(false);
      mcpStatusRef.current = { knowledgeCount: 0, recentItems: [] };
      return;
    }

    const fetchMCPStatus = async () => {
      try {
        const res = await fetch("http://localhost:3001/status");
        if (!res.ok) {
          setMcpConnected(false);
          return;
        }

        const data = (await res.json()) as {
          knowledgeCount?: number;
          recentItems?: McpRecentItem[];
        };

        setMcpConnected(true);
        mcpStatusRef.current = {
          knowledgeCount: Number(data.knowledgeCount ?? 0),
          recentItems: Array.isArray(data.recentItems) ? data.recentItems : [],
        };
      } catch {
        setMcpConnected(false);
      }
    };

    fetchMCPStatus();
    const interval = setInterval(fetchMCPStatus, 3000);
    return () => clearInterval(interval);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      dashboardLog("HEDERA", "Polling disabled (mock mode enabled)");
      return;
    }

    dashboardLog("HEDERA", "Polling started", {
      topicId: topicId || "(none)",
      accounts: accountIds,
      intervalMs: 3000,
    }, { key: "hedera:poll:start", throttleMs: 30_000 });

    let alive = true;

    const poll = async () => {
      const next: HederaPollResult = {
        connected: false,
        mcpConnected,
        hcsFeed: [],
        requests: [],
        accountBalances: {},
        txCount: 0,
        lastBlock: lastBlockRef.current,
        poolBalance: 0,
        rewardPerTask: 0,
        knowledgeCount: 0,
        updatedAt: Date.now(),
      };

      try {
        const requests: Promise<Response>[] = [
          fetch("https://testnet.mirrornode.hedera.com/api/v1/transactions?limit=25&order=desc"),
        ];

        if (topicId) {
          requests.push(
            fetch(
              `https://testnet.mirrornode.hedera.com/api/v1/topics/${topicId}/messages?limit=25&order=desc`,
            ),
          );
        }

        for (const accountId of accountIds) {
          requests.push(fetch(`https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}`));
        }

        const responses = await Promise.all(requests);
        const txResponse = responses[0];
        if (!txResponse.ok) {
          throw new Error(`Mirror transactions API failed with ${txResponse.status}`);
        }

        const txJson = (await txResponse.json()) as { transactions?: MirrorTransaction[] };

        const transactions = txJson.transactions ?? [];
        next.txCount = transactions.length;
        next.lastBlock = lastBlockRef.current + 1;

        if (topicId && responses[1]) {
          if (responses[1].ok) {
            const topicJson = (await responses[1].json()) as { messages?: MirrorTopicMessage[] };
            next.hcsFeed = formatHcsMessages((topicJson.messages ?? []).slice(0, 25)).slice(0, 50);
          } else {
            dashboardWarn("HEDERA", "Topic messages API failed", {
              topicId,
              status: responses[1].status,
            });
          }
        }

        if (accountIds.length > 0) {
          const accountOffset = topicId ? 2 : 1;
          for (let i = 0; i < accountIds.length; i += 1) {
            const response = responses[accountOffset + i];
            if (!response) continue;

            if (!response.ok) {
              dashboardWarn("HEDERA", "Account API failed", {
                accountId: accountIds[i],
                status: response.status,
              });
              continue;
            }

            const accountJson = (await response.json()) as { balance?: { balance?: number } };
            next.accountBalances[accountIds[i]] = (accountJson.balance?.balance ?? 0) / 100_000_000;
          }
        }

        if (CONTRACT_ADDRESS) {
          try {
            const contractData = await fetchContractRequests(CONTRACT_ADDRESS);
            next.requests = contractData.requests;
            next.poolBalance = contractData.poolBalance;
            next.rewardPerTask = contractData.rewardPerTask;
            next.knowledgeCount = contractData.knowledgeCount;
          } catch {
            dashboardWarn("HEDERA", "Contract read failed; keeping mirror data only", {
              contractAddress: CONTRACT_ADDRESS,
            });
          }
        }

        const mcpStatus = mcpStatusRef.current;
        if (mcpStatus.knowledgeCount > 0) {
          next.knowledgeCount = Math.max(next.knowledgeCount, mcpStatus.knowledgeCount);
        }
        if (mcpStatus.recentItems.length > 0 && next.requests.length === 0) {
          next.requests = mapMcpItemsToRequests(mcpStatus.recentItems, next.rewardPerTask);
        }

        next.connected = true;
        const pollSummary = `${next.txCount}|${next.hcsFeed.length}|${Object.keys(next.accountBalances).length}|${next.requests.length}|${next.knowledgeCount}`;
        const now = Date.now();
        if (pollSummary !== lastPollSummaryRef.current || now - lastPollLogAtRef.current >= 30_000) {
          dashboardLog("HEDERA", "Poll success", {
            txCount: next.txCount,
            hcsMessages: next.hcsFeed.length,
            accountBalances: Object.keys(next.accountBalances).length,
            requests: next.requests.length,
            knowledgeCount: next.knowledgeCount,
          }, { key: "hedera:poll:success", throttleMs: 0 });
          lastPollSummaryRef.current = pollSummary;
          lastPollLogAtRef.current = now;
        }
      } catch (error) {
        next.connected = false;
        dashboardWarn("HEDERA", "Poll failed; live connection unavailable", {
          error: error instanceof Error ? error.message : String(error),
        }, { key: "hedera:poll:failed", throttleMs: 10_000 });
      }

      if (alive) {
        lastBlockRef.current = next.lastBlock;
        setState(next);
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      alive = false;
      clearInterval(interval);
      dashboardLog("HEDERA", "Polling stopped", undefined, { key: "hedera:poll:stopped", throttleMs: 120_000 });
    };
  }, [accountIds, enabled, topicId]);

  const derived = useMemo(() => {
    return {
      ...state,
      mcpConnected,
      lastHcsMessageAgo: formatRelativeTime(state.hcsFeed[0]?.timestamp ?? state.updatedAt),
    };
  }, [mcpConnected, state]);

  return derived;
}