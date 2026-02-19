import http from "http";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { ethers } from "ethers";
import { createHederaEvmProvider } from "../shared/hederaRpc.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const MCP_PORT = Number(process.env.MCP_PORT || 3001);
const HBAR_DECIMALS = 8;
const START_ORDER = [
  { name: "executor", delayBeforeMs: 0 },
  { name: "validator", delayBeforeMs: 15_000 },
  { name: "proposer", delayBeforeMs: 10_000 },
];

const processes = new Map();
const agentLogState = new Map();

const STATUS_ABI = [
  "function knowledgeCount() public view returns (uint256)",
  "function poolBalance() public view returns (uint256)",
  "function getKnowledge(uint256 id) public view returns (address, string memory, uint256, bool, bool, address, address)",
];

const PROPOSER_ABI = [
  "function proposeKnowledge(string memory content) public returns (uint256)",
  "event KnowledgeProposed(uint256 indexed id, address indexed proposer, string content)",
];
const KNOWLEDGE_ABI = [
  "function getKnowledge(uint256 id) public view returns (address, string memory, uint256, bool, bool, address, address)",
];
let lastKnownStatus = {
  connected: false,
  contractAddress: process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS || null,
  knowledgeCount: 0,
  poolBalance: "0",
  recentItems: [],
  stale: true,
  updatedAt: new Date().toISOString(),
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldPrintAgentLine(agentName, line) {
  const now = Date.now();
  const state = agentLogState.get(agentName) ?? {
    lastLine: "",
    lastAt: 0,
    suppressed: 0,
  };

  const trimmed = line.trim();
  if (!trimmed) {
    agentLogState.set(agentName, state);
    return false;
  }

  const noisy =
    trimmed === "." ||
    /Scanned \d+\/\d+ items/i.test(trimmed) ||
    /Scan complete/i.test(trimmed) ||
    /Loop complete/i.test(trimmed) ||
    /passed all checks → signing attestation/i.test(trimmed) ||
    /execution reverted: "Knowledge must be executed first"/i.test(trimmed);

  const dedupeWindowMs = noisy ? 60_000 : 12_000;
  if (state.lastLine === trimmed && now - state.lastAt < dedupeWindowMs) {
    state.suppressed += 1;
    state.lastAt = now;
    agentLogState.set(agentName, state);
    return false;
  }

  if (state.suppressed > 0) {
    console.log(`[${agentName.toUpperCase()}] (suppressed ${state.suppressed} repetitive lines)`);
    state.suppressed = 0;
  }

  state.lastLine = trimmed;
  state.lastAt = now;
  agentLogState.set(agentName, state);
  return true;
}

function pipeAgentOutput(agentName, chunk, stream) {
  const prefix = `[${agentName.toUpperCase()}]`;
  const lines = chunk
    .toString()
    .replace(/\r/g, "")
    .split("\n");

  for (const line of lines) {
    const normalized = line.replace(/^\s*\[[A-Z]+\]\s*/i, "").trim();
    if (!normalized) continue;
    if (!shouldPrintAgentLine(agentName, normalized)) continue;
    stream.write(`${prefix} ${normalized}\n`);
  }
}

function startAgent(agentName) {
  const cwd = path.join(__dirname, "..", "agents", agentName);

  const child = spawn("node", ["index.js"], {
    cwd,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => {
    pipeAgentOutput(agentName, chunk, process.stdout);
  });

  child.stderr.on("data", (chunk) => {
    pipeAgentOutput(agentName, chunk, process.stderr);
  });

  const prefix = `[${agentName.toUpperCase()}]`;

  child.on("exit", (code, signal) => {
    const stoppedManually = process.env.__STOP_ALL_AGENTS__ === "1";
    const proposerAutoDisabled =
      agentName === "proposer" && Number(process.env.PROPOSER_INTERVAL_SECONDS || 60) <= 0;
    console.log(`${prefix} process ended (code=${code ?? "null"}, signal=${signal ?? "null"})`);

    if (!stoppedManually) {
      if (proposerAutoDisabled && (code === 0 || code === null)) {
        console.log(`${prefix} auto-proposer disabled (PROPOSER_INTERVAL_SECONDS<=0), not restarting.`);
        return;
      }
      console.log(`${prefix} restarting in 3s...`);
      setTimeout(() => startAgent(agentName), 3000);
    }
  });

  child.on("error", (error) => {
    console.error(`${prefix} startup error:`, error.message || error);
  });

  processes.set(agentName, child);
  console.log(`${prefix} started`);
}

async function startAgentsInOrder() {
  console.log("[MCP] Starting agents in controlled order...");
  console.log("[MCP] 1) Executor -> wait 15s");
  console.log("[MCP] 2) Validator -> wait 10s");
  console.log("[MCP] 3) Proposer");

  for (const step of START_ORDER) {
    if (step.delayBeforeMs > 0) {
      await sleep(step.delayBeforeMs);
    }
    startAgent(step.name);
  }
}

function shortAddress(value) {
  if (!value || value.length < 12) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

async function getChainStatus() {
  if (!process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS) {
    return {
      connected: false,
      error: "KNOWLEDGE_POOL_CONTRACT_ADDRESS is not configured",
      knowledgeCount: 0,
      poolBalance: "0",
      recentItems: [],
    };
  }

  const provider = createHederaEvmProvider();
  const contract = new ethers.Contract(process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS, STATUS_ABI, provider);

  const [knowledgeCountBn, poolBalanceBn] = await Promise.all([contract.knowledgeCount(), contract.poolBalance()]);
  const knowledgeCount = Number(knowledgeCountBn);
  const poolBalance = ethers.formatUnits(poolBalanceBn, HBAR_DECIMALS);

  const recentItems = [];
  const fromId = Math.max(1, knowledgeCount - 4);

  for (let id = fromId; id <= knowledgeCount; id += 1) {
    const [proposer, content, timestamp, validated, executed, validator, executor] = await contract.getKnowledge(id);
    recentItems.push({
      id,
      content,
      timestamp: Number(timestamp),
      validated,
      executed,
      proposer: shortAddress(proposer),
      validator: shortAddress(validator),
      executor: shortAddress(executor),
    });
  }

  const status = {
    connected: true,
    contractAddress: process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS,
    knowledgeCount,
    poolBalance,
    recentItems,
    stale: false,
    updatedAt: new Date().toISOString(),
  };

  lastKnownStatus = status;
  return status;
}

async function spawnResearchRequest(question) {
  if (!question || String(question).trim().length === 0) {
    throw new Error("Question is required");
  }
  if (!process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS) {
    throw new Error("KNOWLEDGE_POOL_CONTRACT_ADDRESS is not configured");
  }

  const proposerKey = process.env.PROPOSER_PRIVATE_KEY || process.env.HEDERA_PRIVATE_KEY;
  if (!proposerKey) {
    throw new Error("PROPOSER_PRIVATE_KEY (or HEDERA_PRIVATE_KEY fallback) is not configured");
  }

  const provider = createHederaEvmProvider();
  const wallet = new ethers.Wallet(proposerKey, provider);
  const iface = new ethers.Interface(PROPOSER_ABI);
  const contract = new ethers.Contract(process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS, iface, wallet);

  const tx = await contract.proposeKnowledge(String(question).trim());
  const receipt = await tx.wait();

  // Parse KnowledgeProposed event to extract knowledge ID
  let knowledgeId = null;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === "KnowledgeProposed") {
        knowledgeId = Number(parsed.args[0]);
        break;
      }
    } catch {
      // skip unparseable logs
    }
  }

  console.log(`[MCP] ✅ Research request submitted. Knowledge ID: ${knowledgeId ?? "unknown"}. TX: ${receipt.hash}`);
  console.log(`[MCP] 🔗 https://hashscan.io/testnet/tx/${receipt.hash}`);

  return { txHash: receipt.hash, knowledgeId };
}

