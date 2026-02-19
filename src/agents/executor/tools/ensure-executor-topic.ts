import { z } from 'zod';
import { StructuredTool } from '@langchain/core/tools';
import {
  Client,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  CustomFixedFee,
  AccountId,
  PrivateKey,
} from '@hashgraph/sdk';
import { hashscanTopicUrl } from '../../../common/utils.js';

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

export class EnsureExecutorTopicTool extends StructuredTool {
  name = 'ensure_executor_topic';
  description =
    'Create a HIP-991 topic for executor sensor data and register it in the HCS-2 indexed registry for discovery.';
  schema = z.object({
    memo: z.string().optional().describe('Optional memo for the topic'),
  });

  private accountId: string;
  private privateKey: string;
  private network: string;
  private registryTopicId?: string;

  constructor(opts: {
    accountId: string;
    privateKey: string;
    network?: string;
    registryTopicId?: string;
  }) {
    super();
    this.accountId = opts.accountId;
    this.privateKey = opts.privateKey;
    this.network = opts.network || 'testnet';
    this.registryTopicId = opts.registryTopicId;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const client =
        this.network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
      client.setOperator(
        AccountId.fromString(this.accountId),
        parseSdkKey(this.privateKey),
      );

      const customFee = new CustomFixedFee()
        .setAmount(10_000_000)
        .setFeeCollectorAccountId(AccountId.fromString(this.accountId));

      const memo =
        input.memo || `HIVE Executor sensor data - ${this.accountId}`;
      const topicTx = await new TopicCreateTransaction()
        .setTopicMemo(memo)
        .setCustomFees([customFee])
        .execute(client);

      const receipt = await topicTx.getReceipt(client);
      const topicId = receipt.topicId!.toString();
      console.log(`[EXECUTOR] HIP-991 topic created: ${topicId}`);
      console.log(
        `[EXECUTOR] ${hashscanTopicUrl(topicId, this.network)}`,
      );

      if (this.registryTopicId) {
        const standardsSdk: any = await import('@hashgraphonline/standards-sdk');
        const hcs2Client = new standardsSdk.HCS2Client({
          network: this.network,
          operatorId: this.accountId,
          operatorKey: this.privateKey,
          logLevel: 'warn',
        } as any);

        const response = await hcs2Client.registerEntry(this.registryTopicId, {
          targetTopicId: topicId,
          metadata: JSON.stringify({ memo }),
          memo: `Executor ${this.accountId} sensor topic`,
        });

        if (!response.success) {
          console.warn(
            `[EXECUTOR] HCS-2 registration failed: ${response.error}`,
          );
        } else {
          console.log(
            `[EXECUTOR] Registered in HCS-2 registry (seq: ${response.sequenceNumber})`,
          );
        }
      }

      return JSON.stringify({ success: true, topicId });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export class SubmitToTopicTool extends StructuredTool {
  name = 'submit_to_executor_topic';
  description = 'Submit a message to the executor HIP-991 topic (sensor data).';
  schema = z.object({
    topicId: z.string().describe('The topic ID to submit to'),
    message: z.string().describe('The message content to submit'),
  });

  private accountId: string;
  private privateKey: string;
  private network: string;

  constructor(opts: {
    accountId: string;
    privateKey: string;
    network?: string;
  }) {
    super();
    this.accountId = opts.accountId;
    this.privateKey = opts.privateKey;
    this.network = opts.network || 'testnet';
  }

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const client =
        this.network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
      client.setOperator(
        AccountId.fromString(this.accountId),
        parseSdkKey(this.privateKey),
      );

      const tx = await new TopicMessageSubmitTransaction()
        .setTopicId(input.topicId)
        .setMessage(input.message)
        .execute(client);

      await tx.getReceipt(client);
      return JSON.stringify({ success: true, topicId: input.topicId });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
