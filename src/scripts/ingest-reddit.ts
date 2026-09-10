import axios from 'axios';
import { supabase, Source, Item } from '../db.js';
import crypto from 'crypto';

// Hash function to anonymize author names for compliance/privacy
function hashAuthor(author: string): string {
  return crypto.createHash('sha256').update(author).digest('hex').substring(0, 16);
}

// Fetch subreddit posts
async function fetchSubreddit(subreddit: string, limit = 15): Promise<any[]> {
  const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}`;
  console.log(`[Reddit] Fetching JSON from: ${url}`);
  
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    
    if (response.data && response.data.data && response.data.data.children) {
      return response.data.data.children;
    }
    throw new Error('Invalid JSON structure returned by Reddit');
  } catch (error: any) {
    console.error(`[Reddit] Error fetching /r/${subreddit}:`, error.message);
    if (error.response) {
      console.error(`[Reddit] Response Status: ${error.response.status}`);
    }
    return [];
  }
}

// Main execution block
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const targetSubreddits = ['comfyui', 'StableDiffusion', 'aivideo', 'runwayml'];
  
  console.log(`[Reddit] Starting crawler. Mode: ${isDryRun ? 'DRY-RUN (Console only)' : 'DATABASE'}`);
  
  for (const sub of targetSubreddits) {
    console.log(`\n--------------------------------------------`);
    console.log(`[Reddit] Processing subreddit: /r/${sub}`);
    
    const subUrl = `https://www.reddit.com/r/${sub}`;
    let sourceId = '';
    
    if (!isDryRun) {
      // Find or create source in Supabase
      const { data: source, error: findError } = await supabase
        .from('sources')
        .select('id')
        .eq('url', subUrl)
        .maybeSingle();
        
      if (findError) {
        console.error(`[DB] Error looking up source:`, findError.message);
        continue;
      }
      
      if (source) {
        sourceId = source.id;
      } else {
        console.log(`[DB] Registering source /r/${sub}...`);
        const { data: newSource, error: createError } = await supabase
          .from('sources')
          .insert({
            platform: 'REDDIT',
            name: `/r/${sub}`,
            url: subUrl,
            access_type: 'public',
            usefulness_score: 5,
            collection_method: 'API'
          })
          .select('id')
          .single();
          
        if (createError) {
          console.error(`[DB] Error creating source:`, createError.message);
          continue;
        }
        sourceId = newSource.id;
      }
    }
    
    // Fetch data
    const posts = await fetchSubreddit(sub);
    console.log(`[Reddit] Retrieved ${posts.length} posts.`);
    
    for (const post of posts) {
      const data = post.data;
      if (!data) continue;
      
      // We only care about text posts or posts with details
      const id = data.id || '';
      const title = data.title || '';
      const body = data.selftext || '';
      const author = data.author || '[deleted]';
      const upvotes = data.ups || 0;
      const numComments = data.num_comments || 0;
      const permalink = data.permalink ? `https://www.reddit.com${data.permalink}` : '';
      const createdUtc = data.created_utc ? new Date(data.created_utc * 1000).toISOString() : new Date().toISOString();
      
      console.log(` - Post: "${title}" (Upvotes: ${upvotes}, Comments: ${numComments})`);
      
      if (!isDryRun && sourceId) {
        // Upsert into Supabase (by platform_item_id)
        const itemPayload = {
          source_id: sourceId,
          platform_item_id: id,
          author_hash: hashAuthor(author),
          url: permalink,
          title: title,
          body: body || title, // fallback to title if text is empty
          metadata: {
            upvotes,
            num_comments: numComments,
            is_self: data.is_self,
            domain: data.domain
          },
          created_at: createdUtc
        };
        
        // Supabase select for dedup
        const { data: existingItem, error: fetchErr } = await supabase
          .from('items')
          .select('id')
          .eq('source_id', sourceId)
          .eq('platform_item_id', id)
          .maybeSingle();
          
        if (fetchErr) {
          console.error(`[DB] Error checking item existence:`, fetchErr.message);
          continue;
        }
        
        if (existingItem) {
          console.log(`   [DB] Item already exists. Skipping.`);
        } else {
          const { error: insertErr } = await supabase
            .from('items')
            .insert(itemPayload);
            
          if (insertErr) {
            console.error(`   [DB] Error inserting item:`, insertErr.message);
          } else {
            console.log(`   [DB] Successfully saved.`);
          }
        }
      }
    }
  }
  
  console.log(`\n[Reddit] Crawler finished.`);
}

main().catch(console.error);
