import '../../common/suppress-warnings.js';
import { config } from 'dotenv';
import { ProposerAgent } from './proposer-agent.js';

config();

async function main(): Promise<void> {
  console.log('HIVE Proposer Agent');
  console.log('===================');

  try {
    const agent = new ProposerAgent();
    await agent.initialize();
    await agent.start();
  } catch (error) {
    console.error(
      'Failed to start Proposer Agent:',
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}

main().catch(console.error);
