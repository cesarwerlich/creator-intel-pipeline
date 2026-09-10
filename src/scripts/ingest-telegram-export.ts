import crypto from 'crypto';
import path from 'path';
import { Artifact, Source, supabase } from '../db.js';
import { extractUrls, normalizeText, parseArgs, readTextFile, requireValue, slugify, writeJsonFile } from '../lib/cli.js';

interface TelegramMessage {
  id?: number | string;
  type?: string;
  date?: string;
  date_unixtime?: string;
  from?: string;
  from_id?: string;
  actor?: string;
  actor_id?: string;
  action?: string;
  title?: string;
  new_title?: string;
  text?: unknown;
  text_entities?: Array<{ type?: string; text?: string; href?: string }>;
  inline_bot_buttons?: Array<Array<{ type?: string; text?: string; data?: string }>>;
  reply_to_message_id?: number | string;
  edited?: string;
  edited_unixtime?: string;
  reactions?: unknown;
  forwarded_from?: string | null;
  forwarded_from_id?: string;
  poll?: unknown;
  author?: string;
  media_type?: string;
  mime_type?: string;
  file_name?: string;
  file_size?: number;
  photo?: string;
  photo_file_size?: number;
  width?: number;
  height?: number;
  duration_seconds?: number;
}

interface TelegramExportInfo {
  name?: string;
  type?: string;
  id?: number | string;
  messages?: TelegramMessage[];
}

interface ParsedTelegramItem {
  platformItemId: string;
  title: string;
  body: string;
  createdAt: string;
  authorPointer: string;
  urls: string[];
  messageType: string;
  topicTitle?: string;
  metadata: Record<string, unknown>;
  privacyLevel: 'private';
  ingestionMethod: 'EXPORT';
}

interface ImportStats {
  sourceId: string;
  itemsSeen: number;
  itemsInserted: number;
  itemsExisting: number;
  linkArtifactsInserted: number;
}

const ITEM_BATCH_SIZE = 250;
const LOOKUP_BATCH_SIZE = 100;
const MEDIA_FIELDS = [
  'media_type',
  'mime_type',
  'file_name',
  'file_size',
  'photo_file_size',
  'width',
  'height',
  'duration_seconds'
] as const;

function hashAuthor(author: string): string {
  return crypto.createHash('sha256').update(author).digest('hex').substring(0, 16);
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function parseTelegramExport(raw: string): TelegramExportInfo {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { messages: parsed };
    if (Array.isArray(parsed.messages)) return parsed;
  } catch {
    // Fall through to plain-text import.
  }

  return {
    name: 'Plain Text Telegram Export',
    type: 'plain_text',
    messages: raw
      .split(/\n{2,}/)
      .map((chunkText, index) => ({
        id: `plain-${index + 1}`,
        text: chunkText.trim(),
        date: new Date().toISOString()
      }))
      .filter((message) => normalizeText(message.text).length > 0)
  };
}

function extractEntityUrls(message: TelegramMessage): string[] {
  const urls: string[] = [];

  for (const entity of message.text_entities ?? []) {
    if (entity.href) urls.push(entity.href);
    if (entity.text) urls.push(...extractUrls(entity.text));
  }

  for (const row of message.inline_bot_buttons ?? []) {
    for (const button of row) {
      if (button.type === 'url' && button.data) urls.push(button.data);
      if (button.text) urls.push(...extractUrls(button.text));
      if (button.data) urls.push(...extractUrls(button.data));
    }
  }

  return urls;
}

function messageHasMediaMetadata(message: TelegramMessage): boolean {
  return Boolean(message.photo || message.file_name || message.file_size || message.media_type || message.mime_type);
}

function mediaMetadata(message: TelegramMessage): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};

  for (const field of MEDIA_FIELDS) {
    if (message[field] !== undefined) metadata[field] = message[field];
  }

  metadata.hasPhoto = Boolean(message.photo);
  metadata.hasFile = Boolean(message.file_name || message.file_size || message.media_type || message.mime_type);
  metadata.fileIncluded = message.photo !== '(File not included. Change data exporting settings to download.)'
    && message.file_name !== '(File not included. Change data exporting settings to download.)';
  return metadata;
}

function sanitizeTextForDb(value: string): string {
  let sanitized = '';
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    const nextCode = value.charCodeAt(index + 1);

    if (code === 0) continue;
    if (code >= 0xd800 && code <= 0xdbff) {
      if (nextCode >= 0xdc00 && nextCode <= 0xdfff) {
        sanitized += value[index] + value[index + 1];
        index += 1;
      }
      continue;
    }
    if (code >= 0xdc00 && code <= 0xdfff) continue;
    sanitized += value[index];
  }
  return sanitized;
}

