import { extractUrls, parseArgs, readTextFile, requireValue, writeJsonFile } from '../lib/cli.js';

function splitNotes(markdown: string) {
  const sections = markdown
    .split(/\n(?=#{1,3}\s+)/)
    .map((section) => section.trim())
    .filter(Boolean);

  if (sections.length > 0) return sections;
  return markdown
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter(Boolean);
}

function titleFromSection(section: string, index: number): string {
  const firstLine = section.split('\n')[0]?.replace(/^#{1,6}\s+/, '').trim();
  return firstLine || `Skool note ${index + 1}`;
}

function main() {
  const args = parseArgs();
  const file = requireValue(args, 'file');
  const isDryRun = args.flags.has('dry-run');
  const sourceName = args.values.get('source-name') ?? 'Skool Manual Notes';
  const raw = readTextFile(file);
  const sections = splitNotes(raw);

  const items = sections.map((section, index) => ({
    platform: 'SKOOL',
    sourceName,
    platformItemId: `skool-note-${index + 1}`,
    title: titleFromSection(section, index),
    body: section,
    urls: extractUrls(section),
    privacyLevel: 'paid',
    ingestionMethod: 'MANUAL_NOTES',
    createdAt: new Date().toISOString()
  }));

  console.log(`[Skool] Parsed ${items.length} manual note items from ${file}`);

  if (isDryRun) {
    console.log('[Skool] Dry run only. No files or database rows written.');
    console.log(JSON.stringify(items.slice(0, 3), null, 2));
    return;
  }

  writeJsonFile('data/processed/skool-note-items.json', { sourceName, items });
  console.log('[Skool] Wrote data/processed/skool-note-items.json');
}

main();
