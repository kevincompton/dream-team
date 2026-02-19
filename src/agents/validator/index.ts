import '../../common/suppress-warnings.js';
import { config } from 'dotenv';
import { ValidatorAgent } from './validator-agent.js';

config();

async function main(): Promise<void> {
  console.log('HIVE Validator Agent');
  console.log('====================');

  try {
    const agent = new ValidatorAgent();
    await agent.initialize();
    await agent.start();
  } catch (error) {
    console.error(
      'Failed to start Validator Agent:',
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}

main().catch(console.error);
