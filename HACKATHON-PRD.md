# HIVE Protocol — Hackathon PRD

> **Tracks**: Killer App for the Agentic Society · On-chain Automation with Hedera Schedule Service
> **Project**: HIVE Protocol — Autonomous Knowledge Marketplace
> **Status**: MVP live on Hedera testnet · HCS-native evolution in progress (branch: `HCS`)

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

A user sends a question via WhatsApp. Their OpenClaw agent routes it to HIVE's MCP (Master Control Program) server. The MCP identifies which specialist **Executor agents** hold relevant data (each Executor publishes to its own HIP-991–gated HCS topic). The **Validator agent** pays into Executor topics to retrieve that knowledge, attests its quality on-chain, and publishes the result to a **Knowledge topic** (also HIP-991 gated). The MCP reads the attestation (fee-exempt) and returns the answer to the user's OpenClaw agent. Value flows: users pay to read Knowledge topics, Validators pay Executors to query their data, Executors earn royalties continuously. The more Executors join, the more specialised the knowledge graph; the more users join, the higher the fee revenue — a genuine network-effect flywheel, all on Hedera.

**Hackathon Track Alignment**:
- **Killer App for the Agentic Society**: HIVE is agent-native by design. OpenClaw agents are the primary users. There is no human operator. The system gains value with every new agent. Commerce is mediated by HIP-991 topic fees (Executor → Validator → User fee chain), and UCP can standardise the message schema for agent-to-agent knowledge requests.
- **On-chain Automation with Hedera Schedule Service**: Proposer auto-proposals and Validator attestation cycles can be anchored to Hedera Scheduled Transactions (HIP-755), ensuring the knowledge refresh cadence is enforced on-chain rather than relying on off-chain cron jobs — making automation trustless and auditable.

### Key Features (MVP)

1. **Autonomous 3-Agent Loop** — ProposerAgent → ExecutorAgent → ValidatorAgent cycle runs continuously on Hedera testnet with zero human intervention. Full on-chain state machine in `KnowledgePool.sol`.
2. **HIP-991 Paid Knowledge Topics** — Every validated piece of knowledge becomes a pay-to-read HCS topic (0.1 HBAR). Validator is the fee collector; access is programmable and auditable.
3. **MCP Gateway + OpenClaw Integration** — REST endpoint at `/research-request` accepts questions from any OpenClaw agent (WhatsApp/Telegram/Discord) and proxies into the on-chain cycle. Fee-exempt read of all topics for MCP routing.
4. **Live Observer Dashboard** — Next.js 14 dashboard showing agent states, HBAR economy flows, HCS feed, and knowledge graph. Built for human observers, not operators.
5. **HCS-Native Economy (Phase 2, in progress)** — Replace `KnowledgePool.sol` with pure HIP-991 topic-fee economy: Executor Topics (one per agent, pay-to-query) + Knowledge Topics (attested answers, pay-to-read). Removes contract dependency entirely.

### Non-Goals (v1)

- No user-facing wallet connection (agents transact autonomously; dashboard is read-only)
- No mainnet deployment during hackathon (testnet only)
- No cross-chain bridges
- No human-operated knowledge submission UI
- No fine-tuning or custom LLM training

---

## 3. Hedera Integration Architecture

### Network Services Used

