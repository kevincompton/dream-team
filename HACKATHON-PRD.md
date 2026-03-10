# HIVE Protocol — Hackathon PRD (v2)

> **Tracks**: Killer App for the Agentic Society (OpenClaw) · On-chain Automation with Hedera Schedule Service
> **Project**: HIVE Protocol — Autonomous Knowledge Marketplace
> **Status**: MVP fully live on Hedera testnet · All core features complete ✅
> **Last updated**: v2 — reflects HCS branch completion

---

## ⚠️ Potential Disqualifying / Risk Elements (Read First)

| Risk | Severity | Assessment | Action Required |
|---|---|---|---|
| Track 2 requires contract-driven scheduling, not backend scripts | **Was critical** | ✅ CLEARED — `KnowledgePool.sol` inherits `HederaScheduleService`, calls `scheduleCall()` on `0x16b` directly; `pulse()` self-reschedules on-chain | None — confirm in README |
| Schedule lifecycle UI for Track 2 ("created → pending → executed/failed with tx links") | **Moderate** | ⚠️ Dashboard shows agent states + HCS feed but may not explicitly surface schedule lifecycle panel | Add schedule lifecycle view to dashboard before submission |
| No public live demo URL | **Submission blocker** | ⚠️ Dashboard exists locally; not yet deployed publicly | Deploy to Vercel/Render before submission |
| No demo video (<3 min) | **Submission blocker** | ⚠️ Not recorded yet | Record before submission |
| UCP message schema not implemented | **Low** | Track 1 gives bonus points for UCP, not required; missing it costs points, not eligibility | Implement if time allows |
| ERC-8004 reputation not implemented | **Low** | Track 1 calls this "nice to have" explicitly | Implement if time allows |
| Using stock hedera-agent-kit plugins vs. custom plugins | **None** | ✅ NOT disqualifying — track resources explicitly link `hedera-agent-kit`. Custom LangChain tools on top of stock plugins is the correct pattern. Demonstrates ecosystem fluency. | None |
| LLM provider (OpenAI/Groq default) | **None** | ✅ Neither track specifies LLM provider | None |
| Testnet only | **None** | ✅ Track 2 explicitly says "Working app on Hedera Testnet" | None |
| No external user validation | **Moderate** | Validation is 15% of score; currently internal only | Get 1-2 external users before demo |

---

## 1. Problem Statement

**The AI agent economy is blind and trustless — agents cannot reliably discover specialist agents, pay for their knowledge, or verify the quality of what they receive without a trusted third party.**

As AI agents proliferate across platforms (WhatsApp bots, Discord agents, autonomous research pipelines), they increasingly need to *hire* other agents — sourcing real-time data, domain expertise, or computation they cannot produce themselves. Today this is solved by hand-wiring API calls between specific agents or relying on centralised orchestration that creates a single point of failure and zero economic incentive for specialisation.

**Target Users**:
- **Primary**: OpenClaw AI agents (the "society") — autonomous agents running on WhatsApp, Telegram, Discord that need verified knowledge they cannot produce themselves
- **Secondary**: Developers and organisations deploying specialised data-collection agents (sensors, indexers, oracles) who want to monetise their output
- **Observing audience**: Human operators monitoring the agent economy via a live dashboard

**Current Solutions & Why They Fail**:
| Approach | Problem |
|---|---|
| Centralised APIs (OpenAI, Perplexity) | Single point of failure; no agent-to-agent economy; no verifiable attestation |
| Centralised orchestrators (LangChain, AutoGPT) | Human-operated; no on-chain settlement; no reputation |
| Manual agent wiring | Breaks at scale; no discovery; no payment rail |

**Why Web3?**:
Web2 cannot provide: (1) trustless payment settlement between agents with no human in the loop, (2) immutable, verifiable attestation of knowledge quality, (3) a permissionless market where any agent can join and immediately start earning or consuming. Only Hedera's HCS + HTS + EVM combination provides sub-second finality, fee-level programmable economics (HIP-991), and tamper-proof consensus — all at a cost low enough for high-frequency agent transactions.

---

## 2. Solution Overview

HIVE Protocol is an **autonomous knowledge marketplace** where AI agents fund research, verify results on Hedera, and settle value — all without human intervention.

A user sends a question via Telegram (or WhatsApp). Their OpenClaw agent routes it to HIVE's MCP (Master Control Program) server. The MCP identifies which specialist **Executor agents** hold relevant data (each Executor publishes to its own HIP-991–gated HCS topic). The **Validator agent** pays into Executor topics to retrieve that knowledge, attests its quality on-chain, and publishes the result to a **Knowledge topic** (also HIP-991 gated). The MCP reads the attestation (fee-exempt) and returns the answer to the user's OpenClaw agent. Value flows automatically: Validators pay Executors to query their data, Executors earn royalties continuously. The more Executors join, the richer the knowledge graph; the more agents join, the higher fee revenue — a genuine network-effect flywheel, all on Hedera.

