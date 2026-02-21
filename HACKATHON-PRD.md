# HIVE Protocol — Hackathon PRD (v3)

> **Tracks**: Killer App for the Agentic Society (OpenClaw) · On-chain Automation with Hedera Schedule Service
> **Project**: HIVE Protocol — Autonomous Knowledge Marketplace
> **Status**: MVP fully live on Hedera testnet · All core features complete ✅
> **Last updated**: v3 — agent-native reframe, dashboard complete, OpenClaw via HCS

---

## ⚠️ Risk Register (Read First)

| Risk | Severity | Status | Action |
|---|---|---|---|
| Dashboard public URL required | **Submission blocker** | ✅ CLEARED — live at dream-team-dashboard.vercel.app | None |
| Schedule lifecycle UI required for Track 2 | **High** | ✅ CLEARED — `ScheduleTimelinePanel` deployed | None |
| Contract-driven scheduling (not off-chain cron) | **Was critical** | ✅ CLEARED — `KnowledgePool.sol` inherits `HederaScheduleService`, calls `scheduleCall(0x16b)` | None |
| Demo video (<3 min) | **Submission blocker** | 🚨 TODO | Record before submission |
| No external validation | **Moderate** | ⚠️ All usage internal | Get 1–2 external agents / operators to query via HCS before submission |
| UCP message schema | **Bonus** | ✅ CLEARED | Highlight in pitch |
| ERC-8004 reputation | **Nice-to-have** | ✅ `ReputationLeaderboard` panel in dashboard | Confirm data source is live |

---

## 1. Problem Statement

**The emerging agentic society has no knowledge layer. Autonomous AI agents cannot reliably hire specialist agents, pay for verified information, or trust what they receive — without a centralised intermediary.**

As AI agents proliferate across on-chain and off-chain systems, they increasingly need to *hire* other agents — sourcing real-time sensor data, domain expertise, or computation they cannot produce themselves. Today this is solved by hard-wiring API calls between specific agents or relying on centralised orchestrators that create single points of failure and zero economic incentive for specialisation.

**Target Users** (agents, not humans):
- **Primary**: OpenClaw AI agents — autonomous agents that need verified knowledge they cannot produce themselves, discovered and paid for via Hedera-native protocols
- **Secondary**: Developers and organisations deploying specialised data-collection agents (sensors, indexers, oracles) who want to monetise their output with zero infrastructure overhead
- **Observing audience**: Human operators watching the agent economy through a read-only dashboard

**Current Solutions & Why They Fail**:
| Approach | Problem |
|---|---|
| Centralised APIs (OpenAI, Perplexity) | Single point of failure; no agent-to-agent economy; no verifiable attestation |
| Centralised orchestrators (LangChain, AutoGPT) | Human-operated; no on-chain settlement; no reputation |
| Manual agent wiring | Breaks at scale; no discovery; no payment rail |

**Why Web3**:
Web2 cannot provide: (1) trustless payment settlement between agents with no human in the loop, (2) immutable verifiable attestation of knowledge quality, (3) a permissionless market where any agent can join and immediately start earning or consuming. Only Hedera's HCS + HTS + EVM combination provides sub-second finality, fee-level programmable economics (HIP-991), and tamper-proof consensus — at a cost low enough for high-frequency agent transactions.

---

## 2. Solution Overview

HIVE Protocol is an **autonomous knowledge marketplace** where AI agents fund research, verify results on Hedera, and settle value — all without human intervention.

An OpenClaw agent sends a message to a HIVE inbound HCS topic. The MCP (Master Control Program) detects the request and calls `proposeKnowledge()` on the smart contract. Three autonomous HIVE agents — **Proposer**, **Executor**, and **Validator** — run the `propose → validate → execute` cycle entirely on Hedera. The Validator pays into HIP-991 Executor topics to retrieve data, attests quality on-chain, and publishes the result to a HCS-2 indexed Knowledge topic. Value flows automatically: Validators pay Executors to query their data, Executors earn royalties continuously. The more Executors join, the richer the knowledge graph. The more agents join, the higher fee revenue — a genuine network-effect flywheel, fully on Hedera.

**Track Alignment**:
- **Killer App for the Agentic Society**: HIVE is agent-native by design. OpenClaw agents communicate with HIVE via HCS topics — no human messaging layer, no chatbot. All commerce is mediated by HIP-991 topic fees. Agents discover, rank (reputation), and trade with each other using Hedera's native payment rails. The dashboard is a human observation window only.
- **On-Chain Automation with Hedera Schedule Service**: `KnowledgePool.sol` inherits `HederaScheduleService` and directly calls the `0x16b` system contract. The `pulse()` function self-reschedules on every execution — a true on-chain recursive automation loop. No off-chain cron. Every schedule is observable on HashScan.

### Key Features — Status [v3]

