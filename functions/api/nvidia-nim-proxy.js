const ALLOWED_ORIGINS = ['https://dhanuksoftwares.com', 'https://www.dhanuksoftwares.com'];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https:\/\/[a-z0-9]+\.dhanuksoftwares\.pages\.dev$/.test(origin)) return true;
  return false;
}
const NIM_BASE = 'https://integrate.api.nvidia.com/v1';
const RATE_LIMIT_MAP = new Map();
const RATE_LIMIT = 100;
const RATE_WINDOW = 60_000;

function checkRate(ip) {
  const now = Date.now();
  const record = RATE_LIMIT_MAP.get(ip) || { count: 0, resetAt: now + RATE_WINDOW };
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + RATE_WINDOW;
  }
  if (record.count >= RATE_LIMIT) return false;
  record.count++;
  RATE_LIMIT_MAP.set(ip, record);
  return true;
}

export async function onRequest({ request }) {
  const requestOrigin = request.headers.get('origin') || '';
  const allowOrigin = isAllowedOrigin(requestOrigin) ? requestOrigin : ALLOWED_ORIGINS[0];
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, x-nvidia-api-key, Authorization',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin'
  };

  if (request.method === 'OPTIONS') return new Response('', { status: 200, headers });

  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    if (!checkRate(ip)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again in a minute.' }), { status: 429, headers });
    }

    const url = new URL(request.url);
    const nimAction = url.searchParams.get('action');
    const apiKey = request.headers.get('x-nvidia-api-key');

    if (!apiKey || !apiKey.startsWith('nvapi-')) {
      return new Response(JSON.stringify({ error: 'Invalid or missing NVIDIA API key. Key must start with nvapi-' }), { status: 401, headers });
    }

    let requestBody = null;
    if (request.method === 'POST') {
      requestBody = await request.text();
    }

    const fetchOptions = {
      method: request.method === 'POST' ? 'POST' : 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    if (requestBody) {
      fetchOptions.body = requestBody;
    }

    let nimUrl;

    if (nimAction === 'models') {
      nimUrl = `${NIM_BASE}/models`;
    } else if (nimAction === 'chat') {
      nimUrl = `${NIM_BASE}/chat/completions`;
    } else if (nimAction === 'completions') {
      nimUrl = `${NIM_BASE}/completions`;
    } else if (nimAction === 'embeddings') {
      nimUrl = `${NIM_BASE}/embeddings`;
    } else if (nimAction === 'image-generations') {
      nimUrl = `${NIM_BASE}/image/generations`;
    } else if (nimAction === 'health') {
      let body = {};
      if (requestBody) { try { body = JSON.parse(requestBody); } catch(e) {} }
      const models = Array.isArray(body.models) ? body.models.slice(0, 50) : [];
      const categories = body.categories || {};
      if (!models.length) {
        return new Response(JSON.stringify({ error: 'Provide models array' }), { status: 400, headers });
      }
      function categorize(id) {
        const lower = id.toLowerCase();
        if (lower.includes('embed') || lower.includes('rerank') || lower.includes('bge-') || lower.includes('nv-embed') || lower.includes('arctic-embed') || lower.includes('gte-') || lower.includes('nvclip') || lower.includes('nv-rerank') || lower.includes('bce-') || lower.includes('retriev')) return 'embedding';
        if (lower.includes('flux') || lower.includes('stable-diffusion') || lower.includes('sdxl') || lower.includes('trellis') || lower.includes('kandinsky') || lower.includes('diffusiongemma') || lower.includes('stable-image')) return 'image';
        if (lower.includes('video') || lower.includes('cosmos-predict') || lower.includes('stable-video') || lower.includes('ai-synthetic-video') || lower.includes('svd')) return 'video';
        if (lower.includes('code') || lower.includes('coder') || lower.includes('codegemma') || lower.includes('codestral') || lower.includes('deepseek-coder')) return 'code';
        if (lower.includes('vision') || lower.includes('-vl') || lower.includes('vl-') || lower.includes('paligemma') || lower.includes('phi-3-vision') || lower.includes('phi-4-multimodal') || lower.includes('llama-4-maverick') || lower.includes('llama-4-scout') || lower.includes('vila') || lower.includes('neva') || lower.includes('kosmos') || lower.includes('fuyu') || lower.includes('pixtral') || lower.includes('qwen2-vl') || lower.includes('qwen-qvq')) return 'multimodal';
        if (lower.includes('alpha') || lower.includes('esm') || lower.includes('boltz') || lower.includes('diffdock') || lower.includes('evo2') || lower.includes('genmol') || lower.includes('molmim') || lower.includes('protein') || lower.includes('colabfold') || lower.includes('biomolecular') || lower.includes('openbiomed')) return 'healthcare';
        if (lower.includes('pii') || lower.includes('safety') || lower.includes('jailbreak') || lower.includes('nemoguard') || lower.includes('content-safety') || lower.includes('gliner')) return 'safety';
        if (lower.includes('translate') || lower.includes('riva')) return 'speech';
        return 'llm';
      }
      function healthEndpoint(cat) {
        if (cat === 'embedding') return [`${NIM_BASE}/embeddings`, JSON.stringify({ model: 'test', input: 'hi', encoding_format: 'float' })];
        if (cat === 'image') return [`${NIM_BASE}/image/generations`, JSON.stringify({ model: 'test', prompt: 'hi' })];
        if (cat === 'video') return [null, null];
        if (cat === 'speech') return [null, null];
        if (cat === 'healthcare') return [null, null];
        return [`${NIM_BASE}/chat/completions`, JSON.stringify({ model: 'test', messages: [{ role: 'user', content: 'hi' }], max_tokens: 3, stream: false })];
      }
      const results = await Promise.all(models.map(async (modelId) => {
        try {
          const cat = categories[modelId] || categorize(modelId);
          const [endpoint, reqBody] = healthEndpoint(cat);
          if (!endpoint) return { id: modelId, live: true, untestable: true };
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 8000);
          const body = JSON.parse(reqBody);
          body.model = modelId;
          const r = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: ctrl.signal,
          });
          clearTimeout(timer);
          if (r.status === 404) return { id: modelId, live: false };
          if (r.status === 400) {
            const errData = await r.json().catch(() => ({}));
            const detail = (errData.detail || errData.error || '').toLowerCase();
            if (detail.includes('not found') || detail.includes('deprecated') || detail.includes('removed')) return { id: modelId, live: false };
            return { id: modelId, live: true };
          }
          if (r.status === 401) return { id: modelId, live: true };
          if (r.status === 429) return { id: modelId, live: true };
          if (!r.ok) return { id: modelId, live: true };
          const data = await r.json().catch(() => null);
          if (cat === 'embedding') {
            return { id: modelId, live: !!(data && data.data && data.data.length > 0) };
          }
          const hasContent = data && data.choices && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content;
          return { id: modelId, live: !!hasContent };
        } catch (e) {
          return { id: modelId, live: true };
        }
      }));
      const live = results.filter(r => r.live).map(r => r.id);
      const dead = results.filter(r => !r.live).map(r => r.id);
      return new Response(JSON.stringify({ live, dead, checked: models.length }), { status: 200, headers });
    } else {
      return new Response(JSON.stringify({ error: 'Invalid action. Use: models, chat, completions' }), { status: 400, headers });
    }

    const startTime = Date.now();
    const nimRes = await fetch(nimUrl, fetchOptions);
    const elapsed = Date.now() - startTime;

    const responseHeaders = { ...headers };
    responseHeaders['x-nim-latency-ms'] = String(elapsed);

    const contentType = nimRes.headers.get('content-type') || '';

    if (!nimRes.ok) {
      const errText = await nimRes.text().catch(() => 'Unknown error');
      return new Response(JSON.stringify({
        error: `NVIDIA NIM API error: ${nimRes.status}`,
        detail: errText.slice(0, 500),
        latencyMs: elapsed,
      }), { status: nimRes.status, headers: responseHeaders });
    }

    if (contentType.includes('text/event-stream')) {
      return new Response(nimRes.body, {
        status: 200,
        headers: {
          ...responseHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    const data = await nimRes.json();
    return new Response(JSON.stringify({ ...data, _latencyMs: elapsed }), { status: 200, headers: responseHeaders });

  } catch (e) {
    return new Response(JSON.stringify({ error: 'Proxy error', detail: e.message }), { status: 500, headers });
  }
}
