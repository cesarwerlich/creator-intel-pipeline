import { supabase } from '../db.js';

interface SourceRow {
  id: string;
  name: string;
  platform: string;
  url: string;
  created_at: string;
}

function groupBy<T>(items: T[], keyFor: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFor(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

async function countRows(table: string, sourceId: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('source_id', sourceId);

  if (error) throw new Error(`[DB] Error counting ${table}: ${error.message}`);
  return count ?? 0;
}

async function main() {
  const { data, error } = await supabase
    .from('sources')
    .select('id, name, platform, url, created_at')
    .order('created_at', { ascending: true });

  if (error) throw new Error(`[DB] Error loading sources: ${error.message}`);

  const sources = (data ?? []) as SourceRow[];
  const duplicateNameGroups = [...groupBy(sources, (source) => `${source.platform}:${source.name}`).entries()]
    .filter(([, rows]) => rows.length > 1);

  console.log(JSON.stringify({
    sourceCount: sources.length,
    duplicateNameGroups: duplicateNameGroups.map(([key, rows]) => ({
      key,
      sources: rows.map((source) => ({
        id: source.id,
        url: source.url,
        createdAt: source.created_at
      }))
    }))
  }, null, 2));

  for (const source of sources) {
    const [items, artifacts] = await Promise.all([
      countRows('items', source.id),
      countRows('artifacts', source.id)
    ]);

    const isStableTelegramUrl = source.platform !== 'TELEGRAM' || /^telegram-export:\/\/[^/]+\/[a-z0-9-]+$/.test(source.url);
    console.log(JSON.stringify({
      id: source.id,
      name: source.name,
      platform: source.platform,
      items,
      artifacts,
      sourceUrlLooksStable: isStableTelegramUrl,
      url: source.url
    }, null, 2));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
