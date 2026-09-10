import { EvidenceCard, Finding, supabase } from '../db.js';
import { parseArgs } from '../lib/cli.js';

interface SourceRow {
  id: string;
  name: string;
  platform: string;
  url: string;
}

interface EvidenceRow extends EvidenceCard {
  id: string;
  item_id: string;
  created_at?: string;
}

interface FindingRule {
  id: string;
  category: string;
  claim: string;
  evidenceSummaryPrefix: string;
  recommendedAction: string;
  riskNotes?: string;
  patterns: RegExp[];
  categories?: string[];
  minMatches: number;
}

const RULES: FindingRule[] = [
  {
    id: 'snapchat-account-supply',
    category: 'growth_distribution',
    claim: 'Operators treat Snapchat account supply and lock-rate as a core scaling constraint, with repeated demand for accounts that can absorb higher add volume without getting locked.',
    evidenceSummaryPrefix: 'Community evidence repeatedly mentions sourcing Snapchat accounts, acceptable add volume, and low lock-rate expectations as a gating factor for scale.',
    recommendedAction: 'Track account quality, lock rate, and add capacity as first-class variables in any Snapchat growth experiment.',
    riskNotes: 'Supplier quality is uneven and often mixed with scam risk.',
    patterns: [/locked quickly/i, /accept 150-200 adds/i, /\bbuying\b.*snap/i, /\bsoftreg\b/i, /\bsupplier\b/i, /\bno lock\b/i, /\blocked rate\b/i, /\badds a day\b/i],
    categories: ['growth_distribution', 'failure_case'],
    minMatches: 3
  },
  {
    id: 'reply-latency-scaling',
    category: 'workflow_automation',
    claim: 'Reply latency becomes an operational bottleneck as Snapchat add volume rises; teams report the bot falling behind and ask for controls that prioritize active conversations.',
    evidenceSummaryPrefix: 'Multiple evidence cards describe the bot lagging behind message volume, especially once adds and conversations scale up.',
    recommendedAction: 'Instrument reply-latency and queue depth before scaling traffic, and test priority logic for active or high-value chats.',
    riskNotes: 'Slow reply loops can reduce conversion and make the automation feel visibly artificial.',
    patterns: [/wait several hours/i, /keep up with the messages/i, /took too long to respond/i, /priority chatting/i, /\b700 adds\b/i, /\bstuck\b/i],
    categories: ['workflow_automation', 'failure_case'],
    minMatches: 2
  },
  {
    id: 'snapchat-web-limitations',
    category: 'workflow_automation',
    claim: 'Snapchat web leaves detectable traces and missing capabilities, creating both user objections and operational limits for browser-based automation.',
    evidenceSummaryPrefix: 'Evidence points to Snapchat web being detectable and missing key actions such as full media handling, which directly surfaces in objections.',
    recommendedAction: 'Treat Snapchat web as a constrained execution surface and design objection handling plus QA checks around web-specific tells.',
    riskNotes: 'Web-surface constraints can cap automation quality even when messaging logic improves.',
    patterns: [/snapchat web/i, /web version/i, /open their snaps from web/i, /send videos/i, /accepting friends.*web/i],
    categories: ['workflow_automation', 'growth_distribution', 'failure_case'],
    minMatches: 3
  },
  {
    id: 'conversion-depends-on-creative-and-settings',
    category: 'workflow_automation',
    claim: 'Conversion problems are discussed as a creative-and-settings issue, not just a traffic issue; poor snaps, bad defaults, and weak prompt settings are treated as fixable causes of low CR.',
    evidenceSummaryPrefix: 'Release notes and troubleshooting messages connect low conversion rates to snap quality and bot configuration rather than raw traffic volume alone.',
    recommendedAction: 'Version prompt/settings bundles and snap assets together so conversion troubleshooting can isolate what changed.',
    patterns: [/\bcr\b/i, /poor conversion/i, /uploaded snaps are poor/i, /abismal settings/i, /default settings/i, /common objections/i],
    categories: ['workflow_automation', 'growth_distribution', 'platform_monetization'],
    minMatches: 3
  },
  {
    id: 'link-integrity-and-platform-support',
    category: 'platform_monetization',
    claim: 'Link integrity and platform support are brittle: operators report wrong monetization links, link replacement bugs, and limitations when trying to use alternate monetization platforms.',
    evidenceSummaryPrefix: 'Evidence cards show monetization links are both mission-critical and error-prone, with support gaps beyond the default platform workflow.',
    recommendedAction: 'Add link validation, link-change alerts, and explicit support rules for non-default monetization platforms before live traffic runs.',
    riskNotes: 'Broken or wrong links create direct revenue loss and trust damage.',
    patterns: [/\bmonetization link\b/i, /changed my (monetization|payment) link/i, /price is expired/i, /can't enter my link/i, /subscription/i],
    categories: ['platform_monetization', 'workflow_automation', 'failure_case'],
    minMatches: 3
  },
  {
    id: 'geo-persona-consistency',
    category: 'failure_case',
    claim: 'Automation breaks cover when persona facts drift from profile or travel-mode context, especially on dating-platform style workflows where age and city details are checked directly.',
    evidenceSummaryPrefix: 'Several cards describe the bot leaking the wrong age or city when users test travel-mode or profile consistency.',
    recommendedAction: 'Add persona-consistency checks for age, city, timezone, and platform-specific context before any dating-playbook automation is trusted.',
    riskNotes: 'Persona drift creates immediate user suspicion and can trigger reports or bans.',
    patterns: [/travel mode/i, /bumble was created in/i, /random age/i, /where im from/i, /city the bumble/i],
    categories: ['workflow_automation', 'growth_distribution', 'failure_case'],
    minMatches: 2
  },
  {
    id: 'tinder-vs-bumble-traffic',
    category: 'growth_distribution',
    claim: 'Traffic discussion is weighted toward Tinder and Snapchat over Bumble; Bumble is repeatedly framed as harder to scale or less attractive operationally.',
    evidenceSummaryPrefix: 'Evidence cards compare Tinder and Bumble directly, with Tinder discussed as easier for volume and Bumble as more operationally frustrating.',
    recommendedAction: 'Prioritize Tinder-adjacent traffic assumptions in the next outbound experiments and treat Bumble as a separate playbook with its own economics.',
    patterns: [/tinder is main source of traffic/i, /tinder is way easier than bumble/i, /super boost/i, /bumble doesnt care/i, /virtual card payment methods for bumble/i],
    categories: ['growth_distribution'],
    minMatches: 3
  },
  {
    id: 'supplier-scam-risk',
    category: 'failure_case',
    claim: 'The supplier market around accounts, proxies, and growth inputs is scam-heavy, so vendor validation is a repeated operating need rather than an edge case.',
    evidenceSummaryPrefix: 'Multiple cards describe scammers, unreliable sellers, and broken supplier promises around accounts and proxy-adjacent services.',
    recommendedAction: 'Create a vendor-validation checklist and keep supplier decisions separate from core growth experiments.',
    riskNotes: 'Bad suppliers waste time, contaminate experiments, and can poison account health.',
    patterns: [/scammer/i, /anti scam/i, /dont buy/i, /supplier/i, /proxy supplier/i, /promises u email and proxy/i],
    categories: ['failure_case', 'workflow_automation', 'growth_distribution'],
    minMatches: 3
  }
];

function normalizeForDedupe(value: string): string {
  return value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function usefulnessScore(matchCount: number, hasMediumReliability: boolean): number {
  const base = Math.min(10, 4 + matchCount);
  return hasMediumReliability ? Math.min(10, base + 1) : base;
}

async function loadSourcesById(): Promise<Map<string, SourceRow>> {
  const { data, error } = await supabase.from('sources').select('id, name, platform, url');
  if (error) throw new Error(`[DB] Error loading sources: ${error.message}`);
  return new Map(((data ?? []) as SourceRow[]).map((source) => [source.id, source]));
}

async function loadEvidence(limit: number): Promise<EvidenceRow[]> {
  const rows: EvidenceRow[] = [];
  const pageSize = 1000;

  for (let offset = 0; offset < limit; offset += pageSize) {
    const pageLimit = Math.min(pageSize, limit - offset);
    const { data, error } = await supabase
      .from('evidence_cards')
      .select('id, item_id, finding_id, category, summary, why_it_matters, source_pointer, reliability, privacy_level, suggested_experiment, metadata, created_at, reviewed_at')
      .is('finding_id', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageLimit - 1);

    if (error) throw new Error(`[DB] Error loading evidence cards: ${error.message}`);
    rows.push(...((data ?? []) as EvidenceRow[]));
    if ((data ?? []).length < pageLimit) break;
  }

  return rows;
}

async function existingFindingClaims(): Promise<Set<string>> {
  const { data, error } = await supabase.from('findings').select('claim');
  if (error) throw new Error(`[DB] Error loading findings: ${error.message}`);
  return new Set((data ?? []).map((row) => String(row.claim)));
}

async function resetFindings(isDryRun: boolean): Promise<void> {
  const { data: linkedCards, error: linkedError } = await supabase
    .from('evidence_cards')
    .select('id')
    .not('finding_id', 'is', null);

  if (linkedError) throw new Error(`[Findings] Error loading linked evidence cards: ${linkedError.message}`);

  if (isDryRun) {
    console.log(`[Findings] Dry run: would unlink ${(linkedCards ?? []).length} evidence cards and delete existing findings.`);
    return;
  }

  const linkedIds = (linkedCards ?? []).map((row) => String(row.id));
  for (let offset = 0; offset < linkedIds.length; offset += 100) {
    const idBatch = linkedIds.slice(offset, offset + 100);
    const { error: unlinkError } = await supabase
      .from('evidence_cards')
      .update({ finding_id: null, reviewed_at: null })
      .in('id', idBatch);

    if (unlinkError) throw new Error(`[Findings] Error unlinking evidence cards: ${unlinkError.message}`);
  }

  const { error: deleteError } = await supabase.from('findings').delete().not('id', 'is', null);
  if (deleteError) throw new Error(`[Findings] Error deleting existing findings: ${deleteError.message}`);
}

function matchesRule(card: EvidenceRow, rule: FindingRule): boolean {
  if (rule.categories && !rule.categories.includes(card.category)) return false;
  return rule.patterns.some((pattern) => pattern.test(card.summary));
}

function dedupeCards(cards: EvidenceRow[]): EvidenceRow[] {
  const seen = new Set<string>();
  const unique: EvidenceRow[] = [];

  for (const card of cards) {
    const key = `${card.category}:${normalizeForDedupe(card.summary)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(card);
  }

  return unique;
}

async function insertFinding(
  finding: Finding,
  evidenceIds: string[],
  isDryRun: boolean
): Promise<string | null> {
  if (isDryRun) return null;

  const { data, error } = await supabase.from('findings').insert(finding).select('id').single();
  if (error || !data?.id) {
    throw new Error(`[DB] Error inserting finding: ${error?.message ?? 'unknown error'}`);
  }

  const reviewedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('evidence_cards')
    .update({ finding_id: data.id, reviewed_at: reviewedAt })
    .in('id', evidenceIds);

  if (updateError) {
    throw new Error(`[DB] Error linking evidence cards to finding: ${updateError.message}`);
  }

  return String(data.id);
}

async function main() {
  const args = parseArgs();
  const isDryRun = args.flags.has('dry-run');
  const replaceExisting = args.flags.has('replace-existing');
  const limit = Number(args.values.get('limit') ?? '5000');
  const maxFindings = Number(args.values.get('max-findings') ?? '12');
  const personaVersion = args.values.get('persona-version') ?? 'creator-community-v1';

  if (replaceExisting) {
    await resetFindings(isDryRun);
  }

  const [evidence, loadedClaims] = await Promise.all([
    loadEvidence(limit),
    existingFindingClaims()
  ]);
  const existingClaims = replaceExisting ? new Set<string>() : loadedClaims;

  const results: Array<Record<string, unknown>> = [];
  let inserted = 0;

  for (const rule of RULES) {
    if (results.length >= maxFindings) break;
    if (existingClaims.has(rule.claim)) continue;

    const matched = dedupeCards(
      evidence
        .filter((card) => matchesRule(card, rule))
        .sort((left, right) => {
          const reliabilityScore = (value?: string) => (value === 'medium' ? 2 : value === 'high' ? 3 : 1);
          return reliabilityScore(right.reliability) - reliabilityScore(left.reliability);
        })
    );

    if (matched.length < rule.minMatches) continue;

    const selected = matched.slice(0, 6);
    const hasMediumReliability = selected.some((card) => card.reliability === 'medium' || card.reliability === 'high');
    const sourcePointers = [...new Set(selected.map((card) => card.source_pointer).filter(Boolean))] as string[];
    const evidenceSummary = `${rule.evidenceSummaryPrefix} Representative pointers: ${sourcePointers.join('; ')}`;
    const itemId = selected[0]?.item_id;
    if (!itemId) continue;

    const finding: Finding = {
      item_id: itemId,
      category: rule.category,
      claim: rule.claim,
      evidence_summary: evidenceSummary,
      usefulness_score: usefulnessScore(selected.length, hasMediumReliability),
      risk_notes: rule.riskNotes,
      recommended_action: rule.recommendedAction,
      persona_version: personaVersion
    };

    const findingId = await insertFinding(
      finding,
      selected.map((card) => card.id),
      isDryRun
    );

    results.push({
      rule: rule.id,
      category: rule.category,
      claim: rule.claim,
      usefulnessScore: finding.usefulness_score,
      evidenceCount: selected.length,
      sourcePointers,
      findingId
    });
    inserted += 1;
  }

  console.log(`[Findings] Evaluated ${evidence.length} evidence cards`);
  if (isDryRun) {
    console.log('[Findings] Dry run only. No database rows written.');
  }
  console.log(`[Findings] ${inserted} findings ${isDryRun ? 'would be inserted' : 'inserted'}`);
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