function sanitizeJsonForDb(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (typeof value === 'string') return sanitizeTextForDb(value);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value === null || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeJsonForDb(item))
      .filter((item) => item !== undefined);
  }
  if (typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, objectValue] of Object.entries(value)) {
      const sanitizedValue = sanitizeJsonForDb(objectValue);
      if (sanitizedValue !== undefined) sanitized[sanitizeTextForDb(key)] = sanitizedValue;
    }
    return sanitized;
  }
  return null;
}

function serviceBody(message: TelegramMessage): string {
  if (!message.action) return '';
  const title = message.title ?? message.new_title;
  return title ? `[service:${message.action}] ${title}` : `[service:${message.action}]`;
}

function mediaBody(message: TelegramMessage): string {
  if (!messageHasMediaMetadata(message)) return '';
  const mediaType = message.media_type ?? (message.photo ? 'photo' : 'file');
  const fileName = message.file_name ? ` ${message.file_name}` : '';
  return `[media:${mediaType}]${fileName}`;
}

function toParsedItem(message: TelegramMessage): ParsedTelegramItem | null {
  const textBody = normalizeText(message.text).trim();
  const body = textBody || serviceBody(message) || mediaBody(message);
  if (!body) return null;
  const urls = [...new Set([...extractUrls(body), ...extractEntityUrls(message)])];
  const topicTitle = message.action === 'topic_created' ? message.title : undefined;
  const metadata: Record<string, unknown> = {
    messageType: message.type,
    action: message.action,
    topicTitle,
    replyToMessageId: message.reply_to_message_id,
    edited: message.edited,
    editedUnixtime: message.edited_unixtime,
    reactions: message.reactions,
    forwardedFrom: message.forwarded_from,
    forwardedFromId: message.forwarded_from_id,
    poll: message.poll,
    author: message.author,
    textEntityTypes: [...new Set((message.text_entities ?? []).map((entity) => entity.type).filter(Boolean))],
    inlineButtonCount: (message.inline_bot_buttons ?? []).flat().length
  };

  if (messageHasMediaMetadata(message)) {
    metadata.media = mediaMetadata(message);
  }

  return {
    platformItemId: String(message.id ?? ''),
    title: (topicTitle ?? body).slice(0, 100),
    body,
    createdAt: message.date ?? new Date().toISOString(),
    authorPointer: message.from_id ?? message.from ?? message.actor_id ?? message.actor ?? 'telegram-user',
    urls,
    messageType: message.type ?? 'message',
    topicTitle,
    metadata,
    privacyLevel: 'private',
    ingestionMethod: 'EXPORT'
  };
}

function legacySourceUrlForFile(sourceName: string, file: string): string {
  return `telegram-export://${encodeURIComponent(sourceName)}/${encodeURIComponent(path.resolve(file))}`;
}

function sourceUrlForExport(sourceName: string, exportInfo: TelegramExportInfo): string {
  const exportId = exportInfo.id ? String(exportInfo.id) : 'unknown';
  return `telegram-export://${encodeURIComponent(exportId)}/${slugify(sourceName)}`;
}

async function updateSourceUrl(sourceId: string, url: string): Promise<Source> {
  const { data, error } = await supabase
    .from('sources')
    .update({ url })
    .eq('id', sourceId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`[DB] Error updating Telegram source URL: ${error?.message ?? 'unknown error'}`);
  }

  return data as Source;
}

async function findOrCreateSource(sourceName: string, file: string, exportInfo: TelegramExportInfo): Promise<Source> {
  const url = sourceUrlForExport(sourceName, exportInfo);
  const { data: existing, error: findError } = await supabase
    .from('sources')
    .select('*')
    .eq('url', url)
    .maybeSingle();

  if (findError) {
    throw new Error(`[DB] Error looking up Telegram source: ${findError.message}`);
  }

  if (existing) return existing as Source;

  // Earlier imports used the local file path as source identity. If this export
  // already exists under that legacy URL, promote it to the stable source URL.
  const legacyUrl = legacySourceUrlForFile(sourceName, file);
  const { data: legacyExisting, error: legacyFindError } = await supabase
    .from('sources')
    .select('*')
    .eq('url', legacyUrl)
    .maybeSingle();

  if (legacyFindError) {
    throw new Error(`[DB] Error looking up legacy Telegram source: ${legacyFindError.message}`);
  }

  if (legacyExisting?.id) {
    return updateSourceUrl(String(legacyExisting.id), url);
  }

  const { data: created, error: createError } = await supabase
    .from('sources')
    .insert({
      platform: 'TELEGRAM',
      name: sourceName,
      url,
      access_type: 'private',
      usefulness_score: 8,
      collection_method: 'EXPORT'
    })
    .select('*')
    .single();

  if (createError || !created) {
    throw new Error(`[DB] Error creating Telegram source: ${createError?.message ?? 'unknown error'}`);
  }

  return created as Source;
}

