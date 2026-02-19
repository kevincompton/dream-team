import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";
import { createHederaEvmProvider } from "../../shared/hederaRpc.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const CONTRACT_ABI = [
  "function proposeKnowledge(string memory content) public returns (uint256)",
  "function knowledgeCount() public view returns (uint256)",
  "function getKnowledge(uint256 id) public view returns (address, string memory, uint256, bool, bool, address, address)",
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

const KNOWLEDGE_TOPICS = [
  "What is the optimal HBAR gas fee window by hour of day on Hedera testnet?",
  "What are the current Hedera Token Service limits for NFT minting in 2026?",
  "Which DeFi protocols have the lowest slippage on Hedera EVM right now?",
  "What is the average Hedera consensus latency in the last 24 hours?",
  "What ERC-20 vulnerabilities were reported in the last 30 days?",
  "What are the top 5 most active smart contracts on Hedera testnet this week?",
  "What is the current exchange rate between HBAR and USDC on Hedera DEXs?",
  "Which Hedera validators have the highest uptime percentage this week?",
  "What are the best gas optimization patterns for Solidity on Hedera EVM?",
  "What is the average HCS message finality time on testnet today?",
  "How many active accounts does Hedera testnet have in February 2026?",
  "What is the cheapest time to deploy a smart contract on Hedera EVM?",
  "What HTS token standards are most used by agents on Hedera testnet?",
  "What are the rate limits for Hedera Mirror Node API calls?",
  "Which OpenClaw agent skills have the highest usage this week?"
];

let lastTopicIndex = -1;

function getNextTopic() {
  let index;
  do {
    index = Math.floor(Math.random() * KNOWLEDGE_TOPICS.length);
  } while (index === lastTopicIndex);
  lastTopicIndex = index;
  return KNOWLEDGE_TOPICS[index];
}

class ProposerAgent {
  constructor() {
    this.accountId = process.env.PROPOSER_ACCOUNT_ID;
    const privateKey = process.env.PROPOSER_PRIVATE_KEY || process.env.HEDERA_PRIVATE_KEY;
    this.provider = createHederaEvmProvider();
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.contract = new ethers.Contract(
      process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS,
      CONTRACT_ABI,
      this.wallet
    );
    this.running = false;
    this.lastProposalAt = 0;
    this.isProposing = false;
  }

  async generateKnowledge() {
    return getNextTopic();
  }

  async propose(content) {
    try {
      console.log(`[PROPOSER] 🧠 Proponiendo conocimiento: ${content.substring(0, 50)}...`);
      const tx = await this.contract.proposeKnowledge(content);
      const receipt = await tx.wait();
      this.lastProposalAt = Date.now();
      console.log(`[PROPOSER] 📤 Conocimiento propuesto. TX: ${receipt.hash}`);
      console.log(`[PROPOSER] 🔗 HashScan TX: ${hashscanTxUrl(receipt.hash)}`);
      return receipt;
    } catch (error) {
      console.error("[PROPOSER] 🧠 Error al proponer:", error);
      throw error;
    }
  }

  async countUnexecutedRequests() {
    const count = await this.contract.knowledgeCount();
    let unexecuted = 0;
    for (let id = 1; id <= count; id += 1) {
      const knowledge = await this.contract.getKnowledge(id);
      const [, , , , executed] = knowledge;
      if (!executed) unexecuted += 1;
    }
    return unexecuted;
  }

  async proposeAuto() {
    try {
      if (this.isProposing) return;
      this.isProposing = true;

      const elapsed = Date.now() - this.lastProposalAt;
      if (elapsed < 60_000) {
        console.log("[PROPOSER] 🧠 Esperando cooldown de 60s para próxima propuesta");
        return;
      }

      const unexecutedRequests = await this.countUnexecutedRequests();
      if (unexecutedRequests > 3) {
        console.log(`[PROPOSER] ⏸️ Backlog of ${unexecutedRequests} unexecuted requests — waiting`);
        return;
      }

      const knowledge = await this.generateKnowledge();
      return await this.propose(knowledge);
    } catch (error) {
      console.error("[PROPOSER] 🧠 Error en proposeAuto:", error);
    } finally {
      this.isProposing = false;
    }
  }

  async start() {
    if (!process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS) {
      console.error("[PROPOSER] 🧠 KNOWLEDGE_POOL_CONTRACT_ADDRESS no configurado");
      return;
    }

    if (!this.accountId) {
      console.warn("[PROPOSER] 🧠 PROPOSER_ACCOUNT_ID no definido; usando solo private key");
    }

    console.log("[PROPOSER] 🧠 Agente Proposer iniciado");
    console.log(`[PROPOSER] 🧠 Cuenta: ${this.accountId || "(no definida)"}`);
    console.log(`[PROPOSER] 🧠 Conectado a contrato: ${process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS}`);
    console.log(`[PROPOSER] 🔗 HashScan contrato: ${hashscanContractUrl(process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS)}`);
    this.running = true;

    // Hedera RPC no soporta eth_newFilter; usar polling para auto-proponer
    const interval = parseInt(process.env.PROPOSER_INTERVAL_SECONDS || "60", 10);
    if (interval > 0) {
      console.log(`[PROPOSER] 🧠 Auto-proponiendo cada ${interval}s (máx 1/min, backlog<=3)...`);
      await this.proposeAuto();
      setInterval(() => {
        if (this.running) {
          this.proposeAuto();
        }
      }, interval * 1000);
    }
  }

  stop() {
    this.running = false;
  }
}

const agent = new ProposerAgent();
agent.start().catch(console.error);

export default ProposerAgent;
