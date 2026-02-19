import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { ethers } from "ethers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const START_ORDER = [
  { name: "executor", delayBeforeMs: 0 },
  { name: "validator", delayBeforeMs: 15_000 },
  { name: "proposer", delayBeforeMs: 10_000 },
];

const processes = new Map();

const CONTRACT_ABI = [
  "function knowledgeCount() public view returns (uint256)",
  "function totalRewardPerTask() public view returns (uint256)",
  "function getKnowledge(uint256 id) public view returns (address, string memory, uint256, bool, bool, address, address)",
];

const HBAR_DECIMALS = 8;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startAgent(agentName) {
  const cwd = path.join(__dirname, "..", "agents", agentName);

  const child = spawn("node", ["index.js"], {
    cwd,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const prefix = `[${agentName.toUpperCase()}]`;

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`${prefix} ${chunk.toString()}`);
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(`${prefix} ${chunk.toString()}`);
  });

  child.on("exit", (code, signal) => {
    const stoppedManually = process.env.__STOP_ALL_AGENTS__ === "1";
    console.log(`${prefix} proceso finalizado (code=${code ?? "null"}, signal=${signal ?? "null"})`);

    if (!stoppedManually) {
      console.log(`${prefix} reiniciando en 3s...`);
      setTimeout(() => startAgent(agentName), 3000);
    }
  });

  child.on("error", (error) => {
    console.error(`${prefix} error al iniciar:`, error.message || error);
  });

  processes.set(agentName, child);
  console.log(`${prefix} iniciado`);
}

async function main() {
  console.log("Iniciando agentes en orden controlado...");
  console.log("1) Executor (limpia backlog) -> espera 15s");
  console.log("2) Validator -> espera 10s");
  console.log("3) Proposer\n");

  for (const step of START_ORDER) {
    if (step.delayBeforeMs > 0) {
      await sleep(step.delayBeforeMs);
    }
    startAgent(step.name);
  }

  const printStatusSnapshot = async () => {
    try {
      if (!process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS) {
        return;
      }

      const provider = new ethers.JsonRpcProvider(
        process.env.HEDERA_NETWORK === "mainnet"
          ? "https://mainnet.hashio.io/api"
          : "https://testnet.hashio.io/api"
      );

      const contract = new ethers.Contract(
        process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS,
        CONTRACT_ABI,
        provider
      );

      const count = Number(await contract.knowledgeCount());
      let completed = 0;
      let pending = 0;

      for (let id = 1; id <= count; id += 1) {
        let knowledge;
        try {
          knowledge = await contract.getKnowledge(id);
        } catch (err) {
          console.log(`[STATUS] ⚠️ Skipping item ${id}: ${err?.shortMessage || err?.message || "read failed"}`);
          continue;
        }

        const [, , , validated, executed] = knowledge;
        if (validated && executed) {
          completed += 1;
        }
        if (!executed) {
          pending += 1;
        }
      }

      const rewardPerTask = await contract.totalRewardPerTask();
      const distributedRaw = rewardPerTask * BigInt(completed);
      const distributed = ethers.formatUnits(distributedRaw, HBAR_DECIMALS);

      console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 HIVE STATUS SNAPSHOT
   Total requests: ${count}
   Completed (V:Y E:Y): ${completed}
   Pending execution: ${pending}
   $HIVE distributed: ${distributed}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
    } catch (error) {
      console.error("[STATUS] Error building snapshot:", error.message || error);
    }
  };

  await printStatusSnapshot();
  setInterval(printStatusSnapshot, 60_000);

  console.log("\nTodos los agentes iniciados con autorestart activo. Ctrl+C para detener.");
}

process.on("SIGINT", () => {
  process.env.__STOP_ALL_AGENTS__ = "1";
  console.log("\nDeteniendo agentes...");
  for (const [, child] of processes) {
    child.kill("SIGINT");
  }
  setTimeout(() => process.exit(0), 500);
});

main().catch((error) => {
  console.error("Error en run-all-agents:", error.message || error);
  process.exit(1);
});