async function ensureRawExportArtifact(sourceId: string, file: string, itemCount: number, linkCount: number): Promise<void> {
  const localPath = path.resolve(file);
  const { data: existing, error: findError } = await supabase
    .from('artifacts')
    .select('id')
    .eq('source_id', sourceId)
    .eq('artifact_type', 'raw_export')
    .eq('local_path', localPath)
    .maybeSingle();

  if (findError) {
    throw new Error(`[DB] Error checking raw export artifact: ${findError.message}`);
  }

  if (existing) return;

  const payload: Artifact = {
    source_id: sourceId,
    artifact_type: 'raw_export',
    platform: 'TELEGRAM',
    local_path: localPath,
    title: path.basename(localPath),
    privacy_level: 'private',
    metadata: {
      itemCount,
      linkCount
    }
  };

  const { error: insertError } = await supabase.from('artifacts').insert(payload);
  if (insertError) {
    throw new Error(`[DB] Error inserting raw export artifact: ${insertError.message}`);
  }
}

async function fetchExistingPlatformItemIds(sourceId: string, platformItemIds: string[]): Promise<Set<string>> {
  const existingIds = new Set<string>();

  for (const idBatch of chunk(platformItemIds, LOOKUP_BATCH_SIZE)) {
    const { data, error } = await supabase
      .from('items')
      .select('platform_item_id')
      .eq('source_id', sourceId)
      .in('platform_item_id', idBatch);

    if (error) {
      throw new Error(`[DB] Error checking existing Telegram items: ${error.message}`);
    }

    for (const row of data ?? []) {
      if (row.platform_item_id) existingIds.add(String(row.platform_item_id));
    }
  }

  return existingIds;
}

async function insertItems(sourceId: string, items: ParsedTelegramItem[], existingIds: Set<string>): Promise<number> {
  let inserted = 0;
  const newItems = items.filter((item) => !existingIds.has(item.platformItemId));

  for (const itemBatch of chunk(newItems, ITEM_BATCH_SIZE)) {
    const payload = itemBatch.map((item) => ({
      source_id: sourceId,
      platform_item_id: item.platformItemId,
      author_hash: hashAuthor(item.authorPointer),
      title: sanitizeTextForDb(item.title),
      body: sanitizeTextForDb(item.body),
      metadata: sanitizeJsonForDb({
        authorPointer: item.authorPointer,
        privacyLevel: item.privacyLevel,
        ingestionMethod: item.ingestionMethod,
        linkCount: item.urls.length,
        ...item.metadata
      }),
      created_at: item.createdAt
    }));

    const { error } = await supabase.from('items').insert(payload);
    if (error) {
      const firstId = itemBatch[0]?.platformItemId ?? 'unknown';
      const lastId = itemBatch[itemBatch.length - 1]?.platformItemId ?? 'unknown';
      throw new Error(
        `[DB] Error inserting Telegram items ${firstId}-${lastId}: ${error.message} ${JSON.stringify(error)}`
      );
    }

    inserted += itemBatch.length;
  }

  return inserted;
}

async function fetchItemIdsByPlatformIds(sourceId: string, platformItemIds: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  for (const idBatch of chunk(platformItemIds, LOOKUP_BATCH_SIZE)) {
    const { data, error } = await supabase
      .from('items')
      .select('id, platform_item_id')
      .eq('source_id', sourceId)
      .in('platform_item_id', idBatch);

    if (error) {
      throw new Error(`[DB] Error fetching Telegram item ids: ${error.message}`);
    }

    for (const row of data ?? []) {
      if (row.platform_item_id) result.set(String(row.platform_item_id), String(row.id));
    }
  }

  return result;
}

async function fetchExistingArtifactUrls(itemIds: string[]): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();

  for (const itemIdBatch of chunk(itemIds, LOOKUP_BATCH_SIZE)) {
    const { data, error } = await supabase
      .from('artifacts')
      .select('item_id, url')
      .eq('artifact_type', 'video_metadata')
      .in('item_id', itemIdBatch);

    if (error) {
      throw new Error(`[DB] Error checking existing link artifacts: ${error.message}`);
    }

    for (const row of data ?? []) {
      const itemId = String(row.item_id);
      const urls = map.get(itemId) ?? new Set<string>();
      if (row.url) urls.add(String(row.url));
      map.set(itemId, urls);
    }
  }

  return map;
}

function artifactPlatformForUrl(url: string): Artifact['platform'] {
  if (/youtube\.com|youtu\.be/i.test(url)) return 'YOUTUBE';
  if (/vimeo\.com/i.test(url)) return 'VIMEO';
  return 'MANUAL';
}

