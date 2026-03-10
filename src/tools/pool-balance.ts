import { z } from 'zod';
import { StructuredTool } from '@langchain/core/tools';
import { ethers } from 'ethers';
import { HBAR_DECIMALS } from '../common/utils.js';

export class PoolBalanceTool extends StructuredTool {
  name = 'pool_balance';
  description =
    'Get the current pool balance and total reward per task from the KnowledgePool contract. Returns values in HBAR.';
  schema = z.object({});

  private contract: ethers.Contract;

  constructor(contract: ethers.Contract) {
    super();
    this.contract = contract;
  }

  async _call(): Promise<string> {
    try {
      const [balance, totalReward] = await Promise.all([
        this.contract.poolBalance(),
        this.contract.totalRewardPerTask(),
      ]);
      return JSON.stringify({
        success: true,
        poolBalanceHbar: ethers.formatUnits(balance, HBAR_DECIMALS),
        poolBalanceWei: balance.toString(),
        totalRewardPerTaskHbar: ethers.formatUnits(totalReward, HBAR_DECIMALS),
        totalRewardPerTaskWei: totalReward.toString(),
        canExecute: balance >= totalReward,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