**Track Alignment**:
- **Killer App for the Agentic Society**: HIVE is agent-native by design. OpenClaw agents are the primary users. There is no human operator. The system gains value with every new agent that joins. Commerce is mediated by HIP-991 topic fees (Executor → Validator → User fee chain). Agents discover, rank (reputation), and trade with each other using Hedera's native payment rails.
- **On-Chain Automation with Hedera Schedule Service**: `KnowledgePool.sol` inherits `HederaScheduleService` and directly calls the 0x16b system contract. The `pulse()` function self-reschedules on every execution — a true on-chain recursive automation loop. No off-chain cron. Every schedule is observable on HashScan.

### Key Features (MVP) — [UPDATED v2]

| Feature | Status | Track Relevance |
|---|---|---|
| Autonomous 3-Agent Loop (Proposer → Executor → Validator) | ✅ Done | Track 1 |
| HIP-991 Paid Knowledge Topics (0.1 HBAR per read) | ✅ Done | Track 1 |
| HCS-native Executor Topics (pure topic-fee economy) | ✅ Done **[NEW — was in progress]** | Track 1 |
| MCP Gateway + OpenClaw/Telegram Integration | ✅ Done **[UPGRADED — was partial]** | Track 1 |
| Live Observer Dashboard (Next.js 14) | ✅ Done | Track 1 |
| hedera-agent-kit v3.0.7 with custom LangChain tools | ✅ Done **[NEW]** | Track 1 |
| Inter-agent HCS communication ("agentic comms") | ✅ Done **[NEW]** | Track 1 |
| HIP-755 / HIP-1215 Contract-Driven Scheduling | ✅ Done **[NEW — was planned]** | Track 2 |
| Schedule lifecycle UI panel | ⚠️ Needs work | Track 2 |
| UCP message schema in HCS topic payloads | 📋 Planned (bonus) | Track 1 bonus |
| ERC-8004 reputation scores in dashboard | 📋 Planned (nice-to-have) | Track 1 nice-to-have |
| Public live demo URL | 🚨 Submission blocker | Both |
| Demo video (<3 min) | 🚨 Submission blocker | Both |

### Non-Goals (v1)

- No user-facing wallet connection (agents transact autonomously; dashboard is read-only)
- No mainnet deployment during hackathon (testnet only — explicitly allowed by Track 2)
- No cross-chain bridges
- No human-operated knowledge submission UI
- No fine-tuning or custom LLM training

---

## 3. Hedera Integration Architecture

### Network Services Used

| Service | Purpose | Why This Service? |
|---|---|---|
| **Hedera EVM** | `KnowledgePool.sol` — propose/validate/execute state machine with HBAR reward distribution | EVM compatibility for rapid Solidity development; native HBAR settlement (not wrapped); hashio RPC gives sub-second confirmation |
| **HCS (TopicCreateTransaction)** | Each validated knowledge item becomes a permanent, ordered HCS topic; inter-agent comms channel | Immutable, timestamped, tamper-proof — no centralised DB; native to Hedera; supports custom fees; enables agentic comms |
| **HIP-991 (Custom Fixed Fees on HCS)** | Executor topics charge Validator 0.1 HBAR to query; Knowledge topics charge users 0.1 HBAR to read | Enables a programmable fee economy *at the protocol layer* — no smart contract needed for payment routing. Hedera's native monetisation primitive for knowledge |
| **HIP-755 / HIP-1215 (Schedule Service)** | `KnowledgePool.sol` inherits `HederaScheduleService`, calls `scheduleCall()` on 0x16b; `pulse()` self-reschedules on every execution | Contract-driven: the smart contract (not a backend) creates and chains schedules. Observable on HashScan. Enables trustless, auditable automation |
| **Mirror Node API** | Dashboard live mode: polls `DeviceCommand` events, topic messages, account balances, transaction history | Enables the human observer UI without any custom indexer; drives the HCS feed, schedule lifecycle, and economy panels |
| **hedera-agent-kit v3.0.7** | LangChain toolkit powering all three agents with `coreConsensusPlugin`, `coreHTSPlugin`, `coreAccountPlugin`, `coreQueriesPlugin` | Official Hedera ecosystem AI agent framework; enables agents to interact with HCS/HTS/EVM natively; custom tools extend the stock plugins |
| **HCS-2 Standard** | `@hashgraphonline/standards-sdk` — knowledge topics indexed per HCS-2 for discoverability | Enables standard-compliant knowledge indexing; any HCS-2–aware agent can discover HIVE Knowledge topics |
| **@hashgraph/sdk** | `TopicCreateTransaction`, `CustomFixedFee`, `PrivateKey` management for all HCS operations | Native SDK ensures correct fee application and topic memo fields |

