import { z } from 'zod';
import { StructuredTool } from '@langchain/core/tools';
import { ethers } from 'ethers';
import { hashscanTxUrl, HBAR_DECIMALS } from '../../../common/utils.js';

export class ExecuteKnowledgeTool extends StructuredTool {
  name = 'execute_knowledge';
  description =
    'Execute a validated knowledge item on the KnowledgePool contract. This triggers reward distribution. Check pool balance first to ensure sufficient funds.';
  schema = z.object({
    id: z.number().int().positive().describe('The knowledge item ID to execute'),
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
      const [balance, totalReward] = await Promise.all([
        this.contract.poolBalance(),
        this.contract.totalRewardPerTask(),
      ]);

      if (balance < totalReward) {
        return JSON.stringify({
          success: false,
          error: `Insufficient pool balance: ${ethers.formatUnits(balance, HBAR_DECIMALS)} HBAR < ${ethers.formatUnits(totalReward, HBAR_DECIMALS)} HBAR required`,
        });
      }

      const tx = await this.contract.executeKnowledge(input.id);
      const receipt = await tx.wait();
      console.log(`[EXECUTOR] Executed knowledge #${input.id}. TX: ${receipt.hash}`);
      console.log(`[EXECUTOR] ${hashscanTxUrl(receipt.hash, this.network)}`);

      const postBalance = await this.contract.poolBalance();
      return JSON.stringify({
        success: true,
        id: input.id,
        txHash: receipt.hash,
        hashscanUrl: hashscanTxUrl(receipt.hash, this.network),
        poolBalanceAfter: ethers.formatUnits(postBalance, HBAR_DECIMALS),
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
