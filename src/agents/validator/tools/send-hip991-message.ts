import { z } from 'zod';
import { StructuredTool } from '@langchain/core/tools';
import {
  Client,
  AccountId,
  PrivateKey,
  TopicMessageSubmitTransaction,
  TopicId,
  Hbar,
} from '@hashgraph/sdk';

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

export class SendHip991MessageTool extends StructuredTool {
  name = 'send_hip991_message';
  description =
    'Submit a message to a HIP-991 paid topic on Hedera. Use this instead of submit_topic_message when the target topic has custom fees (e.g. sensor inbound topic, knowledge inbound topic).';
  schema = z.object({
    topicId: z.string().describe('The topic ID to send the message to (e.g. 0.0.12345)'),
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
      const operatorKey = parseSdkKey(this.privateKey);
      client.setOperator(AccountId.fromString(this.accountId), operatorKey);
      client.setDefaultMaxTransactionFee(new Hbar(10));

      const tx = await new TopicMessageSubmitTransaction()
        .setTopicId(TopicId.fromString(input.topicId))
        .setMessage(input.message)
        .setMaxTransactionFee(new Hbar(5))
        .execute(client);

      const receipt = await tx.getReceipt(client);
      const seq = receipt.topicSequenceNumber?.toString() ?? 'unknown';

      console.log(`[VALIDATOR] HIP-991 message sent to ${input.topicId} (seq: ${seq})`);

      return JSON.stringify({
        success: true,
        topicId: input.topicId,
        sequenceNumber: seq,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[VALIDATOR] HIP-991 send failed:`, msg);
      return JSON.stringify({ success: false, error: msg });
    }
  }
}
