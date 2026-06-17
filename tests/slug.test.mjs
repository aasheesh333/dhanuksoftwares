import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, ensureUnique } from '../lib/slug.mjs';

test('slugify converts name to kebab-case', () => {
  assert.equal(slugify('AstroPrerna'), 'astroprerna');
  assert.equal(slugify('Quick Scan!'), 'quick-scan');
  assert.equal(slugify('Photo Editor Pro'), 'photo-editor-pro');
  assert.equal(slugify('  Focus  App  '), 'focus-app');
  assert.equal(slugify('App @ #2'), 'app-2');
});

test('slugify handles empty/edge cases', () => {
  assert.equal(slugify(''), '');
  assert.equal(slugify('---'), '');
  assert.equal(slugify('astroPrerna'), 'astroprerna');
});

test('ensureUnique appends counter on collision', () => {
  const existing = new Set(['astroprerna', 'focus-app']);
  assert.equal(ensureUnique('astroprerna', existing), 'astroprerna-2');
  assert.equal(ensureUnique('focus-app', existing), 'focus-app-2');
  assert.equal(ensureUnique('quick-scan', existing), 'quick-scan');
});
