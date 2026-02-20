# HIVE Protocol — Architecture

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        MCP (port 3001)                          │
│              Master Control Program / API Gateway                │
│                                                                 │
│  POST /research-request  ──►  routes to Proposer                │
│  GET  /status            ──►  on-chain pool stats               │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                     KnowledgePool.sol (EVM)                       │
│                                                                  │
│  knowledgePool[id] = { proposer, content, timestamp,             │
│                        validated, executed, validator, executor } │
│                                                                  │
│  poolBalance()  ·  totalRewardPerTask()  ·  knowledgeCount()     │
└──────────────────────────────────────────────────────────────────┘
        ▲                    ▲                      ▲
        │                    │                      │
   proposeKnowledge()   executeKnowledge()    validateKnowledge()
        │                    │                      │
┌───────┴───────┐  ┌─────────┴─────────┐  ┌────────┴────────────┐
│   PROPOSER    │  │     EXECUTOR      │  │     VALIDATOR        │
│               │  │                   │  │                      │
│ • Generates   │  │ • Polls for items │  │ • Polls for items    │
│   research    │  │   where executed  │  │   where validated    │
│   questions   │  │   == false        │  │   == false           │
│               │  │                   │  │                      │
│ • Calls       │  │ • Checks pool     │  │ • Calls              │
│   propose-    │  │   balance ≥       │  │   validateKnowledge()│
│   Knowledge() │  │   reward          │  │                      │
│               │  │                   │  │ • Creates HIP-991    │
│ • Respects    │  │ • Calls           │  │   paid topic for     │
│   backlog     │  │   executeKnow-    │  │   each knowledge     │
│   limit (3)   │  │   ledge() →       │  │   item               │
│               │  │   triggers HBAR   │  │                      │
│               │  │   payout to all   │  │ • Registers topic    │
│               │  │   3 roles         │  │   in HCS-2 indexed   │
│               │  │                   │  │   registry            │
└───────────────┘  └───────────────────┘  └──────────────────────┘
    Account:            Account:               Account:
    0.0.7984601         0.0.7984602            0.0.7984604
```

### Contract Flow (current)

```
User question arrives via MCP
        │
        ▼
  ┌─ Proposer ─┐
  │  propose-   │
  │  Knowledge()│──────► Item created on-chain (validated=false, executed=false)
  └─────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
     ┌─── Validator ───┐            ┌──── Executor ────┐
     │ validateKnow-   │            │  executeKnow-    │
     │ ledge()         │            │  ledge()         │
     │                 │            │                  │
     │ validated=true  │            │ executed=true    │
     │ + HIP-991 topic │            │ + HBAR rewards   │
     │ + HCS-2 index   │            │   paid out       │
     └─────────────────┘            └──────────────────┘

  Flow order: validate-first (contract enforces validation before execution)
```

### Reward Settlement

When `executeKnowledge(id)` is called, the contract pays from the pool:

| Role       | Reward     |
|------------|------------|
| Proposer   | 0.001 HBAR |
| Validator  | 0.001 HBAR |
| Executor   | 0.001 HBAR |
| **Total**  | **0.003 HBAR per task** |

---

## Proposed Architecture — With Sensor Agents

Sensor agents are independent data-gathering agents that **do the actual research work**,
**monetize their findings** through HIP-991 paid topics, and **store results** on HCS.
The executor remains a lean settlement bot.

```
┌─────────────────────────────────────────────────────────────────┐
│                        MCP (port 3001)                          │
│              Master Control Program / API Gateway                │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                     KnowledgePool.sol (EVM)                       │
└──────────────────────────────────────────────────────────────────┘
        ▲                    ▲                      ▲
        │                    │                      │
   proposeKnowledge()   executeKnowledge()    validateKnowledge()
        │                    │                      │
┌───────┴───────┐  ┌─────────┴─────────┐  ┌────────┴────────────┐
│   PROPOSER    │  │     EXECUTOR      │  │     VALIDATOR        │
│               │  │  (settlement bot) │  │  (attestation +      │
│ Submits       │  │                   │  │   knowledge topics)  │
│ research      │  │ Checks balance,   │  │                      │
│ questions     │  │ calls execute,    │  │ Validates items,     │
│               │  │ distributes HBAR  │  │ creates HIP-991      │
│               │  │                   │  │ paid topics,         │
│               │  │ No HCS topics.    │  │ HCS-2 indexing       │
│               │  │ No research.      │  │                      │
└───────────────┘  └───────────────────┘  └──────────────────────┘
                                                    ▲
                                                    │ submits findings
                                                    │ for validation
                                                    │
         ┌──────────────────────────────────────────┘
         │
         │          ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
         │            SENSOR AGENT FLEET  (N instances)
         │          │                                           │
         │
         │          │  ┌──────────────┐  ┌──────────────┐       │
         ├─────────────│  Sensor #1   │  │  Sensor #2   │
         │          │  │  (weather)   │  │  (finance)   │       │
         │             │              │  │              │
         │          │  │ Own HIP-991  │  │ Own HIP-991  │       │
         │             │ paid topic   │  │ paid topic   │
         │          │  └──────┬───────┘  └──────┬───────┘       │
         │                    │                 │
         │          │         ▼                 ▼                │
         │             ┌──────────────┐  ┌──────────────┐
         │          │  │  Sensor #3   │  │  Sensor #N   │       │
         │             │  (science)   │  │  (custom)    │
         │          │  │              │  │              │       │
         │             │ Own HIP-991  │  │ Own HIP-991  │
         │          │  │ paid topic   │  │ paid topic   │       │
         │             └──────────────┘  └──────────────┘
         │          │                                           │
         │           ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
         │
         ▼