async function insertLinkArtifacts(sourceId: string, items: ParsedTelegramItem[], itemIdByPlatformId: Map<string, string>): Promise<number> {
  const existingArtifactUrls = await fetchExistingArtifactUrls([...itemIdByPlatformId.values()]);
  const payload: Artifact[] = [];

  for (const item of items) {
    const itemId = itemIdByPlatformId.get(item.platformItemId);
    if (!itemId) continue;

    const knownUrls = existingArtifactUrls.get(itemId) ?? new Set<string>();
    for (const url of item.urls) {
      if (knownUrls.has(url)) continue;
      knownUrls.add(url);
      existingArtifactUrls.set(itemId, knownUrls);

      payload.push({
        source_id: sourceId,
        item_id: itemId,
        artifact_type: 'video_metadata',
        platform: artifactPlatformForUrl(url),
        url,
        title: item.title,
        transcript_method: 'unavailable',
        privacy_level: item.privacyLevel,
        metadata: {
          importedFrom: 'telegram_export',
          sourcePlatform: 'TELEGRAM'
        }
      });
    }
  }

  if (payload.length === 0) return 0;

  for (const artifactBatch of chunk(payload, ITEM_BATCH_SIZE)) {
    const { error } = await supabase.from('artifacts').insert(artifactBatch);
    if (error) {
      throw new Error(`[DB] Error inserting Telegram link artifacts: ${error.message}`);
    }
  }

  return payload.length;
}

async function syncTelegramItems(
  sourceName: string,
  file: string,
  exportInfo: TelegramExportInfo,
  items: ParsedTelegramItem[],
  allLinks: string[]
): Promise<ImportStats> {
  const source = await findOrCreateSource(sourceName, file, exportInfo);
  const sourceId = String(source.id);
  await ensureRawExportArtifact(sourceId, file, items.length, allLinks.length);

  const existingIds = await fetchExistingPlatformItemIds(
    sourceId,
    items.map((item) => item.platformItemId)
  );
  const itemsInserted = await insertItems(sourceId, items, existingIds);
  const itemIdByPlatformId = await fetchItemIdsByPlatformIds(
    sourceId,
    items.map((item) => item.platformItemId)
  );
  const linkArtifactsInserted = await insertLinkArtifacts(sourceId, items, itemIdByPlatformId);

  return {
    sourceId,
    itemsSeen: items.length,
    itemsInserted,
    itemsExisting: existingIds.size,
    linkArtifactsInserted
  };
}

async function main() {
  const args = parseArgs();
  const file = requireValue(args, 'file');
  const isDryRun = args.flags.has('dry-run');
  const sourceName = args.values.get('source-name') ?? 'Telegram Export';
  const limit = Number(args.values.get('limit') ?? '0');
  const raw = readTextFile(file);
  const exportInfo = parseTelegramExport(raw);
  const messages = exportInfo.messages ?? [];
  const resolvedSourceName = args.values.get('source-name') ?? exportInfo.name ?? sourceName;

  const items = messages
    .map((message) => toParsedItem(message))
    .filter((item): item is ParsedTelegramItem => Boolean(item));

  const selectedItems = limit > 0 ? items.slice(0, limit) : items;
  const allLinks = [...new Set(selectedItems.flatMap((item) => item.urls))];
  const videoLinks = allLinks.filter((url) => /youtu\.be|youtube\.com|vimeo\.com/i.test(url));

  console.log(`[Telegram] Parsed ${selectedItems.length} items from ${file}`);
  console.log(`[Telegram] Source: ${resolvedSourceName}`);
  if (limit > 0) {
    console.log(`[Telegram] Import limited to first ${limit} parsed items`);
  }
  console.log(`[Telegram] Found ${allLinks.length} total links`);
  console.log(`[Telegram] Found ${videoLinks.length} YouTube/Vimeo links`);

  if (isDryRun) {
    console.log('[Telegram] Dry run only. No files or database rows written.');
    console.log(JSON.stringify(selectedItems.slice(0, 3), null, 2));
    return;
  }

  const stats = await syncTelegramItems(resolvedSourceName, file, exportInfo, selectedItems, allLinks);
  writeJsonFile('data/processed/telegram-items.json', {
    sourceName: resolvedSourceName,
    exportInfo: {
      name: exportInfo.name,
      type: exportInfo.type,
      id: exportInfo.id,
      originalMessageCount: messages.length
    },
    items: selectedItems,
    allLinks,
    videoLinks,
    stats
  });
  console.log('[Telegram] Wrote data/processed/telegram-items.json');
  console.log(`[Telegram] Synced source ${stats.sourceId} to Supabase`);
  console.log(`[Telegram] Items seen: ${stats.itemsSeen}`);
  console.log(`[Telegram] Items inserted: ${stats.itemsInserted}`);
  console.log(`[Telegram] Items already present: ${stats.itemsExisting}`);
  console.log(`[Telegram] Link artifacts inserted: ${stats.linkArtifactsInserted}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
