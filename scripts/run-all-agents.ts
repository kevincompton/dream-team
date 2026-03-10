import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { ethers } from 'ethers';
import { createHederaEvmProvider } from '../src/shared/hedera-rpc.js';
import { KNOWLEDGE_POOL_ABI } from '../src/common/contract.js';
import { HBAR_DECIMALS } from '../src/common/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, '..', '.env') });

const START_ORDER = [
  { name: 'executor', delayBeforeMs: 0 },
  { name: 'validator', delayBeforeMs: 15_000 },
  { name: 'proposer', delayBeforeMs: 10_000 },
];

const processes = new Map<string, ChildProcess>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startAgent(agentName: string): void {
  const entryPoint = path.join(__dirname, '..', 'src', 'agents', agentName, 'index.ts');

  const child = spawn('npx', ['tsx', entryPoint], {
    cwd: path.join(__dirname, '..'),
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const prefix = `[${agentName.toUpperCase()}]`;

  child.stdout!.on('data', (chunk: Buffer) => {
    process.stdout.write(`${prefix} ${chunk.toString()}`);
  });

  child.stderr!.on('data', (chunk: Buffer) => {
    process.stderr.write(`${prefix} ${chunk.toString()}`);
  });

  child.on('exit', (code, signal) => {
    const stoppedManually = process.env.__STOP_ALL_AGENTS__ === '1';
    console.log(`${prefix} process ended (code=${code ?? 'null'}, signal=${signal ?? 'null'})`);

    if (!stoppedManually) {
      console.log(`${prefix} restarting in 3s...`);
      setTimeout(() => startAgent(agentName), 3000);
    }
  });

  child.on('error', (error) => {
    console.error(`${prefix} startup error:`, error.message || error);
  });

  processes.set(agentName, child);
  console.log(`${prefix} started`);
}

async function main(): Promise<void> {
  console.log('Starting agents in controlled order...');
  console.log('1) Executor -> wait 15s');
  console.log('2) Validator -> wait 10s');
  console.log('3) Proposer\n');

  for (const step of START_ORDER) {
    if (step.delayBeforeMs > 0) {
      await sleep(step.delayBeforeMs);
    }
    startAgent(step.name);
  }

  const printStatusSnapshot = async (): Promise<void> => {
    try {
      if (!process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS) return;

      const provider = createHederaEvmProvider();
      const contract = new ethers.Contract(
        process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS,
        KNOWLEDGE_POOL_ABI,
        provider,
      );

      const count = Number(await contract.knowledgeCount());
      let completed = 0;
      let pending = 0;

      for (let id = 1; id <= count; id++) {
        try {
          const knowledge = await contract.getKnowledge(id);
          const validated = knowledge[3];
          const executed = knowledge[4];
          if (validated && executed) completed++;
          if (!executed) pending++;
        } catch (err: any) {
          console.log(`[STATUS] Skipping item ${id}: ${err?.shortMessage || err?.message || 'read failed'}`);
        }
      }

      const rewardPerTask = await contract.totalRewardPerTask();
      const distributedRaw = rewardPerTask * BigInt(completed);
      const distributed = ethers.formatUnits(distributedRaw, HBAR_DECIMALS);

      console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  HIVE STATUS SNAPSHOT
   Total requests: ${count}
   Completed (V:Y E:Y): ${completed}
   Pending execution: ${pending}
   $HIVE distributed: ${distributed}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
    } catch (error: any) {
      console.error('[STATUS] Error building snapshot:', error.message || error);
    }
  };

  await printStatusSnapshot();
  setInterval(printStatusSnapshot, 60_000);

  console.log('\nAll agents started with auto-restart. Ctrl+C to stop.');
}

process.on('SIGINT', () => {
  process.env.__STOP_ALL_AGENTS__ = '1';
  console.log('\nStopping agents...');
  for (const [, child] of processes) {
    child.kill('SIGINT');
  }
  setTimeout(() => process.exit(0), 500);
});

main().catch((error) => {
  console.error('Error in run-all-agents:', error instanceof Error ? error.message : error);
  process.exit(1);
});
