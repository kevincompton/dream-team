import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";
import { chat as llmChat } from "../common/llm.js";
import { ensureExecutorTopic } from "./hcs-topic.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const CONTRACT_ABI = [
  "function executeKnowledge(uint256 id) public",
  "function getKnowledge(uint256 id) public view returns (address, string memory, uint256, bool, bool, address, address)",
  "function knowledgeCount() public view returns (uint256)",
  "function poolBalance() public view returns (uint256)",
  "function totalRewardPerTask() public view returns (uint256)",
  "event KnowledgeExecuted(uint256 indexed id, address indexed executor)",
  "event KnowledgeValidated(uint256 indexed id, address indexed validator)"
];

const HASHSCAN_BASE =
  process.env.HEDERA_NETWORK === "mainnet"
    ? "https://hashscan.io/mainnet"
    : "https://hashscan.io/testnet";

function hashscanTxUrl(value) {
  return `${HASHSCAN_BASE}/tx/${encodeURIComponent(value)}`;
}

function hashscanContractUrl(value) {
  return `${HASHSCAN_BASE}/contract/${encodeURIComponent(value)}`;
}

const HBAR_DECIMALS = 8;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class ExecutorAgent {
  constructor() {
    this.llmChat = llmChat;
    this.accountId = process.env.EXECUTOR_ACCOUNT_ID;
    const privateKey = process.env.EXECUTOR_PRIVATE_KEY || process.env.HEDERA_PRIVATE_KEY;
    this.provider = new ethers.JsonRpcProvider(
      process.env.HEDERA_NETWORK === "mainnet"
        ? "https://mainnet.hashio.io/api"
        : "https://testnet.hashio.io/api"
    );
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.contract = new ethers.Contract(
      process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS,
      CONTRACT_ABI,
      this.wallet
    );
    this.running = false;
    this.polling = false;
    this.pendingExecutions = new Set();
    this.flowOrder = (process.env.KNOWLEDGE_FLOW_ORDER || "auto").toLowerCase();
    this.flowOrderResolved = this.flowOrder === "validate-first" || this.flowOrder === "execute-first"
      ? this.flowOrder
      : null;
    this.topicId = null;
  }

  resolveFlowOrderFromError(errorMessage) {
    const msg = String(errorMessage || "").toLowerCase();
    if (!this.flowOrderResolved && msg.includes("knowledge must be validated first")) {
      this.flowOrderResolved = "validate-first";
      console.log("[EXECUTOR] 🔁 Flow order detected: validate-first");
    }
  }

  shouldExecuteItem(validated, executed, executor) {
    const isUnexecuted = executor === ZERO_ADDRESS || executed === false || executed === undefined;
    if (!isUnexecuted) return false;

    if (this.flowOrderResolved === "validate-first") {
      return validated === true;
    }

    if (this.flowOrderResolved === "execute-first") {
      return true;
    }

    return true;
  }

  async execute(id) {
    try {
      console.log(`[EXECUTOR] ⚙️ Ejecutando conocimiento ID: ${id}`);
      const tx = await this.contract.executeKnowledge(id);
      const receipt = await tx.wait();
      console.log(`[EXECUTOR] ✅ Conocimiento ejecutado. TX: ${receipt.hash}`);
      console.log(`[EXECUTOR] 🔗 HashScan TX: ${hashscanTxUrl(receipt.hash)}`);
      
      const balance = await this.contract.poolBalance();
      console.log(`[EXECUTOR] ✅ Balance del pool tras ejecución: ${ethers.formatUnits(balance, HBAR_DECIMALS)} HBAR`);
      
      return receipt;
    } catch (error) {
      console.error(`[EXECUTOR] ⚙️ Error al ejecutar ID ${id}:`, error);
      throw error;
    }
  }

  generateMockResult(id) {
    return `Mock result for Knowledge #${id} generated at ${new Date().toISOString()}`;
  }

  async executeAuto(id) {
    try {
      if (this.pendingExecutions.has(id)) return;
      this.pendingExecutions.add(id);
      const knowledge = await this.contract.getKnowledge(id);
      const [, content, , validated, executed] = knowledge;

      if (executed) {
        return;
      }

      if (this.flowOrderResolved === "validate-first" && !validated) {
        console.log(`[EXECUTOR] ⏳ #${id} not yet validated — skipping`);
        return;
      }

      console.log(`[EXECUTOR] ⚙️ Item #${id} not executed → processing...`);
      await delay(3000);
      console.log(`[EXECUTOR] ⚙️ Simulating research for: "${String(content).slice(0, 80)}${String(content).length > 80 ? "..." : ""}"`);

      const balance = await this.contract.poolBalance();
      const totalReward = await this.contract.totalRewardPerTask();
      
      if (balance < totalReward) {
        console.log(
          `[EXECUTOR] ⚙️ Pool insuficiente: ${ethers.formatUnits(balance, HBAR_DECIMALS)} HBAR < ${ethers.formatUnits(totalReward, HBAR_DECIMALS)} HBAR requeridos`
        );
        return;
      }

      await this.execute(id);
      console.log(`[EXECUTOR] ✅ Item #${id} executed successfully`);
    } catch (error) {
      this.resolveFlowOrderFromError(error?.shortMessage || error?.message || "");
      console.error(`[EXECUTOR] ⚙️ Error en executeAuto ID ${id}:`, error);
    } finally {
      this.pendingExecutions.delete(id);
    }
  }

  async getKnowledge(id) {
    return await this.contract.getKnowledge(id);
  }

  async start() {
    if (!process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS) {
      console.error("[EXECUTOR] ⚙️ KNOWLEDGE_POOL_CONTRACT_ADDRESS no configurado");
      return;
    }

    if (!this.accountId) {
      console.warn("[EXECUTOR] ⚙️ EXECUTOR_ACCOUNT_ID no definido; usando solo private key");
    }

    try {
      this.topicId = await ensureExecutorTopic({
        memo: `HIVE Executor sensor - ${this.accountId || "default"}`,
      });
      console.log(`[EXECUTOR] 📡 HIP-991 topic assigned: ${this.topicId}`);
    } catch (err) {
      console.warn("[EXECUTOR] ⚠️ Could not init HIP-991 topic:", err?.message || err);
    }

    console.log("[EXECUTOR] ⚙️ Agente Executor iniciado");
    console.log(`[EXECUTOR] ⚙️ Cuenta: ${this.accountId || "(no definida)"}`);
    console.log(`[EXECUTOR] ⚙️ Conectado a contrato: ${process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS}`);
    console.log(`[EXECUTOR] 🔗 HashScan contrato: ${hashscanContractUrl(process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS)}`);
    this.running = true;

    const balance = await this.contract.poolBalance();
    const totalReward = await this.contract.totalRewardPerTask();
    console.log(`[EXECUTOR] ⚙️ Balance del pool: ${ethers.formatUnits(balance, HBAR_DECIMALS)} HBAR`);
    console.log(`[EXECUTOR] ⚙️ Recompensa total por tarea: ${ethers.formatUnits(totalReward, HBAR_DECIMALS)} HBAR`);
    console.log(`[EXECUTOR] 🔄 Flow order mode: ${this.flowOrderResolved || "auto"}`);

    const clearBacklog = async () => {
      const count = await this.contract.knowledgeCount();
      console.log(`[EXECUTOR] 📊 Contract has ${count.toString()} items`);
      if (count === 0n) {
        console.log("[EXECUTOR] ℹ️ No items yet, waiting...");
        return;
      }

      let executedCount = 0;
      const total = Number(count);
      for (let i = 1; i <= total; i++) {
        try {
          const item = await this.contract.getKnowledge(i);
          const validated = item[3];
          const executed = item[4];
          const executor = item[6];

          const needsExecution = this.shouldExecuteItem(validated, executed, executor);

          if (!needsExecution) {
            process.stdout.write(".");
            if (i % 10 === 0) {
              console.log(`\n[EXECUTOR] 📊 Scanned ${i}/${total} items...`);
            }
            continue;
          }

          console.log(`\n[EXECUTOR] 🎯 Found unexecuted item #${i} — processing`);
          await this.executeAuto(i);
          executedCount += 1;

          if (i % 10 === 0) {
            console.log(`[EXECUTOR] 📊 Scanned ${i}/${total} items...`);
          }
        } catch (err) {
          console.log(`\n[EXECUTOR] ⚠️ Skip #${i}: bad data`);
          continue;
        }
      }

      console.log("");
      console.log(`[EXECUTOR] ✅ Loop complete — checked all ${total} items`);
      console.log(`[EXECUTOR] ✅ Scan complete: ${executedCount} executed this cycle`);
      console.log("[EXECUTOR] ✅ Backlog cleared");
    };

    await clearBacklog();

    const pollInterval = parseInt(process.env.EXECUTOR_POLL_SECONDS || "15", 10) * 1000;
    const checkAndExecute = async () => {
      if (!this.running || this.polling) return;
      this.polling = true;
      try {
        const count = await this.contract.knowledgeCount();
        console.log(`[EXECUTOR] 📊 Contract has ${count.toString()} items`);
        if (count === 0n) {
          console.log("[EXECUTOR] ℹ️ No items yet, waiting...");
          return;
        }

        let executedCount = 0;
        const total = Number(count);
        for (let i = 1; i <= total; i++) {
          try {
            const item = await this.contract.getKnowledge(i);
            const validated = item[3];
            const executed = item[4];
            const executor = item[6];

            const needsExecution = this.shouldExecuteItem(validated, executed, executor);

            if (!needsExecution) {
              process.stdout.write(".");
              if (i % 10 === 0) {
                console.log(`\n[EXECUTOR] 📊 Scanned ${i}/${total} items...`);
              }
              continue;
            }

            console.log(`\n[EXECUTOR] 🎯 Found unexecuted item #${i} — processing`);
            await this.executeAuto(i);
            executedCount += 1;

            if (i % 10 === 0) {
              console.log(`[EXECUTOR] 📊 Scanned ${i}/${total} items...`);
            }
          } catch (err) {
            console.log(`\n[EXECUTOR] ⚠️ Skip #${i}: bad data`);
            continue;
          }
        }

        console.log("");
        console.log(`[EXECUTOR] ✅ Loop complete — checked all ${total} items`);
        console.log(`[EXECUTOR] ✅ Scan complete: ${executedCount} executed this cycle`);
      } catch (error) {
        console.error("[EXECUTOR] ⚙️ Error en polling:", error);
      } finally {
        this.polling = false;
      }
    };

    console.log(`[EXECUTOR] ✅ Backlog cleared — watching for new items every ${parseInt(process.env.EXECUTOR_POLL_SECONDS || "15", 10)}s`);
    setInterval(checkAndExecute, pollInterval);
  }

  stop() {
    this.running = false;
  }
}

const agent = new ExecutorAgent();
agent.start().catch(console.error);

export default ExecutorAgent;
