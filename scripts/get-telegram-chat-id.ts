import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, '..', '.env') });

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk; });
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('Set TELEGRAM_BOT_TOKEN in .env first.');
    process.exit(1);
  }

  // A webhook (e.g. set by OpenClaw) blocks getUpdates — remove it first
  console.log('[TELEGRAM] Removing any active webhook...');
  const whResp = await httpsGet(`https://api.telegram.org/bot${token}/deleteWebhook`);
  const whJson = JSON.parse(whResp);
  if (whJson.ok) {
    console.log('[TELEGRAM] Webhook cleared.');
  } else {
    console.warn('[TELEGRAM] deleteWebhook:', whJson.description);
  }

  console.log('[TELEGRAM] Fetching recent updates...');
  console.log('[TELEGRAM] Make sure you have sent at least one message to the bot first.\n');

  const resp = await httpsGet(`https://api.telegram.org/bot${token}/getUpdates?limit=20`);
  const json = JSON.parse(resp);

  if (!json.ok) {
    console.error('Telegram API error:', json.description);
    process.exit(1);
  }

  const updates: Array<{ message?: { chat: { id: number; first_name?: string; username?: string; title?: string; type: string } } }> = json.result || [];

  if (updates.length === 0) {
    console.log('[TELEGRAM] No updates found. Send a message to your bot on Telegram first, then re-run.');
    return;
  }

  const seen = new Map<number, { id: number; name: string; type: string }>();
  for (const u of updates) {
    const chat = u.message?.chat;
    if (!chat) continue;
    if (!seen.has(chat.id)) {
      seen.set(chat.id, {
        id: chat.id,
        name: chat.title || chat.first_name || chat.username || 'unknown',
        type: chat.type,
      });
    }
  }

  console.log('[TELEGRAM] Found chats:\n');
  for (const [, chat] of seen) {
    console.log(`  Chat ID: ${chat.id}`);
    console.log(`  Name:    ${chat.name}`);
    console.log(`  Type:    ${chat.type}`);
    console.log('');
  }

  if (seen.size > 0) {
    const first = seen.values().next().value;
    console.log('--- Add to .env ---');
    console.log(`TELEGRAM_CHAT_ID=${first!.id}`);
    console.log('-------------------');
  }
}

main().catch((err) => {
  console.error('[TELEGRAM] Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
