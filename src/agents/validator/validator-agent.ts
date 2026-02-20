import { config } from 'dotenv';
import { ethers } from 'ethers';
import { Client, TopicMessageQuery, TopicId, Timestamp } from '@hashgraph/sdk';
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
import {
  createKnowledgePoolContract,
  parseKnowledgeItem,
} from '../../common/contract.js';
import { createHederaEvmProvider } from '../../shared/hedera-rpc.js';
import {
  hashscanContractUrl,
  isRpcRateLimited,
  ZERO_ADDRESS,
} from '../../common/utils.js';
import { ValidateKnowledgeTool } from './tools/validate-knowledge.js';
import { CreateKnowledgeTopicTool } from './tools/create-knowledge-topic.js';
import { GetKnowledgeTool } from '../../tools/get-knowledge.js';
import { KnowledgeCountTool } from '../../tools/knowledge-count.js';

config();

export class ValidatorAgent {
  private env: EnvironmentConfig;
  private isRunning = false;
  private polling = false;
  private scanCursor = 1;
  private maxItemsPerCycle: number;
  private flowOrder: string;
  private flowOrderResolved: string | null;

  private agentExecutor?: AgentExecutor;
  private hederaToolkit?: HederaLangchainToolkit;
  private client?: Client;
  private contract?: ethers.Contract;
  private walletAddress?: string;

