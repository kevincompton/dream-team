import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const agents = ['proposer', 'executor', 'validator'];

console.log('Starting HIVE Protocol agents...');

agents.forEach((agentName) => {
  const entryPoint = path.join(__dirname, '..', 'src', 'agents', agentName, 'index.ts');
  const agentProcess = spawn('npx', ['tsx', entryPoint], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    shell: true,
  });

  agentProcess.on('error', (error) => {
    console.error(`Error starting agent ${agentName}:`, error);
  });

  console.log(`Agent ${agentName} started`);
});

console.log('\nAll agents running. Press Ctrl+C to stop.');