### hedera-agent-kit Plugin Architecture [NEW in v2]

Each agent uses `HederaLangchainToolkit` with stock plugins as a foundation, then extends with custom LangChain tools:

| Agent | Stock Plugins Used | Custom Tools Built on Top |
|---|---|---|
| **Proposer** | `coreConsensusPlugin`, `coreQueriesPlugin` | `ProposeKnowledgeTool`, `CountUnexecutedTool`, `KnowledgeCountTool` |
| **Executor** | `coreHTSPlugin`, `coreAccountPlugin`, `coreConsensusPlugin`, `coreQueriesPlugin` | `ExecuteKnowledgeTool`, `PoolBalanceTool`, `GetKnowledgeTool` |
| **Validator** | `coreConsensusPlugin`, `coreQueriesPlugin` | `ValidateKnowledgeTool`, `CreateKnowledgeTopicTool`, `SendHip991MessageTool`, `GetKnowledgeTool` |

This is the recommended hedera-agent-kit pattern: stock plugins handle low-level Hedera operations; custom tools encapsulate protocol-specific business logic. The LLM backbone is configurable (default: Groq/OpenAI; `claude-sonnet-4-6` supported via Anthropic SDK).

### HIP-755 Contract-Driven Scheduling Detail [NEW in v2]

```solidity
// KnowledgePool.sol — contract initiates scheduling (not backend scripts)
contract KnowledgePool is HederaScheduleService {

    // Owner calls startPulse() once → contract takes over
    function startPulse(uint256 intervalSeconds) external {
        require(msg.sender == owner, "Not owner");
        pulseInterval = intervalSeconds;
        _schedulePulse(block.timestamp + intervalSeconds);
    }

    // pulse() is called by Hedera Schedule Service at scheduled time
    // It emits DeviceCommand events, then reschedules itself
    function pulse() external {
        // ... emits commands ...
        if (pulseInterval > 0) {
            _schedulePulse(block.timestamp + pulseInterval); // self-reschedule
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

Backend scripts (`mcp.ts`) only **observe** `DeviceCommand` events via Mirror Node — they do not initiate scheduling. This satisfies Track 2's requirement: *"Scheduling must be initiated from a smart contract."*

### Inter-Agent HCS Communication [NEW in v2]

Agents communicate via dedicated HCS topics (not just the smart contract). Each agent subscribes to an inbound HCS topic and publishes to outbound topics. The MCP bridges HCS messages to Telegram for real-time human observation. This creates a verifiable, immutable audit trail of every agent-to-agent message on Hedera.

### Ecosystem Integrations

| Partner/Platform | Integration Type | Value Added |
|---|---|---|
| **OpenClaw** | MCP endpoint (`/research-request`) accepts agent messages from Telegram/WhatsApp/Discord | Provides the "agentic society" user layer — HIVE is the knowledge backend for the OpenClaw agent network. Live on Telegram. |
| **HashScan** | Every on-chain action logs a HashScan link in agent output | Instant verifiability for judges and observers; trust indicator built into the protocol |
| **UCP (Universal Commerce Protocol)** | Standardise the JSON message schema in HCS topic messages | Bonus: UCP compliance means any UCP-aware agent can discover and trade with HIVE Executors without custom integration *(planned)* |
| **ERC-8004 (Agent Reputation)** | Executor reputation scores surfaced in dashboard `ReputationLeaderboard` | Trust layer: agents with higher validation rates surface to the top *(planned)* |

### Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         HIVE PROTOCOL — HEDERA LAYER                      │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  User (Telegram/WhatsApp)                                                  │
│       ↓  message                                                           │
│  OpenClaw Agent                                                            │
│       ↓  POST /research-request                                            │
│  MCP Server (port 3001) ←── Mirror Node: polls DeviceCommand events       │
│       ↓  proposeKnowledge()                                                │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │  KnowledgePool.sol (Hedera EVM)                                 │       │
│  │  propose → validate → execute   HBAR rewards to all 3 agents   │       │
│  │  HIP-1215: pulse() self-schedules via scheduleCall(0x16b)       │       │
│  │  DeviceCommand events → MCP bridge → Telegram                  │       │
│  └───────────┬─────────────────────────────────────────────────────┘       │
│              │  hedera-agent-kit (stock plugins + custom tools)            │
│  ┌───────────▼────────────┐                                                │
│  │   EXECUTOR TOPICS      │  (HIP-991 paid — Validator pays to query)      │
│  │   One per Executor     │  HCS-2 indexed for discovery                   │
│  │   • Sensor/research    │                                                │
│  └───────────┬────────────┘                                                │
│              │  Validator pays → reads → attests                           │
│  ┌───────────▼────────────┐                                                │
│  │   KNOWLEDGE TOPICS     │  (HIP-991 paid — User pays to read)            │
│  │   Attested answers     │  HCS-2 + UCP schema (planned)                 │
│  │   • ERC-8004 rep score │  (planned)                                     │
│  └───────────┬────────────┘                                                │
│              │  MCP reads (fee-exempt) → returns to OpenClaw               │
│  OpenClaw Agent reasons → User receives answer on Telegram                 │
│                                                                            │
│  Inter-agent HCS topics: Proposer ↔ Validator ↔ Executor (agentic comms) │
└──────────────────────────────────────────────────────────────────────────┘

 Dashboard (Next.js 14): Mirror Node polling → AgentStatus | Economy |
                          HCS Feed | Schedule Lifecycle | Knowledge Graph
```

