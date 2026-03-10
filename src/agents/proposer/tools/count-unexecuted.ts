import { z } from 'zod';
import { StructuredTool } from '@langchain/core/tools';
import { ethers } from 'ethers';

export class CountUnexecutedTool extends StructuredTool {
  name = 'count_unexecuted';
  description =
    'Count the number of knowledge items that have not yet been executed. Use this to check the backlog before proposing new items.';
  schema = z.object({});

  private contract: ethers.Contract;

  constructor(contract: ethers.Contract) {
    super();
    this.contract = contract;
  }

  async _call(): Promise<string> {
    try {
      const count = Number(await this.contract.knowledgeCount());
      let unexecuted = 0;
      for (let id = 1; id <= count; id++) {
        const knowledge = await this.contract.getKnowledge(id);
        if (!knowledge[4]) unexecuted++;
      }
      return JSON.stringify({
        success: true,
        totalItems: count,
        unexecutedCount: unexecuted,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
