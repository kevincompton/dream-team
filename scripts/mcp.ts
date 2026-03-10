import http from 'http';
import https from 'https';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { ethers } from 'ethers';
import {
  Client as HederaClient,
  AccountId,
  PrivateKey,
  TopicMessageSubmitTransaction,
  TopicId,
} from '@hashgraph/sdk';
import { createHederaEvmProvider } from '../src/shared/hedera-rpc.js';
import { KNOWLEDGE_POOL_ABI } from '../src/common/contract.js';
import { HBAR_DECIMALS, shortAddress, formatHcs10Message } from '../src/common/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, '..', '.env') });

const MCP_PORT = Number(process.env.MCP_PORT || 3001);

const START_ORDER = [
  { name: 'executor', delayBeforeMs: 0 },
  { name: 'validator', delayBeforeMs: 15_000 },
  { name: 'proposer', delayBeforeMs: 10_000 },
];

const processes = new Map<string, ChildProcess>();
const agentLogState = new Map<string, { lastLine: string; lastAt: number; suppressed: number }>();

const PROPOSER_ABI = [
  'function proposeKnowledge(string memory content) public returns (uint256)',
  'event KnowledgeProposed(uint256 indexed id, address indexed proposer, string content)',
];
const KNOWLEDGE_ABI = [
  'function getKnowledge(uint256 id) public view returns (address, string memory, uint256, bool, bool, address, address)',
];

