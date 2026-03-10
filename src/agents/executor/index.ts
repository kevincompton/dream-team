import '../../common/suppress-warnings.js';
import { config } from 'dotenv';
import { ExecutorAgent } from './executor-agent.js';

config();

async function main(): Promise<void> {
  console.log('HIVE Executor Agent');
  console.log('===================');

  try {
    const agent = new ExecutorAgent();
    await agent.initialize();
    await agent.start();
  } catch (error) {
    console.error(
      'Failed to start Executor Agent:',
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}

main().catch(console.error);
