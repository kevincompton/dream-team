import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  Client,
  TopicCreateTransaction,
  AccountId,
  PrivateKey,
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

  console.log(`[SENSOR] Creating HCS-2 storage topic for sensor agent`);
  console.log(`[SENSOR] Account: ${accountId}`);
  console.log(`[SENSOR] Network: ${network}`);

  const client =
    network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
  client.setOperator(AccountId.fromString(accountId), parseSdkKey(privateKey));

  const memo = `HIVE Sensor - ${accountId}`;
  const topicTx = await new TopicCreateTransaction()
    .setTopicMemo(memo)
    .execute(client);

  const receipt = await topicTx.getReceipt(client);
  const topicId = receipt.topicId!.toString();

  console.log(`[SENSOR] HCS-2 storage topic created: ${topicId}`);
  console.log(`[SENSOR] ${hashscanTopicUrl(topicId, network)}`);

  if (registryTopicId) {
    console.log(
      `[SENSOR] Registering in HCS-2 Sensor Registry: ${registryTopicId}`,
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
          type: 'sensor',
          accountId,
          memo,
        }),
        memo: `Sensor ${accountId} topic`,
      });

      if (!response.success) {
        console.warn(`[SENSOR] HCS-2 registration failed: ${response.error}`);
      } else {
        console.log(
          `[SENSOR] Registered in HCS-2 registry (seq: ${response.sequenceNumber})`,
        );
      }
    } catch (err) {
      console.warn(
        '[SENSOR] HCS-2 registration failed:',
        err instanceof Error ? err.message : err,
      );
    }
  } else {
    console.warn(
      '[SENSOR] SENSOR_REGISTRY_TOPIC_ID not set; topic not indexed in HCS-2',
    );
  }

  console.log('\n--- Add to .env ---');
  console.log(`SENSOR_TOPIC_ID=${topicId}`);
  console.log('-------------------');
}

main().catch((err) => {
  console.error('[SENSOR] Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
