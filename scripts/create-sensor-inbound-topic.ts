import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  Client,
  TopicCreateTransaction,
  CustomFixedFee,
  AccountId,
  PrivateKey,
  Hbar,
} from '@hashgraph/sdk';
import { hashscanTopicUrl } from '../src/common/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, '..', '.env') });

function parseSdkKey(key: string): PrivateKey {
  const trimmed = key.trim();
  if (trimmed.startsWith('0x') || /^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return PrivateKey.fromStringECDSA(trimmed);
  }
  try {
    return PrivateKey.fromStringDer(trimmed);
  } catch {
    return PrivateKey.fromString(trimmed);
  }
}

async function main(): Promise<void> {
  const accountId =
    process.env.SENSOR_ACCOUNT_ID || process.env.HEDERA_ACCOUNT_ID;
  const privateKey =
    process.env.SENSOR_PRIVATE_KEY || process.env.HEDERA_PRIVATE_KEY;
  const network = process.env.HEDERA_NETWORK || 'testnet';
  const registryTopicId = process.env.SENSOR_REGISTRY_TOPIC_ID;

  if (!accountId || !privateKey) {
    console.error(
      'Set SENSOR_ACCOUNT_ID + SENSOR_PRIVATE_KEY (or HEDERA_ACCOUNT_ID + HEDERA_PRIVATE_KEY) in .env',
    );
    process.exit(1);
  }

  console.log(`[SENSOR-INBOUND] Creating HIP-991 inbound topic for sensor agent`);
  console.log(`[SENSOR-INBOUND] Account: ${accountId}`);
  console.log(`[SENSOR-INBOUND] Network: ${network}`);

  const client =
    network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
  const operatorKey = parseSdkKey(privateKey);
  client.setOperator(AccountId.fromString(accountId), operatorKey);

  const customFee = new CustomFixedFee()
    .setAmount(10_000_000) // 0.1 HBAR per inbound message
    .setFeeCollectorAccountId(AccountId.fromString(accountId));

  const maxFee = Number(process.env.HIP991_MAX_TOPIC_CREATE_FEE_HBAR || '200');

  const memo = `HIVE Sensor Inbound - ${accountId}`;
  const topicTx = await new TopicCreateTransaction()
    .setAdminKey(operatorKey.publicKey)
    .setTopicMemo(memo)
    .setCustomFees([customFee])
    .setMaxTransactionFee(new Hbar(maxFee))
    .execute(client);

  const receipt = await topicTx.getReceipt(client);
  const topicId = receipt.topicId!.toString();

  console.log(`[SENSOR-INBOUND] HIP-991 inbound topic created: ${topicId}`);
  console.log(`[SENSOR-INBOUND] Fee: 0.1 HBAR per message (collector: ${accountId})`);
  console.log(`[SENSOR-INBOUND] ${hashscanTopicUrl(topicId, network)}`);

  if (registryTopicId) {
    console.log(
      `[SENSOR-INBOUND] Registering in HCS-2 Sensor Registry: ${registryTopicId}`,
    );
    try {
      const standardsSdk: any = await import(
        '@hashgraphonline/standards-sdk'
      );
      const hcs2Client = new standardsSdk.HCS2Client({
        network,
        operatorId: accountId,
        operatorKey: privateKey,
        logLevel: 'warn',
      } as any);

      const response = await hcs2Client.registerEntry(registryTopicId, {
        targetTopicId: topicId,
        metadata: JSON.stringify({
          type: 'sensor-inbound',
          accountId,
          memo,
        }),
        memo: `Sensor ${accountId} inbound topic`,
      });

      if (!response.success) {
        console.warn(`[SENSOR-INBOUND] HCS-2 registration failed: ${response.error}`);
      } else {
        console.log(
          `[SENSOR-INBOUND] Registered in HCS-2 registry (seq: ${response.sequenceNumber})`,
        );
      }
    } catch (err) {
      console.warn(
        '[SENSOR-INBOUND] HCS-2 registration failed:',
        err instanceof Error ? err.message : err,
      );
    }
  } else {
    console.warn(
      '[SENSOR-INBOUND] SENSOR_REGISTRY_TOPIC_ID not set; topic not indexed in HCS-2',
    );
  }

  console.log('\n--- Add to .env ---');
  console.log(`SENSOR_INBOUND_TOPIC_ID=${topicId}`);
  console.log('-------------------');
}

main().catch((err) => {
  console.error('[SENSOR-INBOUND] Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