---

## 4. Hedera Network Impact

### Account Creation

- **Each new Executor agent** requires a dedicated Hedera account (separate private key to avoid nonce collisions). As the Executor network scales, each new operator creates a Hedera account.
- **OpenClaw users** who transact with Knowledge topics (pay to read) will require Hedera accounts for HBAR payment.
- **Estimated accounts at hackathon**: 4–6 (3 agents + operator + 1–2 demo users)
- **Estimated accounts at 6 months** (10 Executor operators × avg 2 Executors): 20–30 agent accounts + 100–500 user accounts

### Active Accounts

- The autonomous agent loop generates transactions continuously (every 45–60s per cycle). Even with 3 agents, all 3 accounts are active every polling interval.
- HIP-755 `pulse()` adds scheduled transactions at the configured interval, keeping accounts active between knowledge cycles.
- **Estimated MAA at launch**: 3–6 (agents + demo users)
- **Estimated MAA at scale**: 50–200 (agents + regular knowledge consumers)

### Transactions Per Second (TPS) Impact

Each full knowledge cycle generates:
| Transaction | Hedera Service |
|---|---|
| `proposeKnowledge()` | EVM |
| `validateKnowledge()` | EVM |
| `TopicCreateTransaction` (HIP-991 Knowledge topic) | HCS |
| `executeKnowledge()` + 3× HBAR transfers | EVM |
| `scheduleCall()` in `_schedulePulse()` — contract creates schedule | Schedule Service (0x16b) |
| `pulse()` executed by Schedule Service | EVM + Schedule Service |
| User pays to read Knowledge topic | HCS |
| Inter-agent HCS messages (agentic comms) | HCS |

**~8 transactions per knowledge cycle** · At 1 cycle/minute with 5 Executors: ~0.67 TPS sustained from HIVE alone. At scale (100 Executors, 1000 daily queries): meaningful TPS contribution.

### Audience Exposure

- **AI developer community**: Builders of OpenClaw agents, LangChain/AutoGPT users looking for Hedera-native agent infrastructure
- **IoT/sensor operators**: Organisations with real-time data streams who can monetise as Executors
- **Enterprise AI teams**: Companies building multi-agent workflows who need verifiable knowledge provenance
- **Target market size**: $4.6B agentic AI market (2024, Grand View Research), growing 45% CAGR

---

## 5. Innovation & Differentiation

### Ecosystem Gap

No existing Hedera project provides a **programmable, autonomous knowledge economy where agents hire agents**. HTS and HCS have been used for NFTs, tokens, and audit trails — but never as the economic rails for an agent-to-agent knowledge marketplace where fees flow automatically at the HCS protocol layer (HIP-991) rather than through a smart contract intermediary. Adding hedera-agent-kit as the agent intelligence layer makes HIVE uniquely composable with the broader Hedera agent ecosystem.

### Cross-Chain Comparison

| Platform | What it does | HIVE difference |
|---|---|---|
| Bittensor (TAO) | Decentralised ML network with token incentives | Requires validators to run GPU nodes; not agent-native; no HCS attestation |
| Fetch.ai | Agent marketplace on Cosmos | Web3-native but no programmable fee topics; not OpenClaw integrated |
| Ritual | Onchain AI inference | Inference only; no knowledge accumulation; no pay-to-read topic economy |
| **HIVE** | Knowledge marketplace via HCS topic fees | HIP-991 makes payment happen at the *topic protocol layer* — no contract needed for fee routing. First agent-to-agent knowledge market on Hedera. Powered by hedera-agent-kit. |

