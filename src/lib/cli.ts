import fs from 'fs';
import path from 'path';

export interface CliArgs {
  flags: Set<string>;
  values: Map<string, string>;
}

export function parseArgs(argv = process.argv.slice(2)): CliArgs {
  const flags = new Set<string>();
  const values = new Map<string, string>();

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;

    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      values.set(key, next);
      i += 1;
    } else {
      flags.add(key);
    }
  }

  return { flags, values };
}

export function requireValue(args: CliArgs, key: string): string {
  const value = args.values.get(key);
  if (!value) {
    throw new Error(`Missing required --${key} value`);
  }
  return value;
}

export function readTextFile(filePath: string): string {
  return fs.readFileSync(path.resolve(filePath), 'utf8');
}

export function writeJsonFile(filePath: string, value: unknown): void {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`);
}

export function writeTextFile(filePath: string, value: string): void {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, value);
}

export function normalizeText(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) {
          return String((part as { text: unknown }).text);
        }
        return '';
      })
      .join('');
  }

  if (typeof value === 'string') return value;
  if (value == null) return '';
  return String(value);
}

export function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"')]+/gi) ?? [];
  return [...new Set(matches.map((url) => url.replace(/[.,;:!?]+$/, '')))];
}

export function classifyVideoUrl(url: string): 'YOUTUBE' | 'VIMEO' | 'OTHER' {
  const lower = url.toLowerCase();
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'YOUTUBE';
  if (lower.includes('vimeo.com')) return 'VIMEO';
  return 'OTHER';
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
