import path from 'path';
import { parseArgs, readTextFile, requireValue, writeJsonFile } from '../lib/cli.js';

function main() {
  const args = parseArgs();
  const isDryRun = args.flags.has('dry-run');
  const itemId = requireValue(args, 'item-id');
  const file = requireValue(args, 'file');
  const method = args.values.get('method') ?? 'manual';
  const privacyLevel = args.values.get('privacy-level') ?? 'private';
  const text = readTextFile(file);

  const artifact = {
    itemId,
    artifactType: 'transcript',
    localPath: path.resolve(file),
    transcriptMethod: method,
    privacyLevel,
    characterCount: text.length,
    preview: text.slice(0, 240),
    createdAt: new Date().toISOString()
  };

  console.log(`[Transcript] Prepared transcript artifact for item ${itemId}`);
  console.log(`[Transcript] Method: ${method}; privacy: ${privacyLevel}; chars: ${text.length}`);

  if (isDryRun) {
    console.log('[Transcript] Dry run only. No files or database rows written.');
    console.log(JSON.stringify(artifact, null, 2));
    return;
  }

  writeJsonFile(`data/processed/transcript-${itemId}.json`, artifact);
  console.log(`[Transcript] Wrote data/processed/transcript-${itemId}.json`);
}

main();
