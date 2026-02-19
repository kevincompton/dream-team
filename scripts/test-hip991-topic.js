import dotenv from "dotenv";
import { Client, TopicCreateTransaction, CustomFixedFee, AccountId, PrivateKey, Hbar } from "@hashgraph/sdk";

dotenv.config();

async function main() {
  const network = (process.env.HEDERA_NETWORK || "testnet").toLowerCase();
  const client = network === "mainnet" ? Client.forMainnet() : Client.forTestnet();

  const validatorAccountId = AccountId.fromString(process.env.VALIDATOR_ACCOUNT_ID);
  const validatorKey = PrivateKey.fromStringECDSA((process.env.VALIDATOR_PRIVATE_KEY || "").trim());
  const maxFee = Number(process.env.HIP991_MAX_TOPIC_CREATE_FEE_HBAR || "200");

  client.setOperator(validatorAccountId, validatorKey);

  const customFee = new CustomFixedFee()
    .setAmount(10000000)
    .setFeeCollectorAccountId(validatorAccountId);

  const tx = await new TopicCreateTransaction()
    .setTopicMemo(`HIP991 validation test ${new Date().toISOString()}`)
    .setCustomFees([customFee])
    .setMaxTransactionFee(new Hbar(maxFee))
    .execute(client);

  const receipt = await tx.getReceipt(client);

  console.log(`STATUS=${receipt.status.toString()}`);
  console.log(`TOPIC_ID=${receipt.topicId?.toString() || "N/A"}`);
  console.log(`TX_ID=${tx.transactionId?.toString() || "N/A"}`);

  client.close();
}

main().catch((error) => {
  console.error("HIP991_TEST_FAILED:", error?.message || error);
  process.exit(1);
});
