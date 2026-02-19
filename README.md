# HIVE Protocol — Autonomous Knowledge Marketplace

[![Hedera](https://img.shields.io/badge/Hedera-Network-00A4BD)](https://hedera.com)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-Agent%20Gateway-5865F2)](https://docs.openclaw.ai/)
[![HIP-991](https://img.shields.io/badge/HIP--991-Topic%20Fees-00A4BD)](https://hips.hedera.com/hip/hip-991)
[![HIP-755](https://img.shields.io/badge/HIP--755-Scheduled%20Contracts-00A4BD)](https://hips.hedera.com/hip/hip-755)

HIVE Protocol is an autonomous knowledge marketplace where AI agents fund research, verify results on Hedera, and settle value through a multi-agent flow. The validator also creates HIP-991 paid knowledge topics after successful attestation.

## Architecture

OpenClaw (WhatsApp / Telegram / Discord)  
↓ user sends research question  
MCP (Master Control Program) — port 3001  
↓ routes to ProposerAgent  
ProposerAgent — proposes to `KnowledgePool.sol` on Hedera EVM  
↓ on-chain request created  
ExecutorAgent (Sensor Agent) — researches and executes  
↓ submits execution on-chain  
ValidatorAgent — attests + creates HIP-991 topic  
↓ paid knowledge topic live on Hedera HCS

## 1) Prerequisites

- Node.js `>=22`
- npm `>=10`
- Hedera testnet account(s) with HBAR
- API key for one LLM provider (Groq/Ollama/Anthropic)

## 2) Clone and Install

```bash
git clone <YOUR_REPO_URL>
cd hive-protocol
npm install
```

This repo uses npm workspaces, so one `npm install` at root installs contracts, agents, and dashboard dependencies.

## 3) Configure Environment

Copy template:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Set these required values in `.env`:

```dotenv
# Hedera network + operator
HEDERA_NETWORK=testnet
HEDERA_ACCOUNT_ID=0.0.xxxxxxx
HEDERA_PRIVATE_KEY=0x...

# One key per agent (recommended)
PROPOSER_ACCOUNT_ID=0.0.xxxxxxx
PROPOSER_PRIVATE_KEY=0x...
EXECUTOR_ACCOUNT_ID=0.0.xxxxxxx
EXECUTOR_PRIVATE_KEY=0x...
VALIDATOR_ACCOUNT_ID=0.0.xxxxxxx
VALIDATOR_PRIVATE_KEY=0x...

# LLM provider
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_...

# Dashboard mode
NEXT_PUBLIC_USE_MOCK_DATA=false
NEXT_PUBLIC_AGENT_ACCOUNT_IDS=0.0.proposer,0.0.executor,0.0.validator
NEXT_PUBLIC_USER_WALLET=0.0.xxxxxxx

# MCP
MCP_PORT=3001
```

After deploying, set both contract vars:

```dotenv
KNOWLEDGE_POOL_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_KNOWLEDGE_POOL_CONTRACT_ADDRESS=0x...
```

Optional but useful:

```dotenv
NEXT_PUBLIC_HCS_TOPIC_ID=0.0.xxxxxxx
NEXT_PUBLIC_DASHBOARD_DEBUG=true
NEXT_PUBLIC_DASHBOARD_LOG_LEVEL=warn
# KNOWLEDGE_FLOW_ORDER=auto|validate-first|execute-first
```

## 4) Deploy and Fund

Validate Hedera credentials:

```bash
npm run setup:hedera
```

Deploy contract:

```bash
npm run deploy:contract
```

Fund pool:

```bash
npm run fund:pool
```

Optional rewards update:

```bash
npm run set:rewards
```

## 5) Run the System

Start MCP + all agents:

```bash
npm run mcp
```

In a second terminal, start dashboard:

```bash
npm run start:dashboard
```

Dashboard URL: `http://localhost:3000`  
MCP status URL: `http://localhost:3001/status`

## 6) Verify End-to-End

Check chain state:

```bash
npm run status:chain
```

Expected healthy state summary should trend to completed items (`V:Y E:Y`).

Test MCP status:

```bash
curl http://localhost:3001/status
```

Submit research request:

```bash
curl -X POST http://localhost:3001/research-request \
  -H "Content-Type: application/json" \
  -d '{"question":"What is HIP-991?","userId":"demo"}'
```

When validator succeeds, logs include HIP-991 topic creation:

```text
[VALIDATOR] 🏷️  HIP-991 Topic created: 0.0.xxxxx
[VALIDATOR] 🔗 https://hashscan.io/testnet/topic/0.0.xxxxx
```

## 7) Scripts Reference

Root scripts:

- `npm run setup:hedera` — validate Hedera credentials
- `npm run create:hcs-topic` — create HCS topic helper
- `npm run create:agent-wallets` — generate/fund agent wallet setup
- `npm run deploy:contract` — deploy `KnowledgePool`
- `npm run fund:pool` — fund rewards pool
- `npm run set:rewards` — configure reward splits
- `npm run status:chain` — print full chain health summary
- `npm run run:all-agents` — legacy orchestrator
- `npm run mcp` — MCP server + ordered agents startup
- `npm run sensors` — run executor only
- `npm run start:agents` — start agents helper script
- `npm run start:dashboard` — run Next.js dashboard

## 8) Common Troubleshooting

- `Live mode unavailable` at dashboard startup: normal for first poll cycle; verify MCP and RPC after a few seconds.
- `MCP OFFLINE` badge: ensure `npm run mcp` is running and `MCP_PORT` matches.
- `JsonRpcProvider failed to detect network`: transient Hashio RPC instability; retry.
- Validator HIP-991 signature errors: ensure `VALIDATOR_PRIVATE_KEY` is correct for `VALIDATOR_ACCOUNT_ID`.
- Stuck states (`V:N E:N` backlog): run `npm run status:chain` and verify agents are running with valid keys/funding.

## 9) Hackathon Alignment

| Requirement         | Implementation                                        |
|---------------------|-------------------------------------------------------|
| Agent-first         | 3 autonomous agents, 0 human intervention             |
| Autonomous behavior | Full propose → execute → validate cycle on-chain      |
| Multi-agent value   | More agents = more knowledge = more HIP-991 royalties |
| HCS                 | Requests + attestations + HIP-991 paid topics         |
| EVM                 | `KnowledgePool.sol` on Hedera testnet                 |
| HIP-991             | Validated knowledge becomes paid HCS topics           |
| OpenClaw-ready      | MCP endpoint at `localhost:3001`                      |

## Resources

- HIP-991: https://hips.hedera.com/hip/hip-991
- HIP-755: https://hips.hedera.com/hip/hip-755
- OpenClaw Docs: https://docs.openclaw.ai/
- Hedera Docs: https://docs.hedera.com/
- HashScan Testnet: https://hashscan.io/testnet/
