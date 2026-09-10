import { EvidenceCard, supabase } from '../db.js';
import { parseArgs } from '../lib/cli.js';

interface SourceRow {
  id: string;
  name: string;
  platform: string;
  url: string;
}

interface ItemRow {
  id: string;
  source_id: string;
  platform_item_id: string | null;
  title: string | null;
  body: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface CandidateCard {
  item: ItemRow;
  category: string;
  summary: string;
  whyItMatters: string;
  reliability: 'high' | 'medium' | 'low' | 'unknown';
  suggestedExperiment?: string;
}

const CATEGORY_RULES = [
  {
    category: 'platform_monetization',
    pattern: /\b(subscription|subscriber|subs\b|ppv|paywall|refund|chargeback|price|paid|unlock)\b/i,
    whyItMatters: 'Signals monetization, platform economics, pricing, or buyer-friction patterns.',
    suggestedExperiment: 'Compare this against the target creator persona pricing, welcome-message, or retention assumptions.'
  },
  {
    category: 'workflow_automation',
    pattern: /\b(bot|automation|automate|ai bot|chatbot|crm|script|scrape|api|browser|proxy|sms|verification|warmup)\b/i,
    whyItMatters: 'Signals an operational workflow, automation tactic, or infrastructure bottleneck.',
    suggestedExperiment: 'Decide whether this belongs in manual playbook, intel monitoring, or future automation.'
  },
  {
    category: 'growth_distribution',
    pattern: /\b(snapchat|instagram|tinder|bumble|telegram|discord|facebook|x\b|twitter|traffic|lead|dm|outreach|account)\b/i,
    whyItMatters: 'Signals platform-specific acquisition, outreach, or distribution behavior.',
    suggestedExperiment: 'Map the pattern to one platform playbook before testing it with the target creator persona.'
  },
  {
    category: 'failure_case',
    pattern: /\b(error|doesn'?t work|not working|banned|blocked|refund|scam|fake|problem|issue|objection|frustrat|confus|called me out|broken)\b/i,
    whyItMatters: 'Failure reports and objections are useful for product risk, messaging, and playbook design.',
    suggestedExperiment: 'Turn this into an objection-handling or QA checklist item if repeated.'
  },
  {
    category: 'tool_comparison',
    pattern: /\b(runway|kling|comfyui|flux|sdxl|midjourney|seedance|replicate|fal|openrouter|youtube|vimeo|tutorial)\b/i,
    whyItMatters: 'Signals tools, tutorials, or implementation references worth comparing.',
    suggestedExperiment: 'Add the tool or tutorial to the next provider/workflow review queue.'
  }
];

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

function compactText(text: string, maxLength = 260): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 3)}...` : compact;
}

function reactionCount(metadata: Record<string, unknown> | null): number {
  const reactions = metadata?.reactions;
  if (!Array.isArray(reactions)) return 0;

  return reactions.reduce((sum, reaction) => {
    if (reaction && typeof reaction === 'object' && 'count' in reaction) {
      return sum + Number((reaction as { count?: unknown }).count ?? 0);
    }
    return sum;
  }, 0);
}

function hasPoll(metadata: Record<string, unknown> | null): boolean {
  return Boolean(metadata?.poll);
}

function hasLinks(metadata: Record<string, unknown> | null): boolean {
  return Number(metadata?.linkCount ?? 0) > 0;
}

function scoreItem(item: ItemRow): number {
  const metadata = item.metadata ?? {};
  let score = 0;
  score += Math.min(reactionCount(metadata), 20);
  if (hasPoll(metadata)) score += 8;
  if (hasLinks(metadata)) score += 5;
  if (item.body.length > 180) score += 2;
  if (metadata.messageType === 'service') score -= 6;
  return score;
}

function candidatesForItem(item: ItemRow): CandidateCard[] {
  const cards: CandidateCard[] = [];
  const text = `${item.title ?? ''}\n${item.body}`;
  const score = scoreItem(item);

  for (const rule of CATEGORY_RULES) {
    if (!rule.pattern.test(text)) continue;
    if (score < 2 && item.body.length < 80) continue;
    const reliability = score >= 10 ? 'medium' : 'low';
    cards.push({
      item,
      category: rule.category,
      summary: compactText(item.body),
      whyItMatters: rule.whyItMatters,
      reliability,
      suggestedExperiment: rule.suggestedExperiment
    });
  }

  return cards;
}

function sourceLooksStable(source: SourceRow): boolean {
  return source.platform !== 'TELEGRAM' || /^telegram-export:\/\/[^/]+\/[a-z0-9-]+$/.test(source.url);
}

async function loadSources(sourceName?: string, includeUnstableSources = false): Promise<SourceRow[]> {
  let query = supabase
    .from('sources')
    .select('id, name, platform, url')
    .order('created_at', { ascending: true });

  if (sourceName) query = query.ilike('name', `%${sourceName}%`);

  const { data, error } = await query;
  if (error) throw new Error(`[DB] Error loading sources: ${error.message}`);
  const sources = (data ?? []) as SourceRow[];
  return includeUnstableSources ? sources : sources.filter(sourceLooksStable);
}

async function loadItems(sourceId: string, limit: number): Promise<ItemRow[]> {
  const pageSize = 1000;
  const rows: ItemRow[] = [];

  for (let offset = 0; offset < limit; offset += pageSize) {
    const pageLimit = Math.min(pageSize, limit - offset);
    const { data, error } = await supabase
      .from('items')
      .select('id, source_id, platform_item_id, title, body, metadata, created_at')
      .eq('source_id', sourceId)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageLimit - 1);

    if (error) throw new Error(`[DB] Error loading items: ${error.message}`);
    rows.push(...((data ?? []) as ItemRow[]));
    if ((data ?? []).length < pageLimit) break;
  }

  return rows;
}

async function existingEvidenceKeys(itemIds: string[]): Promise<Set<string>> {
  if (itemIds.length === 0) return new Set();

  const rows: Array<{ item_id: string; category: string }> = [];
  for (let offset = 0; offset < itemIds.length; offset += 100) {
    const idBatch = itemIds.slice(offset, offset + 100);
    const { data, error } = await supabase
      .from('evidence_cards')
      .select('item_id, category')
      .in('item_id', idBatch);

    if (error) throw new Error(`[DB] Error loading existing evidence cards: ${error.message}`);
    rows.push(...((data ?? []) as Array<{ item_id: string; category: string }>));
  }

  return new Set(rows.map((row) => `${row.item_id}:${row.category}`));
}

async function insertEvidenceCards(cards: CandidateCard[], sourceById: Map<string, SourceRow>): Promise<number> {
  const existing = await existingEvidenceKeys(cards.map((card) => card.item.id));
  const payload: EvidenceCard[] = cards
    .filter((card) => !existing.has(`${card.item.id}:${card.category}`))
    .map((card) => {
      const source = sourceById.get(card.item.source_id);
      return {
        item_id: card.item.id,
        category: card.category,
        summary: sanitizeTextForDb(card.summary),
        why_it_matters: sanitizeTextForDb(card.whyItMatters),
        source_pointer: source
          ? sanitizeTextForDb(`${source.platform}:${source.name}:${card.item.platform_item_id ?? card.item.id}`)
          : sanitizeTextForDb(card.item.platform_item_id ?? card.item.id),
        reliability: card.reliability,
        privacy_level: 'private',
        suggested_experiment: card.suggestedExperiment ? sanitizeTextForDb(card.suggestedExperiment) : undefined,
        metadata: sanitizeJsonForDb({
          generatedBy: 'build-evidence-cards',
          sourceId: card.item.source_id,
          createdAt: card.item.created_at
        })
      };
    });

  if (payload.length === 0) return 0;

  const { error } = await supabase.from('evidence_cards').insert(payload);
  if (error) throw new Error(`[DB] Error inserting evidence cards: ${error.message} ${JSON.stringify(error)}`);
  return payload.length;
}

async function main() {
  const args = parseArgs();
  const isDryRun = args.flags.has('dry-run');
  const includeUnstableSources = args.flags.has('include-unstable-sources');
  const limit = Number(args.values.get('limit') ?? '500');
  const sourceFilter = args.values.get('source');

  const sources = await loadSources(sourceFilter, includeUnstableSources);
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const allCandidates: CandidateCard[] = [];

  for (const source of sources) {
    const items = await loadItems(source.id, limit);
    const candidates = items.flatMap(candidatesForItem);
    allCandidates.push(...candidates);
    console.log(`[Evidence] ${source.name}: ${items.length} items inspected, ${candidates.length} candidate cards`);
  }

  if (isDryRun) {
    console.log('[Evidence] Dry run only. No database rows written.');
    console.log(JSON.stringify(allCandidates.slice(0, 10).map((card) => ({
      source: sourceById.get(card.item.source_id)?.name,
      item: card.item.platform_item_id,
      category: card.category,
      reliability: card.reliability,
      summary: card.summary,
      suggestedExperiment: card.suggestedExperiment
    })), null, 2));
    return;
  }

  const inserted = await insertEvidenceCards(allCandidates, sourceById);
  console.log(`[Evidence] Inserted ${inserted} evidence cards`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
