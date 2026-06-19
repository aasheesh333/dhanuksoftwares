const rateLimitMap = new Map();
const RATE_LIMIT = 5;
const RATE_WINDOW = 60_000;
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const PS_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const SYSTEM_PROMPT = `You are an expert SEO copywriter for an Indian Android app studio called Dhanuk Softwares. You write content that ranks on Google India search results.

Rules:
- Target position #1 for: [app category] + Indian audience long-tail keywords
- Use LSI keywords naturally (no stuffing)
- Mix English with Hindi terms where natural (e.g., "Kundli", "Rashifal", "Jugaad")
- Follow E-E-A-T (Experience, Expertise, Authority, Trust)
- Write in active voice, second person ("you")
- Output strict JSON only, no markdown, no preamble
- Schema.org friendly (SoftwareApplication, FAQPage)
- Reads human-written, not AI-generated
- Lengths: tagline <=60 char, shortDesc <=160 char, longDescription 1500-3000 words (Play Store full description length, comprehensive SEO content)

Return this exact JSON shape:
{
  "tagline": "...",
  "shortDesc": "...",
  "longDescription": "...",
  "keywords": ["...", "..."],
  "features": ["...", "..."],
  "faq": [{"q":"...","a":"..."}, ...]
}`;

function checkRate(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip) || { count: 0, resetAt: now + RATE_WINDOW };
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + RATE_WINDOW;
  }
  if (record.count >= RATE_LIMIT) return false;
  record.count++;
  rateLimitMap.set(ip, record);
  return true;
}

