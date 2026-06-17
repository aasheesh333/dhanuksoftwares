const rateLimitMap = new Map();
const RATE_LIMIT = 5;
const RATE_WINDOW = 60_000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Dhanuk@2025';
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

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

export default async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });

  const token = req.headers.get('x-admin-token');
  if (token !== ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  if (!checkRate(ip)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again in a minute.' }), { status: 429, headers });
  }

  if (!GROQ_API_KEY) {
    return new Response(JSON.stringify({ error: 'GROQ_API_KEY not configured' }), { status: 500, headers });
  }

  let body;
  try { body = await req.json(); } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers });
  }

  const { name, category, seed } = body;
  if (!name || !seed) {
    return new Response(JSON.stringify({ error: 'Missing name or seed' }), { status: 400, headers });
  }

  const userPrompt = `App name: ${name}
Category: ${category || 'General'}
Short description (seed): ${seed}

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
      const errText = await res.text();
      return new Response(JSON.stringify({ error: `Groq API error: ${res.status}`, details: errText.slice(0, 200) }), { status: 502, headers });
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

    return new Response(JSON.stringify({ ok: true, data: parsed, model: GROQ_MODEL }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: `Server error: ${e.message}` }), { status: 500, headers });
  }
};

export const config = { path: '/api/ai-fill' };
