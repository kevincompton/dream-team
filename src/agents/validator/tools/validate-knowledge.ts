import { z } from 'zod';
import { StructuredTool } from '@langchain/core/tools';
import { ethers } from 'ethers';
import { hashscanTxUrl, ZERO_ADDRESS } from '../../../common/utils.js';
import { parseKnowledgeItem } from '../../../common/contract.js';

export class ValidateKnowledgeTool extends StructuredTool {
  name = 'validate_knowledge';
  description =
    'Validate a knowledge item on the KnowledgePool contract after checking quality criteria: content must be >10 chars, proposer must not be the validator, and flow order must be respected.';
  schema = z.object({
    id: z.number().int().positive().describe('The knowledge item ID to validate'),
  });

  private contract: ethers.Contract;
  private walletAddress: string;
  private network?: string;
  private flowOrder: string | null;

  constructor(
    contract: ethers.Contract,
    walletAddress: string,
    opts?: { network?: string; flowOrder?: string | null },
  ) {
    super();
    this.contract = contract;
    this.walletAddress = walletAddress.toLowerCase();
    this.network = opts?.network;
    this.flowOrder = opts?.flowOrder ?? null;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const raw = await this.contract.getKnowledge(input.id);
      const item = parseKnowledgeItem(raw);

      if (item.validated) {
        return JSON.stringify({ success: false, error: 'Already validated' });
      }

      const checks: Record<string, boolean> = {
        hasContent: !!item.content && item.content.length > 10,
        notSelfValidating:
          item.proposer.toLowerCase() !== this.walletAddress,
        flowReady:
          this.flowOrder === 'execute-first'
            ? item.executed
            : this.flowOrder === 'validate-first'
              ? !item.executed
              : true,
      };

      const failed = Object.entries(checks)
        .filter(([, v]) => !v)
        .map(([k]) => k);

      if (failed.length > 0) {
        return JSON.stringify({
          success: false,
          error: `Validation checks failed: ${failed.join(', ')}`,
          checks,
        });
      }

      const tx = await this.contract.validateKnowledge(input.id);
      const receipt = await tx.wait();
      console.log(`[VALIDATOR] #${input.id} attested on-chain. TX: ${receipt.hash}`);
      console.log(`[VALIDATOR] ${hashscanTxUrl(receipt.hash, this.network)}`);

      return JSON.stringify({
        success: true,
        id: input.id,
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