let lastKnownStatus: Record<string, unknown> = {
  connected: false,
  contractAddress: process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS || null,
  knowledgeCount: 0,
  poolBalance: '0',
  recentItems: [],
  stale: true,
  updatedAt: new Date().toISOString(),
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldPrintAgentLine(agentName: string, line: string): boolean {
  const now = Date.now();
  const state = agentLogState.get(agentName) ?? {
    lastLine: '',
    lastAt: 0,
    suppressed: 0,
  };

  const trimmed = line.trim();
  if (!trimmed) {
    agentLogState.set(agentName, state);
    return false;
  }

  const noisy =
    trimmed === '.' ||
    /Scanned \d+\/\d+ items/i.test(trimmed) ||
    /Scan complete/i.test(trimmed) ||
    /Loop complete/i.test(trimmed) ||
    /passed all checks/i.test(trimmed) ||
    /execution reverted: "Knowledge must be executed first"/i.test(trimmed);

  const dedupeWindowMs = noisy ? 60_000 : 12_000;
  if (state.lastLine === trimmed && now - state.lastAt < dedupeWindowMs) {
    state.suppressed += 1;
    state.lastAt = now;
    agentLogState.set(agentName, state);
    return false;
  }

  if (state.suppressed > 0) {
    console.log(`[${agentName.toUpperCase()}] (suppressed ${state.suppressed} repetitive lines)`);
    state.suppressed = 0;
  }

  state.lastLine = trimmed;
  state.lastAt = now;
  agentLogState.set(agentName, state);
  return true;
}

function pipeAgentOutput(agentName: string, chunk: Buffer, stream: NodeJS.WriteStream): void {
  const prefix = `[${agentName.toUpperCase()}]`;
  const lines = chunk.toString().replace(/\r/g, '').split('\n');

  for (const line of lines) {
    const normalized = line.replace(/^\s*\[[A-Z]+\]\s*/i, '').trim();
    if (!normalized) continue;
    if (!shouldPrintAgentLine(agentName, normalized)) continue;
    stream.write(`${prefix} ${normalized}\n`);
  }
}

function startAgent(agentName: string): void {
  const entryPoint = path.join(__dirname, '..', 'src', 'agents', agentName, 'index.ts');

  const child = spawn('npx', ['tsx', entryPoint], {
    cwd: path.join(__dirname, '..'),
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout!.on('data', (chunk: Buffer) => {
    pipeAgentOutput(agentName, chunk, process.stdout);
  });

  child.stderr!.on('data', (chunk: Buffer) => {
    pipeAgentOutput(agentName, chunk, process.stderr);
  });

  const prefix = `[${agentName.toUpperCase()}]`;

  child.on('exit', (code, signal) => {
    const stoppedManually = process.env.__STOP_ALL_AGENTS__ === '1';
    const proposerAutoDisabled =
      agentName === 'proposer' && Number(process.env.PROPOSER_INTERVAL_SECONDS || 60) <= 0;
    console.log(`${prefix} process ended (code=${code ?? 'null'}, signal=${signal ?? 'null'})`);

    if (!stoppedManually) {
      if (proposerAutoDisabled && (code === 0 || code === null)) {
        console.log(`${prefix} auto-proposer disabled, not restarting.`);
        return;
      }
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

async function startAgentsInOrder(): Promise<void> {
  console.log('[MCP] Starting agents in controlled order...');
  console.log('[MCP] 1) Executor -> wait 15s');
  console.log('[MCP] 2) Validator -> wait 10s');
  console.log('[MCP] 3) Proposer');

  for (const step of START_ORDER) {
    if (step.delayBeforeMs > 0) {
      await sleep(step.delayBeforeMs);
    }
    startAgent(step.name);
  }
}

async function getChainStatus(): Promise<Record<string, unknown>> {
  if (!process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS) {
    return {
      connected: false,
      error: 'KNOWLEDGE_POOL_CONTRACT_ADDRESS is not configured',
      knowledgeCount: 0,
      poolBalance: '0',
      recentItems: [],
    };
  }

  const provider = createHederaEvmProvider();
  const contract = new ethers.Contract(
    process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS,
    KNOWLEDGE_POOL_ABI,
    provider,
  );

  const [knowledgeCountBn, poolBalanceBn] = await Promise.all([
    contract.knowledgeCount(),
    contract.poolBalance(),
  ]);
  const knowledgeCount = Number(knowledgeCountBn);
  const poolBalance = ethers.formatUnits(poolBalanceBn, HBAR_DECIMALS);

  const recentItems: Record<string, unknown>[] = [];
  const fromId = Math.max(1, knowledgeCount - 4);

  for (let id = fromId; id <= knowledgeCount; id++) {
    const [proposer, content, timestamp, validated, executed, validator, executor] =
      await contract.getKnowledge(id);
    recentItems.push({
      id,
      content,
      timestamp: Number(timestamp),
      validated,
      executed,
      proposer: shortAddress(proposer),
      validator: shortAddress(validator),
      executor: shortAddress(executor),
    });
  }

  const status = {
    connected: true,
    contractAddress: process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS,
    knowledgeCount,
    poolBalance,
    recentItems,
    stale: false,
    updatedAt: new Date().toISOString(),
  };

  lastKnownStatus = status;
  return status;
}

async function spawnResearchRequest(question: string): Promise<{ txHash: string; knowledgeId: number | null }> {
  if (!question || String(question).trim().length === 0) {
    throw new Error('Question is required');
  }
  if (!process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS) {
    throw new Error('KNOWLEDGE_POOL_CONTRACT_ADDRESS is not configured');
  }

  const proposerKey = process.env.PROPOSER_PRIVATE_KEY || process.env.HEDERA_PRIVATE_KEY;
  if (!proposerKey) {
    throw new Error('PROPOSER_PRIVATE_KEY (or HEDERA_PRIVATE_KEY fallback) is not configured');
  }

  const provider = createHederaEvmProvider();
  const wallet = new ethers.Wallet(proposerKey, provider);
  const iface = new ethers.Interface(PROPOSER_ABI);
  const contract = new ethers.Contract(process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS, iface, wallet);

  const tx = await contract.proposeKnowledge(String(question).trim());
  const receipt = await tx.wait();

  let knowledgeId: number | null = null;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === 'KnowledgeProposed') {
        knowledgeId = Number(parsed.args[0]);
        break;
      }
    } catch {
      // skip unparseable logs
    }
  }

  console.log(`[MCP] Research request submitted. Knowledge ID: ${knowledgeId ?? 'unknown'}. TX: ${receipt.hash}`);
  console.log(`[MCP] https://hashscan.io/testnet/tx/${receipt.hash}`);

  return { txHash: receipt.hash, knowledgeId };
}

async function waitForKnowledgeResult(
  knowledgeId: number,
  timeoutMs = 120_000,
): Promise<{ content: string; validated: boolean; executed: boolean } | null> {
  const provider = createHederaEvmProvider();
  const contract = new ethers.Contract(
    process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS!,
    KNOWLEDGE_ABI,
    provider,
  );

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await sleep(4_000);
    try {
      const [, content, , validated, executed] = await contract.getKnowledge(knowledgeId);
      if (executed) {
        console.log(`[MCP] Knowledge #${knowledgeId} fully settled.`);
        return { content, validated, executed };
      }
      console.log(`[MCP] Knowledge #${knowledgeId} pending (validated=${validated}, executed=${executed})...`);
    } catch (err: any) {
      console.log(`[MCP] Poll error for #${knowledgeId}: ${err?.shortMessage || err?.message}`);
    }
  }
  return null;
}

// ─── HIP-1215 Device Command Bridge (Mirror Node → Telegram) ────

const DEVICE_COMMAND_TOPIC0 = ethers.id('DeviceCommand(uint256,string)');
const MIRROR_BASE = process.env.HEDERA_NETWORK === 'mainnet'
  ? 'https://mainnet.mirrornode.hedera.com'
  : 'https://testnet.mirrornode.hedera.com';
const PULSE_POLL_MS = 10_000;
let lastPulseTimestamp = `${Math.floor(Date.now() / 1000)}.000000000`;

function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        } else {
          resolve(data);
        }
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

function httpPost(url: string, body: Record<string, unknown>): Promise<string> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const parsed = new URL(url);
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk; });
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