### Novel Hedera Usage

1. **HIP-991 as a native payment rail between agents** — using `CustomFixedFee` on HCS topics so that Executor agents automatically earn HBAR when their topic is queried, with zero smart contract involvement.
2. **HIP-755 contract-driven self-scheduling** — `KnowledgePool.sol` creates recursive Hedera Schedule Service calls from within Solidity, making the automation cadence enforced and auditable on-chain, not via off-chain cron.
3. **hedera-agent-kit as the AI-Hedera bridge** — using the official Hedera agent framework (stock plugins + custom tools) to give each agent native Hedera capabilities. First known deployment of hedera-agent-kit in an autonomous multi-agent marketplace.
4. **HCS-2 standard for knowledge indexing** — encoding knowledge topics per the HCS-2 standard so they are discoverable by any standards-compliant agent or application.

---

## 6. Feasibility & Business Model

### Technical Feasibility

- **Hedera Services Required**: HCS (HIP-991, HCS-2), Hedera EVM, Scheduled Transactions (HIP-755/HIP-1215), Mirror Node API, @hashgraph/sdk, hedera-agent-kit
- **Team Capabilities**: Full-stack Node.js, Solidity, React/Next.js, Hedera SDK — all demonstrated in working codebase
- **Technical Risks & Mitigations**:

| Risk | Mitigation |
|---|---|
| Hashio RPC 502 intermittency | Retry logic in agents; Mirror Node as fallback for reads |
| HIP-755 scheduled TX gas limits | `PULSE_GAS_LIMIT = 2_000_000` set in contract; lightweight function selector call |
| HIP-991 fee configuration errors | Tested on testnet; fee-exempt key for MCP confirmed working |
| OpenClaw API changes | MCP server abstracts the interface; easy to swap |
| Schedule lifecycle UI gap | Add Mirror Node polling for schedule addresses emitted by `PulseScheduled` event |

### Business Model (Lean Canvas)

| Element | Description |
|---|---|
| **Problem** | Agents can't reliably hire specialist agents · No verifiable knowledge provenance · No autonomous payment settlement between agents |
| **Solution** | HIP-991 topic fees = native agent-to-agent payment rail · HCS attestation = verifiable knowledge quality · MCP gateway = OpenClaw discovery layer |
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

### MVP Scope — Status Update [UPDATED v2]

| Feature | Priority | Status | Hedera Service |
|---|---|---|---|
| KnowledgePool.sol deployed on testnet | P0 | ✅ Done | Hedera EVM |
| ProposerAgent auto-proposes every 60s | P0 | ✅ Done | Hedera EVM |
| ExecutorAgent polls + executes | P0 | ✅ Done | Hedera EVM |
| ValidatorAgent attests + creates HIP-991 topic | P0 | ✅ Done | HCS + HIP-991 |
| MCP server + `/research-request` endpoint | P0 | ✅ Done | — |
| Next.js observer dashboard (live + demo mode) | P0 | ✅ Done | Mirror Node |
| HCS-native Executor Topics (HIP-991 economy) | P0 | ✅ Done **[NEW — was in progress]** | HCS + HIP-991 |
| HIP-755 Contract-Driven Scheduled TX | P0 | ✅ Done **[NEW — was planned]** | Scheduled TX (0x16b) |
| hedera-agent-kit v3.0.7 integration | P0 | ✅ Done **[NEW]** | hedera-agent-kit |
| Inter-agent HCS communication | P0 | ✅ Done **[NEW]** | HCS |
| Telegram / OpenClaw integration | P0 | ✅ Done **[UPGRADED]** | OpenClaw |
| Schedule lifecycle UI panel | P0 | ⚠️ Needs work | Mirror Node |
| Public live demo URL (Vercel) | P0 | 🚨 TODO | — |
| Demo video (<3 min) | P0 | 🚨 TODO | — |
| UCP message schema in HCS topic payloads | P1 | 📋 Planned (bonus) | HCS |
| ERC-8004 reputation scores in dashboard | P2 | 📋 Planned (nice-to-have) | Mirror Node |

### Team Roles

| Member | Role | Key Responsibilities |
|---|---|---|
| Kevin | Full-Stack / Protocol Lead | Solidity contracts, Node.js agents, Hedera SDK integration, MCP server, hedera-agent-kit |
| Nicolas | Frontend / Dashboard | Next.js dashboard, Mirror Node integration, UI/UX, schedule lifecycle panel |
| (+ teammates) | TBD | OpenClaw integration, demo video, pitch |

### Design Decisions

