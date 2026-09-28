import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, copyFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import os from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HTML_PATH = join(ROOT, 'docs', 'nvidia-nim-speed-test.html');
const html = readFileSync(HTML_PATH, 'utf8');

function extractInlineScript() {
  const idx = html.lastIndexOf('<script>');
  assert.ok(idx !== -1, 'inline <script> block exists');
  const end = html.indexOf('</script>', idx);
  assert.ok(end !== -1, 'closing </script> exists');
  const src = html.slice(idx + '<script>'.length, end);
  assert.ok(!src.includes('</script'), 'script must not contain a nested </script>');
  return src;
}

function extractFn(src, name) {
  const marker = 'function ' + name + '(';
  const start = src.indexOf(marker);
  assert.ok(start !== -1, name + ' is declared');
  let i = src.indexOf('{', start);
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

const src = extractInlineScript();
const fn = (name) => vm.runInNewContext('(' + extractFn(src, name) + ')');

test('inline tool script parses as valid JavaScript', () => {
  new vm.Script(src);
});

test('escHtml actually escapes HTML (was a no-op before the fix)', () => {
  const escHtml = fn('escHtml');
  assert.equal(escHtml('<b>"a"&\'b\'</b>'), '&lt;b&gt;&quot;a&quot;&amp;\'b\'&lt;/b&gt;');
  assert.equal(escHtml('plain'), 'plain');
  assert.ok(!escHtml('<img src=x onerror=alert(1)>').includes('<img'));
});

test('escAttr escapes quotes and angle brackets', () => {
  const escAttr = fn('escAttr');
  assert.equal(escAttr(`a'b"c<d>&e`), 'a&#39;b&quot;c&lt;d&gt;&amp;e');
});

test('categorize maps known model families', () => {
  const categorize = fn('categorize');
  assert.equal(categorize('meta/llama-3.3-70b-instruct'), 'llm');
  assert.equal(categorize('black-forest-labs/flux.1-dev'), 'image');
  assert.equal(categorize('nvidia/nv-embedqa-e5-v5'), 'embedding');
  assert.equal(categorize('stabilityai/stable-video-diffusion'), 'video');
  assert.equal(categorize('qwen/qwen3-coder-480b-a35b-instruct'), 'code');
  assert.equal(categorize('nvidia/llama-3.2-11b-vision-instruct'), 'multimodal');
});

test('getTestType only offers tests the proxy supports', () => {
  const getTestType = fn('getTestType');
  assert.equal(getTestType('llm'), 'chat');
  assert.equal(getTestType('code'), 'chat');
  assert.equal(getTestType('embedding'), 'embedding');
  assert.equal(getTestType('image'), 'image');
  assert.equal(getTestType('video'), 'none');
  assert.equal(getTestType('tool'), 'none');
  assert.equal(getTestType('speech'), 'none');
  assert.equal(getTestType('healthcare'), 'none');
});

test('refreshModels is attached to window (inline onclick needs it)', () => {
  assert.ok(src.includes('window.refreshModels'), 'refreshModels must be global');
});

test('batch UI elements exist in the page', () => {
  assert.ok(html.includes('id="stop-batch-btn"'), 'Stop button present');
  assert.ok(html.includes('id="batch-progress"'), 'progress indicator present');
  assert.ok(html.includes('onclick="stopBatch()"'), 'stop handler wired');
});

test('no stale "click Save" copy (button is Fetch Models)', () => {
  assert.ok(!html.includes('click Save'), 'stale copy removed');
  assert.ok(html.includes('Fetch Models'), 'correct button label referenced');
});

test('sticky bar no longer covers content (body padding toggle)', () => {
  assert.ok(src.includes("classList.toggle('has-sticky-bar'"), 'body class toggled with bar');
  assert.ok(html.includes('body.has-sticky-bar'), 'padding rule present');
});

// ---- Cloudflare Pages Function: nvidia-nim-proxy ----
const PROXY_TMP = join(os.tmpdir(), 'nvidia-nim-proxy.test.mjs');
copyFileSync(join(ROOT, 'functions', 'api', 'nvidia-nim-proxy.js'), PROXY_TMP);
const proxy = await import(pathToFileURL(PROXY_TMP).href);

function mockRequest(action, body, key = 'nvapi-test-key') {
  const headers = {
    'origin': 'https://dhanuksoftwares.com',
    'x-nvidia-api-key': key,
    'content-type': 'application/json',
    'cf-connecting-ip': '1.2.3.4',
  };
  return {
    method: 'POST',
    url: 'https://dhanuksoftwares.com/api/nvidia-nim-proxy?action=' + action,
    headers: { get: (k) => headers[k.toLowerCase()] ?? null },
    text: async () => JSON.stringify(body),
  };
}

test('proxy health flags models that reject the benchmark endpoint as untestable', async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const b = JSON.parse(opts.body);
    if (b.model === 'nvidia/nemotron-parse') {
      return { status: 400, json: async () => ({ detail: 'Model does not support chat completions format' }) };
    }
    return { status: 200, json: async () => ({ choices: [{ message: { content: 'haiku' } }] }) };
  };
  try {
    const res = await proxy.onRequest({ request: mockRequest('health', {
      models: ['nvidia/nemotron-parse', 'meta/llama-3.3-70b-instruct'],
      categories: { 'nvidia/nemotron-parse': 'multimodal', 'meta/llama-3.3-70b-instruct': 'llm' },
    }) });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.deepEqual(data.untestable, ['nvidia/nemotron-parse']);
    assert.ok(data.live.includes('meta/llama-3.3-70b-instruct'));
    assert.deepEqual(data.dead, []);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('proxy health marks 404 models dead and survives object-shaped errors', async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    status: 400,
    json: async () => ({ error: { message: 'model not found or deprecated', type: 'x' } }),
  });
  try {
    const res = await proxy.onRequest({ request: mockRequest('health', {
      models: ['gone/model'], categories: { 'gone/model': 'llm' },
    }) });
    const data = await res.json();
    assert.deepEqual(data.dead, ['gone/model']);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('proxy rejects missing/invalid API key with 401', async () => {
  const res = await proxy.onRequest({ request: mockRequest('models', null, null) });
  assert.equal(res.status, 401);
});

test('proxy rejects unknown action with 400', async () => {
  const res = await proxy.onRequest({ request: mockRequest('bogus', {}) });
  assert.equal(res.status, 400);
});