async function waitForKnowledgeResult(knowledgeId, timeoutMs = 120_000) {
  if (!knowledgeId) return null;
  const provider = createHederaEvmProvider();
  const contract = new ethers.Contract(
    process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS,
    KNOWLEDGE_ABI,
    provider,
  );

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await sleep(4_000);
    try {
      const [, content, , validated, executed] = await contract.getKnowledge(knowledgeId);
      if (executed) {
        console.log(`[MCP] ✅ Knowledge #${knowledgeId} fully settled.`);
        return { content, validated, executed };
      }
      console.log(`[MCP] ⏳ Knowledge #${knowledgeId} pending (validated=${validated}, executed=${executed})...`);
    } catch (err) {
      console.log(`[MCP] ⚠️ Poll error for #${knowledgeId}: ${err?.shortMessage || err?.message}`);
    }
  }
  return null; // timeout
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/research-request") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", async () => {
      try {
        const { question, userId } = JSON.parse(body || "{}");
        console.log(`[MCP] 📨 Research Request from ${userId || "unknown"}: ${question}`);
        const { txHash } = await spawnResearchRequest(question);
        res.writeHead(200);
        res.end(JSON.stringify({ status: "accepted", message: `Research request queued: "${question}"`, txHash }));
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ status: "error", error: error instanceof Error ? error.message : "Invalid request" }));
      }
    });

  } else if (req.method === "POST" && req.url === "/research") {
    // Blocking endpoint — submits proposal and waits for the answer (up to 120s)
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", async () => {
      try {
        const { question, userId } = JSON.parse(body || "{}");
        if (!question) throw new Error("question is required");
        console.log(`[MCP] 🔬 Blocking research from ${userId || "openclaw"}: ${question}`);

        const { txHash, knowledgeId } = await spawnResearchRequest(question);

        if (!knowledgeId) {
          res.writeHead(200);
          res.end(JSON.stringify({ status: "accepted", message: "Submitted to HIVE but could not track ID. Check /status.", txHash }));
          return;
        }

        const result = await waitForKnowledgeResult(knowledgeId);

        if (result) {
          res.writeHead(200);
          res.end(JSON.stringify({
            status: "completed",
            knowledgeId,
            content: result.content,
            txHash,
          }));
        } else {
          res.writeHead(200);
          res.end(JSON.stringify({
            status: "timeout",
            knowledgeId,
            txHash,
            message: "HIVE agents are still processing. Ask again in a moment or check /status.",
          }));
        }
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ status: "error", error: error instanceof Error ? error.message : "Invalid request" }));
      }
    });

  } else if (req.method === "GET" && req.url === "/status") {
    try {
      const status = await getChainStatus();
      res.writeHead(200);
      res.end(JSON.stringify(status));
    } catch (error) {
      const fallback = {
        ...lastKnownStatus,
        connected: false,
        stale: true,
        error: error instanceof Error ? error.message : "Status retrieval failed",
      };
      res.writeHead(200);
      res.end(
        JSON.stringify(fallback),
      );
    }
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found" }));
  }
});

async function main() {
  try {
    await getChainStatus();
  } catch {
    // warm cache best effort; server will still start
  }

  await startAgentsInOrder();

  server.listen(MCP_PORT, () => {
    console.log(`[MCP] 🧠 Master Control Program listening on port ${MCP_PORT}`);
    console.log(`[MCP] 📡 OpenClaw endpoint: http://localhost:${MCP_PORT}/research-request`);
  });

  process.on("SIGINT", () => {
    process.env.__STOP_ALL_AGENTS__ = "1";
    console.log("\n[MCP] Stopping agents and server...");
    for (const [, child] of processes) {
      child.kill("SIGINT");
    }
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 800);
  });
}

main().catch((error) => {
  console.error("[MCP] Fatal error:", error.message || error);
  process.exit(1);
});