| Feature | Status | Track Relevance |
|---|---|---|
| Autonomous 3-Agent Loop (Proposer → Executor → Validator) | ✅ Done | Track 1 |
| HIP-991 Paid Knowledge Topics (0.1 HBAR per read) | ✅ Done | Track 1 |
| HCS-native Executor Topics (HIP-991 economy) | ✅ Done | Track 1 |
| hedera-agent-kit v3.0.7 (stock plugins + custom tools) | ✅ Done | Track 1 |
| Inter-agent HCS-10 communication | ✅ Done | Track 1 |
| MCP Gateway + OpenClaw HCS integration | ✅ Done | Track 1 |
| HCS-2 Knowledge topic indexing | ✅ Done | Track 1 |
| UCP-compliant message schema in HCS payloads | ✅ Done **[NEW v3]** | Track 1 bonus |
| ReputationLeaderboard dashboard panel | ✅ Done **[NEW v3]** | Track 1 nice-to-have |
| HIP-755 / HIP-1215 Contract-Driven Scheduling | ✅ Done | Track 2 |
| ScheduleTimelinePanel in dashboard | ✅ Done **[NEW v3]** | Track 2 |
| KnowledgeFlowPanel (PROPOSED → SETTLED lifecycle) | ✅ Done **[NEW v3]** | Track 1 + 2 |
| UserHistoryPanel + TransferAnimationOverlay | ✅ Done **[NEW v3]** | Track 1 |
| Validator real-time HCS topic subscription | ✅ Done **[NEW v3]** | Track 1 |
| MCP `/research` blocking endpoint (waits for settlement) | ✅ Done **[NEW v3]** | Track 1 |
| Live dashboard deployed (dream-team-dashboard.vercel.app) | ✅ Done **[NEW v3]** | Both |
| Demo video (<3 min) | 🚨 TODO | Both |
| External agent validation (non-team HCS query) | ⚠️ Needs action | Track 1 |

### Non-Goals (v1)

- No user-facing wallet connection — agents transact autonomously; dashboard is read-only
- No mainnet deployment during hackathon (testnet only — explicitly allowed by Track 2)
- No cross-chain bridges
- No human-operated knowledge submission UI
- No fine-tuning or custom LLM training

---

## 3. Hedera Integration Architecture

### Network Services Used

| Service | Purpose | Why This Service? |
|---|---|---|
| **Hedera EVM** | `KnowledgePool.sol` — propose/validate/execute state machine with HBAR reward distribution | EVM compatibility; native HBAR settlement; hashio RPC sub-second confirmation |
| **HCS (TopicCreateTransaction)** | Each validated knowledge item becomes a permanent HCS topic; all inter-agent communication flows through HCS | Immutable, timestamped, tamper-proof; native to Hedera; supports custom fees; enables agent-to-agent comms |
| **HIP-991 (Custom Fixed Fees)** | Executor topics charge Validator 0.1 HBAR to query; Knowledge topics charge agents to read | Programmable fee economy at the protocol layer — no smart contract needed for payment routing |
| **HIP-755 / HIP-1215 (Schedule Service)** | `KnowledgePool.sol` inherits `HederaScheduleService`, calls `scheduleCall()` on `0x16b`; `pulse()` self-reschedules | Contract-driven: the smart contract (not a backend) creates and chains schedules. Observable on HashScan. |
| **HCS-10 Message Format** | Standardised JSON envelope for all inter-agent HCS messages | Protocol-level interoperability — any HCS-10 aware agent can communicate with HIVE |
| **HCS-2 Standard** | Knowledge topics indexed per HCS-2 for discoverability | Any standards-compliant agent can discover HIVE Knowledge topics without custom integration |
| **Mirror Node API** | Dashboard: polls `DeviceCommand` events, topic messages, balances, schedule lifecycle | Zero custom indexer; always in sync with chain |
| **hedera-agent-kit v3.0.7** | LangChain toolkit powering all three agents | Official Hedera agent framework; stock plugins handle low-level ops; custom tools encapsulate HIVE protocol logic |
| **@hashgraph/sdk** | `TopicCreateTransaction`, `CustomFixedFee`, HIP-991 message submission | Native SDK for correct fee application |

### hedera-agent-kit Plugin Architecture

Each agent uses `HederaLangchainToolkit` with stock plugins as a foundation, extended with custom LangChain `StructuredTool` classes:

| Agent | Stock Plugins | Custom Tools |
|---|---|---|
| **Proposer** | `coreConsensusPlugin`, `coreQueriesPlugin` | `ProposeKnowledgeTool`, `KnowledgeCountTool`, `CountUnexecutedTool` |
| **Executor** | `coreHTSPlugin`, `coreAccountPlugin`, `coreConsensusPlugin`, `coreQueriesPlugin` | `ExecuteKnowledgeTool`, `PoolBalanceTool`, `GetKnowledgeTool` |
| **Validator** | `coreConsensusPlugin`, `coreQueriesPlugin` | `ValidateKnowledgeTool`, `CreateKnowledgeTopicTool`, `SendHip991MessageTool`, `GetKnowledgeTool` |

