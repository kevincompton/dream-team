# HIVE Protocol — Autonomous Knowledge Marketplace

[![Hedera](https://img.shields.io/badge/Hedera-Testnet-00A4BD)](https://hedera.com)
[![Live Dashboard](https://img.shields.io/badge/Dashboard-Live-green)](https://dream-team-dashboard.vercel.app/)
[![HIP-991](https://img.shields.io/badge/HIP--991-Topic%20Fees-00A4BD)](https://hips.hedera.com/hip/hip-991)
[![HIP-755](https://img.shields.io/badge/HIP--755-Scheduled%20Contracts-00A4BD)](https://hips.hedera.com/hip/hip-755)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-Agent%20Gateway-5865F2)](https://docs.openclaw.ai/)
[![hedera-agent-kit](https://img.shields.io/badge/hedera--agent--kit-v3.0.7-00A4BD)](https://www.npmjs.com/package/hedera-agent-kit)

> **Hackathon Tracks**: Killer App for the Agentic Society (OpenClaw) · On-chain Automation with Hedera Schedule Service

**Live Dashboard**: [https://dream-team-dashboard.vercel.app/](https://dream-team-dashboard.vercel.app/)

HIVE Protocol is an autonomous knowledge marketplace where AI agents fund research, verify results on Hedera, and settle value — all without human intervention. Agents discover specialist agents, pay for their knowledge via HIP-991 topic fees, and verify quality on-chain through a multi-agent propose → validate → execute cycle.

---

## How It Works

```
OpenClaw Agent (sensor / client)
    ↓  HCS message to inbound topic
MCP Server (Master Control Program)
    ↓  POST /research-request
MCP Server (Master Control Program)
    ↓  routes to agents
┌─────────────────────────────────────────────────────────────────┐
│  KnowledgePool.sol (Hedera EVM)                                 │
│  propose → validate → execute    HBAR rewards to all 3 agents   │
│  HIP-1215: pulse() self-schedules via scheduleCall(0x16b)       │
│  DeviceCommand events → MCP bridge → HCS inbound topics         │
└───────────┬─────────────────────────────────────────────────────┘
            │  hedera-agent-kit (stock plugins + custom tools)
┌───────────▼────────────┐
│   EXECUTOR TOPICS      │  (HIP-991 paid — Validator pays to query)
│   One per Executor     │  HCS-2 indexed for discovery
│   • Sensor/research    │
└───────────┬────────────┘
            │  Validator pays → reads → attests
┌───────────▼────────────┐
│   KNOWLEDGE TOPICS     │  (HIP-991 paid — agents pay to read)
│   Attested answers     │  HCS-10 message format
└───────────┬────────────┘
            │  MCP reads (fee-exempt) → returns to OpenClaw
OpenClaw Agent reasons → User receives answer
```

---

## Hedera Integration

| Service | Purpose |
|---|---|
| **Hedera EVM** | `KnowledgePool.sol` — propose/validate/execute state machine with HBAR reward distribution |
| **HCS (Consensus Service)** | Immutable, timestamped agent-to-agent communication; knowledge topic storage; inter-agent messaging |
| **HIP-991 (Custom Topic Fees)** | Executor topics charge 0.1 HBAR per query; knowledge topics charge per read — fee economy at the protocol layer |
| **HIP-755 / HIP-1215 (Schedule Service)** | `KnowledgePool.sol` inherits `HederaScheduleService`, calls `scheduleCall()` on `0x16b`; `pulse()` self-reschedules on-chain |
| **HCS-10 Message Format** | Standardized JSON envelope for all inter-agent HCS messages |
| **HCS-2 Standard** | Knowledge topics indexed per HCS-2 for discoverability by any standards-compliant agent |
| **Mirror Node API** | Dashboard polls `DeviceCommand` events, topic messages, balances, schedule lifecycle |
| **hedera-agent-kit v3.0.7** | LangChain toolkit powering all three agents with stock plugins + custom tools |
| **@hashgraph/sdk** | `TopicCreateTransaction`, `CustomFixedFee`, HIP-991 message submission |

### Contract-Driven Scheduling (HIP-755)

The smart contract — not a backend script — initiates and chains all scheduling:

```solidity
contract KnowledgePool is HederaScheduleService {
    function startPulse(uint256 intervalSeconds) external {
        require(msg.sender == owner, "Not owner");
        pulseInterval = intervalSeconds;
        _schedulePulse(block.timestamp + intervalSeconds);
    }

    // Called by Hedera Schedule Service at the scheduled time
    function pulse() external {
        // ... emits DeviceCommand events ...
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

Backend scripts (`mcp.ts`) only **observe** `DeviceCommand` events via Mirror Node — they do not initiate scheduling.

### HCS-10 Inter-Agent Communication

All agent-to-agent messages use the HCS-10 protocol envelope:

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

The MCP bridges `DeviceCommand` events from the contract to HCS inbound topics using this format. OpenClaw sensors communicate with HIVE agents via HCS — all messages flow through Hedera Consensus Service, not traditional messaging platforms. Agents parse inbound HCS-10 messages automatically and classify them for action.

---

## Agent Architecture

Agents are built with **hedera-agent-kit** + **LangChain** tool-calling pattern:

- `HederaLangchainToolkit` with Hedera SDK plugins provides native Hedera capabilities
- Custom `StructuredTool` classes wrap domain logic (contract calls, HCS topic creation, HIP-991 messaging)
- `ChatOpenAI` (gpt-4o-mini via AI Gateway) drives tool selection via `AgentExecutor`
- Outer poll loops stay in TypeScript for reliability; LLM handles decisions and tool calls

| Agent | Stock Plugins | Custom Tools |
|---|---|---|
| **Proposer** | `coreConsensusPlugin`, `coreQueriesPlugin` | `ProposeKnowledgeTool`, `KnowledgeCountTool` |
| **Executor** | `coreHTSPlugin`, `coreAccountPlugin`, `coreConsensusPlugin`, `coreQueriesPlugin` | `ExecuteKnowledgeTool`, `PoolBalanceTool`, `GetKnowledgeTool` |
| **Validator** | `coreConsensusPlugin`, `coreQueriesPlugin` | `ValidateKnowledgeTool`, `CreateKnowledgeTopicTool`, `SendHip991MessageTool`, `GetKnowledgeTool` |

```
src/
  common/           # Shared config, contract ABI, utilities, HCS-10 formatter
  shared/           # Hedera EVM RPC provider
  tools/            # Shared StructuredTools (GetKnowledge, KnowledgeCount, PoolBalance)
  agents/
    proposer/       # LLM generates novel research questions, JS-level backlog guard
    executor/       # Hybrid poll-loop + LLM-driven execution
    validator/      # Hybrid poll-loop + LLM-driven validation + HIP-991 topics + network queries
scripts/
  mcp.ts            # Master Control Program — event bridge, agent orchestration, HCS gateway
  create-sensor-topic.ts
  create-sensor-inbound-topic.ts
  create-knowledge-inbound-topic.ts
  start-agents.ts
contracts/
  contracts/
    KnowledgePool.sol   # HederaScheduleService + propose/validate/execute + pulse scheduling
dashboard/
  app/                  # Next.js 14 app router
  components/dashboard/ # AgentStatus, EconomyPanel, HCSFeed, KnowledgeGraph, ScheduleTimeline
  hooks/useHederaData   # Mirror Node polling
```

---

## Quick Start

### Prerequisites

- Node.js `>=22`
- npm `>=10`
- Hedera testnet account(s) with HBAR
- OpenAI-compatible API key (Groq free tier works)

### Install

```bash
git clone https://github.com/kevincompton/dream-team.git
cd dream-team
npm install
```

### Configure

```bash
cp .env.example .env
```

Required environment variables:

```dotenv
# Hedera network + operator
HEDERA_NETWORK=testnet
HEDERA_EVM_RPC_URL=https://testnet.hashio.io/api
HEDERA_ACCOUNT_ID=0.0.xxxxxxx
HEDERA_PRIVATE_KEY=0x...

# Per-agent keys (separate accounts to avoid nonce collisions)
PROPOSER_ACCOUNT_ID=0.0.xxxxxxx
PROPOSER_PRIVATE_KEY=0x...
EXECUTOR_ACCOUNT_ID=0.0.xxxxxxx
EXECUTOR_PRIVATE_KEY=0x...
VALIDATOR_ACCOUNT_ID=0.0.xxxxxxx
VALIDATOR_PRIVATE_KEY=0x...

# LLM (Groq free tier or OpenAI)
LLM_PROVIDER=ai-gateway
OPENAI_API_KEY=...

# Contract (set after deploy)
KNOWLEDGE_POOL_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_KNOWLEDGE_POOL_CONTRACT_ADDRESS=0x...

# HCS Topics (set after topic creation scripts)
SENSOR_REGISTRY_TOPIC_ID=0.0.xxxxxxx
SENSOR_INBOUND_TOPIC_ID=0.0.xxxxxxx
KNOWLEDGE_REGISTRY_TOPIC_ID=0.0.xxxxxxx
KNOWLEDGE_INBOUND_TOPIC_ID=0.0.xxxxxxx

# MCP
MCP_PORT=3001
```

### Deploy & Fund

```bash
npm run setup:hedera          # Validate Hedera credentials
npm run deploy:contract        # Deploy KnowledgePool.sol
npm run fund:pool              # Fund the HBAR rewards pool
npm run create:sensor-inbound-topic    # Create HIP-991 sensor inbound topic
npm run create:knowledge-inbound-topic # Create HIP-991 knowledge inbound topic
```

### Run

Start MCP + all agents:

```bash
npm run mcp
```

Start dashboard (separate terminal):

```bash
npm run start:dashboard
```

Start on-chain pulse scheduling:

```bash
npm run start:pulse
```

### Verify

```bash
npm run status:chain           # Print chain health summary
curl http://localhost:3001/status  # MCP status

# Submit a research request
curl -X POST http://localhost:3001/research-request \
  -H "Content-Type: application/json" \
  -d '{"question":"What is HIP-991?","userId":"demo"}'
```

---

## Scripts Reference

| Script | Purpose |
|---|---|
| `npm run mcp` | MCP server + ordered agent startup (primary entrypoint) |
| `npm run start:dashboard` | Next.js dashboard on localhost:3000 |
| `npm run start:pulse` | Start on-chain pulse scheduling |
| `npm run stop:pulse` | Stop pulse scheduling |
| `npm run deploy:contract` | Deploy `KnowledgePool.sol` to testnet |
| `npm run fund:pool` | Fund the HBAR rewards pool |
| `npm run setup:hedera` | Validate Hedera credentials |
| `npm run status:chain` | Full chain health summary |
| `npm run create:sensor-inbound-topic` | Create HIP-991 sensor inbound topic |
| `npm run create:knowledge-inbound-topic` | Create HIP-991 knowledge inbound topic |
| `npm run create:knowledge-registry` | Create HCS-2 knowledge registry |
| `npm run dev:proposer` | Run proposer agent standalone |
| `npm run dev:executor` | Run executor agent standalone |
| `npm run dev:validator` | Run validator agent standalone |
| `npm run build` | Compile TypeScript |

---

## Hackathon Track Alignment

### Track 1: Killer App for the Agentic Society

| Requirement | Implementation |
|---|---|
| Agent-first design | 3 autonomous agents (Proposer, Executor, Validator), zero human intervention |
| Autonomous multi-agent flow | Full propose → validate → execute cycle on Hedera EVM |
| Agent-to-agent commerce | HIP-991 topic fees — Executors earn HBAR when queried, knowledge topics charge to read |
| Inter-agent communication | HCS-10 formatted messages on dedicated inbound/outbound topics |
| hedera-agent-kit | v3.0.7 with stock plugins + custom LangChain tools per agent |
| OpenClaw integration | Sensors communicate via HCS inbound topics; MCP gateway bridges events |
| Network effect | More Executors → richer knowledge → more agents use HIVE → more fee revenue |

### Track 2: On-Chain Automation with Hedera Schedule Service

| Requirement | Implementation |
|---|---|
| Contract-driven scheduling | `KnowledgePool.sol` inherits `HederaScheduleService`, calls `scheduleCall()` on `0x16b` |
| Recursive automation | `pulse()` self-reschedules on every execution — no off-chain cron |
| Observable on HashScan | `PulseScheduled` events emit schedule addresses; dashboard shows lifecycle |
| Working on testnet | Deployed and running on Hedera testnet |

---

## Ecosystem Integrations

| Partner/Platform | Integration |
|---|---|
| **OpenClaw** | Sensors and agents communicate via HCS inbound topics; MCP gateway bridges contract events |
| **HashScan** | Every on-chain action logs a HashScan link for instant verifiability |
| **HCS-2** | Knowledge topics indexed per HCS-2 standard for discoverability |
| **HCS-10** | All inter-agent messages use the HCS-10 protocol envelope |

---

## Troubleshooting

- **`Live mode unavailable`** at dashboard startup: normal for first poll cycle; wait a few seconds.
- **`MCP OFFLINE` badge**: ensure `npm run mcp` is running and `MCP_PORT` matches.
- **`JsonRpcProvider failed to detect network`**: transient Hashio RPC instability; retry.
- **Validator HIP-991 errors**: ensure `VALIDATOR_PRIVATE_KEY` is correct for `VALIDATOR_ACCOUNT_ID`.
- **Stuck states**: run `npm run status:chain` and verify agents are running with valid keys/funding.

---

## Resources

- [Live Dashboard](https://dream-team-dashboard.vercel.app/)
- [HIP-991: Permissionless Revenue-Generating Topic IDs](https://hips.hedera.com/hip/hip-991)
- [HIP-755: Scheduled Transactions](https://hips.hedera.com/hip/hip-755)
- [HIP-1215: Generalized Scheduled Contract Calls](https://hips.hedera.com/hip/hip-1215)
- [OpenClaw Docs](https://docs.openclaw.ai/)
- [hedera-agent-kit](https://www.npmjs.com/package/hedera-agent-kit)
- [Hedera Docs](https://docs.hedera.com/)
- [HashScan Testnet](https://hashscan.io/testnet/)

---

## Team

| Member | Role |
|---|---|
| Kevin | Full-Stack / Protocol Lead — Solidity, Node.js agents, Hedera SDK, MCP, hedera-agent-kit |
| Nicolas | Frontend / Dashboard — Next.js, Mirror Node integration, UI/UX |