  constructor() {
    this.env = process.env as NodeJS.ProcessEnv & EnvironmentConfig;
    this.maxItemsPerCycle = Math.max(
      1,
      parseInt(this.env.VALIDATOR_MAX_ITEMS_PER_CYCLE || '8', 10),
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
    console.log('[VALIDATOR] Initializing Validator Agent');
    console.log('========================================');

    if (!this.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY required');
    }
    if (!this.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS) {
      throw new Error('KNOWLEDGE_POOL_CONTRACT_ADDRESS required');
    }

    const privateKey =
      this.env.VALIDATOR_PRIVATE_KEY || this.env.HEDERA_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('VALIDATOR_PRIVATE_KEY or HEDERA_PRIVATE_KEY required');
    }

    const accountId =
      this.env.VALIDATOR_ACCOUNT_ID || this.env.HEDERA_ACCOUNT_ID;
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
    this.walletAddress = wallet.address;
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

    const sensorInboundTopicId = this.env.SENSOR_INBOUND_TOPIC_ID;

    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `You are a Knowledge Validator agent for the HIVE Protocol on Hedera.

Your job is to validate knowledge items, create HCS-2 topics for validated knowledge, and coordinate with sensor agents.

When given a knowledge item to validate:
1. Use validate_knowledge to attest the item on-chain
2. If validation succeeds, use create_knowledge_topic to create an HCS-2 topic and register it in the Knowledge registry

When you receive an inbound message on the knowledge topic, use submit_topic_message to send a request to the sensor agent's inbound topic (${sensorInboundTopicId || 'not configured'}) asking for a summary of today's sensor data readings.

Current Configuration:
- Network: ${network}
- Contract: ${this.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS}
- Account: ${accountId || 'unknown'}
- Flow order: ${this.flowOrderResolved || 'auto'}
- Sensor inbound topic: ${sensorInboundTopicId || 'not configured'}`,
      ],
      ['user', '{input}'],
      ['placeholder', '{agent_scratchpad}'],
    ]);

    const validateKnowledgeTool = new ValidateKnowledgeTool(
      this.contract,
      wallet.address,
      { network, flowOrder: this.flowOrderResolved },
    );
    const createKnowledgeTopicTool = new CreateKnowledgeTopicTool({
      accountId: accountId || '',
      privateKey,
      network,
      registryTopicId: this.env.KNOWLEDGE_REGISTRY_TOPIC_ID,
    });
    const getKnowledgeTool = new GetKnowledgeTool(this.contract);
    const knowledgeCountTool = new KnowledgeCountTool(this.contract);
    const hederaTools = this.hederaToolkit.getTools();

    const allTools = [
      ...hederaTools,
      validateKnowledgeTool,
      createKnowledgeTopicTool,
      getKnowledgeTool,
      knowledgeCountTool,
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

    console.log(
      `[VALIDATOR] Account: ${accountId || '(using key only)'}`,
    );
    console.log(
      `[VALIDATOR] Contract: ${hashscanContractUrl(this.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS!, network)}`,
    );
    console.log(
      `[VALIDATOR] Flow order: ${this.flowOrderResolved || 'auto'}`,
    );
    console.log('[VALIDATOR] Initialized successfully');
  }

  private resolveFlowOrderFromError(errorMessage: string): void {
    const msg = String(errorMessage || '').toLowerCase();
    if (
      !this.flowOrderResolved &&
      msg.includes('knowledge must be executed first')
    ) {
      this.flowOrderResolved = 'execute-first';
      console.log('[VALIDATOR] Flow order detected: execute-first');
    }
  }

  async start(): Promise<void> {
    if (!this.agentExecutor || !this.contract) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    this.isRunning = true;

    process.on('SIGINT', async () => {
      console.log('\n[VALIDATOR] Shutting down...');
      await this.stop();
      process.exit(0);
    });

    console.log(
      `[VALIDATOR] Flow order mode: ${this.flowOrderResolved || 'auto'}`,
    );

    if (this.env.KNOWLEDGE_INBOUND_TOPIC_ID && this.client) {
      const inboundTopicId = TopicId.fromString(this.env.KNOWLEDGE_INBOUND_TOPIC_ID);
      console.log(`[VALIDATOR] Subscribing to inbound topic ${this.env.KNOWLEDGE_INBOUND_TOPIC_ID}`);

      new TopicMessageQuery()
        .setTopicId(inboundTopicId)
        .setStartTime(Timestamp.fromDate(new Date()))
        .subscribe(
          this.client,
          (error) => {
            console.error('[VALIDATOR] Inbound subscription error:', error);
          },
          (message) => {
            const decoded = Buffer.from(message.contents).toString('utf8');
            const seq = message.sequenceNumber.toString();
            console.log(`[VALIDATOR] Inbound message #${seq}: "${decoded.slice(0, 100)}"`);

            this.agentExecutor!.invoke({
              input: `You received an inbound message on the knowledge topic: "${decoded}". Use submit_topic_message to send a message to topic ${this.env.SENSOR_INBOUND_TOPIC_ID} requesting a summary of today's sensor data readings.`,
            })
              .then((result) => console.log(`[VALIDATOR] Agent response: ${result.output}`))
              .catch((err) => console.warn('[VALIDATOR] Agent invocation failed:', err instanceof Error ? err.message : err));
          },
        );
    }

    const intervalSeconds = parseInt(
      this.env.VALIDATOR_POLL_SECONDS || '60',
      10,
    );
    console.log(
      `[VALIDATOR] Polling every ${intervalSeconds}s (batch=${this.maxItemsPerCycle})`,
    );

    const runLoop = async () => {
      if (!this.isRunning || this.polling) return;
      this.polling = true;

      try {
        const total = Number(await this.contract!.knowledgeCount());
        if (total === 0) return;

        const startId = Math.min(this.scanCursor, total);
        let scannedCount = 0;

        for (let offset = 0; offset < this.maxItemsPerCycle; offset++) {
          const i = ((startId - 1 + offset) % total) + 1;
          try {
            const raw = await this.contract!.getKnowledge(i);
            const item = parseKnowledgeItem(raw);
            scannedCount++;

            if (item.validated) continue;

            if (
              this.flowOrderResolved === 'execute-first' &&
              !item.executed
            )
              continue;
            if (
              this.flowOrderResolved === 'validate-first' &&
              item.executed
            )
              continue;

            const checks = {
              hasContent: !!item.content && item.content.length > 10,
              notSelfValidating:
                item.proposer.toLowerCase() !==
                this.walletAddress!.toLowerCase(),
              flowReady:
                this.flowOrderResolved === 'execute-first'
                  ? item.executed
                  : this.flowOrderResolved === 'validate-first'
                    ? !item.executed
                    : true,
            };

            const failed = Object.entries(checks)
              .filter(([, v]) => !v)
              .map(([k]) => k);

            if (failed.length > 0) {
              console.log(
                `[VALIDATOR] #${i} failed checks: ${failed.join(', ')}`,
              );
              continue;
            }

            console.log(
              `[VALIDATOR] #${i} passed all checks -- invoking agent`,
            );

            try {
              const result = await this.agentExecutor!.invoke({
                input: `Validate knowledge item #${i} with content: "${item.content.slice(0, 100)}". After validating on-chain, create a HIP-991 topic for it.`,
              });
              console.log(`[VALIDATOR] #${i}: ${result.output}`);
            } catch (execErr) {
              this.resolveFlowOrderFromError(
                execErr instanceof Error
                  ? execErr.message
                  : String(execErr),
              );
              console.log(
                `[VALIDATOR] #${i} tx failed: ${execErr instanceof Error ? execErr.message : 'unknown error'}`,
              );
            }
          } catch (err) {
            if (isRpcRateLimited(err)) {
              console.log(
                '[VALIDATOR] RPC rate limit detected. Pausing cycle.',
              );
              break;
            }
            console.log(
              `[VALIDATOR] Skip #${i}: ${err instanceof Error ? err.message : 'read failed'}`,
            );
          }
        }

        this.scanCursor =
          ((startId - 1 + this.maxItemsPerCycle) % total) + 1;
        console.log(
          `[VALIDATOR] Scanned ${scannedCount}/${total} items this cycle`,
        );
      } catch (error) {
        if (isRpcRateLimited(error)) {
          console.error('[VALIDATOR] Polling throttled by RPC provider');
          return;
        }
        console.error(
          '[VALIDATOR] Error in polling:',
          error instanceof Error ? error.message : error,
        );
      } finally {
        this.polling = false;
      }
    };

    await runLoop();
    setInterval(runLoop, intervalSeconds * 1000);
  }

  async stop(): Promise<void> {
    console.log('[VALIDATOR] Stopping...');
    this.isRunning = false;
  }
}
