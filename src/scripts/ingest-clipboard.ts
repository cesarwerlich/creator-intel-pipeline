import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase, Source, Item } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get clipboard content using pbpaste on macOS
function getClipboardContent(): string {
  try {
    const stdout = execSync('pbpaste', { encoding: 'utf-8' });
    return stdout ? stdout.trim() : '';
  } catch (err) {
    return '';
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  
  // Parse command arguments
  const sourceNameIndex = args.indexOf('--name');
  const sourceName = sourceNameIndex !== -1 ? args[sourceNameIndex + 1] : 'Manual Clipboard Import';
  
  const sourceUrlIndex = args.indexOf('--url');
  const sourceUrl = sourceUrlIndex !== -1 ? args[sourceUrlIndex + 1] : `manual://clipboard-${Date.now()}`;

  console.log(`[Clipboard] Starting import...`);
  console.log(`[Clipboard] Source Name: ${sourceName}`);
  console.log(`[Clipboard] Source URL: ${sourceUrl}`);
  console.log(`[Clipboard] Mode: ${isDryRun ? 'DRY-RUN (Console only)' : 'DATABASE'}`);

  // Fetch text
  let content = getClipboardContent();
  
  if (!content) {
    console.log('[Clipboard] Clipboard is empty or pbpaste failed. Checking data/paste.txt...');
    const pasteFilePath = path.resolve(__dirname, '../../data/paste.txt');
    if (fs.existsSync(pasteFilePath)) {
      content = fs.readFileSync(pasteFilePath, 'utf-8').trim();
    }
  }

  if (!content) {
    console.error('Error: Clipboard is empty and no text was found in data/paste.txt');
    console.error('Copy some text to your clipboard or write to data/paste.txt, then try again.');
    process.exit(1);
  }

  console.log(`[Clipboard] Loaded text of length ${content.length} characters.`);
  console.log(`[Clipboard] Preview of text:\n"${content.substring(0, 180)}..."\n`);

  if (isDryRun) {
    console.log('[Clipboard] Dry run completed. No database writes performed.');
    process.exit(0);
  }

  // Find or create source
  let sourceId = '';
  const { data: source, error: findError } = await supabase
    .from('sources')
    .select('id')
    .eq('url', sourceUrl)
    .maybeSingle();

  if (findError) {
    console.error('[DB] Source search failed:', findError.message);
    process.exit(1);
  }

  if (source) {
    sourceId = source.id;
  } else {
    console.log(`[DB] Registering source: ${sourceName}...`);
    const { data: newSource, error: createError } = await supabase
      .from('sources')
      .insert({
        platform: 'MANUAL',
        name: sourceName,
        url: sourceUrl,
        access_type: 'private',
        usefulness_score: 8,
        collection_method: 'CLIPBOARD'
      })
      .select('id')
      .single();

    if (createError) {
      console.error('[DB] Error creating source:', createError.message);
      process.exit(1);
    }
    sourceId = newSource.id;
  }

  // Insert item into Database
  const itemPayload = {
    source_id: sourceId,
    platform_item_id: `manual-${Date.now()}`,
    author_hash: 'system-user',
    url: sourceUrl,
    title: sourceName,
    body: content,
    metadata: {
      importMethod: 'pbpaste_clipboard',
      importedAt: new Date().toISOString()
    },
    created_at: new Date().toISOString()
  };

  const { error: insertErr } = await supabase
    .from('items')
    .insert(itemPayload);

  if (insertErr) {
    console.error('[DB] Error inserting manual item:', insertErr.message);
    process.exit(1);
  }

  console.log('[DB] Successfully imported manual item to items table.');
}

main().catch(console.error);
