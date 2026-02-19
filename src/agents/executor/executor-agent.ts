import { config } from 'dotenv';
import { ethers } from 'ethers';
import { Client } from '@hashgraph/sdk';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import {
  HederaLangchainToolkit,
  AgentMode,
  coreHTSPlugin,
  coreAccountPlugin,
  coreConsensusPlugin,
  coreQueriesPlugin,
} from 'hedera-agent-kit';
import { EnvironmentConfig } from '../../common/agent-config.js';
import {
  createKnowledgePoolContract,
  parseKnowledgeItem,
} from '../../common/contract.js';
import { createHederaEvmProvider } from '../../shared/hedera-rpc.js';
import {
  hashscanContractUrl,
  delay,
  isRpcRateLimited,
  ZERO_ADDRESS,
  HBAR_DECIMALS,
} from '../../common/utils.js';
import { ExecuteKnowledgeTool } from './tools/execute-knowledge.js';
import {
  EnsureExecutorTopicTool,
  SubmitToTopicTool,
} from './tools/ensure-executor-topic.js';
import { GetKnowledgeTool } from '../../tools/get-knowledge.js';
import { KnowledgeCountTool } from '../../tools/knowledge-count.js';
import { PoolBalanceTool } from '../../tools/pool-balance.js';

config();

export class ExecutorAgent {
  private env: EnvironmentConfig;
  private isRunning = false;
  private polling = false;
  private scanCursor = 1;
  private maxItemsPerCycle: number;
  private pendingExecutions = new Set<number>();
  private flowOrder: string;
  private flowOrderResolved: string | null;
  private topicId: string | null = null;

  private agentExecutor?: AgentExecutor;
  private hederaToolkit?: HederaLangchainToolkit;
  private client?: Client;
  private contract?: ethers.Contract;

  constructor() {
    this.env = process.env as NodeJS.ProcessEnv & EnvironmentConfig;
    this.maxItemsPerCycle = Math.max(
      1,
      parseInt(this.env.EXECUTOR_MAX_ITEMS_PER_CYCLE || '8', 10),
    );
    this.flowOrder = (
      this.env.KNOWLEDGE_FLOW_ORDER || 'auto'
    ).toLowerCase();
    this.flowOrderResolved =
      this.flowOrder === 'validate-first' ||
      this.flowOrder === 'execute-first'
        ? this.flowOrder
        : null;
  }

  async initialize(): Promise<void> {
    console.log('[EXECUTOR] Initializing Executor Agent');
    console.log('=====================================');

    if (!this.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY required');
    }
    if (!this.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS) {
      throw new Error('KNOWLEDGE_POOL_CONTRACT_ADDRESS required');
    }

    const privateKey =
      this.env.EXECUTOR_PRIVATE_KEY || this.env.HEDERA_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('EXECUTOR_PRIVATE_KEY or HEDERA_PRIVATE_KEY required');
    }

    const accountId =
      this.env.EXECUTOR_ACCOUNT_ID || this.env.HEDERA_ACCOUNT_ID;
    const network = this.env.HEDERA_NETWORK || 'testnet';

    this.client =
      network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
    if (accountId) {
      this.client.setOperator(accountId, privateKey);
    }

    this.hederaToolkit = new HederaLangchainToolkit({
      client: this.client,
      configuration: {
        tools: [],
        context: { mode: AgentMode.AUTONOMOUS },
        plugins: [
          coreHTSPlugin,
          coreAccountPlugin,
          coreConsensusPlugin,
          coreQueriesPlugin,
        ],
      },
    });

    const provider = createHederaEvmProvider();
    const wallet = new ethers.Wallet(privateKey, provider);
    this.contract = createKnowledgePoolContract(
      this.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS!,
      wallet,
    );

