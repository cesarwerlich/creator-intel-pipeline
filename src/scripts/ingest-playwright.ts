import { chromium, BrowserContext } from 'playwright';
import { supabase, Source, Item } from '../db.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function hashAuthor(author: string): string {
  return crypto.createHash('sha256').update(author).digest('hex').substring(0, 16);
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  
  // Parse command arguments
  const platformArgIndex = args.indexOf('--platform');
  const platform = platformArgIndex !== -1 ? args[platformArgIndex + 1] : '';
  
  const urlArgIndex = args.indexOf('--url');
  const url = urlArgIndex !== -1 ? args[urlArgIndex + 1] : '';
  
  const scrollArgIndex = args.indexOf('--scroll');
  const scrollCount = scrollArgIndex !== -1 ? parseInt(args[scrollArgIndex + 1], 10) : 5;

  if (!platform || !url) {
    console.error('Usage: npx tsx src/scripts/ingest-playwright.ts --platform <discord|skool> --url <url> [--scroll <count>] [--dry-run]');
    process.exit(1);
  }

  const upperPlatform = platform.toUpperCase() as 'DISCORD' | 'SKOOL';
  if (!['DISCORD', 'SKOOL'].includes(upperPlatform)) {
    console.error('Error: Platform must be "discord" or "skool"');
    process.exit(1);
  }

  console.log(`[Playwright] Starting scraper for platform: ${upperPlatform}`);
  console.log(`[Playwright] Target URL: ${url}`);
  console.log(`[Playwright] Mode: ${isDryRun ? 'DRY-RUN (Console only)' : 'DATABASE'}`);

  let sourceId = '';
  if (!isDryRun) {
    // Find or create source
    const { data: source, error: findError } = await supabase
      .from('sources')
      .select('id')
      .eq('url', url)
      .maybeSingle();

    if (findError) {
      console.error('[DB] Source query failed:', findError.message);
      process.exit(1);
    }

    if (source) {
      sourceId = source.id;
    } else {
      console.log(`[DB] Registering source for ${url}...`);
      const { data: newSource, error: createError } = await supabase
        .from('sources')
        .insert({
          platform: upperPlatform,
          name: `${upperPlatform} Community: ${url.split('/').pop() || 'General'}`,
          url: url,
          access_type: 'private', // Discord/Skool usually requires login/auth
          usefulness_score: 7,
          collection_method: 'BROWSER_AUTOMATION'
        })
        .select('id')
        .single();

      if (createError) {
        console.error('[DB] Error creating source:', createError.message);
        process.exit(1);
      }
      sourceId = newSource.id;
    }
  }

  // Setup browser options and check profile path
  const chromeProfile = process.env.CHROME_PROFILE_PATH;
  let context: BrowserContext;

  if (chromeProfile) {
    console.log(`[Playwright] Attempting to reuse Chrome profile from: ${chromeProfile}`);
    try {
      context = await chromium.launchPersistentContext(chromeProfile, {
        headless: false, // run headful so user can see login state/verify
        channel: 'chrome',
        args: ['--disable-extensions-except', '--disable-dev-shm-usage'],
      });
    } catch (e: any) {
      console.warn(`[Playwright] Locked profile or error launching Chrome profile: ${e.message}`);
      console.warn(`[Playwright] Falling back to a clean browser launch. (You may need to log in manually)`);
      const browser = await chromium.launch({ headless: false });
      context = await browser.newContext();
    }
  } else {
    console.log('[Playwright] No CHROME_PROFILE_PATH in env. Starting clean browser instance...');
    const browser = await chromium.launch({ headless: false });
    context = await browser.newContext();
  }

  const page = await context.newPage();
  
  // Set window size
  await page.setViewportSize({ width: 1280, height: 800 });

  console.log(`[Playwright] Navigating to ${url}...`);
  await page.goto(url);

  // Let the user log in or wait for page load
  console.log('[Playwright] Waiting for content... If you need to login, please do so in the browser window.');
  
  if (upperPlatform === 'DISCORD') {
    // Discord check if we are on login screen
    try {
      await page.waitForSelector('[class*="messageContent"]', { timeout: 30000 });
      console.log('[Playwright] Message elements found. User is logged in.');
    } catch (err) {
      console.log('[Playwright] Waiting 15 seconds to allow manual login or channel load...');
      await page.waitForTimeout(15000);
    }

    // Scroll up to load older messages
    console.log(`[Playwright] Scrolling up ${scrollCount} times to fetch history...`);
    for (let i = 0; i < scrollCount; i++) {
      // Find the message container scrollable area
      const scroller = await page.$('[class*="scrollerInner"]');
      if (scroller) {
        await page.evaluate(() => {
          const scrollArea = document.querySelector('[class*="messagesWrapper"] [class*="scroller"]');
          if (scrollArea) {
            scrollArea.scrollBy(0, -600);
          }
        });
      }
      await page.waitForTimeout(1500);
    }

    // Extract Discord messages
    console.log('[Playwright] Extracting Discord messages...');
    const messages = await page.$$eval('[class*="messageListItem"]', (elements) => {
      return elements.map(el => {
        const id = el.getAttribute('id') || '';
        const authorEl = el.querySelector('[class*="username"]');
        const author = authorEl ? authorEl.textContent || '' : '';
        const contentEl = el.querySelector('[class*="messageContent"]');
        const content = contentEl ? contentEl.textContent || '' : '';
        const timeEl = el.querySelector('time');
        const timestamp = timeEl ? timeEl.getAttribute('datetime') || '' : '';
        
        return { id, author, content, timestamp };
      });
    });

    console.log(`[Playwright] Parsed ${messages.length} messages.`);
    
    // Save to Database
    for (const msg of messages) {
      if (!msg.content || !msg.author) continue;
      
      console.log(` - [${msg.author}]: "${msg.content.substring(0, 60)}..."`);
      
      if (!isDryRun && sourceId) {
        const itemPayload = {
          source_id: sourceId,
          platform_item_id: msg.id || `discord-${Date.now()}-${Math.random()}`,
          author_hash: hashAuthor(msg.author),
          url: url,
          body: msg.content,
          metadata: {
            authorName: msg.author, // optional metadata (non-GDPR sensitive or hashed if needed)
          },
          created_at: msg.timestamp || new Date().toISOString()
        };

        // Query check to avoid duplicates
        const { data: existing, error: checkErr } = await supabase
          .from('items')
          .select('id')
          .eq('source_id', sourceId)
          .eq('platform_item_id', itemPayload.platform_item_id)
          .maybeSingle();

        if (checkErr) continue;
        if (!existing) {
          await supabase.from('items').insert(itemPayload);
        }
      }
    }

  } else if (upperPlatform === 'SKOOL') {
    // Skool layout: Posts have specific structures inside the list
    try {
      await page.waitForSelector('a[href*="/post/"]', { timeout: 30000 });
      console.log('[Playwright] Skool posts found.');
    } catch (err) {
      console.log('[Playwright] Waiting 15 seconds for manual login or page load...');
      await page.waitForTimeout(15000);
    }

    // Scroll down to load posts
    console.log(`[Playwright] Scrolling down ${scrollCount} times to load posts...`);
    for (let i = 0; i < scrollCount; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await page.waitForTimeout(1500);
    }

    // Extract Skool posts list
    console.log('[Playwright] Extracting Skool posts...');
    const posts = await page.$$eval('a[href*="/post/"]', (elements) => {
      return elements.map(el => {
        const url = (el as HTMLAnchorElement).href;
        const titleEl = el.querySelector('h1, h2, h3, [class*="title"], [class*="Text"]');
        const title = titleEl ? titleEl.textContent || '' : '';
        const bodyEl = el.querySelector('[class*="description"], [class*="body"], p');
        const body = bodyEl ? bodyEl.textContent || '' : '';
        const authorEl = el.querySelector('[class*="author"], [class*="name"]');
        const author = authorEl ? authorEl.textContent || '' : '';
        
        return { url, title, body, author };
      });
    });

    console.log(`[Playwright] Parsed ${posts.length} posts.`);

    for (const post of posts) {
      if (!post.title) continue;
      const postId = post.url.split('/').pop() || '';
      
      console.log(` - Post: "${post.title}" by ${post.author}`);

      if (!isDryRun && sourceId) {
        const itemPayload = {
          source_id: sourceId,
          platform_item_id: postId,
          author_hash: hashAuthor(post.author || 'skool-user'),
          url: post.url,
          title: post.title,
          body: post.body || post.title,
          metadata: {
            authorName: post.author,
          },
          created_at: new Date().toISOString() // Skool dates are relative in DOM, use current time
        };

        const { data: existing, error: checkErr } = await supabase
          .from('items')
          .select('id')
          .eq('source_id', sourceId)
          .eq('platform_item_id', postId)
          .maybeSingle();

        if (checkErr) continue;
        if (!existing) {
          await supabase.from('items').insert(itemPayload);
        }
      }
    }
  }

  console.log('[Playwright] Scrape completed. Closing browser context...');
  await context.close();
}

main().catch(console.error);