┌─────────────────────────────────────────────┐
│          HCS-2 Sensor Registry              │
│  (indexed topic listing all sensor topics)  │
│                                             │
│  Each sensor registers on startup:          │
│  { topicId, type, capabilities, accountId } │
└─────────────────────────────────────────────┘
```

### Sensor Agent Lifecycle

```
                        ┌──────────────────────┐
           Startup      │  1. Create HIP-991   │
          ─────────►    │     paid topic       │
                        │     (monetizes       │
                        │      query access)   │
                        │                      │
                        │  2. Register in      │
                        │     HCS-2 Sensor     │
                        │     Registry         │
                        └──────────┬───────────┘
                                   │
                                   ▼
                        ┌──────────────────────┐
           Polling      │  3. Watch contract   │
          ─────────►    │     for unexecuted   │
                        │     items matching   │
                        │     capability       │
                        └──────────┬───────────┘
                                   │
                                   ▼
                        ┌──────────────────────┐
           Research     │  4. Gather data /    │
          ─────────►    │     run research     │
                        │     (LLM + tools)    │
                        └──────────┬───────────┘
                                   │
                                   ▼
                        ┌──────────────────────┐
           Publish      │  5. Submit results   │
          ─────────►    │     to own HIP-991   │
                        │     paid topic       │
                        │     (stored on HCS)  │
                        └──────────┬───────────┘
                                   │
                                   ▼
                        ┌──────────────────────┐
           Signal       │  6. Signal validator │
          ─────────►    │     that research    │
                        │     is ready for     │
                        │     attestation      │
                        └──────────────────────┘
```

### Full Flow With Sensors

```
User: "What is the current state of DeFi lending rates?"
  │
  ▼
MCP ──► Proposer ──► proposeKnowledge("DeFi lending rates") ──► Item #5 on-chain
                                                                     │
                                                                     │
  ┌──────────────────────────────────────────────────────────────────┘
  │
  ▼
Sensor #2 (finance) sees item #5 matches its capability
  │
  ├─► Researches DeFi lending rates (Aave, Compound, etc.)
  │
  ├─► Submits findings to its HIP-991 paid topic on HCS
  │   (anyone can pay 0.1 HBAR to read this topic)
  │
  └─► Signals readiness (e.g., HCS message or on-chain flag)
        │
        ▼
Validator sees item #5 is ready
  │
  ├─► Reads sensor's findings
  ├─► Validates quality / accuracy
  ├─► Calls validateKnowledge(5) on-chain
  ├─► Creates HIP-991 knowledge topic for item #5
  └─► Indexes in HCS-2 Knowledge Registry
        │
        ▼
Executor sees item #5 is validated + unexecuted
  │
  ├─► Checks pool balance ≥ 0.003 HBAR
  └─► Calls executeKnowledge(5) ──► HBAR paid to proposer, validator, executor
```

### Role Summary

| Agent      | Responsibility                          | HIP-991 Topics       | HCS-2 Registry         |
|------------|-----------------------------------------|----------------------|------------------------|
| Proposer   | Submits research questions              | None                 | None                   |
| Sensor(s)  | Gathers data, publishes findings        | Own paid topic       | Sensor Registry        |
| Validator  | Attests quality, gates execution        | Per-knowledge topic  | Knowledge Registry     |
| Executor   | Settlement — triggers reward payout     | None                 | None                   |

### Open Questions

- **How do sensors signal readiness?** Options: (a) submit to a shared HCS coordination topic, (b) an on-chain mapping/event, (c) validator just polls sensor topics
- **Sensor reward split?** Currently rewards go to proposer/validator/executor. Should sensors get a cut? Would require a contract change (4-way split) or an off-chain arrangement.
- **Sensor selection:** When multiple sensors can handle a query, who picks which one runs it? First-come-first-serve? Validator chooses? MCP routes?
- **Capability matching:** How does a sensor know a knowledge item matches its domain? Keyword matching? LLM classification? On-chain tags?
