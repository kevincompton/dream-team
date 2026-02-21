import dotenv from "dotenv";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { ethers } from "ethers";
import {
  Client,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  TopicId,
  CustomFixedFee,
  AccountId,
  PrivateKey,
  AccountBalanceQuery,
  Hbar,
} from "@hashgraph/sdk";
import { createHederaEvmProvider } from "../../shared/hederaRpc.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });
const ENV_PATH = path.join(__dirname, "..", "..", ".env");

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

function hashscanTopicUrl(value) {
  return `${HASHSCAN_BASE}/topic/${encodeURIComponent(value)}`;
}

async function upsertHip991TopicMapping(knowledgeId, topicId) {
  try {
    const envText = await fs.readFile(ENV_PATH, "utf8");
    const lineRegex = /^HIP991_TOPICS=(.*)$/m;
    const match = envText.match(lineRegex);
    const currentRaw = match?.[1]?.trim() || "[]";

    let current = [];
    try {
      current = JSON.parse(currentRaw);
      if (!Array.isArray(current)) current = [];
    } catch {
      current = [];
    }

    const next = current.filter((entry) => Number(entry?.knowledgeId) !== Number(knowledgeId));
    next.push({ knowledgeId: Number(knowledgeId), topicId: String(topicId) });
    next.sort((a, b) => Number(a.knowledgeId) - Number(b.knowledgeId));

    const replacement = `HIP991_TOPICS=${JSON.stringify(next)}`;
    const updated = match
      ? envText.replace(lineRegex, replacement)
      : `${envText.trimEnd()}\n${replacement}\n`;

    await fs.writeFile(ENV_PATH, updated, "utf8");
    process.env.HIP991_TOPICS = JSON.stringify(next);
    console.log(`[VALIDATOR] 🗂️ Updated HIP991_TOPICS with knowledge #${knowledgeId} -> ${topicId}`);
  } catch (error) {
    console.log(`[VALIDATOR] ⚠️ Could not update HIP991_TOPICS in .env: ${error?.message || error}`);
  }
}