interface DeviceCommandEvent {
  commandId: number;
  command: string;
}

function decodeDeviceCommand(log: { topics: string[]; data: string }): DeviceCommandEvent | null {
  try {
    const commandId = Number(BigInt(log.topics[1]));
    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['string'], log.data);
    return { commandId, command: decoded[0] as string };
  } catch (err) {
    console.warn('[DEVICE-BRIDGE] Decode error:', err instanceof Error ? err.message : err);
    return null;
  }
}

async function sendTelegramMessage(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const resp = await httpPost(url, { chat_id: chatId, text });
    const result = JSON.parse(resp);
    if (!result.ok) {
      console.warn('[DEVICE-BRIDGE] Telegram API error:', result.description);
    }
  } catch (err) {
    console.warn('[DEVICE-BRIDGE] Telegram send failed:', err instanceof Error ? err.message : err);
  }
}

function parseSdkKey(key: string): PrivateKey {
  const trimmed = key.trim();
  if (trimmed.startsWith('0x') || /^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return PrivateKey.fromStringECDSA(trimmed);
  }
  try {
    return PrivateKey.fromStringDer(trimmed);
  } catch {
    return PrivateKey.fromString(trimmed);
  }
}

async function sendHcsMessage(topicId: string, message: string): Promise<void> {
  const accountId = process.env.HEDERA_ACCOUNT_ID;
  const privateKey = process.env.HEDERA_PRIVATE_KEY;
  if (!accountId || !privateKey || !topicId) return;

  try {
    const network = process.env.HEDERA_NETWORK || 'testnet';
    const client = network === 'mainnet' ? HederaClient.forMainnet() : HederaClient.forTestnet();
    client.setOperator(AccountId.fromString(accountId), parseSdkKey(privateKey));

    const hcs10Payload = formatHcs10Message({
      operatorTopicId: topicId,
      operatorAccountId: accountId,
      senderAccountId: accountId,
      value: message,
    });

    const tx = await new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(topicId))
      .setMessage(hcs10Payload)
      .execute(client);

    const receipt = await tx.getReceipt(client);
    console.log(`[DEVICE-BRIDGE] HCS-10 message sent to ${topicId} (seq: ${receipt.topicSequenceNumber})`);
  } catch (err) {
    console.warn('[DEVICE-BRIDGE] HCS send failed:', err instanceof Error ? err.message : err);
  }
}

async function pollDeviceCommands(): Promise<void> {
  const contractAddr = process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS;
  if (!contractAddr) return;

  const timestampFilter = lastPulseTimestamp ? `&timestamp=gt:${lastPulseTimestamp}` : '';
  const url = `${MIRROR_BASE}/api/v1/contracts/${contractAddr}/results/logs?order=asc&limit=25${timestampFilter}`;

  try {
    const body = await httpGet(url);
    const json = JSON.parse(body);
    const allLogs: Array<{ topics: string[]; data: string; timestamp: string }> = json.logs || [];
    const logs = allLogs.filter((l) => l.topics[0] === DEVICE_COMMAND_TOPIC0);

    if (logs.length > 0) {
      console.log(`[DEVICE-BRIDGE] Found ${logs.length} DeviceCommand event(s)`);
    }

    for (const log of logs) {
      const evt = decodeDeviceCommand(log);
      if (!evt) continue;

      lastPulseTimestamp = log.timestamp;
      console.log(`[DEVICE-BRIDGE] #${evt.commandId}: "${evt.command}"`);

      const sensorInboundTopic = process.env.SENSOR_INBOUND_TOPIC_ID;
      if (evt.command === 'request sensor summary') {
        const knowledgeInboundTopic = process.env.KNOWLEDGE_INBOUND_TOPIC_ID;
        if (knowledgeInboundTopic) {
          await sendHcsMessage(knowledgeInboundTopic, 'Provide a summary of today\'s sensor data readings');
        }
      } else if (sensorInboundTopic) {
        await sendHcsMessage(sensorInboundTopic, evt.command);
      }
    }
  } catch (err) {
    console.warn('[DEVICE-BRIDGE] Poll error:', err instanceof Error ? err.message : err);
  }
}

