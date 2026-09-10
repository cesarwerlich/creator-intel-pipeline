import { classifyVideoUrl, extractUrls, parseArgs, readTextFile, requireValue, writeJsonFile } from '../lib/cli.js';

function bodyText(input: unknown): string {
  if (typeof input === 'string') return input;
  if (Array.isArray(input)) return input.map(bodyText).join('\n');
  if (input && typeof input === 'object') {
    const record = input as Record<string, unknown>;
    return [record.title, record.body, record.text, record.summary].filter(Boolean).map(String).join('\n');
  }
  return '';
}

function main() {
  const args = parseArgs();
  const file = requireValue(args, 'file');
  const isDryRun = args.flags.has('dry-run');
  const raw = readTextFile(file);

  let parsed: unknown = raw;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Plain text is supported.
  }

  const records = Array.isArray(parsed) ? parsed : [parsed];
  const links = records.flatMap((record, index) => {
    const text = bodyText(record);
    return extractUrls(text).map((url) => ({
      sourceIndex: index,
      url,
      platform: classifyVideoUrl(url)
    }));
  });

  const videoLinks = links.filter((link) => link.platform !== 'OTHER');
  console.log(`[Links] Found ${links.length} total links in ${file}`);
  console.log(`[Links] Found ${videoLinks.length} YouTube/Vimeo links`);

  if (isDryRun) {
    console.log('[Links] Dry run only. No files or database rows written.');
    console.log(JSON.stringify(links, null, 2));
    return;
  }

  writeJsonFile('data/processed/links.json', { links, videoLinks, extractedAt: new Date().toISOString() });
  console.log('[Links] Wrote data/processed/links.json');
}

main();