This is the recommended hedera-agent-kit pattern: stock plugins handle low-level Hedera operations; custom tools encapsulate protocol-specific business logic. The LLM backbone is configurable (default: gpt-4o-mini via AI Gateway; `claude-sonnet-4-6` supported).

### HIP-755 Contract-Driven Scheduling

```solidity
contract KnowledgePool is HederaScheduleService {
    // Owner calls startPulse() once → contract takes over permanently
    function startPulse(uint256 intervalSeconds) external {
        require(msg.sender == owner, "Not owner");
        pulseInterval = intervalSeconds;
        _schedulePulse(block.timestamp + intervalSeconds);
    }

    // Called by Hedera Schedule Service at the scheduled time; self-reschedules
    function pulse() external {
        // ... emits DeviceCommand events ...
        if (pulseInterval > 0) {
            _schedulePulse(block.timestamp + pulseInterval);
        }
    }

    // Contract calls scheduleCall() on 0x16b — fully on-chain
    function _schedulePulse(uint256 time) internal {
        bytes memory callData = abi.encodeWithSelector(this.pulse.selector);
        (int64 rc, address scheduleAddress) = scheduleCall(
            address(this), time, PULSE_GAS_LIMIT, 0, callData
        );
        emit PulseScheduled(scheduleAddress, nextPulseId, time);
    }
}
```

Backend (`mcp.ts`) only **observes** `DeviceCommand` events via Mirror Node — it does not initiate scheduling.

### HCS-10 Inter-Agent Communication

All agent-to-agent messages use the HCS-10 protocol envelope — this is the agent communication layer, not a human messaging platform:

```json
{
  "p": "hcs-10",
  "op": "message",
  "operator_id": "<topicId>@<accountId>",
  "data": {
    "accountId": "<senderAccountId>",
    "value": "<message content>"
  }
}
```

The MCP bridges `DeviceCommand` events from the contract to HCS inbound topics using this format. OpenClaw sensors communicate with HIVE agents via HCS — all messages flow through Hedera Consensus Service. Agents parse inbound HCS-10 messages and classify them automatically: sensor data request, sensor data reply, knowledge query, or unknown.

### Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         HIVE PROTOCOL — HEDERA LAYER                     │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  OpenClaw Agent (sensor / client)                                         │
│       ↓  HCS message to inbound topic                                     │
│  MCP Server (port 3001) ←── Mirror Node: polls DeviceCommand events      │
│       ↓  proposeKnowledge()                                               │
│  ┌─────────────────────────────────────────────────────────────────┐      │
│  │  KnowledgePool.sol (Hedera EVM)                                 │      │
│  │  propose → validate → execute   HBAR rewards to all 3 agents   │      │
│  │  HIP-1215: pulse() self-schedules via scheduleCall(0x16b)       │      │
│  │  DeviceCommand events → MCP bridge → HCS inbound topics         │      │
│  └───────────┬─────────────────────────────────────────────────────┘      │
│              │  hedera-agent-kit (stock plugins + custom tools)           │
│  ┌───────────▼────────────┐                                               │
│  │   EXECUTOR TOPICS      │  (HIP-991 paid — Validator pays to query)     │
│  │   One per Executor     │  HCS-2 indexed for discovery                  │
│  └───────────┬────────────┘                                               │
│              │  Validator pays → reads → attests                          │
│  ┌───────────▼────────────┐                                               │
│  │   KNOWLEDGE TOPICS     │  (HIP-991 paid — agents pay to read)          │
│  │   Attested answers     │  HCS-10 + UCP schema · HCS-2 indexed          │
│  └───────────┬────────────┘                                               │
│              │  MCP reads (fee-exempt) → returns to OpenClaw              │
│  OpenClaw Agent receives verified knowledge answer                        │
│                                                                           │
│  Inter-agent HCS topics: Proposer ↔ Validator ↔ Executor (HCS-10 comms) │
└──────────────────────────────────────────────────────────────────────────┘

 Dashboard (Next.js 14) — human observer window:
   AgentStatus | EconomyPanel | HCSFeed | ScheduleTimeline
   KnowledgeFlow | KnowledgeGraph | ReputationLeaderboard
   UserHistory | TransferAnimation | BottomStatusBar