async function submitSeedMessage(client, topicId, payload, label) {
  const maxTopicMessageFeeHbar = Number(process.env.HIP991_MAX_TOPIC_MESSAGE_FEE_HBAR || "1");
  const tx = await new TopicMessageSubmitTransaction()
    .setTopicId(TopicId.fromString(topicId))
    .setMessage(JSON.stringify(payload))
    .setMaxTransactionFee(new Hbar(maxTopicMessageFeeHbar))
    .execute(client);

  const receipt = await tx.getReceipt(client);
  console.log(`[VALIDATOR] 📨 ${label} message status: ${receipt.status.toString()}`);
  console.log(`[VALIDATOR] 🔗 ${label} message TX: ${hashscanTxUrl(tx.transactionId.toString())}`);
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function isRpcRateLimited(error) {
  const raw = [
    error?.shortMessage,
    error?.message,
    error?.info?.responseBody,
    error?.info?.responseStatus,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return raw.includes("error code: 1015")
    || raw.includes("429")
    || raw.includes("exceeded maximum retry limit");
}

function getValidatorSdkKey() {
  const key = (process.env.VALIDATOR_PRIVATE_KEY || process.env.HEDERA_PRIVATE_KEY || "").trim();
  if (key.startsWith("0x") || /^[0-9a-fA-F]{64}$/.test(key)) {
    return PrivateKey.fromStringECDSA(key);
  }
  try {
    return PrivateKey.fromStringDer(key);
  } catch {
    return PrivateKey.fromString(key);
  }
}

async function createHIP991Topic(knowledgeId, content, settledTxHash) {
  const client = Client.forTestnet();
  const validatorAccountId = AccountId.fromString(process.env.VALIDATOR_ACCOUNT_ID);
  client.setOperator(validatorAccountId, getValidatorSdkKey());

  const balance = await new AccountBalanceQuery()
    .setAccountId(validatorAccountId)
    .execute(client);
  const maxTopicCreateFeeHbar = Number(process.env.HIP991_MAX_TOPIC_CREATE_FEE_HBAR || "2");

  console.log(`[VALIDATOR] 💳 Validator balance: ${balance.hbars.toString()}`);
  console.log(`[VALIDATOR] 🧾 HIP-991 topic max fee: ${maxTopicCreateFeeHbar} HBAR`);

  const customFee = new CustomFixedFee()
    .setAmount(10000000)
    .setFeeCollectorAccountId(validatorAccountId);

  const topicTx = await new TopicCreateTransaction()
    .setTopicMemo(`HIVE Knowledge #${knowledgeId}: ${String(content).substring(0, 50)}`)
    .setCustomFees([customFee])
    .setMaxTransactionFee(new Hbar(maxTopicCreateFeeHbar))
    .execute(client);

  const receipt = await topicTx.getReceipt(client);
  const topicId = receipt.topicId.toString();
  await upsertHip991TopicMapping(knowledgeId, topicId);

  const seedPayload = {
    type: "knowledge.created",
    source: "validator",
    knowledgeId,
    topicId,
    contentPreview: String(content).slice(0, 280),
    settledTxHash: settledTxHash || null,
    createdAt: new Date().toISOString(),
  };

  try {
    await submitSeedMessage(client, topicId, seedPayload, "Topic seed");

    const globalTopicId = (process.env.NEXT_PUBLIC_HCS_TOPIC_ID || "").trim();
    if (globalTopicId && globalTopicId !== topicId) {
      await submitSeedMessage(
        client,
        globalTopicId,
        {
          ...seedPayload,
          type: "knowledge.topic.created",
          source: "validator-global-feed",
        },
        "Global feed",
      );
    }
  } catch (error) {
    console.log(`[VALIDATOR] ⚠️ Could not publish seed message to topic ${topicId}: ${error?.message || error}`);
  }

  console.log(`[VALIDATOR] 🏷️  HIP-991 Topic created: ${topicId}`);
  console.log(`[VALIDATOR] 💰 Fee: 0.1 HBAR per access`);
  console.log(`[VALIDATOR] 🔗 ${hashscanTopicUrl(topicId)}`);

  return topicId;
}

class ValidatorAgent {
  constructor() {
    this.accountId = process.env.VALIDATOR_ACCOUNT_ID;
    const privateKey = process.env.VALIDATOR_PRIVATE_KEY || process.env.HEDERA_PRIVATE_KEY;
    this.provider = createHederaEvmProvider();
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.contract = new ethers.Contract(
      process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS,
      CONTRACT_ABI,
      this.wallet
    );
    this.running = false;
    this.polling = false;
    this.scanCursor = 1;
    this.maxItemsPerCycle = Math.max(
      1,
      parseInt(process.env.VALIDATOR_MAX_ITEMS_PER_CYCLE || "8", 10)
    );
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
        const topicId = await createHIP991Topic(id, item.content, tx.hash);
        console.log(`[VALIDATOR] ✅ #${id} fully settled with HIP-991 topic: ${topicId}`);
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

        const startId = Math.min(this.scanCursor, total);
        let scannedCount = 0;

        for (let offset = 0; offset < this.maxItemsPerCycle; offset++) {
          const i = ((startId - 1 + offset) % total) + 1;
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
            scannedCount += 1;
            await this.processItem(i, item);
          } catch (err) {
            if (isRpcRateLimited(err)) {
              console.log("[VALIDATOR] ⏳ RPC rate limit detectado (1015/429). Se pausa este ciclo.");
              break;
            }
            console.log(`[VALIDATOR] ⚠️ Skip #${i}: ${err?.shortMessage || err?.message || "read failed"}`);
          }
        }

        this.scanCursor = ((startId - 1 + this.maxItemsPerCycle) % total) + 1;
        console.log(`[VALIDATOR] 📊 Scanned ${scannedCount}/${total} items this cycle`);
      } catch (error) {
        if (isRpcRateLimited(error)) {
          console.error("[VALIDATOR] ⏳ Polling throttled by RPC provider (1015/429)");
          return;
        }
        console.error("[VALIDATOR] 🔐 Error en polling:", error);
      } finally {
        this.polling = false;
      }
    };

    const intervalSeconds = parseInt(process.env.VALIDATOR_POLL_SECONDS || "60", 10);
    console.log(`[VALIDATOR] 🔄 Polling every ${intervalSeconds}s (batch=${this.maxItemsPerCycle})`);
    setInterval(runLoop, intervalSeconds * 1000);
    runLoop();
  }

  stop() {
    this.running = false;
  }
}

const agent = new ValidatorAgent();
agent.start().catch(console.error);

export default ValidatorAgent;
