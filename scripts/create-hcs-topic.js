import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { AccountId, Client, PrivateKey, TopicCreateTransaction } from "@hashgraph/sdk";

dotenv.config();

const ENV_PATH = path.join(process.cwd(), ".env");

function upsertEnvValue(rawEnv, key, value) {
  const lineRegex = new RegExp(`^${key}=.*$`, "m");
  const line = `${key}=${value}`;
  if (lineRegex.test(rawEnv)) {
    return rawEnv.replace(lineRegex, line);
  }
  return `${rawEnv.trimEnd()}\n${line}\n`;
}

function parseOperatorPrivateKey(value) {
  const normalized = value.startsWith("0x") ? value.slice(2) : value;

  try {
    return PrivateKey.fromStringECDSA(normalized);
  } catch {
    try {
      return PrivateKey.fromStringED25519(normalized);
    } catch {
      return PrivateKey.fromString(value);
    }
  }
}

async function main() {
  if (!process.env.HEDERA_ACCOUNT_ID || !process.env.HEDERA_PRIVATE_KEY) {
    throw new Error("HEDERA_ACCOUNT_ID y HEDERA_PRIVATE_KEY son requeridos en .env");
  }

  const network = process.env.HEDERA_NETWORK || "testnet";
  const client = Client.forName(network);
  client.setOperator(
    AccountId.fromString(process.env.HEDERA_ACCOUNT_ID),
    parseOperatorPrivateKey(process.env.HEDERA_PRIVATE_KEY),
  );

  console.log(`Creando topic HCS en ${network}...`);

  const tx = await new TopicCreateTransaction().setTopicMemo("Hive Protocol Knowledge Flow").execute(client);
  const receipt = await tx.getReceipt(client);

  if (!receipt.topicId) {
    throw new Error("No se pudo crear el topic HCS");
  }

  const topicId = receipt.topicId.toString();
  console.log(`✓ Topic creado: ${topicId}`);

  let envRaw = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
  envRaw = upsertEnvValue(envRaw, "NEXT_PUBLIC_HCS_TOPIC_ID", topicId);
  fs.writeFileSync(ENV_PATH, `${envRaw.trimEnd()}\n`, "utf8");

  console.log(`✓ .env actualizado: NEXT_PUBLIC_HCS_TOPIC_ID=${topicId}`);
  client.close();
}

main().catch((error) => {
  console.error("Error creando topic HCS:", error.message || error);
  process.exit(1);
});