```

### Ecosystem Integrations

| Partner/Platform | Integration | Value Added |
|---|---|---|
| **OpenClaw** | Sensors and agents communicate via HCS inbound topics; MCP bridges contract events | HIVE is the knowledge backend for the OpenClaw agent network — agent-to-agent, no human messaging layer |
| **HashScan** | Every on-chain action logs a HashScan link in agent output | Instant verifiability for judges and observers |
| **HCS-2** | Knowledge topics registered per HCS-2 standard | Any HCS-2 aware agent can discover HIVE topics without custom integration |
| **HCS-10** | All inter-agent messages use HCS-10 protocol envelope | Protocol-level interoperability with any HCS-10 agent |
| **UCP** | UCP-compliant message schema in Knowledge topic payloads | Bonus: any UCP-aware agent can trade with HIVE Executors without custom integration |

---

## 4. Hedera Network Impact

### Account Creation

- Each new Executor agent requires a dedicated Hedera account (separate private key to avoid nonce collisions)
- OpenClaw agents that query Knowledge topics (pay to read) require Hedera accounts for HBAR payment
- **Estimated accounts at hackathon**: 4–6 (3 agents + operator + 1–2 demo operators)
- **Estimated accounts at 6 months** (10 Executor operators × avg 2 Executors): 20–30 agent accounts + 100–500 consumer agent accounts

### Active Accounts

- The autonomous agent loop generates transactions continuously (every 45–60s per cycle). All 3 agent accounts are active every polling interval.
- HIP-755 `pulse()` adds scheduled transactions at the configured interval, keeping accounts active between knowledge cycles.
- **Estimated MAA at launch**: 3–6 (agents + demo users)
- **Estimated MAA at scale**: 50–200 (agents + regular knowledge consumers)

### Transactions Per Second (TPS) Impact

Each full knowledge cycle generates:

| Transaction | Hedera Service |
|---|---|
| `proposeKnowledge()` | Hedera EVM |
| `validateKnowledge()` | Hedera EVM |
| `TopicCreateTransaction` (HIP-991 Knowledge topic) | HCS |
| `executeKnowledge()` + 3× HBAR transfers | Hedera EVM |
| `scheduleCall()` in `_schedulePulse()` | Schedule Service (0x16b) |
| `pulse()` executed by Schedule Service | Hedera EVM + Schedule Service |
| Agent pays to read Knowledge topic | HCS |
| Inter-agent HCS-10 messages | HCS |

**~8 transactions per knowledge cycle** · At 1 cycle/minute with 5 Executors: ~0.67 TPS sustained. At scale (100 Executors, 1000 daily queries): meaningful TPS contribution.

### Audience Exposure

- **AI developer community**: Builders of OpenClaw agents and LangChain/AutoGPT developers looking for Hedera-native agent infrastructure
- **IoT/sensor operators**: Organisations with real-time data streams who can monetise as Executors
- **Enterprise AI teams**: Companies building multi-agent workflows that need verifiable knowledge provenance
- **Target market size**: $4.6B agentic AI market (2024, Grand View Research), growing 45% CAGR → ~$20B by 2028

---

## 5. Innovation & Differentiation

### Ecosystem Gap

No existing Hedera project provides a **programmable, autonomous knowledge economy where agents hire agents**. HCS has been used for tokens and audit trails — but never as the economic rail for an agent-to-agent knowledge marketplace where fees flow automatically at the HCS protocol layer (HIP-991). HIVE adds hedera-agent-kit as the agent intelligence layer, making it uniquely composable with the broader Hedera agent ecosystem.

### Cross-Chain Comparison

| Platform | What it does | HIVE difference |
|---|---|---|
| Bittensor (TAO) | Decentralised ML network with token incentives | Requires validators to run GPU nodes; not agent-native; no HCS attestation |
| Fetch.ai | Agent marketplace on Cosmos | Web3-native but no programmable fee topics; not OpenClaw integrated |
| Ritual | Onchain AI inference | Inference only; no knowledge accumulation; no pay-to-read topic economy |
| **HIVE** | Knowledge marketplace via HCS topic fees | HIP-991 at the topic protocol layer — no contract needed for fee routing. First agent-to-agent knowledge market on Hedera. |

### Novel Hedera Usage

1. **HIP-991 as a native payment rail between agents** — `CustomFixedFee` on HCS topics means Executor agents automatically earn HBAR when their topic is queried, with zero smart contract involvement.
2. **HIP-755 contract-driven self-scheduling** — `KnowledgePool.sol` creates recursive Hedera Schedule Service calls from within Solidity, making the automation cadence enforced and auditable on-chain.
3. **hedera-agent-kit as the AI-Hedera bridge** — stock plugins + custom tools give each agent native Hedera capabilities. First known deployment of hedera-agent-kit in an autonomous multi-agent knowledge marketplace.
4. **HCS-10 as the agent communication protocol** — all inter-agent messages use the standardised HCS-10 envelope. Any HCS-10 aware agent in the ecosystem can interoperate with HIVE without custom integration.
5. **UCP-compliant knowledge payloads** — Knowledge topic messages use UCP schema, enabling any UCP-aware agent to discover and trade with HIVE Executors without custom integration.
6. **HCS-2 standard for knowledge indexing** — knowledge topics registered per HCS-2 so they are discoverable by any standards-compliant agent or application.

---

## 6. Feasibility & Business Model

### Technical Feasibility

- **Hedera Services Required**: HCS (HIP-991, HCS-2, HCS-10), Hedera EVM, Scheduled Transactions (HIP-755/HIP-1215), Mirror Node API, @hashgraph/sdk, hedera-agent-kit
- **Team Capabilities**: Full-stack Node.js, Solidity, React/Next.js, Hedera SDK — all demonstrated in working deployed codebase

### Technical Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Hashio RPC 502 intermittency | Retry logic in agents; Mirror Node as fallback for reads |
| HIP-755 scheduled TX gas limits | `PULSE_GAS_LIMIT = 2_000_000` set in contract; lightweight function selector call |
| HIP-991 fee configuration errors | Tested on testnet; fee-exempt key for MCP confirmed working |
| OpenClaw API changes | MCP server abstracts the interface; HCS topic layer is durable |

### Business Model (Lean Canvas)

| Element | Description |
|---|---|
| **Problem** | Agents can't reliably hire specialist agents · No verifiable knowledge provenance · No autonomous payment settlement between agents |
| **Solution** | HIP-991 topic fees = native agent-to-agent payment rail · HCS attestation = verifiable knowledge quality · HCS-10/UCP = protocol-level interoperability |
| **Key Metrics** | Active Executor count · Daily knowledge queries · HBAR volume through topic fees · Knowledge topic count · Schedule executions per day |
| **Unique Value Prop** | "The knowledge marketplace where every answer is attested on Hedera and every agent earns automatically" |
| **Unfair Advantage** | HIP-991 + HCS is a Hedera-native primitive unavailable on any other chain; first-mover in the OpenClaw + hedera-agent-kit ecosystem |
| **Channels** | OpenClaw agent registry · Hedera developer community · AI agent Discord communities · Hackathon visibility |
| **Customer Segments** | Executor operators (data/sensor owners) · OpenClaw agent developers · Enterprise AI teams |
| **Cost Structure** | HBAR for testnet transactions (near zero) · Hosting for MCP server and dashboard · LLM API costs (Groq free tier sufficient for MVP) |
| **Revenue Streams** | Protocol fee: 10% of all Knowledge topic fees → treasury account · Executor subscription: premium listing in MCP discovery index · Enterprise: dedicated Validator node + SLA |

### Why Web3 is Required

1. **Trustless payment between agents**: Two AI agents cannot use a bank account. HBAR settlement on Hedera is the only way autonomous agents pay each other without a human custodian.
2. **Verifiable attestation**: A Validator's `validateKnowledge()` transaction is on-chain — any agent can verify the attestation without trusting HIVE's servers.
3. **Censorship-resistant knowledge**: HCS topics are immutable and ordered; no central operator can delete or reorder attested knowledge.
4. **Programmable access control**: HIP-991 custom fees enforce "pay to read" at the protocol layer — no API key management, no rate limiting server.
5. **Trustless automation**: HIP-755 contract-driven scheduling means no human needs to keep a cron job running — the network enforces the cadence.

---

## 7. Execution Plan

### MVP Scope — Status [v3]

| Feature | Priority | Status | Hedera Service |
|---|---|---|---|
| KnowledgePool.sol deployed on testnet | P0 | ✅ Done | Hedera EVM |
| ProposerAgent auto-proposes every 60s | P0 | ✅ Done | Hedera EVM |
| ExecutorAgent polls + executes | P0 | ✅ Done | Hedera EVM |
| ValidatorAgent attests + creates HIP-991 topic | P0 | ✅ Done | HCS + HIP-991 |
| MCP server + OpenClaw HCS gateway | P0 | ✅ Done | HCS |
| HCS-native Executor Topics (HIP-991 economy) | P0 | ✅ Done | HCS + HIP-991 |
| HIP-755 Contract-Driven Scheduled TX | P0 | ✅ Done | Scheduled TX (0x16b) |
| hedera-agent-kit v3.0.7 integration | P0 | ✅ Done | hedera-agent-kit |
| Inter-agent HCS-10 communication | P0 | ✅ Done | HCS |
| Validator real-time HCS subscription | P0 | ✅ Done **[NEW v3]** | HCS |
| MCP `/research` blocking endpoint | P0 | ✅ Done **[NEW v3]** | — |
| UCP message schema in HCS topic payloads | P0 | ✅ Done **[NEW v3 — was bonus]** | HCS |
| Live dashboard (dream-team-dashboard.vercel.app) | P0 | ✅ Done **[NEW v3 — was blocker]** | Mirror Node |
| ScheduleTimelinePanel in dashboard | P0 | ✅ Done **[NEW v3 — was ⚠️]** | Mirror Node |
| KnowledgeFlowPanel (PROPOSED → SETTLED) | P0 | ✅ Done **[NEW v3]** | Mirror Node |
| ReputationLeaderboard panel | P1 | ✅ Done **[NEW v3 — was nice-to-have]** | Mirror Node |
| UserHistoryPanel + TransferAnimationOverlay | P1 | ✅ Done **[NEW v3]** | Mirror Node |
| Demo video (<3 min) | P0 | 🚨 TODO | — |
| External agent validation | P1 | ⚠️ TODO | HCS |

### Team Roles

| Member | Role | Key Responsibilities |
|---|---|---|
| Kevin | Full-Stack / Protocol Lead | Solidity contracts, Node.js agents, Hedera SDK, MCP server, hedera-agent-kit |
| Nicolas | Frontend / Dashboard | Next.js dashboard, Mirror Node integration, UI/UX, all dashboard panels |

### Design Decisions

| Decision | Options Considered | Choice | Rationale |
|---|---|---|---|
| Agent communication layer | Traditional messaging (Slack, Telegram) vs. HCS topics | HCS-10 topics | Hedera-native; immutable audit trail; HIP-991 fee-gated; interoperable with any HCS-10 agent |
| Knowledge economy primitive | Smart contract reward pool vs. HIP-991 topic fees | Both (hybrid) | Contract manages propose/validate/execute flow; HIP-991 handles pay-to-read at the topic layer |
| Agent intelligence framework | Raw LangChain vs. hedera-agent-kit | hedera-agent-kit + custom tools | Official Hedera agent framework; stock plugins handle low-level ops; custom tools encapsulate HIVE logic |
| Scheduling architecture | Off-chain cron vs. contract-driven schedule | Contract-driven (HIP-1215) | `KnowledgePool.sol` calls `scheduleCall()` on `0x16b` — fully on-chain, satisfies Track 2 |
| Agent isolation | Shared key vs. per-agent keys | Per-agent keys | Prevents nonce collisions; enables per-agent reputation tracking |
| Dashboard data source | Custom indexer vs. Mirror Node | Mirror Node | Zero infrastructure; always in sync with chain; standard Hedera pattern |

### Post-Hackathon Roadmap

- **Month 1–2**: Mainnet deployment · First 5 external Executor operators onboarded · UCP registry listing
- **Month 3–6**: Protocol fee implementation · Executor discovery API · ERC-8004 reputation system live on-chain · 50+ Executor agents
- **Month 6–12**: Enterprise Validator nodes · Scheduled TX–based SLA enforcement · SaucerSwap integration for HBAR→stablecoin conversion of Executor earnings

---

## 8. Validation Strategy

### Feedback Sources

- **Hedera developer Discord**: Share the live dashboard URL and request feedback from active HCS/HTS builders
- **OpenClaw community**: Direct integration makes OpenClaw agent developers natural early adopters; collect feedback on the MCP API and UCP schema
- **Hackathon judges**: Structured feedback from judges is a validation cycle in itself
- **Live dashboard**: share the public URL with judges and mentors — observable proof of autonomous activity

### Validation Milestones

| Milestone | Target | Status |
|---|---|---|
| Working demo with 3 agents on testnet | Live on HashScan | ✅ Done |
| Public dashboard deployed | dream-team-dashboard.vercel.app live | ✅ Done |
| First external OpenClaw agent queries via HCS | 1 non-team agent submits an HCS message | ⚠️ TODO |
| Hackathon judge feedback | Written response from 2+ judges | Demo day |
| First external Knowledge topic query (fee paid) | 1 non-team agent pays to read | ⚠️ TODO |
| 5 Executor operators, 20+ knowledge topics | Growing knowledge graph | Month 1 |

### Market Feedback Cycles

1. **Cycle 1 (Hackathon)**: Deploy demo → share dashboard URL with judges + Hedera Discord → collect feedback on protocol economics and HCS usage
2. **Cycle 2 (Post-hackathon week 1)**: Onboard 2–3 external Executor operators → observe their knowledge topics → interview on friction points → iterate on Executor onboarding
3. **Cycle 3 (Month 1)**: Open the MCP `/research` endpoint to OpenClaw community → track query volume, topic creation rate, HBAR flow → iterate on fee amounts and UCP schema

---

## 9. Go-To-Market Strategy

### Target Market

- **TAM**: $4.6B agentic AI infrastructure market (2024), growing 45% CAGR → ~$20B by 2028
- **SAM**: Hedera-native AI agent developers + OpenClaw ecosystem (~500 active developers today, growing rapidly)
- **Initial Target Segment**: OpenClaw agent developers who need a verified knowledge backend for their agents

### Distribution Channels

1. **OpenClaw ecosystem**: HIVE is the natural knowledge layer for any OpenClaw agent. Listing in the OpenClaw agent registry gives immediate distribution to all OpenClaw developers.
2. **Hedera developer community**: Hedera Discord, HashScan visibility, hackathon press — drives awareness among technical users who can run Executor nodes.
3. **AI developer communities**: Cross-posting to LangChain, AutoGPT, CrewAI communities as "the first on-chain knowledge marketplace for AI agents."

### Growth Strategy

- **Flywheel**: More Executors → richer knowledge graph → more OpenClaw agents use HIVE → more fee revenue for Executors → more Executors join
- **Partnership opportunities**: SaucerSwap (HBAR liquidity for Executor earnings) · Hashgraph Association incubator · Enterprise IoT sensor companies as premium Executor operators

---

## 10. Pitch Outline

### 3-Minute Structure

1. **The Problem (30s)**: *"The agentic society is coming — but agents can't hire other agents. When an AI agent needs data it doesn't have, it either hallucinates or calls a centralised API it can't verify. There's no marketplace where agents hire agents, pay instantly in HBAR, and trust what they receive — without a human in the loop."*

2. **The Solution (60s)**: *"HIVE Protocol is the knowledge marketplace for the agentic society. Three autonomous agents — Proposer, Executor, and Validator — run continuously on Hedera. Executors publish data to HCS topics with a 0.1 HBAR read fee. Validators attest quality on-chain and create permanent knowledge records, indexed by HCS-2 and encoded with UCP schema. OpenClaw agents pay to query — HBAR flows automatically. No human involved. Watch it run live on HashScan right now."* [Demo: show HashScan + dashboard]

3. **Hedera Integration (45s)**: *"Two Hedera-native primitives make this impossible to replicate elsewhere. HIP-991 — custom fees on HCS topics — means Executors earn HBAR every time their knowledge is read, no smart contract needed for payment routing. And HIP-755 — our KnowledgePool contract inherits HederaScheduleService and calls the 0x16b system contract directly — the automation cadence is enforced on-chain, not by a cron job. Plus hedera-agent-kit powers each agent's intelligence. This literally cannot exist anywhere else."*

4. **Traction (30s)**: *"We have [N] knowledge topics live on Hedera testnet, [N] HBAR transacted between agents autonomously, and the dashboard at dream-team-dashboard.vercel.app showing the agent economy in real time. Any OpenClaw agent can query HIVE right now via HCS and watch the transaction land on HashScan within seconds."*

5. **The Opportunity (30s)**: *"The agentic AI market hits $20B by 2028. Every AI agent that needs verified knowledge is a potential HIVE user. Every data operator is a potential Executor. We're the knowledge layer the agentic society runs on — and it gets more valuable with every agent that joins."*

6. **The Ask (15s)**: *"We're applying for the Hedera incubator and looking for the first 5 Executor operators. If you have data streams that agents should be paying to access, HIVE is how you monetise them — today, on testnet."*

### Key Metrics to Present

- Live HashScan link to `KnowledgePool.sol` and HIP-991 topics (verifiable, not slide claims)
- Number of autonomous transactions completed during hackathon period
- Dashboard URL showing live agent state, HBAR economy flow, HCS feed, schedule lifecycle
- HBAR volume transacted between agents (fee receipts from HIP-991 topics)
- Schedule lifecycle: `PulseScheduled` events → executed on HashScan

---

## Predicted Score Assessment [v3]

### Track 1: Killer App for the Agentic Society

| Criterion | Weight | Score | Rationale | How to Improve |
|---|---|---|---|---|
| **Innovation** | 10% | 5 / 5 | First agent-to-agent knowledge marketplace on Hedera. HIP-991 as agent payment rail is non-obvious. UCP compliance now implemented (bonus). HCS-10 interoperability. hedera-agent-kit in a live marketplace is novel. | Highlight UCP + HCS-10 interoperability explicitly in pitch |
| **Feasibility** | 10% | 4.5 / 5 | Working code on testnet, clear Lean Canvas, full-stack Hedera capability demonstrated. Hybrid contract + HCS economy well-reasoned. | Cite market size data explicitly in pitch; show revenue model on slide |
| **Execution** | 20% | 5 / 5 | All core MVP done. Dashboard public and live. ScheduleTimeline, KnowledgeFlow, ReputationLeaderboard, TransferAnimation all deployed. UCP done. Only gap: demo video. | Record demo video — the single remaining blocker |
| **Validation** | 15% | 2.5 / 5 | All usage internal. Dashboard is public but no confirmed external agent queries yet. | **Highest leverage**: get 1–2 external OpenClaw agents or operators to send an HCS message and screenshot Mirror Node proof. Moves this to 4/5. |
| **Success** | 20% | 4 / 5 | ~8 tx per knowledge cycle; autonomous agents = continuous Hedera activity; HIP-755 adds scheduled tx; UCP + HCS-2 enable ecosystem-wide discovery. | Quantify tx count and HBAR volume on HashScan during pitch |
| **Pitch** | 10% | 4.5 / 5 | Strong "agents hiring agents" narrative. Live dashboard. HashScan links as proof. UCP + HCS-10 interoperability story. | Practice 3-min structure; lead with live HashScan view; have backup demo video |

**Track 1 Estimated Weighted Score**: ~91–94% · **Strong favourite** (up from ~87–91% in v2)

---

### Track 2: On-Chain Automation with Hedera Schedule Service

| Criterion | Weight | Score | Rationale | How to Improve |
|---|---|---|---|---|
| **Innovation** | ~14% | 4.5 / 5 | Contract-driven self-scheduling (`pulse()` reschedules itself via `0x16b`) in a knowledge marketplace context is non-obvious. Most implementations are one-shot; HIVE's is recursive. | Emphasise the recursive self-scheduling pattern explicitly — most demos are one-shot |
| **Feasibility** | ~14% | 4.5 / 5 | Contract scheduling confirmed working on testnet. Edge cases handled. | Add explicit edge-case documentation |
| **Execution** | ~14% | 4.5 / 5 | Core scheduling works. `ScheduleTimelinePanel` now live in dashboard — was the gap in v2. | Verify ScheduleTimeline pulls live `PulseScheduled` events with HashScan links |
| **Integration** | ~14% | 5 / 5 | Contract calls `0x16b` via `HederaScheduleService` inheritance — deepest possible integration. Backend only observes events; scheduling is fully on-chain. | Show Solidity `_schedulePulse()` → `scheduleCall(0x16b)` in demo |
| **Validation** | ~14% | 2.5 / 5 | No external observers have watched the scheduling system run. | Share schedule timeline screenshots with 1–2 external observers before submission |
| **Success** | ~14% | 4 / 5 | Every pulse creates a scheduled transaction; at 60s intervals = continuous chain activity. Growing as more agents join. | Quantify scheduled tx count during hackathon on HashScan |
| **Pitch** | ~14% | 4.5 / 5 | Strong technical story. HashScan observable. Contract code as proof. ScheduleTimeline panel in dashboard. | Show the `pulse()` → `_schedulePulse()` → `scheduleCall(0x16b)` chain explicitly in demo |

**Track 2 Estimated Weighted Score**: ~84–88% · **Competitive for prize** (up from ~79–84% in v2)

---

## Immediate Next Steps (Priority Order)

### Submission Blockers

1. **[P0] 🚨 Record demo video (<3 min)** — Show: OpenClaw agent sends HCS message → MCP → on-chain propose/validate/execute cycle → HashScan → Knowledge topic created → answer returned. Include `pulse()` schedule lifecycle on HashScan for Track 2. Real transactions, not mockups.

### Score Multipliers (Highest Impact)

2. **[P1] External validation** — The single biggest score lever remaining (15% weight, currently 2.5/5). Get 1–2 people outside the team to: (a) send an HCS message to the knowledge inbound topic, or (b) pay 0.1 HBAR to read a Knowledge topic. Screenshot the Mirror Node proof. This alone moves Validation from 2.5 → 4/5.

3. **[P1] Verify ScheduleTimeline live data** — Confirm the `ScheduleTimelinePanel` is pulling live `PulseScheduled` events from Mirror Node with HashScan links for the `scheduleAddress`. This is an explicit Track 2 UI requirement and it needs to show real chain data.

### Quick Wins

4. Log `https://hashscan.io/testnet/topic/{id}` for every HCS topic created — verify all code paths emit this
5. Add a second Executor agent with a different specialisation before demo day to show multi-agent discovery
6. Show the `_schedulePulse()` → `scheduleCall(0x16b)` Solidity path explicitly in the demo slides

### Nice-to-Have

7. **[P2] SaucerSwap mention** — Add to roadmap slide as a concrete post-hackathon integration (converts Executor HBAR earnings to stablecoins)

---

## Parking Lot (Future Ideas)

- **Agent DAOs**: Executor guilds where multiple agents pool HBAR to fund a shared Validator node
- **Prediction market layer**: Agents stake HBAR on whether a knowledge claim will be attested (HTS token)
- **Cross-agent UCP discovery registry**: Token-gated index of all active Executors with reputation scores
- **Slashing mechanism**: Validators who attest false knowledge lose staked HBAR (HTS + EVM)
- **Hedera File Service**: Store large research outputs on HFS; HCS topic links to HFS file ID
- **SaucerSwap integration**: Convert Executor HBAR earnings to stablecoins on-chain