async function scrapePlayStore(url) {
  let parsedUrl;
  try { parsedUrl = new URL(url); } catch (e) { throw new Error('Invalid URL'); }
  if (parsedUrl.protocol !== 'https:') throw new Error('URL must be HTTPS');
  const host = parsedUrl.hostname.toLowerCase();
  const allowedHosts = new Set(['play.google.com', 'play.google.co.in']);
  if (!allowedHosts.has(host)) throw new Error('Only play.google.com URLs are allowed');

  const htmlUrl = url.includes('?') ? url + '&hl=en' : url + '?hl=en';
  const res = await fetch(htmlUrl, {
    headers: { 'User-Agent': PS_UA, 'Accept-Language': 'en-US,en;q=0.9' }
  });
  if (!res.ok) throw new Error(`Play Store returned ${res.status}`);
  const html = await res.text();

  const appId = (url.match(/[?&]id=([^&]+)/) || [])[1] || '';

  const ogTitle = (html.match(/<meta property="og:title" content="([^"]+)"/) || [])[1] || '';
  const name = ogTitle.replace(/\s*-\s*Apps on Google Play$/i, '').trim()
    || (html.match(/<meta itemprop="name" content="([^"]+)"/) || [])[1] || '';

  const tagline = (html.match(/<meta itemprop="description" content="([^"]+)"/) || [])[1] || '';

  const descMatch = html.match(/data-g-id="description">([\s\S]{50,15000}?)<\/div>/);
  let longDescription = '';
  if (descMatch) {
    longDescription = descMatch[1]
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  const iconMatch = html.match(/https:\/\/play-lh\.googleusercontent\.com\/[A-Za-z0-9_-]{40,200}(?!=)/);
  const icon = iconMatch ? iconMatch[0] : '';

  const screenshotsAll = [...new Set(html.match(/https:\/\/play-lh\.googleusercontent\.com\/[A-Za-z0-9_-]{40,200}=w1052-h592/g) || [])];
  const screenshots = screenshotsAll.slice(0, 6);

  const rating = (html.match(/aria-label="Rated ([0-9.]+) stars/) || [])[1] || '';
  const reviews = (html.match(/<span[^>]*aria-label="([0-9,.]+)\s*reviews?/i) || [])[1] || '';
  const downloads = (html.match(/class="ClM7O">([0-9]+[BMK]\+?)<\/div>/) || [])[1] || '';
  const updated = (html.match(/class="xg1aie">([^<]+)/) || [])[1] || '';
  const developer = (html.match(/class="wMUdtb">([^<]+)/) || [])[1] || '';

  let category = '';
  const genreMatch = html.match(/<meta itemprop="applicationCategory" content="([^"]+)"/);
  if (genreMatch) category = genreMatch[1];
  if (!category) {
    const catMatch = html.match(/aria-label="(Communication|Productivity|Tools|Entertainment|Education|Lifestyle|Health|Finance|Photography|Social|Music|Shopping|Games)"/);
    if (catMatch) category = catMatch[1];
  }

  return {
    appId, name, tagline, longDescription, icon, screenshots,
    rating, reviews, downloads, updated, developer, category
  };
}

export async function onRequest({ request, env }) {
  const ADMIN_PASSWORD = env.ADMIN_PASSWORD;
  const GROQ_API_KEY = env.GROQ_API_KEY;

  const ALLOWED_ORIGINS = ['https://dhanuksoftwares.com', 'https://www.dhanuksoftwares.com'];
  const requestOrigin = request.headers.get('origin') || '';
  const allowOrigin = ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : ALLOWED_ORIGINS[0];
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  };

  if (request.method === 'OPTIONS') return new Response('', { status: 200, headers });
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });

  const token = request.headers.get('x-admin-token');
  if (token !== ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  if (!checkRate(ip)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again in a minute.' }), { status: 429, headers });
  }

  if (!GROQ_API_KEY) {
    return new Response(JSON.stringify({ error: 'GROQ_API_KEY not configured' }), { status: 500, headers });
  }

  let body;
  try { body = await request.json(); } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers });
  }

  const { name, category, seed, playStoreUrl } = body;
  if (!name || (!seed && !playStoreUrl)) {
    return new Response(JSON.stringify({ error: 'Missing name and (seed or playStoreUrl)' }), { status: 400, headers });
  }

  let scraped = null;
  if (playStoreUrl) {
    try {
      scraped = await scrapePlayStore(playStoreUrl);
    } catch (e) {
      return new Response(JSON.stringify({ error: `Play Store fetch failed: ${e.message}` }), { status: 502, headers });
    }
  }

  const contextParts = [];
  if (scraped) {
    contextParts.push(`[PLAY STORE DATA — use this as primary source]`);
    if (scraped.name) contextParts.push(`App name: ${scraped.name}`);
    if (scraped.tagline) contextParts.push(`Tagline: ${scraped.tagline}`);
    if (scraped.category) contextParts.push(`Category: ${scraped.category}`);
    if (scraped.developer) contextParts.push(`Developer: ${scraped.developer}`);
    if (scraped.rating) contextParts.push(`Rating: ${scraped.rating}/5 (${scraped.reviews || '?'} reviews)`);
    if (scraped.downloads) contextParts.push(`Downloads: ${scraped.downloads}`);
    if (scraped.updated) contextParts.push(`Last updated: ${scraped.updated}`);
    if (scraped.longDescription) contextParts.push(`\nOfficial description (use as ground truth, expand and optimize for SEO):\n${scraped.longDescription.slice(0, 3000)}`);
  }
  if (seed) contextParts.push(`\n[ADDITIONAL CONTEXT FROM USER]\n${seed}`);

  const userPrompt = `App name: ${name}
Category: ${category || (scraped?.category) || 'General'}

${contextParts.join('\n')}

INSTRUCTIONS:
- Use the Play Store data as ground truth for facts (features, what app does, etc.)
- If Play Store data is sparse, expand using your knowledge of similar apps in this category
- Generate longDescription: 1500-3000 words, structured with H2/H3 headings, bullets, paragraphs
- Add 6-8 FAQ pairs covering: pricing, offline use, privacy, compatibility, common concerns, comparison
- Add 8 keywords combining official + LSI long-tail Indian queries
- Features: 6-8 bullets based on what the app actually does (don't invent)
- shortDesc: 1-sentence compelling hook for meta description
- tagline: punchy 4-7 word value prop

Generate the SEO content JSON for this app.`;

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: 'json_object' }
      })
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Groq API error: ${res.status}` }), { status: 502, headers });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(JSON.stringify({ error: 'Empty response from Groq' }), { status: 502, headers });
    }

    let parsed;
    try { parsed = JSON.parse(content); }
    catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON from AI', raw: content.slice(0, 500) }), { status: 502, headers });
    }

    return new Response(JSON.stringify({
      ok: true,
      data: parsed,
      scraped,
      model: GROQ_MODEL
    }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: `Server error: ${e.message}` }), { status: 500, headers });
  }
}