import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env file');
}

// Create a Supabase client pre-configured to point to the 'intel' schema
export const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'intel',
  },
});

// Helper types matching our SQL schema
export interface Source {
  id?: string;
  platform: 'REDDIT' | 'DISCORD' | 'SKOOL' | 'TELEGRAM' | 'YOUTUBE' | 'VIMEO' | 'MANUAL';
  name: string;
  url: string;
  access_type: string;
  usefulness_score?: number;
  collection_method: 'API' | 'BROWSER_AUTOMATION' | 'CLIPBOARD' | 'EXPORT' | 'MANUAL_NOTES' | 'TRANSCRIPT' | 'PUBLIC_METADATA';
  created_at?: string;
  updated_at?: string;
}

export interface Item {
  id?: string;
  source_id: string;
  platform_item_id?: string;
  author_hash?: string;
  url?: string;
  title?: string;
  body: string;
  metadata?: any;
  created_at?: string;
  collected_at?: string;
}

export interface ItemTag {
  id?: string;
  item_id: string;
  tag: string;
  confidence?: number;
}

export interface Finding {
  id?: string;
  item_id: string;
  category: string;
  claim: string;
  evidence_summary: string;
  usefulness_score: number;
  risk_notes?: string;
  recommended_action?: string;
  persona_version?: string;
  exported_to_research_at?: string;
  created_at?: string;
}

export interface Artifact {
  id?: string;
  source_id?: string;
  item_id?: string;
  artifact_type: 'raw_export' | 'video_metadata' | 'transcript' | 'screenshot' | 'normalized_file';
  platform?: Source['platform'];
  url?: string;
  local_path?: string;
  title?: string;
  transcript_method?: 'official_api' | 'public_metadata' | 'yt_dlp_subtitles' | 'manual' | 'unavailable';
  privacy_level?: 'public' | 'internal' | 'private' | 'paid';
  metadata?: any;
  created_at?: string;
}

export interface EvidenceCard {
  id?: string;
  item_id: string;
  finding_id?: string;
  category: string;
  summary: string;
  why_it_matters: string;
  source_pointer?: string;
  reliability?: 'high' | 'medium' | 'low' | 'unknown';
  privacy_level?: 'public' | 'internal' | 'private' | 'paid';
  suggested_experiment?: string;
  metadata?: any;
  created_at?: string;
  reviewed_at?: string;
}
