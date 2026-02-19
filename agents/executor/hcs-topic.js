/**
 * HIP-991 topic creation and HCS-2 registry registration for Executor agents.
 * Each Executor gets an assigned HIP-991 topic; registered in HCS-2 indexed registry for discovery.
 */
import { Client, TopicCreateTransaction, TopicMessageSubmitTransaction, CustomFixedFee, AccountId, PrivateKey } from "@hashgraph/sdk";
import { HCS2Client, HCS2RegistryType } from "@hashgraphonline/standards-sdk";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const HASHSCAN_BASE = process.env.HEDERA_NETWORK === "mainnet"
  ? "https://hashscan.io/mainnet"
  : "https://hashscan.io/testnet";

function getExecutorSdkKey() {
  const key = (process.env.EXECUTOR_PRIVATE_KEY || process.env.HEDERA_PRIVATE_KEY || "").trim();
  if (key.startsWith("0x") || /^[0-9a-fA-F]{64}$/.test(key)) {
    return PrivateKey.fromStringECDSA(key);
  }
  try {
    return PrivateKey.fromStringDer(key);
  } catch {
    return PrivateKey.fromString(key);
  }
}

/**
 * Create a HIP-991 topic for the Executor (sensor data). Fee collector = Executor account.
 */
export async function createHIP991Topic(metadata = {}) {
  const accountId = process.env.EXECUTOR_ACCOUNT_ID || process.env.HEDERA_ACCOUNT_ID;
  if (!accountId) {
    throw new Error("EXECUTOR_ACCOUNT_ID or HEDERA_ACCOUNT_ID required");
  }

  const client = (process.env.HEDERA_NETWORK === "mainnet" ? Client.forMainnet() : Client.forTestnet());
  client.setOperator(AccountId.fromString(accountId), getExecutorSdkKey());

  const customFee = new CustomFixedFee()
    .setAmount(10_000_000) // 0.1 HBAR (8 decimals)
    .setFeeCollectorAccountId(AccountId.fromString(accountId));

  const memo = metadata.memo || `HIVE Executor sensor data - ${accountId}`;
  const topicTx = await new TopicCreateTransaction()
    .setTopicMemo(memo)
    .setCustomFees([customFee])
    .execute(client);

  const receipt = await topicTx.getReceipt(client);
  const topicId = receipt.topicId.toString();

  console.log(`[EXECUTOR] 🏷️  HIP-991 topic created: ${topicId}`);
  console.log(`[EXECUTOR] 💰 Fee: 0.1 HBAR per message`);
  console.log(`[EXECUTOR] 🔗 ${HASHSCAN_BASE}/topic/${topicId}`);

  return topicId;
}

/**
 * Register the Executor's topic in the HCS-2 indexed registry.
 */
export async function registerInHCS2Registry(topicId, metadata = {}) {
  const registryTopicId = process.env.EXECUTOR_REGISTRY_TOPIC_ID?.trim();
  if (!registryTopicId) {
    console.warn("[EXECUTOR] EXECUTOR_REGISTRY_TOPIC_ID not set; topic created but not registered (MCP won't discover it)");
    return;
  }

  const operatorId = process.env.EXECUTOR_ACCOUNT_ID || process.env.HEDERA_ACCOUNT_ID;
  const operatorKey = process.env.EXECUTOR_PRIVATE_KEY || process.env.HEDERA_PRIVATE_KEY;
  if (!operatorId || !operatorKey) {
    throw new Error("EXECUTOR_ACCOUNT_ID and EXECUTOR_PRIVATE_KEY required for HCS-2");
  }

  const network = process.env.HEDERA_NETWORK || "testnet";
  const client = new HCS2Client({
    network,
    operatorId,
    operatorKey,
    logLevel: "warn",
  });

  const response = await client.registerEntry(registryTopicId, {
    targetTopicId: topicId,
    metadata: typeof metadata === "string" ? metadata : JSON.stringify(metadata),
    memo: `Executor ${operatorId} sensor topic`,
  });

  if (!response.success) {
    throw new Error(response.error || "HCS-2 registerEntry failed");
  }

  console.log(`[EXECUTOR] 📋 Registered in HCS-2 registry (sequence: ${response.sequenceNumber})`);
}

/**
 * Create and assign a HIP-991 topic for this Executor on init. Always creates; registers in HCS-2 registry.
 */
export async function ensureExecutorTopic(metadata = {}) {
  const topicId = await createHIP991Topic(metadata);
  await registerInHCS2Registry(topicId, metadata);
  return topicId;
}

/**
 * Submit a message to the Executor's HIP-991 topic (sensor data).
 */
export async function submitToTopic(topicId, message) {
  const accountId = process.env.EXECUTOR_ACCOUNT_ID || process.env.HEDERA_ACCOUNT_ID;
  if (!accountId) {
    throw new Error("EXECUTOR_ACCOUNT_ID required");
  }

  const client = (process.env.HEDERA_NETWORK === "mainnet" ? Client.forMainnet() : Client.forTestnet());
  client.setOperator(AccountId.fromString(accountId), getExecutorSdkKey());

  const payload = typeof message === "string" ? message : JSON.stringify(message);
  const tx = await new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(payload)
    .execute(client);

  await tx.getReceipt(client);
  return tx;
}
