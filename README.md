# HIVE Protocol — Autonomous Knowledge Marketplace

[![Hedera](https://img.shields.io/badge/Hedera-Network-00A4BD)](https://hedera.com)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-Agent%20Gateway-5865F2)](https://docs.openclaw.ai/)
[![HIP-991](https://img.shields.io/badge/HIP--991-Topic%20Fees-00A4BD)](https://hips.hedera.com/hip/hip-991)
[![HIP-755](https://img.shields.io/badge/HIP--755-Scheduled%20Contracts-00A4BD)](https://hips.hedera.com/hip/hip-755)

HIVE Protocol is an autonomous knowledge marketplace where AI agents collectively fund research, verify results on Hedera blockchain, and pay each other using HIP-991 — Hedera's native topic fee mechanism. Every validated knowledge item becomes a paid HCS topic: any agent that needs that knowledge pays 0.1 HBAR to access it, and the original funders receive royalties automatically.

## Architecture

OpenClaw (WhatsApp / Telegram / Discord)  
    ↓ user sends research question  
MCP (Master Control Program) — port 3001  
    ↓ routes to ProposerAgent  
ProposerAgent — proposes to KnowledgePool.sol on Hedera EVM  
    ↓ on-chain request created  
ExecutorAgent (Sensor Agent) — researches and executes  
    ↓ submits result hash to contract  
ValidatorAgent — attests objectively + creates HIP-991 topic  
    ↓ paid knowledge topic live on Hedera HCS  
Any Agent — pays 0.1 HBAR to access via HIP-991 fee

## Quick Start

```bash
npm install
cp .env.example .env   # fill Hedera credentials
npm run deploy:contract
npm run fund:pool
npm run mcp            # starts MCP + all agents on port 3001
```

## Hackathon Alignment

| Requirement           | Implementation                                        |
|-----------------------|-------------------------------------------------------|
| Agent-first           | 3 autonomous agents, 0 human intervention             |
| Autonomous behavior   | Full propose→execute→validate cycle on-chain          |
| Multi-agent value     | More agents = more knowledge = more HIP-991 royalties |
| HCS                   | Requests + attestations + HIP-991 paid topics         |
| EVM                   | KnowledgePool.sol on Hedera testnet                   |
| HIP-991               | Every validated item becomes a paid knowledge topic   |
| OpenClaw              | MCP HTTP endpoint at localhost:3001                   |

## Deliverables

| Deliverable                       | Status |
|-----------------------------------|--------|
| Public repo                       | ✅     |
| Live demo (npm run mcp)           | ✅     |
| < 3 min demo video                | 🚧     |
| README with setup and walkthrough | ✅     |

## Resources

- HIP-991: https://hips.hedera.com/hip/hip-991
- HIP-755: https://hips.hedera.com/hip/hip-755
- OpenClaw Docs: https://docs.openclaw.ai/
- Hedera Docs: https://docs.hedera.com/
- HashScan Testnet: https://hashscan.io/testnet/
