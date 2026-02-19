#!/usr/bin/env node
/**
 * Creates an HCS-2 indexed registry for Executor topics.
 * Run once to bootstrap; set EXECUTOR_REGISTRY_TOPIC_ID in .env.
 * @see https://hol.org/docs/libraries/standards-sdk/hcs-2/overview/
 */
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { HCS2Client, HCS2RegistryType } from "@hashgraphonline/standards-sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const ENV_PATH = path.join(process.cwd(), ".env");

function upsertEnvValue(rawEnv, key, value) {
  const lineRegex = new RegExp(`^${key}=.*$`, "m");
  const line = `${key}=${value}`;
  if (lineRegex.test(rawEnv)) {
    return rawEnv.replace(lineRegex, line);
  }
  return `${rawEnv.trimEnd()}\n${line}\n`;
}

async function main() {
  const operatorId = process.env.EXECUTOR_ACCOUNT_ID || process.env.HEDERA_ACCOUNT_ID;
  const operatorKey = process.env.EXECUTOR_PRIVATE_KEY || process.env.HEDERA_PRIVATE_KEY;

  if (!operatorId || !operatorKey) {
    throw new Error("EXECUTOR_ACCOUNT_ID and EXECUTOR_PRIVATE_KEY (or HEDERA_ACCOUNT_ID / HEDERA_PRIVATE_KEY) required");
  }

  const network = process.env.HEDERA_NETWORK || "testnet";
  const client = new HCS2Client({
    network,
    operatorId,
    operatorKey,
    logLevel: "info",
  });

  console.log(`Creating HCS-2 indexed Executor registry on ${network}...`);

  const response = await client.createRegistry({
    registryType: HCS2RegistryType.INDEXED,
    ttl: 86400 * 365, // 1 year
    adminKey: true,
  });

  if (!response.success || !response.topicId) {
    throw new Error(response.error || "Failed to create registry");
  }

  const topicId = response.topicId;
  console.log(`✓ HCS-2 Executor registry created: ${topicId}`);
  console.log(`  Indexed — full history, update/delete supported`);

  let envRaw = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
  envRaw = upsertEnvValue(envRaw, "EXECUTOR_REGISTRY_TOPIC_ID", topicId);
  fs.writeFileSync(ENV_PATH, `${envRaw.trimEnd()}\n`, "utf8");

  console.log(`✓ .env updated: EXECUTOR_REGISTRY_TOPIC_ID=${topicId}`);
}

main().catch((err) => {
  console.error("Error:", err.message || err);
  process.exit(1);
});
