/**
 * HIP-991 Knowledge topic creation and HCS-2 registry registration for Validator agent.
 * Each attested Knowledge item gets a HIP-991 topic; registered in HCS-2 indexed registry.
 */
import { Client, TopicCreateTransaction, CustomFixedFee, AccountId, PrivateKey } from "@hashgraph/sdk";
import { HCS2Client } from "@hashgraphonline/standards-sdk";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const HASHSCAN_BASE = process.env.HEDERA_NETWORK === "mainnet"
  ? "https://hashscan.io/mainnet"
  : "https://hashscan.io/testnet";

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

/**
 * Create a HIP-991 topic for attested Knowledge. Fee collector = Validator account.
 */
async function createHIP991Topic(knowledgeId, content) {
  const accountId = process.env.VALIDATOR_ACCOUNT_ID || process.env.HEDERA_ACCOUNT_ID;
  if (!accountId) {
    throw new Error("VALIDATOR_ACCOUNT_ID or HEDERA_ACCOUNT_ID required");
  }

  const client = (process.env.HEDERA_NETWORK === "mainnet" ? Client.forMainnet() : Client.forTestnet());
  client.setOperator(AccountId.fromString(accountId), getValidatorSdkKey());

  const customFee = new CustomFixedFee()
    .setAmount(10_000_000) // 0.1 HBAR (8 decimals)
    .setFeeCollectorAccountId(AccountId.fromString(accountId));

  const memo = `HIVE Knowledge #${knowledgeId}: ${String(content).substring(0, 50)}`;
  const topicTx = await new TopicCreateTransaction()
    .setTopicMemo(memo)
    .setCustomFees([customFee])
    .execute(client);

  const receipt = await topicTx.getReceipt(client);
  const topicId = receipt.topicId.toString();

  console.log(`[VALIDATOR] 🏷️  HIP-991 topic created: ${topicId}`);
  console.log(`[VALIDATOR] 💰 Fee: 0.1 HBAR per access`);
  console.log(`[VALIDATOR] 🔗 ${HASHSCAN_BASE}/topic/${topicId}`);

  return topicId;
}

/**
 * Register the Knowledge topic in the HCS-2 indexed registry.
 */
async function registerInHCS2Registry(topicId, metadata = {}) {
  const registryTopicId = process.env.KNOWLEDGE_REGISTRY_TOPIC_ID?.trim();
  if (!registryTopicId) {
    console.warn("[VALIDATOR] KNOWLEDGE_REGISTRY_TOPIC_ID not set; topic created but not HCS-2 indexed");
    return;
  }

  const operatorId = process.env.VALIDATOR_ACCOUNT_ID || process.env.HEDERA_ACCOUNT_ID;
  const operatorKey = process.env.VALIDATOR_PRIVATE_KEY || process.env.HEDERA_PRIVATE_KEY;
  if (!operatorId || !operatorKey) {
    throw new Error("VALIDATOR_ACCOUNT_ID and VALIDATOR_PRIVATE_KEY required for HCS-2");
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
    memo: `Knowledge #${metadata.knowledgeId ?? "?"} attested`,
  });

  if (!response.success) {
    throw new Error(response.error || "HCS-2 registerEntry failed");
  }

  console.log(`[VALIDATOR] 📋 Registered in HCS-2 registry (sequence: ${response.sequenceNumber})`);
}

/**
 * Create HIP-991 topic for Knowledge and register in HCS-2 indexed registry.
 */
export async function createAndRegisterKnowledgeTopic(knowledgeId, content) {
  const topicId = await createHIP991Topic(knowledgeId, content);
  await registerInHCS2Registry(topicId, { knowledgeId, content: String(content).slice(0, 100) });
  return topicId;
}
