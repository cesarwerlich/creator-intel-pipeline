-- ============================================================
-- Ingestion Pipeline Schema Setup
-- Run this script in the Supabase SQL Editor.
-- This creates the 'intel' schema and all required tables.
-- ============================================================

-- Create schema if not exists
CREATE SCHEMA IF NOT EXISTS intel;

-- Create types if they do not exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE t.typname = 'platform' AND n.nspname = 'intel') THEN
        CREATE TYPE intel.platform AS ENUM ('REDDIT', 'DISCORD', 'SKOOL', 'TELEGRAM', 'YOUTUBE', 'VIMEO', 'MANUAL');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE t.typname = 'ingestion_method' AND n.nspname = 'intel') THEN
        CREATE TYPE intel.ingestion_method AS ENUM ('API', 'BROWSER_AUTOMATION', 'CLIPBOARD', 'EXPORT', 'MANUAL_NOTES', 'TRANSCRIPT', 'PUBLIC_METADATA');
    END IF;
END
$$;

-- Add enum values for older installations. These are no-ops when values already exist.
ALTER TYPE intel.platform ADD VALUE IF NOT EXISTS 'TELEGRAM';
ALTER TYPE intel.platform ADD VALUE IF NOT EXISTS 'YOUTUBE';
ALTER TYPE intel.platform ADD VALUE IF NOT EXISTS 'VIMEO';
ALTER TYPE intel.ingestion_method ADD VALUE IF NOT EXISTS 'EXPORT';
ALTER TYPE intel.ingestion_method ADD VALUE IF NOT EXISTS 'MANUAL_NOTES';
ALTER TYPE intel.ingestion_method ADD VALUE IF NOT EXISTS 'TRANSCRIPT';
ALTER TYPE intel.ingestion_method ADD VALUE IF NOT EXISTS 'PUBLIC_METADATA';

-- Create Sources table
CREATE TABLE IF NOT EXISTS intel.sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform intel.platform NOT NULL,
    name TEXT NOT NULL,
    url TEXT UNIQUE NOT NULL,
    access_type TEXT NOT NULL, -- 'public' | 'private' | 'paid'
    usefulness_score INTEGER DEFAULT 0, -- 1 to 10
    collection_method intel.ingestion_method NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create Items table
CREATE TABLE IF NOT EXISTS intel.items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES intel.sources(id) ON DELETE CASCADE,
    platform_item_id TEXT, -- post ID, comment ID, or message ID
    author_hash TEXT, -- anonymized author ID
    url TEXT,
    title TEXT,
    body TEXT NOT NULL,
    metadata JSONB, -- dynamic details like upvotes, shares
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    collected_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create Artifacts table
CREATE TABLE IF NOT EXISTS intel.artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES intel.sources(id) ON DELETE CASCADE,
    item_id UUID REFERENCES intel.items(id) ON DELETE CASCADE,
    artifact_type TEXT NOT NULL, -- raw_export, video_metadata, transcript, screenshot, normalized_file
    platform intel.platform,
    url TEXT,
    local_path TEXT,
    title TEXT,
    transcript_method TEXT, -- official_api, public_metadata, yt_dlp_subtitles, manual, unavailable
    privacy_level TEXT DEFAULT 'public' NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create Item Tags table
CREATE TABLE IF NOT EXISTS intel.item_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES intel.items(id) ON DELETE CASCADE,
    tag TEXT NOT NULL, -- e.g., 'visual_consistency', 'flux', 'kling'
    confidence REAL DEFAULT 1.0 NOT NULL,
    CONSTRAINT item_tags_item_id_tag_key UNIQUE (item_id, tag)
);

-- Create Findings table
CREATE TABLE IF NOT EXISTS intel.findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES intel.items(id) ON DELETE CASCADE,
    category TEXT NOT NULL, -- e.g., 'visual_consistency', 'monetization'
    claim TEXT NOT NULL,
    evidence_summary TEXT NOT NULL,
    usefulness_score INTEGER DEFAULT 0 NOT NULL,
    risk_notes TEXT,
    recommended_action TEXT,
    persona_version TEXT, -- e.g. 'persona-v2'
    exported_to_research_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create Evidence Cards table
CREATE TABLE IF NOT EXISTS intel.evidence_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES intel.items(id) ON DELETE CASCADE,
    finding_id UUID REFERENCES intel.findings(id) ON DELETE SET NULL,
    category TEXT NOT NULL,
    summary TEXT NOT NULL,
    why_it_matters TEXT NOT NULL,
    source_pointer TEXT,
    reliability TEXT DEFAULT 'unknown' NOT NULL,
    privacy_level TEXT DEFAULT 'public' NOT NULL,
    suggested_experiment TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    reviewed_at TIMESTAMPTZ
);

-- Enable updated_at trigger helper.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER set_sources_updated_at
    BEFORE UPDATE ON intel.sources
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_items_source_id ON intel.items(source_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_source_id ON intel.artifacts(source_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_item_id ON intel.artifacts(item_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_url ON intel.artifacts(url);
CREATE INDEX IF NOT EXISTS idx_item_tags_tag ON intel.item_tags(tag);
CREATE INDEX IF NOT EXISTS idx_findings_category ON intel.findings(category);
CREATE INDEX IF NOT EXISTS idx_findings_persona_version ON intel.findings(persona_version);
CREATE INDEX IF NOT EXISTS idx_evidence_cards_item_id ON intel.evidence_cards(item_id);
CREATE INDEX IF NOT EXISTS idx_evidence_cards_category ON intel.evidence_cards(category);

-- Supabase API grants. The `intel` schema must also be added to exposed
-- schemas in Supabase Dashboard > Project Settings > API before PostgREST
-- clients can query it.
GRANT USAGE ON SCHEMA intel TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA intel TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA intel TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA intel TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA intel GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA intel GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA intel GRANT SELECT ON TABLES TO anon;