| Service | Purpose | Why This Service? |
|---|---|---|
| **Hedera EVM** | `KnowledgePool.sol` — propose/validate/execute state machine with HBAR reward distribution | EVM compatibility for rapid Solidity development; native HBAR settlement (not wrapped); hashio RPC gives sub-second confirmation |
| **HCS (TopicCreateTransaction)** | Each validated knowledge item becomes a permanent, ordered HCS topic | Immutable, timestamped, tamper-proof — no centralised DB; native to Hedera; supports custom fees |
| **HIP-991 (Custom Fixed Fees on HCS)** | Executor topics charge Validator 0.1 HBAR to query; Knowledge topics charge users 0.1 HBAR to read | Enables a programmable fee economy *at the protocol layer* — no smart contract needed for payment routing. This is Hedera's native monetisation primitive for knowledge |
| **HIP-755 (Scheduled Transactions)** | Auto-schedule Proposer knowledge submissions and Validator attestation cycles at fixed cadences | Makes agent automation *on-chain verifiable* — no off-chain cron. Any observer can verify the schedule on HashScan. Critical for the Automation track |
| **Mirror Node API** | Dashboard live mode: polls topic messages, account balances, and transaction history | Enables the human observer UI without any custom indexer; `/api/v1/topics/{id}/messages` drives the HCS feed panel |
| **@hashgraph/sdk** | TopicCreateTransaction, CustomFixedFee, PrivateKey management for all HCS operations | Native SDK ensures correct fee application and topic memo fields — ethers.js alone cannot create HCS topics |

### Ecosystem Integrations

| Partner/Platform | Integration Type | Value Added |
|---|---|---|
| **OpenClaw** | MCP endpoint (`/research-request`) accepts agent messages from WhatsApp, Telegram, Discord | Provides the "agentic society" user layer — HIVE is the knowledge backend for the OpenClaw agent network |
| **HashScan** | Every on-chain action logs a HashScan link in agent output | Instant verifiability for judges and observers; trust indicator built into the protocol |
| **UCP (Universal Commerce Protocol)** | Standardise the JSON message schema in HCS topic messages for agent-to-agent knowledge requests | Bonus: UCP compliance means any UCP-aware agent can discover and trade with HIVE Executors without custom integration |
| **ERC-8004 (Agent Reputation)** | Executor reputation scores surfaced in dashboard `ReputationLeaderboard` component | Trust layer: agents with higher validation rates surface to the top; Validators prefer high-reputation Executors |

### Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         HIVE PROTOCOL — HEDERA LAYER                      │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  User (WhatsApp/Telegram)                                                  │
│       ↓  message                                                           │
│  OpenClaw Agent                                                            │
│       ↓  POST /research-request                                            │
│  MCP Server (port 3001) ←── fee-exempt read of all HCS topics             │
│       ↓  proposeKnowledge()                                                │
│  ┌─────────────────────────────────┐                                       │
│  │  KnowledgePool.sol (Hedera EVM) │                                       │
│  │  propose → validate → execute   │                                       │
│  │  HBAR rewards to all 3 agents   │                                       │
│  └───────────┬─────────────────────┘                                       │
│              │                                                              │
│  ┌───────────▼────────────┐                                                │
│  │   EXECUTOR TOPICS      │  (HIP-991 paid — Validator pays to query)      │
│  │   One per Executor     │                                                │
│  │   • Sensor/research    │                                                │
│  │   • HIP-755 scheduled  │                                                │
│  └───────────┬────────────┘                                                │
│              │  Validator pays → reads → attests                           │
│  ┌───────────▼────────────┐                                                │
│  │   KNOWLEDGE TOPICS     │  (HIP-991 paid — User pays to read)            │
│  │   Attested answers     │                                                │
│  │   • UCP message schema │                                                │
│  │   • ERC-8004 rep score │                                                │
│  └───────────┬────────────┘                                                │
│              │  MCP reads (fee-exempt) → returns to OpenClaw               │
│  OpenClaw Agent reasons → User receives answer                             │
│                                                                            │
└──────────────────────────────────────────────────────────────────────────┘

 Dashboard (Next.js 14): Mirror Node polling → AgentStatus | Economy |
                          HCS Feed | Knowledge Graph | Reputation Leaderboard
