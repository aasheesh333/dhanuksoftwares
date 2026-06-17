import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrateApp, migrateAll } from '../lib/migrate.mjs';

test('migrateApp converts old fixed-URL fields to marketplaces array', () => {
  const old = {
    name: 'AstroPrerna',
    emoji: '🔭',
    desc: 'Daily horoscope',
    tag: 'Astrology',
    playUrl: 'https://play.google.com/x',
    uptodownUrl: 'https://uptodown.com/x',
    oppoUrl: '',
    vivoUrl: ''
  };
  const result = migrateApp(old);
  assert.equal(result.name, 'AstroPrerna');
  assert.equal(result.shortDesc, 'Daily horoscope');
  assert.equal(result.tag, 'Astrology');
  assert.equal(result.marketplaces.length, 2);
  assert.equal(result.marketplaces[0].name, 'Google Play');
  assert.equal(result.marketplaces[0].type, 'play');
  assert.equal(result.marketplaces[1].name, 'Uptodown');
  assert.equal(result.marketplaces[1].type, 'uptodown');
});

test('migrateApp skips empty URLs', () => {
  const old = { name: 'X', playUrl: '', uptodownUrl: '', oppoUrl: '', vivoUrl: '' };
  const result = migrateApp(old);
  assert.equal(result.marketplaces.length, 0);
});

test('migrateApp is idempotent (new format stays unchanged)', () => {
  const newApp = {
    name: 'AstroPrerna',
    shortDesc: 'X',
    marketplaces: [{ name: 'Direct', url: 'https://x.com/a.apk', type: 'direct' }]
  };
  const result = migrateApp(newApp);
  assert.equal(result.marketplaces.length, 1);
  assert.equal(result.marketplaces[0].name, 'Direct');
});

test('migrateAll processes array', () => {
  const old = [
    { name: 'A', playUrl: 'https://p.com', desc: 'd' },
    { name: 'B', uptodownUrl: 'https://u.com', desc: 'd2' }
  ];
  const result = migrateAll(old);
  assert.equal(result.length, 2);
  assert.equal(result[0].marketplaces[0].type, 'play');
  assert.equal(result[1].marketplaces[0].type, 'uptodown');
});
