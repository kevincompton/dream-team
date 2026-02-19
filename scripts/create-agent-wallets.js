import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import {
  AccountCreateTransaction,
  AccountId,
  Client,
  Hbar,
  PrivateKey,
} from "@hashgraph/sdk";

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

function toEvmHex(privateKey) {
  const raw = privateKey.toStringRaw();
  return raw.startsWith("0x") ? raw : `0x${raw}`;
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

async function createAgentAccount(client, label) {
  const privateKey = PrivateKey.generateECDSA();
  const accountCreateTx = new AccountCreateTransaction()
    .setKey(privateKey.publicKey)
    .setInitialBalance(new Hbar(50));

  if (typeof accountCreateTx.setAlias === "function") {
    accountCreateTx.setAlias(privateKey.publicKey.toEvmAddress());
  }

  const transaction = await accountCreateTx.execute(client);

  const receipt = await transaction.getReceipt(client);
  const accountId = receipt.accountId;

  if (!accountId) {
    throw new Error(`No se pudo crear cuenta para ${label}`);
  }

  return {
    accountId: accountId.toString(),
    privateKeyHex: toEvmHex(privateKey),
  };
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

  console.log("Creando cuentas de agentes con 50 HBAR cada una...");

  const proposer = await createAgentAccount(client, "proposer");
  console.log(`✓ Proposer: ${proposer.accountId}`);

  const executor = await createAgentAccount(client, "executor");
  console.log(`✓ Executor: ${executor.accountId}`);

  const validator = await createAgentAccount(client, "validator");
  console.log(`✓ Validator: ${validator.accountId}`);

  let envRaw = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
  envRaw = upsertEnvValue(envRaw, "PROPOSER_ACCOUNT_ID", proposer.accountId);
  envRaw = upsertEnvValue(envRaw, "PROPOSER_PRIVATE_KEY", proposer.privateKeyHex);
  envRaw = upsertEnvValue(envRaw, "EXECUTOR_ACCOUNT_ID", executor.accountId);
  envRaw = upsertEnvValue(envRaw, "EXECUTOR_PRIVATE_KEY", executor.privateKeyHex);
  envRaw = upsertEnvValue(envRaw, "VALIDATOR_ACCOUNT_ID", validator.accountId);
  envRaw = upsertEnvValue(envRaw, "VALIDATOR_PRIVATE_KEY", validator.privateKeyHex);

  fs.writeFileSync(ENV_PATH, `${envRaw.trimEnd()}\n`, "utf8");

  console.log(`\n✓ .env actualizado en ${ENV_PATH}`);
  console.log("Listo: ya puedes iniciar agentes con wallets separadas.");

  client.close();
}

main().catch((error) => {
  console.error("Error creando wallets de agentes:", error.message || error);
  process.exit(1);
});