| Decision | Options Considered | Choice | Rationale |
|---|---|---|---|
| Knowledge economy primitive | Smart contract reward pool vs. HIP-991 topic fees | Both (hybrid) | Contract manages propose/validate/execute flow; HIP-991 handles pay-to-read economy at topic layer |
| Agent intelligence framework | Raw LangChain vs. hedera-agent-kit | hedera-agent-kit + custom tools | Official Hedera agent framework; stock plugins handle low-level ops; custom tools encapsulate HIVE protocol logic |
| Scheduling architecture | Off-chain cron vs. contract-driven schedule | Contract-driven (HIP-1215) | `KnowledgePool.sol` calls `scheduleCall()` on 0x16b directly — fully on-chain, satisfies Track 2 requirement |
| Agent isolation | Shared key vs. per-agent keys | Per-agent keys | Prevents nonce collisions; enables per-agent reputation tracking |
| LLM provider | OpenAI, Anthropic, Groq, Ollama | Configurable (default: Groq) | Groq free tier sufficient for hackathon; Anthropic SDK included for `claude-sonnet-4-6` |
| Dashboard data source | Custom indexer vs. Mirror Node | Mirror Node | Zero infrastructure; always in sync with chain; standard Hedera pattern |
| Contract language | Vyper vs. Solidity | Solidity `^0.8.24` | Hardhat toolchain; custom errors for gas efficiency; familiar to Hedera EVM devs |

### Post-Hackathon Roadmap

- **Month 1–2**: Mainnet deployment · UCP schema standardisation · First 5 external Executor operators onboarded
- **Month 3–6**: Protocol fee implementation · Executor discovery API · ERC-8004 reputation system live · 50+ Executor agents
- **Month 6–12**: Enterprise Validator nodes · Scheduled TX–based SLA enforcement · Integration with SaucerSwap for HBAR→stablecoin conversion of Executor earnings

---

## 8. Validation Strategy

### Feedback Sources

- **Hedera developer Discord**: Post the live demo URL and request feedback from active HCS/HTS builders
- **OpenClaw community**: Direct integration means OpenClaw agent developers are natural early adopters; collect feedback on the MCP API and UCP schema
- **Hackathon judges**: Structured feedback from judges is a validation cycle in itself
- **Telegram live demo**: The Telegram bot is live — invite judges/observers to query it during the demo

### Validation Milestones

| Milestone | Target | Timeline |
|---|---|---|
| Working demo with 3 agents on testnet | Live on HashScan | ✅ Done |
| Telegram bot live for external queries | 1 external user queries via Telegram | ✅ Done |
| First external Executor operator | 1 person runs their own Executor | Hackathon demo day |
| Hackathon judge feedback collected | Written responses from 2+ judges | Demo day |
| First external Knowledge topic query (fee paid) | 1 non-team user pays to read | Pre-submission |
| 5 Executor operators, 20+ knowledge topics | Growing knowledge graph | Month 1 |

### Market Feedback Cycles

1. **Cycle 1 (Hackathon)**: Deploy demo → share dashboard URL + Telegram bot with judges + Hedera Discord → collect feedback on UX, economics, and HCS usage
2. **Cycle 2 (Post-hackathon week 1)**: Onboard 2–3 external Executor operators → observe their knowledge topics → interview them on friction points → iterate on Executor onboarding
3. **Cycle 3 (Month 1)**: Open the MCP `/research-request` endpoint to OpenClaw community → track query volume, topic creation rate, HBAR flow → iterate on fee amounts and UCP schema

---

## 9. Go-To-Market Strategy

### Target Market

- **TAM**: $4.6B agentic AI infrastructure market (2024), growing 45% CAGR → ~$20B by 2028
- **SAM**: Hedera-native AI agent developers + OpenClaw ecosystem (~500 active developers today, growing rapidly)
- **Initial Target Segment**: OpenClaw agent developers who need a verified knowledge backend for their agents

### Distribution Channels

1. **OpenClaw ecosystem**: HIVE is the natural knowledge layer for any OpenClaw agent. Listing in the OpenClaw skills/plugin registry gives immediate distribution to all OpenClaw developers.
2. **Hedera developer community**: Hedera Discord, HashScan visibility, hackathon press — all drive awareness among the technical audience who can run Executor nodes.
3. **AI developer communities**: Cross-posting to LangChain, AutoGPT, CrewAI communities as "the first on-chain knowledge marketplace for AI agents" — large, fast-growing audiences.

### Growth Strategy

- **Flywheel**: More Executors → richer knowledge graph → more OpenClaw agents use HIVE → more fee revenue for Executors → more Executors join
- **Partnership opportunities**: SaucerSwap (HBAR liquidity for Executor earnings) · Hashgraph Association incubator (April cohort) · Enterprise IoT sensor companies as premium Executor operators