```

---

## 4. Hedera Network Impact

### Account Creation

- **Each new Executor agent** requires a dedicated Hedera account (separate private key to avoid nonce collisions). As the Executor network scales, each new operator creates a Hedera account.
- **OpenClaw users** who transact with Knowledge topics (pay to read) will require Hedera accounts for HBAR payment.
- **Estimated accounts at hackathon**: 4–6 (3 agents + operator + 1–2 demo users)
- **Estimated accounts at 6 months** (10 Executor operators × avg 2 Executors): 20–30 agent accounts + 100–500 user accounts

### Active Accounts

- The autonomous agent loop generates transactions continuously (every 60–120s per cycle). Even with 3 agents, all 3 accounts are active every polling interval.
- Knowledge topic fee payments mean every user query creates a Mirror Node–visible transaction from the user's account.
- **Estimated MAA at launch**: 3–6 (agents + demo users)
- **Estimated MAA at scale**: 50–200 (agents + regular knowledge consumers)

### Transactions Per Second (TPS) Impact

Each full knowledge cycle generates:
| Transaction | Hedera Service |
|---|---|
| `proposeKnowledge()` | EVM |
| `validateKnowledge()` | EVM |
| `TopicCreateTransaction` (HIP-991 topic) | HCS |
| `executeKnowledge()` + 3× HBAR transfers | EVM |
| Scheduled transaction trigger (HIP-755) | Scheduled TX |
| User pays to read Knowledge topic | HCS |

**~6 transactions per knowledge cycle** · At 1 cycle/minute with 5 Executors: ~0.5 TPS sustained from HIVE alone. At scale (100 Executors, 1000 daily queries): meaningful TPS contribution.

### Audience Exposure

- **AI developer community**: Builders of OpenClaw agents, LangChain/AutoGPT users looking for Hedera-native agent infrastructure
- **IoT/sensor operators**: Organisations with real-time data streams who can monetise as Executors
- **Enterprise AI teams**: Companies building multi-agent workflows who need verifiable knowledge provenance
- **Target market size**: $4.6B agentic AI market (2024, Grand View Research), growing 45% CAGR

---

## 5. Innovation & Differentiation

### Ecosystem Gap

No existing Hedera project provides a **programmable, autonomous knowledge economy where agents hire agents**. HTS and HCS have been used for NFTs, tokens, and audit trails — but never as the economic rails for an agent-to-agent knowledge marketplace where fees flow automatically at the HCS protocol layer (HIP-991) rather than through a smart contract intermediary.

### Cross-Chain Comparison

| Platform | What it does | HIVE difference |
|---|---|---|
| Bittensor (TAO) | Decentralised ML network with token incentives | Requires validators to run GPU nodes; not agent-native; no HCS attestation |
| Fetch.ai | Agent marketplace on Cosmos | Web3-native but no programmable fee topics; not OpenClaw integrated |
| Ritual | Onchain AI inference | Inference only; no knowledge accumulation; no pay-to-read topic economy |
| **HIVE** | Knowledge marketplace via HCS topic fees | HIP-991 makes payment happen at the *topic protocol layer* — no contract needed for fee routing. First agent-to-agent knowledge market on Hedera |

### Novel Hedera Usage

1. **HIP-991 as a native payment rail between agents** — using `CustomFixedFee` on HCS topics so that Executor agents automatically earn HBAR when their topic is queried, with zero smart contract involvement. This is non-obvious: most builders think of HCS topics as append-only logs, not economic primitives.
2. **HIP-755 for trustless automation scheduling** — scheduling Proposer submissions and Validator cycles as Hedera Scheduled Transactions so the automation cadence is enforced and auditable on-chain, not via off-chain cron.
3. **UCP message schema in HCS** — encoding Universal Commerce Protocol messages as HCS topic payloads, making every knowledge item discoverable and tradeable by any UCP-aware agent.

---

## 6. Feasibility & Business Model

### Technical Feasibility

- **Hedera Services Required**: HCS (HIP-991), Hedera EVM, Scheduled Transactions (HIP-755), Mirror Node API, @hashgraph/sdk
- **Team Capabilities**: Full-stack Node.js, Solidity, React/Next.js, Hedera SDK — all demonstrated in existing working codebase
- **Technical Risks & Mitigations**:

| Risk | Mitigation |
|---|---|
| Hashio RPC 502 intermittency | Retry logic in agents; Mirror Node as fallback for reads |
| HIP-755 scheduled TX gas limits | Lightweight contract calls; schedule only `proposeKnowledge` |
| HIP-991 fee configuration errors | Tested on testnet; fee-exempt key for MCP confirmed working |
| OpenClaw API changes | MCP server abstracts the interface; easy to swap |

### Business Model (Lean Canvas)

| Element | Description |
|---|---|
| **Problem** | Agents can't reliably hire specialist agents · No verifiable knowledge provenance · No autonomous payment settlement between agents |
| **Solution** | HIP-991 topic fees = native agent-to-agent payment rail · HCS attestation = verifiable knowledge quality · MCP gateway = OpenClaw discovery layer |
| **Key Metrics** | Active Executor count · Daily knowledge queries · HBAR volume through topic fees · Knowledge topic count |
| **Unique Value Prop** | "The knowledge marketplace where every answer is attested on Hedera and every agent earns automatically" |
| **Unfair Advantage** | HIP-991 + HCS is a Hedera-native primitive unavailable on any other chain; first-mover in the OpenClaw ecosystem |
| **Channels** | OpenClaw agent registry · Hedera developer community · AI agent Discord communities · Hackathon visibility |
| **Customer Segments** | Executor operators (data/sensor owners) · OpenClaw agent developers · Enterprise AI teams |
| **Cost Structure** | HBAR for testnet transactions (near zero) · Hosting for MCP server and dashboard · LLM API costs (Groq, free tier sufficient for MVP) |
| **Revenue Streams** | Protocol fee: 10% of all Knowledge topic fees → treasury account · Executor subscription: premium listing in MCP discovery index · Enterprise: dedicated Validator node + SLA |

### Why Web3 is Required

1. **Trustless payment between agents**: Two AI agents cannot use a bank account. HBAR settlement on Hedera is the only way autonomous agents pay each other without a human custodian.
2. **Verifiable attestation**: A Validator's `validateKnowledge()` transaction is on-chain — any agent can verify the attestation without trusting HIVE's servers.
3. **Censorship-resistant knowledge**: HCS topics are immutable and ordered; no central operator can delete or reorder attested knowledge.
4. **Programmable access control**: HIP-991 custom fees enforce "pay to read" at the protocol layer — no API key management, no rate limiting server.

---

## 7. Execution Plan

### MVP Scope (Hackathon)

| Feature | Priority | Status | Hedera Service |
|---|---|---|---|
| KnowledgePool.sol deployed on testnet | P0 | ✅ Done | Hedera EVM |
| ProposerAgent auto-proposes every 60s | P0 | ✅ Done | Hedera EVM |
| ExecutorAgent polls + executes | P0 | ✅ Done | Hedera EVM |
| ValidatorAgent attests + creates HIP-991 topic | P0 | ✅ Done | HCS + HIP-991 |
| MCP server + `/research-request` endpoint | P0 | ✅ Done | — |
| Next.js observer dashboard (live + demo mode) | P0 | ✅ Done | Mirror Node |
| HCS-native Executor Topics (HIP-991 economy) | P0 | 🔄 In progress (branch: HCS) | HCS + HIP-991 |
| HIP-755 Scheduled TX for Proposer cadence | P1 | 📋 Planned | Scheduled TX |
| UCP message schema in HCS topic payloads | P1 | 📋 Planned | HCS |
| ERC-8004 reputation scores in dashboard | P2 | 📋 Planned | Mirror Node |
| OpenClaw live agent connection demo | P1 | 📋 Planned | OpenClaw |

### Team Roles

| Member | Role | Key Responsibilities |
|---|---|---|
| Kevin | Full-Stack / Protocol Lead | Solidity contracts, Node.js agents, Hedera SDK integration, MCP server |
| Nicolas | Frontend / Dashboard | Next.js dashboard, Mirror Node integration, UI/UX |
| (+ teammates) | TBD | OpenClaw integration, demo video, pitch |

### Design Decisions

| Decision | Options Considered | Choice | Rationale |
|---|---|---|---|
| Knowledge economy primitive | Smart contract reward pool vs. HIP-991 topic fees | HIP-991 (evolving to) | No contract needed for fee routing; fees enforced at protocol layer; more composable |
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
- **Hackathon judges**: Structured feedback from the Innovation/Integration judges is a validation cycle in itself
- **AI agent developer communities** (Discord: LangChain, AutoGPT, CrewAI): Share the concept of "agents that hire agents on Hedera" — gauge interest and pull requests

### Validation Milestones

| Milestone | Target | Timeline |
|---|---|---|
| Working demo with 3 agents on testnet | Live on HashScan | Hackathon day 1 |
| First external Executor operator | 1 person runs their own Executor | Hackathon demo day |
| Hackathon judge feedback collected | Written responses from 2+ judges | Demo day |
| OpenClaw integration tested end-to-end | WhatsApp → HIVE → answer returned | Pre-submission |
| First external Knowledge topic query (fee paid) | 1 non-team user pays to read | Post-hackathon week 1 |
| 5 Executor operators, 20+ knowledge topics | Growing knowledge graph | Month 1 |

### Market Feedback Cycles

1. **Cycle 1 (Hackathon)**: Deploy demo → share dashboard URL with judges + Hedera Discord → collect structured feedback on UX, economics, and HCS usage
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

1. **The Problem (30s)**: *"AI agents are getting smarter — but they're also getting lonelier. When your WhatsApp agent needs real-time data it doesn't have, it either hallucinates or calls a centralised API it can't verify. There's no marketplace where agents hire agents, pay instantly, and trust what they receive."*

2. **The Solution (60s)**: *"HIVE Protocol is the knowledge marketplace for the agentic society. Three agents — a Proposer, an Executor, and a Validator — run autonomously on Hedera. Executors collect data, publish it to HCS topics with a 0.1 HBAR read fee. Validators attest quality on-chain and create permanent knowledge records. OpenClaw agents pay to query — HBAR flows automatically, no human involved. Watch it run live on HashScan."* [Demo: show HashScan + dashboard]

3. **Hedera Integration (45s)**: *"HIP-991 is the secret. Custom fees on HCS topics mean Executors earn HBAR every time their knowledge is read — no smart contract, no escrow, no gas limit. HIP-755 Scheduled Transactions enforce the automation cadence on-chain. And HCS gives every answer an immutable, timestamped, verifiable provenance. This literally cannot exist anywhere else."*

4. **Traction (30s)**: *"We have [N] knowledge topics live on Hedera testnet, [N] HBAR transacted between agents, and the dashboard at [URL] showing the agent economy in real time. We've validated the UCP message schema with an OpenClaw agent end-to-end."*

5. **The Opportunity (30s)**: *"The agentic AI market hits $20B by 2028. Every AI agent that needs verified knowledge is a potential HIVE user. Every data operator is a potential Executor. We're the knowledge layer the agentic society runs on — and it gets more valuable with every agent that joins."*

6. **The Ask / Next Steps (15s)**: *"We're applying for the Hedera incubator and looking for the first 5 Executor operators. If you have data streams that agents should be paying to access, HIVE is how you monetise them — today, on testnet."*

### Key Metrics to Present

- Live HashScan links to `KnowledgePool.sol` contract and HIP-991 topics (verifiable, not slide claims)
- Number of autonomous transactions completed during hackathon period
- Dashboard URL showing live agent state, HBAR economy flow, and HCS feed
- HBAR volume transacted between agents (fee receipts from HIP-991 topics)

---

## Parking Lot (Future Ideas)

- **Agent DAOs**: Executor guilds where multiple agents pool HBAR to fund a shared Validator node
- **Prediction market layer**: Agents stake HBAR on whether a knowledge claim will be attested (HTS token)
- **Cross-agent UCP discovery registry**: HTS token-gated index of all active Executors with reputation scores
- **Slashing mechanism**: Validators who attest false knowledge lose staked HBAR (HTS + EVM)
- **Hedera File Service**: Store large research outputs (PDFs, datasets) on HFS; HCS topic links to HFS file ID

---

## Predicted Score Assessment

| Criterion | Predicted Score | Rationale | How to Improve |
|---|---|---|---|
| **Innovation (10%)** | 4.5 / 5 | First agent-to-agent knowledge marketplace on Hedera; HIP-991 used as a native payment rail between agents is genuinely non-obvious; UCP integration is exactly what the track asks for | Explicitly demo UCP message encoding in an HCS topic payload during the pitch |
| **Feasibility (10%)** | 4 / 5 | Working code on testnet, clear Lean Canvas, team has demonstrated full-stack Hedera capability | Complete the Lean Canvas section with cited market size data; show understanding of Hashio RPC risks and mitigations |
| **Execution (20%)** | 4 / 5 | MVP is live and running; dashboard exists; MCP endpoint works; HCS-native branch in active development | Ship the HCS-native economy before submission; add OpenClaw end-to-end demo; ensure dashboard runs at a public URL |
| **Integration (15%)** | 5 / 5 | EVM + HCS + HIP-991 + HIP-755 + Mirror Node + OpenClaw + UCP — deep, creative, multi-service. HIP-991 as agent payment rail is the non-obvious integration that scores a 5 | Add HIP-755 Scheduled TX demo; show UCP schema in HCS payload |
| **Validation (15%)** | 2.5 / 5 | Currently only internal testing; no external users yet | Highest leverage: get 1–2 external people to run an Executor or query a Knowledge topic before demo day; screenshot the Mirror Node proof |
| **Success (20%)** | 3.5 / 5 | Every cycle generates 5–6 Hedera transactions; autonomous agents = continuous activity; network effect story is credible | Show live transaction count on HashScan during pitch; articulate the TPS contribution explicitly |
| **Pitch (10%)** | 4 / 5 | Strong narrative ("agents hiring agents"), live demo URL, HashScan links are credible proof points | Practice the 3-minute structure; lead with the HashScan live view; have a backup demo video |

**Estimated Weighted Score**: ~83–88% · Strong contender in both tracks.

---

## Immediate Next Steps (Priority Order)

### Before Submission

1. **[P0] Complete HCS-native branch** — merge the Executor Topics + Knowledge Topics architecture so the live demo shows the pure HIP-991 economy (no contract dependency). This is the Integration score's strongest moment.
2. **[P0] Add HIP-755 Scheduled Transaction** — schedule at least one `proposeKnowledge()` call as a Hedera Scheduled Transaction. This directly addresses the second track requirement and scores Integration higher.
3. **[P0] Deploy dashboard to public URL** — vercel deploy of `dashboard/` with `NEXT_PUBLIC_USE_MOCK_DATA=false` pointing at testnet. Judges need a browser URL.
4. **[P1] UCP message schema** — encode knowledge request/response as a UCP-compliant JSON payload inside HCS topic messages. Add to README with example. This is the bonus criterion for Track 1.
5. **[P1] External validation** — ask 1–2 people outside the team to query a Knowledge topic (pay 0.1 HBAR) and screenshot the Mirror Node proof. This is the single biggest Validation score lever.
6. **[P1] Demo video** — 3 minutes max. Show: WhatsApp message → MCP → on-chain cycle → HashScan → Knowledge topic created → answer returned. Real transactions, not mockups.
7. **[P2] ERC-8004 reputation** — surface Executor reputation scores in the `ReputationLeaderboard` dashboard panel. Nice-to-have for the track's bonus criterion.

### Quick Wins for Integration Score

- Add `FeeExemptKeyList` demo showing MCP reads all topics for free (shows you understand HIP-991 deeply)
- Log `https://hashscan.io/testnet/topic/{id}` for every HCS topic created (already partially done)
- Add a second Executor agent with a different specialisation to demonstrate multi-agent discovery
