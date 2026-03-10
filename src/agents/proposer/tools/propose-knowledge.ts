import { z } from 'zod';
import { StructuredTool } from '@langchain/core/tools';
import { ethers } from 'ethers';
import { hashscanTxUrl } from '../../../common/utils.js';

export class ProposeKnowledgeTool extends StructuredTool {
  name = 'propose_knowledge';
  description =
    'Propose a new knowledge research question to the KnowledgePool contract. The content should be a well-formed research question about Hedera, blockchain, DeFi, or related topics.';
  schema = z.object({
    content: z.string().min(10).describe('The knowledge research question to propose'),
  });

  private contract: ethers.Contract;
  private network?: string;

  constructor(contract: ethers.Contract, network?: string) {
    super();
    this.contract = contract;
    this.network = network;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const tx = await this.contract.proposeKnowledge(input.content);
      const receipt = await tx.wait();
      console.log(`[PROPOSER] Proposed knowledge. TX: ${receipt.hash}`);
      console.log(`[PROPOSER] ${hashscanTxUrl(receipt.hash, this.network)}`);
      return JSON.stringify({
        success: true,
        txHash: receipt.hash,
        hashscanUrl: hashscanTxUrl(receipt.hash, this.network),
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