let pulsePoller: ReturnType<typeof setInterval> | null = null;

function startPulseBridge(): void {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const contract = process.env.KNOWLEDGE_POOL_CONTRACT_ADDRESS;

  if (!contract) {
    console.log('[DEVICE-BRIDGE] No contract address — bridge disabled');
    return;
  }

  if (!token || !chatId) {
    console.log('[DEVICE-BRIDGE] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing — bridge will only log (no Telegram forwarding)');
  }

  console.log(`[DEVICE-BRIDGE] Polling Mirror Node every ${PULSE_POLL_MS / 1000}s for DeviceCommand events`);
  pulsePoller = setInterval(pollDeviceCommands, PULSE_POLL_MS);
  pollDeviceCommands();
}

// ─── HTTP Server ────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/research-request') {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk; });
    req.on('end', async () => {
      try {
        const { question, userId } = JSON.parse(body || '{}');
        console.log(`[MCP] Research Request from ${userId || 'unknown'}: ${question}`);
        const { txHash } = await spawnResearchRequest(question);
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'accepted', message: `Research request queued: "${question}"`, txHash }));
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ status: 'error', error: error instanceof Error ? error.message : 'Invalid request' }));
      }
    });
  } else if (req.method === 'POST' && req.url === '/research') {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk; });
    req.on('end', async () => {
      try {
        const { question, userId } = JSON.parse(body || '{}');
        if (!question) throw new Error('question is required');
        console.log(`[MCP] Blocking research from ${userId || 'openclaw'}: ${question}`);

        const { txHash, knowledgeId } = await spawnResearchRequest(question);

        if (!knowledgeId) {
          res.writeHead(200);
          res.end(JSON.stringify({ status: 'accepted', message: 'Submitted but could not track ID.', txHash }));
          return;
        }

        const result = await waitForKnowledgeResult(knowledgeId);

        if (result) {
          res.writeHead(200);
          res.end(JSON.stringify({ status: 'completed', knowledgeId, content: result.content, txHash }));
        } else {
          res.writeHead(200);
          res.end(JSON.stringify({ status: 'timeout', knowledgeId, txHash, message: 'Still processing. Check /status.' }));
        }
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ status: 'error', error: error instanceof Error ? error.message : 'Invalid request' }));
      }
    });
  } else if (req.method === 'GET' && req.url === '/status') {
    try {
      const status = await getChainStatus();
      res.writeHead(200);
      res.end(JSON.stringify(status));
    } catch (error) {
      const fallback = {
        ...lastKnownStatus,
        connected: false,
        stale: true,
        error: error instanceof Error ? error.message : 'Status retrieval failed',
      };
      res.writeHead(200);
      res.end(JSON.stringify(fallback));
    }
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

async function main(): Promise<void> {
  try {
    await getChainStatus();
  } catch {
    // warm cache best effort
  }

  await startAgentsInOrder();
  startPulseBridge();

  server.listen(MCP_PORT, () => {
    console.log(`[MCP] Master Control Program listening on port ${MCP_PORT}`);
    console.log(`[MCP] OpenClaw endpoint: http://localhost:${MCP_PORT}/research-request`);
  });

  process.on('SIGINT', () => {
    process.env.__STOP_ALL_AGENTS__ = '1';
    console.log('\n[MCP] Stopping agents and server...');
    if (pulsePoller) clearInterval(pulsePoller);
    for (const [, child] of processes) {
      child.kill('SIGINT');
    }
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 800);
  });
}

main().catch((error) => {
  console.error('[MCP] Fatal error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
