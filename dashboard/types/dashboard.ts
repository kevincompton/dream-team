export type AgentState = "IDLE" | "ACTIVE" | "EXECUTING" | "SETTLED";
export type KnowledgeStatus = "PROPOSED" | "FUNDED" | "EXECUTING" | "ATTESTED" | "SETTLED";
export type HcsMessageType = "success" | "request" | "executor" | "general";

export interface Agent {
  id: string;
  name: string;
  emoji: string;
  state: AgentState;
  wallet: string;
  reputation: number;
  stars: number;
  lastActionAt: number;
  totalTransactions: number;
  activitySparkline: number[];
  balance: number;
  specialty: string;
}

export interface Funder {
  wallet: string;
  amount: number;
}

export interface KnowledgeRequest {
  id: number;
  question: string;
  pool: number;
  status: KnowledgeStatus;
  createdAt: number;
  topicId: string;
  proposer?: string;
  validator?: string;
  executor?: string;
  result?: string;
  funders: Funder[];
  accessFee: number;
  timesAccessed: number;
}

export interface HcsMessage {
  id: string;
  timestamp: number;
  agent: string;
  action: string;
  hash: string;
  type: HcsMessageType;
  topicId?: string;
}

export interface TransferEvent {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  amount: number;
  timestamp: number;
}

export interface EconomyFlowItem {
  hour: string;
  inflow: number;
}

export interface EconomyData {
  circulating: number;
  inPools: number;
  distributed: number;
  staked: number;
  flow24h: EconomyFlowItem[];
}

export interface GraphNode {
  id: string;
  name: string;
  topicId: string;
  question: string;
  val: number;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface LiveStats {
  txPerSecond: number;
  activeAgents: number;
  circulatingHive: number;
  lastBlock: number;
  lastHcsMessageAgo: string;
  uptime: string;
  totalArtifacts: number;
}

export interface DashboardSnapshot {
  agents: Agent[];
  requests: KnowledgeRequest[];
  hcsFeed: HcsMessage[];
  transfers: TransferEvent[];
  economy: EconomyData;
  graph: {
    nodes: GraphNode[];
    links: GraphLink[];
  };
  liveStats: LiveStats;
  mode: "LIVE" | "DEMO";
  connected: boolean;
  updatedAt: number;
}