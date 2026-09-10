import { supabase } from '../db.js';
import { parseArgs, slugify, writeJsonFile, writeTextFile } from '../lib/cli.js';

function markdownList(items: string[]): string {
  if (items.length === 0) return '- None yet.\n';
  return items.map((item) => `- ${item}`).join('\n') + '\n';
}

function compactText(value: string, max = 220): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.length > max ? `${compact.slice(0, max - 3)}...` : compact;
}

async function loadFindings(limit: number) {
  const { data, error } = await supabase
    .from('findings')
    .select('id, item_id, category, claim, evidence_summary, usefulness_score, risk_notes, recommended_action, persona_version, exported_to_research_at, created_at')
    .order('usefulness_score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`[Weekly Brief] Error loading findings: ${error.message}`);
  return data ?? [];
}

async function loadSourceRegister() {
  const { data, error } = await supabase
    .from('sources')
    .select('platform, name, url, access_type, usefulness_score, collection_method')
    .order('created_at', { ascending: true });

  if (error) throw new Error(`[Weekly Brief] Error loading sources: ${error.message}`);
  return data ?? [];
}

async function main() {
  const args = parseArgs();
  const isDryRun = args.flags.has('dry-run');
  const markExported = args.flags.has('mark-exported');
  const week = args.values.get('week') ?? new Date().toISOString().slice(0, 10);
  const limit = Number(args.values.get('limit') ?? '20');
  const title = `Community Intel Brief - ${week}`;
  const slug = `${week}-community-intel`;
  const outDir = `exports/research-briefs/${slugify(slug)}`;
  const [findings, sourceRegisterRows] = await Promise.all([loadFindings(limit), loadSourceRegister()]);

  const findingsPayload = findings.map((finding) => {
    const sourcePointers = (finding.evidence_summary.match(/TELEGRAM:[^;]+:\d+/g) ?? []).slice(0, 6);
    return {
      category: finding.category,
      claim: finding.claim,
      evidenceSummary: compactText(finding.evidence_summary),
      confidence: finding.usefulness_score >= 9 ? 'high' : finding.usefulness_score >= 7 ? 'medium' : 'low',
      sourcePointers,
      recommendedAction: finding.recommended_action ?? 'Review manually.',
      personaVersion: finding.persona_version ?? undefined,
      privacyLevel: 'private'
    };
  });

  const sourceRegister = sourceRegisterRows
    .filter((source) => !/%2FUsers%2F/i.test(source.url))
    .map((source) => ({
      platform: source.platform,
      name: source.name,
      url: source.url,
      accessType: source.access_type,
      reliability: source.usefulness_score >= 8 ? 'medium' : 'low',
      notes: `Collection method: ${source.collection_method}. Sanitized export only.`
    }));

  const experiments = findings
    .filter((finding) => finding.recommended_action)
    .slice(0, 10)
    .map((finding) => ({
      title: `${finding.category} - ${compactText(finding.claim, 72)}`,
      reason: compactText(finding.evidence_summary, 140),
      nextStep: finding.recommended_action,
      relatedFindingCategories: [finding.category]
    }));

  const brief = {
    id: slug,
    weekOf: week,
    title,
    summary: findingsPayload.length === 0
      ? 'No reviewed findings available yet.'
      : `Sanitized brief built from ${findingsPayload.length} reviewed findings across imported community sources.`,
    findings: findingsPayload,
    sourceRegister,
    suggestedExperiments: experiments,
    privacyNotes: 'Raw private and paid-community content remains local-only in creator-intel-pipeline and is not exported.'
  };

  const readme = `# ${title}

## Summary

${brief.summary}

## Findings

${markdownList(findingsPayload.map((finding) => `${finding.category}: ${finding.claim}`))}
## Risks / Caveats

- This export scaffold contains no raw private or paid-community content.
- Add only summarized evidence, source pointers, and recommended experiments.

## Decisions Suggested

${markdownList(experiments.map((experiment) => experiment.nextStep))}
## Open Questions

- Which findings should become creator persona workflow experiments?
`;

  const sourceRegisterMarkdown = `# Source Register - ${week}

## Notes

- Private and paid source material must be summarized before export.
- Use source names and pointers, not raw private message dumps.

${markdownList(sourceRegister.map((source) => `${source.platform} / ${source.name} / ${source.accessType} / ${source.reliability}`))}
`;

  const suggestedExperiments = `# Suggested Experiments - ${week}

${markdownList(experiments.map((experiment) => `${experiment.title}: ${experiment.nextStep}`))}
`;

  console.log(`[Weekly Brief] Prepared sanitized export scaffold for ${week}`);
  console.log(`[Weekly Brief] Target: ${outDir}`);

  if (isDryRun) {
    console.log('[Weekly Brief] Dry run only. No files written.');
    console.log(JSON.stringify(brief, null, 2));
    return;
  }

  writeTextFile(`${outDir}/README.md`, readme);
  writeJsonFile(`${outDir}/findings.json`, brief);
  writeTextFile(`${outDir}/source-register.md`, sourceRegisterMarkdown);
  writeTextFile(`${outDir}/suggested-experiments.md`, suggestedExperiments);

  if (markExported && findings.length > 0) {
    const exportedAt = new Date().toISOString();
    const { error } = await supabase
      .from('findings')
      .update({ exported_to_research_at: exportedAt })
      .in('id', findings.map((finding) => finding.id));
    if (error) throw new Error(`[Weekly Brief] Error marking findings exported: ${error.message}`);
  }

  console.log(`[Weekly Brief] Wrote ${outDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
