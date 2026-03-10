import { z } from 'zod';
import { StructuredTool } from '@langchain/core/tools';
import { ethers } from 'ethers';
import { parseKnowledgeItem } from '../common/contract.js';

export class GetKnowledgeTool extends StructuredTool {
  name = 'get_knowledge';
  description =
    'Retrieve a knowledge item by ID from the KnowledgePool contract. Returns proposer, content, timestamp, validated, executed, validator, and executor fields.';
  schema = z.object({
    id: z.number().int().positive().describe('The knowledge item ID to retrieve'),
  });

  private contract: ethers.Contract;

  constructor(contract: ethers.Contract) {
    super();
    this.contract = contract;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const raw = await this.contract.getKnowledge(input.id);
      const item = parseKnowledgeItem(raw);
      return JSON.stringify({
        success: true,
        id: input.id,
        ...item,
        timestamp: item.timestamp.toString(),
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