    const llm = new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      temperature: 0,
      configuration: {
        baseURL: 'https://ai-gateway.vercel.sh/v1',
      },
      apiKey: this.env.OPENAI_API_KEY!,
    });

    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `You are a Knowledge Executor agent for the HIVE Protocol on Hedera.

Your job is to execute knowledge items that are ready. When given a knowledge item to process:
1. Verify the pool has sufficient funds using pool_balance
2. Execute the knowledge item using execute_knowledge
3. Report the result

Current Configuration:
- Network: ${network}
- Contract: ${this.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS}
- Account: ${accountId || 'unknown'}
- Flow order: ${this.flowOrderResolved || 'auto'}`,
      ],
      ['user', '{input}'],
      ['placeholder', '{agent_scratchpad}'],
    ]);

    const executeKnowledgeTool = new ExecuteKnowledgeTool(
      this.contract,
      network,
    );
    const getKnowledgeTool = new GetKnowledgeTool(this.contract);
    const knowledgeCountTool = new KnowledgeCountTool(this.contract);
    const poolBalanceTool = new PoolBalanceTool(this.contract);

    const ensureTopicTool = new EnsureExecutorTopicTool({
      accountId: accountId || '',
      privateKey,
      network,
      registryTopicId: this.env.EXECUTOR_REGISTRY_TOPIC_ID,
    });

    const hederaTools = this.hederaToolkit.getTools();

    const allTools = [
      ...hederaTools,
      executeKnowledgeTool,
      getKnowledgeTool,
      knowledgeCountTool,
      poolBalanceTool,
      ensureTopicTool,
    ];

    const agent = await createToolCallingAgent({
      llm,
      tools: allTools as any,
      prompt,
    });

    this.agentExecutor = new AgentExecutor({
      agent,
      tools: allTools as any,
      verbose: false,
      maxIterations: 10,
    });

    // Create HIP-991 topic on startup
    if (accountId) {
      try {
        const topicResult = await ensureTopicTool._call({
          memo: `HIVE Executor sensor - ${accountId}`,
        });
        const parsed = JSON.parse(topicResult);
        if (parsed.success) {
          this.topicId = parsed.topicId;
          console.log(`[EXECUTOR] HIP-991 topic assigned: ${this.topicId}`);
        }
      } catch (err) {
        console.warn(
          '[EXECUTOR] Could not init HIP-991 topic:',
          err instanceof Error ? err.message : err,
        );
      }
    }

    console.log(
      `[EXECUTOR] Account: ${accountId || '(using key only)'}`,
    );
    console.log(
      `[EXECUTOR] Contract: ${hashscanContractUrl(this.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS!, network)}`,
    );
    console.log(
      `[EXECUTOR] Flow order: ${this.flowOrderResolved || 'auto'}`,
    );
    console.log('[EXECUTOR] Initialized successfully');
  }

  private resolveFlowOrderFromError(errorMessage: string): void {
    const msg = String(errorMessage || '').toLowerCase();
    if (
      !this.flowOrderResolved &&
      msg.includes('knowledge must be validated first')
    ) {
      this.flowOrderResolved = 'validate-first';
      console.log('[EXECUTOR] Flow order detected: validate-first');
    }
  }

  private shouldExecuteItem(
    validated: boolean,
    executed: boolean,
    executor: string,
  ): boolean {
    const isUnexecuted =
      executor === ZERO_ADDRESS || !executed;
    if (!isUnexecuted) return false;

    if (this.flowOrderResolved === 'validate-first') {
      return validated;
    }
    return true;
  }

  async start(): Promise<void> {
    if (!this.agentExecutor || !this.contract) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    this.isRunning = true;

    process.on('SIGINT', async () => {
      console.log('\n[EXECUTOR] Shutting down...');
      await this.stop();
      process.exit(0);
    });

    const balance = await this.contract.poolBalance();
    const totalReward = await this.contract.totalRewardPerTask();
    console.log(
      `[EXECUTOR] Pool balance: ${ethers.formatUnits(balance, HBAR_DECIMALS)} HBAR`,
    );
    console.log(
      `[EXECUTOR] Reward per task: ${ethers.formatUnits(totalReward, HBAR_DECIMALS)} HBAR`,
    );

    const pollInterval =
      parseInt(this.env.EXECUTOR_POLL_SECONDS || '45', 10) * 1000;
    console.log(
      `[EXECUTOR] Watching every ${parseInt(this.env.EXECUTOR_POLL_SECONDS || '45', 10)}s (batch=${this.maxItemsPerCycle})`,
    );

    const checkAndExecute = async () => {
      if (!this.isRunning || this.polling) return;
      this.polling = true;

      try {
        const count = Number(await this.contract!.knowledgeCount());
        console.log(`[EXECUTOR] Contract has ${count} items`);
        if (count === 0) {
          console.log('[EXECUTOR] No items yet, waiting...');
          return;
        }

        let executedCount = 0;
        let scannedCount = 0;
        const total = count;
        const startId = Math.min(this.scanCursor, total);

        for (let offset = 0; offset < this.maxItemsPerCycle; offset++) {
          const i = ((startId - 1 + offset) % total) + 1;
          try {
            const raw = await this.contract!.getKnowledge(i);
            const item = parseKnowledgeItem(raw);
            scannedCount++;

            if (
              !this.shouldExecuteItem(
                item.validated,
                item.executed,
                item.executor,
              )
            ) {
              continue;
            }

            if (this.pendingExecutions.has(i)) continue;
            this.pendingExecutions.add(i);

            console.log(`[EXECUTOR] Found unexecuted item #${i} -- processing`);

            try {
              const result = await this.agentExecutor!.invoke({
                input: `Execute knowledge item #${i}. The content is: "${item.content.slice(0, 100)}". First check the pool balance, then execute if funds are sufficient.`,
              });
              console.log(`[EXECUTOR] #${i}: ${result.output}`);
              executedCount++;
            } catch (execErr) {
              this.resolveFlowOrderFromError(
                execErr instanceof Error ? execErr.message : String(execErr),
              );
              console.error(
                `[EXECUTOR] Error executing #${i}:`,
                execErr instanceof Error ? execErr.message : execErr,
              );
            } finally {
              this.pendingExecutions.delete(i);
            }
          } catch (err) {
            if (isRpcRateLimited(err)) {
              console.log(
                '[EXECUTOR] RPC rate limit detected. Pausing cycle.',
              );
              break;
            }
            console.log(`[EXECUTOR] Skip #${i}: bad data`);
          }
        }

        this.scanCursor =
          ((startId - 1 + this.maxItemsPerCycle) % total) + 1;
        console.log(
          `[EXECUTOR] Scanned ${scannedCount}/${total} items this cycle`,
        );
        console.log(
          `[EXECUTOR] Scan complete: ${executedCount} executed this cycle`,
        );
      } catch (error) {
        if (isRpcRateLimited(error)) {
          console.error('[EXECUTOR] Polling throttled by RPC provider');
          return;
        }
        console.error(
          '[EXECUTOR] Error in polling:',
          error instanceof Error ? error.message : error,
        );
      } finally {
        this.polling = false;
      }
    };

    await checkAndExecute();
    setInterval(checkAndExecute, pollInterval);
  }

  async stop(): Promise<void> {
    console.log('[EXECUTOR] Stopping...');
    this.isRunning = false;
  }
}
