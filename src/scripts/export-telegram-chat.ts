import fs from 'fs';
import path from 'path';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import input from 'input';
import dotenv from 'dotenv';
import { parseArgs, requireValue, slugify, writeJsonFile } from '../lib/cli.js';

dotenv.config();

interface ExportedTelegramMessage {
  id: number;
  date: string;
  text: string;
  senderId?: string;
  replyToMsgId?: number;
  groupedId?: string;
  urls: string[];
}

function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"')]+/gi) ?? [];
  return [...new Set(matches.map((url) => url.replace(/[.,;:!?]+$/, '')))];
}

function loadSession(sessionFile: string): string {
  if (process.env.TELEGRAM_SESSION) return process.env.TELEGRAM_SESSION;
  if (fs.existsSync(sessionFile)) return fs.readFileSync(sessionFile, 'utf8').trim();
  return '';
}

function saveSession(sessionFile: string, session: string): void {
  fs.mkdirSync(path.dirname(sessionFile), { recursive: true });
  fs.writeFileSync(sessionFile, session);
  fs.chmodSync(sessionFile, 0o600);
}

function entityLabel(entity: any): string {
  return [
    entity?.username,
    entity?.title,
    entity?.firstName,
    entity?.lastName,
    entity?.id?.toString()
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

async function resolveEntity(client: TelegramClient, chat: string) {
  try {
    return await client.getEntity(chat);
  } catch {
    // Private/group links are often not resolvable by URL alone.
  }

  const needle = chat.toLowerCase();
  for await (const dialog of client.iterDialogs({ limit: 500 })) {
    const label = entityLabel(dialog.entity);
    if (label.includes(needle)) return dialog.entity;
  }

  throw new Error(`Could not find Telegram chat matching "${chat}". Try the visible chat title or username.`);
}

async function main() {
  const args = parseArgs();
  const chat = requireValue(args, 'chat');
  const limit = Number(args.values.get('limit') ?? '500');
  const outDir = args.values.get('out-dir') ?? `data/raw/${slugify(`telegram-${chat}-${new Date().toISOString().slice(0, 10)}`)}`;
  const sessionFile = args.values.get('session-file') ?? 'data/raw/telegram.session';

  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH;
  if (!apiId || !apiHash) {
    throw new Error('Missing TELEGRAM_API_ID or TELEGRAM_API_HASH. Create credentials at https://my.telegram.org/apps and add them to .env.');
  }

  const client = new TelegramClient(new StringSession(loadSession(sessionFile)), apiId, apiHash, {
    connectionRetries: 5
  });

  await client.start({
    phoneNumber: async () => process.env.TELEGRAM_PHONE || input.text('Telegram phone number: '),
    password: async () => input.password('Telegram 2FA password, if enabled: '),
    phoneCode: async () => input.text('Telegram login code: '),
    onError: (error) => console.error('[Telegram] Login error:', error)
  });

  saveSession(sessionFile, client.session.save() as unknown as string);

  const entity = await resolveEntity(client, chat);
  const messages: ExportedTelegramMessage[] = [];

  for await (const message of client.iterMessages(entity, { limit })) {
    const text = message.message ?? '';
    messages.push({
      id: message.id,
      date: message.date ? new Date(message.date * 1000).toISOString() : new Date().toISOString(),
      text,
      senderId: message.senderId?.toString(),
      replyToMsgId: message.replyTo?.replyToMsgId,
      groupedId: message.groupedId?.toString(),
      urls: extractUrls(text)
    });
  }

  const exportPayload = {
    name: chat,
    type: 'telegram_chat_export',
    exportedAt: new Date().toISOString(),
    limit,
    messages: messages.reverse()
  };

  writeJsonFile(`${outDir}/result.json`, exportPayload);
  console.log(`[Telegram] Exported ${messages.length} messages to ${outDir}/result.json`);
  console.log(`[Telegram] Session saved to ${sessionFile} (ignored by git)`);

  await client.disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
