import dotenv from "dotenv";
import { Client, AccountId, PrivateKey, TransferTransaction, Hbar } from "@hashgraph/sdk";

dotenv.config();

function parseSdkKey(value) {
  const key = (value || "").trim();
  if (!key) throw new Error("Missing private key");
  if (key.startsWith("0x") || /^[0-9a-fA-F]{64}$/.test(key)) {
    return PrivateKey.fromStringECDSA(key);
  }
  try {
    return PrivateKey.fromStringDer(key);
  } catch {
    return PrivateKey.fromString(key);
  }
}

async function main() {
  const network = (process.env.HEDERA_NETWORK || "testnet").toLowerCase();
  const client = network === "mainnet" ? Client.forMainnet() : Client.forTestnet();

  const operatorId = AccountId.fromString(process.env.HEDERA_ACCOUNT_ID);
  const operatorKey = parseSdkKey(process.env.HEDERA_PRIVATE_KEY);
  const validatorId = AccountId.fromString(process.env.VALIDATOR_ACCOUNT_ID);
  const amountHbar = Number(process.env.FUND_VALIDATOR_HBAR || "10");

  client.setOperator(operatorId, operatorKey);

  const tx = await new TransferTransaction()
    .addHbarTransfer(operatorId, new Hbar(amountHbar).negated())
    .addHbarTransfer(validatorId, new Hbar(amountHbar))
    .setTransactionMemo("fund validator for HIP-991")
    .execute(client);

  const receipt = await tx.getReceipt(client);

  console.log(`✅ Validator funded: +${amountHbar} HBAR`);
  console.log(`Status: ${receipt.status.toString()}`);
  console.log(`TX: ${tx.transactionId.toString()}`);

  client.close();
}

main().catch((error) => {
  console.error("❌ fund-validator failed:", error?.message || error);
  process.exit(1);
});