---

## 10. Pitch Outline

### 3-Minute Structure

1. **The Problem (30s)**: *"AI agents are getting smarter — but they're also getting lonelier. When your Telegram agent needs real-time data it doesn't have, it either hallucinates or calls a centralised API it can't verify. There's no marketplace where agents hire agents, pay instantly, and trust what they receive."*

2. **The Solution (60s)**: *"HIVE Protocol is the knowledge marketplace for the agentic society. Three autonomous agents — Proposer, Executor, and Validator — run continuously on Hedera. Executors collect data, publish it to HCS topics with a 0.1 HBAR read fee. Validators attest quality on-chain and create permanent knowledge records. OpenClaw agents pay to query — HBAR flows automatically, no human involved. Watch it run live on HashScan right now."* [Demo: show HashScan + dashboard + Telegram]

3. **Hedera Integration (45s)**: *"Two Hedera-native primitives make this possible. HIP-991 — custom fees on HCS topics — means Executors earn HBAR every time their knowledge is read, no smart contract needed for fee routing. And HIP-755 — our KnowledgePool contract inherits HederaScheduleService and calls the 0x16b system contract directly — the automation cadence is enforced on-chain, not by a cron job we have to babysit. Plus hedera-agent-kit powers each agent's intelligence. This literally cannot exist anywhere else."*

4. **Traction (30s)**: *"We have [N] knowledge topics live on Hedera testnet, [N] HBAR transacted between agents, and the dashboard at [URL] showing the agent economy in real time. You can query our Telegram bot right now and watch the transaction land on HashScan within seconds."*

5. **The Opportunity (30s)**: *"The agentic AI market hits $20B by 2028. Every AI agent that needs verified knowledge is a potential HIVE user. Every data operator is a potential Executor. We're the knowledge layer the agentic society runs on — and it gets more valuable with every agent that joins."*

6. **The Ask / Next Steps (15s)**: *"We're applying for the Hedera incubator and looking for the first 5 Executor operators. If you have data streams that agents should be paying to access, HIVE is how you monetise them — today, on testnet."*

### Key Metrics to Present

- Live HashScan links to `KnowledgePool.sol` contract and HIP-991 topics (verifiable, not slide claims)
- Number of autonomous transactions completed during hackathon period
- Dashboard URL showing live agent state, HBAR economy flow, and HCS feed
- Schedule lifecycle: created → pending → executed on HashScan
- HBAR volume transacted between agents (fee receipts from HIP-991 topics)

---

## Predicted Score Assessment [UPDATED v2]

### Track 1: Killer App for the Agentic Society

> Note: Track 1 does not list "Integration" as a separate criterion. Hedera usage is assessed within Execution.

| Criterion | Weight | Predicted Score | Rationale | How to Improve |
|---|---|---|---|---|
| **Innovation** | 10% | 4.5 / 5 | First agent-to-agent knowledge marketplace on Hedera; HIP-991 as agent payment rail is non-obvious; hedera-agent-kit deployment in a live marketplace is novel. UCP (bonus) not yet done. | Demo UCP encoding in HCS payload during pitch |
| **Feasibility** | 10% | 4.5 / 5 | Working code on testnet, clear Lean Canvas, team has full-stack Hedera capability. Hybrid contract + HCS economy is well-reasoned. | Cite market size data in README; show clear revenue model |
| **Execution** | 20% | 4.5 / 5 | All core MVP features done. Dashboard live. Telegram working. hedera-agent-kit integrated. Missing: public URL, demo video, UCP, ERC-8004, schedule lifecycle panel. | Deploy dashboard publicly; record video; add schedule lifecycle UI |
| **Validation** | 15% | 2.5 / 5 | Currently mostly internal testing. Telegram bot is live but no confirmed external paying users. | **Highest leverage**: get 1–2 external people to pay 0.1 HBAR to read a Knowledge topic and screenshot Mirror Node proof |
| **Success** | 20% | 4 / 5 | ~8 tx per knowledge cycle; autonomous agents = continuous activity; HIP-755 adds scheduled tx to the count; Telegram integration drives external users. Network effect story is credible. | Show live tx count on HashScan during pitch; articulate TPS contribution explicitly |
| **Pitch** | 10% | 4 / 5 | Strong narrative ("agents hiring agents"), live demo URL (once deployed), Telegram bot as interactive demo, HashScan links as credible proof. | Practice 3-min structure; lead with live HashScan view; have backup demo video |

**Track 1 Estimated Weighted Score**: ~87–91% · **Strong contender** (up from 83–88% in v1)

---

### Track 2: On-Chain Automation with Hedera Schedule Service

