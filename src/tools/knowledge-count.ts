import { z } from 'zod';
import { StructuredTool } from '@langchain/core/tools';
import { ethers } from 'ethers';

export class KnowledgeCountTool extends StructuredTool {
  name = 'knowledge_count';
  description =
    'Get the total number of knowledge items in the KnowledgePool contract.';
  schema = z.object({});

  private contract: ethers.Contract;

  constructor(contract: ethers.Contract) {
    super();
    this.contract = contract;
  }

  async _call(): Promise<string> {
    try {
      const count = await this.contract.knowledgeCount();
      return JSON.stringify({ success: true, count: Number(count) });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
