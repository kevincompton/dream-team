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
│               │  │  (settlement bot) │  │                      │
│ • Generates   │  │                   │  │ • Polls for items    │
│   research    │  │ • Polls for items │  │   where validated    │
│   questions   │  │   where executed  │  │   == false           │
│               │  │   == false        │  │                      │
│ • Calls       │  │                   │  │ • Calls              │
│   propose-    │  │ • Checks pool     │  │   validateKnowledge()│
│   Knowledge() │  │   balance ≥       │  │                      │
│               │  │   reward          │  │ • Creates HIP-991    │
│ • Respects    │  │                   │  │   paid topic for     │
│   backlog     │  │ • Calls           │  │   each knowledge     │
│   limit (3)   │  │   executeKnow-    │  │   item               │
│               │  │   ledge() →       │  │                      │
│               │  │   triggers HBAR   │  │ • Registers topic    │
│               │  │   payout to all   │  │   in HCS-2 indexed   │
│               │  │   3 roles         │  │   registry            │
│               │  │                   │  │                      │
│               │  │ • No HCS topics   │  │                      │
│               │  │ • No research     │  │                      │
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

### Provisioning a Sensor (Demo)

```bash
# 1. Set sensor account credentials in .env
SENSOR_ACCOUNT_ID=0.0.XXXXXXX
SENSOR_PRIVATE_KEY=0x...
SENSOR_REGISTRY_TOPIC_ID=0.0.7984160

# 2. Run the provisioning script
npm run create:sensor-topic

# Output:
# [SENSOR] HIP-991 topic created: 0.0.YYYYYYY
# [SENSOR] Fee: 0.1 HBAR per message (collector: 0.0.XXXXXXX)
# [SENSOR] Registered in HCS-2 registry (seq: N)
#
# --- Add to .env ---
# SENSOR_TOPIC_ID=0.0.YYYYYYY
```

The script creates a HIP-991 paid topic (0.1 HBAR per message, fee collector = sensor account)
and registers it in the HCS-2 Sensor Registry for discovery by other agents.

### Open Questions

- **How do sensors signal readiness?** Options: (a) submit to a shared HCS coordination topic, (b) an on-chain mapping/event, (c) validator just polls sensor topics
- **Sensor reward split?** Currently rewards go to proposer/validator/executor. Should sensors get a cut? Would require a contract change (4-way split) or an off-chain arrangement.
- **Sensor selection:** When multiple sensors can handle a query, who picks which one runs it? First-come-first-serve? Validator chooses? MCP routes?
- **Capability matching:** How does a sensor know a knowledge item matches its domain? Keyword matching? LLM classification? On-chain tags?

---

## On-Chain Scheduling (HIP-755 / HIP-1215)

The KnowledgePool contract uses the **Hedera Schedule Service system contract** (`0x16b`)
to schedule recurring self-calls — no off-chain cron or keeper bot required.

### How It Works

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    KnowledgePool.sol + HederaScheduleService            │
│                                                                         │
│  owner calls startPulse(30)                                             │
│       │                                                                 │
│       ▼                                                                 │
│  _schedulePulse(block.timestamp + 30)                                   │
│       │                                                                 │
│       ├──► scheduleCall(self, expiry, 2M gas, 0, pulse.selector)       │
│       │         │                                                       │
│       │         ▼  HSS system contract (0x16b) stores the schedule     │
│       │                                                                 │
│       │    ... 30 seconds pass ...                                      │
│       │                                                                 │
│       │    Hedera network auto-executes pulse()                         │
│       │         │                                                       │
│       │         ├──► emit SensorPulse(id, timestamp, trigger=true/false)│
│       │         │                                                       │
│       │         └──► _schedulePulse(block.timestamp + 30)  ◄── LOOP    │
│       │                                                                 │
│  stopPulse()  ──► pulseInterval = 0  ──► next pulse() won't reschedule │
└─────────────────────────────────────────────────────────────────────────┘
```

Key points:
- Uses HIP-1215 `scheduleCall()` (generalized scheduled contract calls)
- The contract pays for scheduled execution gas from its own HBAR balance
- `trigger` boolean is pseudo-random: `keccak256(timestamp, pulseId) % 2`
- `stopPulse()` breaks the loop by setting `pulseInterval = 0`

### Event Bridge (Mirror Node → Telegram)

```
KnowledgePool              Mirror Node REST API              MCP (mcp.ts)             Telegram Bot API
     │                            │                              │                          │
     │  emit SensorPulse(...)     │                              │                          │
     ├───────────────────────────►│                              │                          │
     │                            │                              │                          │
     │                            │◄── GET /contracts/{addr}/   │                          │
     │                            │    results/logs?topic0=...   │                          │
     │                            │                              │                          │
     │                            ├─────── log entries ─────────►│                          │
     │                            │                              │                          │
     │                            │                              ├── POST /sendMessage ────►│
     │                            │                              │                          │
     │                            │                              │         ┌────────────────┤
     │                            │                              │         │ Telegram DM to │
     │                            │                              │         │ sensor agent   │
     │                            │                              │         └────────────────┘
```

The MCP polls Mirror Node every 10 seconds for `SensorPulse` events and forwards
them to a Telegram chat via the Bot API. The sensor agent (or human operator)
receives the pulse and can act on the `trigger` boolean.

### Setup Commands

```bash
# 1. Deploy the contract (funds it with 5 HBAR by default)
npm run deploy:contract

# 2. Get your Telegram chat ID (send a message to the bot first)
npm run get:telegram-chat-id
# Copy TELEGRAM_CHAT_ID to .env

# 3. Start the pulse (30s default interval)
npm run start:pulse
# Or with custom interval:  cd contracts && npx hardhat run scripts/start-pulse.js --network hedera -- 60

# 4. Stop the pulse
npm run stop:pulse
```