| Criterion | Weight | Predicted Score | Rationale | How to Improve |
|---|---|---|---|---|
| **Innovation** | ~14% | 4 / 5 | Contract-driven self-scheduling (`pulse()` reschedules itself via 0x16b) in a knowledge marketplace context is non-obvious. Most schedule demos are one-shot; HIVE's is recursive. | Emphasise the recursive self-scheduling pattern explicitly — most implementations are one-shot |
| **Feasibility** | ~14% | 4.5 / 5 | Contract scheduling confirmed working on testnet. Edge cases (insufficient balance, zero interval guard) handled in contract. | Add explicit edge-case handling documentation |
| **Execution** | ~14% | 4 / 5 | Core scheduling works. Missing: schedule lifecycle UI panel ("created → pending → executed/failed with tx links") which is an explicit Track 2 UI requirement. | **Priority**: add schedule lifecycle panel to dashboard showing `PulseScheduled` events from Mirror Node with HashScan links |
| **Integration** | ~14% | 5 / 5 | Contract calls 0x16b via `HederaScheduleService` inheritance — deepest possible integration with the Schedule Service. Backend only observes events; scheduling is fully on-chain. | Show the Solidity code and 0x16b call in the README and demo |
| **Validation** | ~14% | 2.5 / 5 | No external users have observed or interacted with the scheduling system. | Share schedule timeline screenshots with 1–2 external observers before submission |
| **Success** | ~14% | 3.5 / 5 | Every pulse creates a scheduled transaction; at 60s intervals with 5 executors = ~5 scheduled tx/min. Growing as more agents join. | Quantify scheduled tx count during hackathon period on HashScan |
| **Pitch** | ~14% | 4 / 5 | Strong technical story. HashScan observable. Contract code as proof of on-chain scheduling. | Show the `pulse()` → `_schedulePulse()` → `scheduleCall(0x16b)` chain in the demo |

**Track 2 Estimated Weighted Score**: ~79–84% · **Competitive for 2nd place prize** ($2,000)

---

## Immediate Next Steps (Priority Order)

### Submission Blockers (Must Do)

1. **[P0] 🚨 Deploy dashboard to public URL** — `vercel deploy` of `dashboard/` with `NEXT_PUBLIC_USE_MOCK_DATA=false` pointing at testnet. Judges need a browser URL for both tracks.

2. **[P0] 🚨 Record demo video (<3 min)** — Show: Telegram message → MCP → on-chain cycle → HashScan → Knowledge topic created → answer returned. Include `pulse()` schedule on HashScan for Track 2. Real transactions, not mockups.

3. **[P0] ⚠️ Add schedule lifecycle UI panel** — Pull `PulseScheduled` events from Mirror Node using the emitted `scheduleAddress`. Show status: created → pending → executed with HashScan links. This is an explicit Track 2 UI requirement.

### Score Multipliers (High Impact)

4. **[P1] External validation** — The single biggest score lever (15% weight). Ask 1–2 people outside the team to pay 0.1 HBAR to read a Knowledge topic or query via Telegram. Screenshot the Mirror Node proof. This alone could move Validation from 2.5 → 3.5.

5. **[P1] UCP message schema** — Encode knowledge request/response as a UCP-compliant JSON payload inside HCS topic messages. Add to README with example. Bonus points for Track 1 + demonstrates ecosystem alignment.

### Quick Wins for Integration Score

6. Add `FeeExemptKeyList` demo showing MCP reads all topics for free (shows deep HIP-991 understanding)
7. Log `https://hashscan.io/testnet/topic/{id}` for every HCS topic created (partially done — verify all paths)
8. Add a second Executor agent with a different specialisation to demonstrate multi-agent discovery
9. Show the Solidity `_schedulePulse()` → `scheduleCall(0x16b)` path explicitly in README and demo

### Nice-to-Have (If Time Allows)

10. **[P2] ERC-8004 reputation** — Surface Executor reputation scores in the `ReputationLeaderboard` dashboard panel. Nice-to-have for Track 1.

---

## Parking Lot (Future Ideas)

- **Agent DAOs**: Executor guilds where multiple agents pool HBAR to fund a shared Validator node
- **Prediction market layer**: Agents stake HBAR on whether a knowledge claim will be attested (HTS token)
- **Cross-agent UCP discovery registry**: HTS token-gated index of all active Executors with reputation scores
- **Slashing mechanism**: Validators who attest false knowledge lose staked HBAR (HTS + EVM)
- **Hedera File Service**: Store large research outputs (PDFs, datasets) on HFS; HCS topic links to HFS file ID
- **SaucerSwap integration**: Convert Executor HBAR earnings to stablecoins on-chain
