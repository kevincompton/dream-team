import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";
import { createAndRegisterKnowledgeTopic } from "./hcs-topic.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const CONTRACT_ABI = [
  "function validateKnowledge(uint256 id) public",
  "function getKnowledge(uint256 id) public view returns (address, string memory, uint256, bool, bool, address, address)",
  "function knowledgeCount() public view returns (uint256)",
  "event KnowledgeValidated(uint256 indexed id, address indexed validator)",
  "event KnowledgeProposed(uint256 indexed id, address indexed proposer, string content)"
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

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

class ValidatorAgent {
  constructor() {
    this.accountId = process.env.VALIDATOR_ACCOUNT_ID;
    const privateKey = process.env.VALIDATOR_PRIVATE_KEY || process.env.HEDERA_PRIVATE_KEY;
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
    this.flowOrder = (process.env.KNOWLEDGE_FLOW_ORDER || "auto").toLowerCase();
    this.flowOrderResolved = this.flowOrder === "validate-first" || this.flowOrder === "execute-first"
      ? this.flowOrder
      : null;
  }

  resolveFlowOrderFromError(errorMessage) {
    const msg = String(errorMessage || "").toLowerCase();
    if (!this.flowOrderResolved && msg.includes("knowledge must be executed first")) {
      this.flowOrderResolved = "execute-first";
      console.log("[VALIDATOR] 🔁 Flow order detected: execute-first");
    }
  }

  async processItem(id, item) {
    if (item.validated) return;

    if (this.flowOrderResolved === "execute-first" && !item.executed) return;
    if (this.flowOrderResolved === "validate-first" && item.executed) return;

    const checks = {
      hasContent: item.content && item.content.length > 10,
      notSelfValidating: item.proposer.toLowerCase() !== this.wallet.address.toLowerCase(),
      flowReady:
        this.flowOrderResolved === "execute-first"
          ? item.executed
          : this.flowOrderResolved === "validate-first"
            ? !item.executed
            : true,
    };

    const passed = Object.values(checks).every((v) => v === true);

    if (!passed) {
      const failed = Object.entries(checks)
        .filter(([, v]) => !v)
        .map(([k]) => k);
      console.log(`[VALIDATOR] ❌ #${id} failed checks: ${failed.join(", ")}`);
      return;
    }

    console.log(`[VALIDATOR] 🔐 #${id} passed all checks → signing attestation`);

    try {
      const tx = await this.contract.validateKnowledge(id);
      await tx.wait();
      console.log(`[VALIDATOR] ✅ #${id} attested on-chain. TX: ${tx.hash}`);
      console.log(`[VALIDATOR] 🔗 HashScan TX: ${hashscanTxUrl(tx.hash)}`);

      if (process.env.VALIDATOR_ACCOUNT_ID) {
        const topicId = await createAndRegisterKnowledgeTopic(id, item.content);
        console.log(`[VALIDATOR] ✅ #${id} fully settled with HIP-991 topic (HCS-2 indexed): ${topicId}`);
      } else {
        console.log(`[VALIDATOR] ⚠️ #${id} VALIDATOR_ACCOUNT_ID missing, skipping HIP-991 topic creation`);
      }
    } catch (err) {
      this.resolveFlowOrderFromError(err?.shortMessage || err?.message || "");
      console.log(`[VALIDATOR] ❌ #${id} tx failed: ${err?.shortMessage || err?.message || "unknown error"}`);
    }
  }

  async getKnowledge(id) {
    return await this.contract.getKnowledge(id);
  }

  async start() {
    if (!process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS) {
      console.error("[VALIDATOR] 🔐 KNOWLEDGE_POOL_CONTRACT_ADDRESS no configurado");
      return;
    }

    if (!this.accountId) {
      console.warn("[VALIDATOR] 🔐 VALIDATOR_ACCOUNT_ID no definido; usando solo private key");
    }

    console.log("[VALIDATOR] 🔐 Agente Validator iniciado");
    console.log(`[VALIDATOR] 🔐 Cuenta: ${this.accountId || "(no definida)"}`);
    console.log(`[VALIDATOR] 🔐 Conectado a contrato: ${process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS}`);
    console.log(`[VALIDATOR] 🔗 HashScan contrato: ${hashscanContractUrl(process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS)}`);
    console.log(`[VALIDATOR] 🔄 Flow order mode: ${this.flowOrderResolved || "auto"}`);
    this.running = true;

    const runLoop = async () => {
      if (!this.running || this.polling) return;
      this.polling = true;

      try {
        const total = Number(await this.contract.knowledgeCount());
        if (total === 0) return;

        for (let i = 1; i <= total; i++) {
          try {
            const raw = await this.contract.getKnowledge(i);
            const item = {
              proposer: raw[0],
              content: raw[1],
              timestamp: raw[2],
              validated: raw[3],
              executed: raw[4],
              validator: raw[5],
              executor: raw[6],
            };
            await this.processItem(i, item);
          } catch (err) {
            console.log(`[VALIDATOR] ⚠️ Skip #${i}: ${err?.shortMessage || err?.message || "read failed"}`);
            continue;
          }
        }
      } catch (error) {
        console.error("[VALIDATOR] 🔐 Error en polling:", error);
      } finally {
        this.polling = false;
      }
    };

    setInterval(runLoop, 25000);
    runLoop();
  }

  stop() {
    this.running = false;
  }
}

const agent = new ValidatorAgent();
agent.start().catch(console.error);

export default ValidatorAgent;
