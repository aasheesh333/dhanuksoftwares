import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeRichText } from '../lib/render.mjs';

test('sanitizeRichText allows safe tags', () => {
  assert.equal(sanitizeRichText('<h3>Hello</h3>'), '<h3>Hello</h3>');
  assert.equal(sanitizeRichText('<p>Hi <strong>there</strong></p>'), '<p>Hi <strong>there</strong></p>');
  assert.equal(sanitizeRichText('<h2>Title</h2><p>Body</p>'), '<h2>Title</h2><p>Body</p>');
});

test('sanitizeRichText strips dangerous tags', () => {
  assert.equal(sanitizeRichText('<script>alert(1)</script>Hello'), 'Hello');
  assert.equal(sanitizeRichText('<style>body{}</style>Hi'), 'Hi');
  assert.equal(sanitizeRichText('<iframe src="x"></iframe>X'), 'X');
});

test('sanitizeRichText removes dangerous attributes', () => {
  const out = sanitizeRichText('<a href="https://x.com" onclick="hack()">link</a>');
  assert.match(out, /href="https:\/\/x\.com"/);
  assert.doesNotMatch(out, /onclick/);
});

test('sanitizeRichText handles javascript: protocol', () => {
  assert.equal(sanitizeRichText('<a href="javascript:alert(1)">x</a>'), 'x');
});

test('sanitizeRichText allows safe a tags only with href', () => {
  const out = sanitizeRichText('<a href="https://play.google.com">Play</a>');
  assert.match(out, /href="https:\/\/play\.google\.com"/);
  assert.match(out, /target="_blank"/);
  assert.equal(sanitizeRichText('<a>x</a>'), 'x');
});

test('sanitizeRichText converts line breaks', () => {
  assert.equal(sanitizeRichText('Line 1<br>Line 2'), 'Line 1<br>Line 2');
});

test('sanitizeRichText keeps anchor closers (no swallowed content)', () => {
  const out = sanitizeRichText('<p><a href="https://x.com">Link</a> after</p><h2>Next heading</h2><p>Body</p>');
  assert.equal((out.match(/<a\b/g) || []).length, 1);
  assert.equal((out.match(/<\/a>/g) || []).length, 1);
  assert.match(out, /<\/a> after<\/p>/);
  assert.doesNotMatch(out, /<a[^>]*>[^<]*<h2>/);
});

test('sanitizeRichText auto-closes an unclosed anchor', () => {
  const out = sanitizeRichText('<p><a href="https://x.com">Link</p><h2>Heading</h2>');
  assert.equal((out.match(/<\/a>/g) || []).length, 1);
});

test('sanitizeRichText drops anchors without a usable href', () => {
  const out = sanitizeRichText('<p><a name="x">Text</a></p>');
  assert.doesNotMatch(out, /<a\b/);
  assert.match(out, /Text/);
});

test('sanitizeRichText never nests anchors', () => {
  const out = sanitizeRichText('<a href="https://a.com">A <a href="https://b.com">B</a></a>');
  assert.equal((out.match(/<a\b/g) || []).length, 1);
  assert.equal((out.match(/<\/a>/g) || []).length, 1);
});
