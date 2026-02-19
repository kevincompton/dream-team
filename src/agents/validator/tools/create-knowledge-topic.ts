import { z } from 'zod';
import { StructuredTool } from '@langchain/core/tools';
import {
  Client,
  TopicCreateTransaction,
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

export class CreateKnowledgeTopicTool extends StructuredTool {
  name = 'create_knowledge_topic';
  description =
    'Create a HIP-991 paid topic for validated knowledge and register it in the HCS-2 indexed Knowledge registry.';
  schema = z.object({
    knowledgeId: z.number().int().positive().describe('The knowledge item ID'),
    content: z.string().describe('The knowledge content (used for topic memo)'),
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

      const memo = `HIVE Knowledge #${input.knowledgeId}: ${input.content.substring(0, 50)}`;
      const topicTx = await new TopicCreateTransaction()
        .setTopicMemo(memo)
        .setCustomFees([customFee])
        .execute(client);

      const receipt = await topicTx.getReceipt(client);
      const topicId = receipt.topicId!.toString();

      console.log(`[VALIDATOR] HIP-991 topic created: ${topicId}`);
      console.log(`[VALIDATOR] Fee: 0.1 HBAR per access`);
      console.log(`[VALIDATOR] ${hashscanTopicUrl(topicId, this.network)}`);

      if (this.registryTopicId) {
        const standardsSdk: any = await import('@hashgraphonline/standards-sdk');
        const hcs2Client = new standardsSdk.HCS2Client({
          network: this.network,
          operatorId: this.accountId,
          operatorKey: this.privateKey,
          logLevel: 'warn',
        } as any);

        const metadata = {
          knowledgeId: input.knowledgeId,
          content: input.content.slice(0, 100),
        };

        const response = await hcs2Client.registerEntry(this.registryTopicId, {
          targetTopicId: topicId,
          metadata: JSON.stringify(metadata),
          memo: `Knowledge #${input.knowledgeId} attested`,
        });

        if (!response.success) {
          console.warn(`[VALIDATOR] HCS-2 registration failed: ${response.error}`);
        } else {
          console.log(`[VALIDATOR] Registered in HCS-2 registry (seq: ${response.sequenceNumber})`);
        }
      } else {
        console.warn('[VALIDATOR] KNOWLEDGE_REGISTRY_TOPIC_ID not set; topic not indexed');
      }

      return JSON.stringify({ success: true, topicId, knowledgeId: input.knowledgeId });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
