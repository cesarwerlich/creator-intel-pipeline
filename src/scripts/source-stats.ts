import { supabase } from '../db.js';

async function countRows(table: string, column: string, value: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq(column, value);

  if (error) throw new Error(`[DB] Error counting ${table}: ${error.message}`);
  return count ?? 0;
}

async function countFindingsForSource(sourceId: string): Promise<number> {
  const itemIds: string[] = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const { data: items, error: itemError } = await supabase
      .from('items')
      .select('id')
      .eq('source_id', sourceId)
      .range(offset, offset + pageSize - 1);

    if (itemError) throw new Error(`[DB] Error loading source items: ${itemError.message}`);
    itemIds.push(...(items ?? []).map((item) => item.id));
    if ((items ?? []).length < pageSize) break;
  }

  if (itemIds.length === 0) return 0;

  let total = 0;
  for (let offset = 0; offset < itemIds.length; offset += 100) {
    const idBatch = itemIds.slice(offset, offset + 100);
    const { count, error } = await supabase
      .from('findings')
      .select('id', { count: 'exact', head: true })
      .in('item_id', idBatch);

    if (error) throw new Error(`[DB] Error counting findings: ${error.message}`);
    total += count ?? 0;
  }

  return total;
}

async function main() {
  const { data: sources, error } = await supabase
    .from('sources')
    .select('id, name, platform, access_type, collection_method, created_at')
    .order('created_at', { ascending: true });

  if (error) throw new Error(`[DB] Error loading sources: ${error.message}`);

  for (const source of sources ?? []) {
    const sourceId = String(source.id);
    const [items, artifacts, findings] = await Promise.all([
      countRows('items', 'source_id', sourceId),
      countRows('artifacts', 'source_id', sourceId),
      countFindingsForSource(sourceId)
    ]);

    console.log(JSON.stringify({
      id: sourceId,
      name: source.name,
      platform: source.platform,
      accessType: source.access_type,
      collectionMethod: source.collection_method,
      items,
      artifacts,
      findings
    }, null, 2));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
