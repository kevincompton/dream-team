import { config } from 'dotenv';
import { ethers } from 'ethers';
import { Client, AccountId, PrivateKey } from '@hashgraph/sdk';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import {
  HederaLangchainToolkit,
  AgentMode,
  coreConsensusPlugin,
  coreQueriesPlugin,
} from 'hedera-agent-kit';
import { EnvironmentConfig } from '../../common/agent-config.js';
import { createKnowledgePoolContract } from '../../common/contract.js';
import { createHederaEvmProvider } from '../../shared/hedera-rpc.js';
import { hashscanContractUrl } from '../../common/utils.js';
import { ProposeKnowledgeTool } from './tools/propose-knowledge.js';
import { KnowledgeCountTool } from '../../tools/knowledge-count.js';

config();

const BACKLOG_LIMIT = 3;

export class ProposerAgent {
  private env: EnvironmentConfig;
  private isRunning = false;
  private isProposing = false;
  private lastProposalAt = 0;
  private agentExecutor?: AgentExecutor;
  private hederaToolkit?: HederaLangchainToolkit;
  private client?: Client;
  private contract?: ethers.Contract;

  constructor() {
    this.env = process.env as NodeJS.ProcessEnv & EnvironmentConfig;
  }

  async initialize(): Promise<void> {
    console.log('[PROPOSER] Initializing Proposer Agent');
    console.log('=====================================');

    if (!this.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY required');
    }
    if (!this.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS) {
      throw new Error('KNOWLEDGE_POOL_CONTRACT_ADDRESS required');
    }

    const privateKey =
      this.env.PROPOSER_PRIVATE_KEY || this.env.HEDERA_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('PROPOSER_PRIVATE_KEY or HEDERA_PRIVATE_KEY required');
    }

    const accountId =
      this.env.PROPOSER_ACCOUNT_ID || this.env.HEDERA_ACCOUNT_ID;

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
        plugins: [coreConsensusPlugin, coreQueriesPlugin],
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
      temperature: 0.7,
      configuration: {
        baseURL: 'https://ai-gateway.vercel.sh/v1',
      },
      apiKey: this.env.OPENAI_API_KEY!,
    });

    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `You are a Knowledge Proposer agent for the HIVE Protocol on Hedera.

Your ONLY job: generate a novel, specific research question and submit it using propose_knowledge.

TOPICS: Hedera network performance, DeFi protocols on Hedera, HCS/HTS best practices, smart contract optimization, agent coordination patterns, blockchain security, or IoT sensor integration.

RULES:
- Each question must be specific, measurable, and relevant to the Hedera ecosystem.
- Do NOT repeat previous questions. Be creative and varied.
- Call propose_knowledge exactly once with your question.

Current Configuration:
- Network: ${network}
- Contract: ${this.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS}
- Account: ${accountId || 'unknown'}`,
      ],
      ['user', '{input}'],
      ['placeholder', '{agent_scratchpad}'],
    ]);

    const proposeKnowledgeTool = new ProposeKnowledgeTool(this.contract, network);
    const knowledgeCountTool = new KnowledgeCountTool(this.contract);
    const hederaTools = this.hederaToolkit.getTools();

    const allTools = [
      ...hederaTools,
      proposeKnowledgeTool,
      knowledgeCountTool,
    ];

    // Cast needed: hedera-agent-kit bundles its own @langchain/core which creates
    // type incompatibilities with the project's @langchain/core at compile time.
    // Functionally identical at runtime.
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

    console.log(`[PROPOSER] Account: ${accountId || '(using key only)'}`);
    console.log(
      `[PROPOSER] Contract: ${hashscanContractUrl(this.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS!, network)}`,
    );
    console.log('[PROPOSER] Initialized successfully');
  }

  private async countUnexecuted(): Promise<number> {
    if (!this.contract) return 0;
    try {
      const count = Number(await this.contract.knowledgeCount());
      let unexecuted = 0;
      for (let id = 1; id <= count; id++) {
        const knowledge = await this.contract.getKnowledge(id);
        if (!knowledge[4]) unexecuted++;
      }
      return unexecuted;
    } catch (err) {
      console.warn(
        '[PROPOSER] Backlog check failed, proceeding anyway:',
        err instanceof Error ? err.message : err,
      );
      return 0;
    }
  }

  async start(): Promise<void> {
    if (!this.agentExecutor) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    this.isRunning = true;

    process.on('SIGINT', async () => {
      console.log('\n[PROPOSER] Shutting down...');
      await this.stop();
      process.exit(0);
    });

    const intervalSeconds = parseInt(
      this.env.PROPOSER_INTERVAL_SECONDS || '60',
      10,
    );
    console.log(
      `[PROPOSER] Auto-proposing every ${intervalSeconds}s (backlog limit: ${BACKLOG_LIMIT})`,
    );

    const runCycle = async () => {
      if (!this.isRunning || this.isProposing) return;
      this.isProposing = true;

      try {
        const elapsed = Date.now() - this.lastProposalAt;
        if (elapsed < 60_000 && this.lastProposalAt > 0) {
          console.log('[PROPOSER] Cooldown active, skipping...');
          return;
        }

        const unexecuted = await this.countUnexecuted();
        if (unexecuted > BACKLOG_LIMIT) {
          console.log(
            `[PROPOSER] Backlog has ${unexecuted} unexecuted items (limit: ${BACKLOG_LIMIT}), waiting...`,
          );
          return;
        }

        console.log(
          `[PROPOSER] Backlog clear (${unexecuted}/${BACKLOG_LIMIT}), proposing...`,
        );

        const result = await this.agentExecutor!.invoke({
          input:
            'Generate a novel and specific research question about the Hedera ecosystem and propose it to the contract using propose_knowledge.',
        });

        console.log(`[PROPOSER] ${result.output}`);
        this.lastProposalAt = Date.now();
      } catch (error) {
        console.error(
          '[PROPOSER] Error in proposal cycle:',
          error instanceof Error ? error.message : error,
        );
      } finally {
        this.isProposing = false;
      }
    };

    await runCycle();
    setInterval(runCycle, intervalSeconds * 1000);
  }

  async stop(): Promise<void> {
    console.log('[PROPOSER] Stopping...');
    this.isRunning = false;
  }
}
