# HIVE Protocol — Copilot Instructions

## Architecture

Multi-package monorepo for an autonomous knowledge marketplace on **Hedera EVM**. Three components talk to each other through the `KnowledgePool` Solidity contract:

- **`contracts/`** — Hardhat project; `KnowledgePool.sol` owns the full state machine: `propose → validate → execute → settle` (rewards paid in native HBAR wei).
- **`agents/`** — Three ESM Node.js agents (`proposer`, `validator`, `executor`), each with its own `package.json`. Shared LLM adapter at `agents/common/llm.js`. Each agent connects to the contract via `ethers v6` and its own private key (`PROPOSER_PRIVATE_KEY` etc.) to avoid nonce collisions.
- **`dashboard/`** — Next.js 14 (App Router) + TypeScript + Tailwind. Operates in **DEMO** (`NEXT_PUBLIC_USE_MOCK_DATA=true`, mock hooks in `hooks/useMockData.ts`) or **LIVE** mode (Hedera Mirror Node polling, `hooks/useHederaData.ts`). Data is merged by `hooks/useDashboardData.ts` into a `DashboardSnapshot`.
- **`scripts/`** — Orchestration helpers (setup, fund, start agents). Root `package.json` workspaces tie everything together.

## Build and Test

```bash
# Install all workspace packages
npm install

# Compile & test the contract
cd contracts && npx hardhat compile && npx hardhat test && cd ..

# Deploy to Hedera testnet
npm run deploy:contract   # writes EVM address → copy to .env

# Fund pool, then start agents
npm run fund:pool
npm run start:agents

# Dashboard (separate terminal)
npm run start:dashboard   # http://localhost:3000
```

## Code Style

- Agents and scripts use **ESM** (`"type": "module"` in root `package.json`); use `import`/`export`, not `require`. Resolve `__dirname` with `path.dirname(fileURLToPath(import.meta.url))`.
- Dashboard is **TypeScript strict**; components are functional with React hooks. Use `"use client"` only where necessary (interactive/stateful components).
- Solidity targets `^0.8.24`; use custom errors (`error InsufficientPoolBalance()`) instead of revert strings where possible.

## Project Conventions

- **One private key per agent** — `PROPOSER_PRIVATE_KEY`, `VALIDATOR_PRIVATE_KEY`, `EXECUTOR_PRIVATE_KEY` in `.env`. Sharing a key causes nonce collisions.
- **LLM abstraction** — all agent AI calls go through `agents/common/llm.js` `chat()`. Provider selected via `LLM_PROVIDER=groq|ollama|anthropic`; default model for Groq is `llama-3.1-8b-instant`.
- **ABI inline** — agents declare the minimal ABI they need as a string array inside their `index.js` rather than importing compiled artifacts.
- **HashScan links** — agents log `https://hashscan.io/testnet/tx/<hash>` for every on-chain action; replicate this pattern for new agent actions.
- **Dashboard debug** — use `dashboardLog`/`dashboardWarn` from `lib/debug.ts` (not `console.log`) inside dashboard components and hooks.
- **Panel data-attribute** — every dashboard panel root element carries `data-panel-id="<name>"` for layout overlap detection.

## Integration Points

- **Hedera EVM RPC** — `https://testnet.hashio.io/api` (mainnet: `mainnet.hashio.io/api`). Subject to 502 intermittency; add retry logic around `ethers` calls.
- **Hedera Mirror Node** (LIVE dashboard) — polling interval ~3 s:
  - `https://testnet.mirrornode.hedera.com/api/v1/topics/{topicId}/messages`
  - `/api/v1/accounts/{accountId}` (balances)
  - `/api/v1/transactions`
- **Contract address** stored in `KNOWLEDGE_POOL_CONTRACT_ADDRESS` env var; set after deploy.

## Security

- **Never commit `.env`**. The `.env.example` is the canonical reference.
- Use testnet-only keys for demos; rotate immediately if leaked.
- `setRewards` and owner-only functions are guarded by `require(msg.sender == owner)` — do not relax this.
