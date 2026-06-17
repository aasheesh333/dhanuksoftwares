import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderApp, buildSchemaSoftwareApp, buildSchemaFAQ, buildSchemaBreadcrumb, addUtm } from '../lib/render.mjs';

const sampleApp = {
  name: 'AstroPrerna',
  slug: 'astroprerna',
  tagline: 'Your daily horoscope',
  shortDesc: 'Free horoscope in Hindi & English.',
  longDescription: 'AstroPrerna gives you daily personalized horoscopes.',
  emoji: '🔭',
  category: 'Lifestyle',
  keywords: ['astrology', 'horoscope'],
  features: ['Daily horoscope', 'Free Kundli'],
  faq: [{ q: 'Is it free?', a: 'Yes.' }],
  rating: { value: 4.6, count: 1240 },
  marketplaces: [
    { name: 'Google Play', url: 'https://play.google.com/x', type: 'play' },
    { name: 'Direct APK', url: 'https://x.com/a.apk', type: 'direct' }
  ],
  screenshots: ['https://x.com/1.png'],
  lastUpdated: '2026-06-15'
};

test('renderApp produces HTML with title and primary CTA', () => {
  const html = renderApp(sampleApp, 'https://dhanuksoftwares.netlify.app', []);
  assert.match(html, /<title>AstroPrerna - Your daily horoscope \| Dhanuk Softwares<\/title>/);
  assert.match(html, /Download on Google Play/);
  assert.match(html, /Direct APK/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /SoftwareApplication/);
});

test('buildSchemaSoftwareApp has required fields', () => {
  const schema = JSON.parse(buildSchemaSoftwareApp(sampleApp, 'https://x.com'));
  assert.equal(schema['@type'], 'SoftwareApplication');
  assert.equal(schema.name, 'AstroPrerna');
  assert.equal(schema.operatingSystem, 'Android');
  assert.equal(schema.aggregateRating.ratingValue, 4.6);
  assert.equal(schema.offers.length, 2);
});

test('buildSchemaFAQ produces valid FAQ schema', () => {
  const schema = JSON.parse(buildSchemaFAQ(sampleApp));
  assert.equal(schema['@type'], 'FAQPage');
  assert.equal(schema.mainEntity.length, 1);
  assert.equal(schema.mainEntity[0].name, 'Is it free?');
});

test('buildSchemaBreadcrumb has 3 levels', () => {
  const schema = JSON.parse(buildSchemaBreadcrumb(sampleApp, 'https://x.com'));
  assert.equal(schema['@type'], 'BreadcrumbList');
  assert.equal(schema.itemListElement.length, 3);
});

test('addUtm appends utm params correctly', () => {
  const url = addUtm('https://play.google.com/x', 'astroprerna', 'play', 'hero');
  assert.match(url, /utm_source=dhanuksoftwares/);
  assert.match(url, /utm_content=astroprerna_hero/);
  assert.match(url, /utm_term=play/);
});

test('renderApp with no marketplaces shows Coming Soon CTA', () => {
  const app = { ...sampleApp, marketplaces: [] };
  const html = renderApp(app, 'https://x.com', []);
  assert.match(html, /mailto:support|Contact Us/);
});

test('renderApp includes related apps', () => {
  const related = [{ name: 'Focus App', slug: 'focus-app', emoji: '🎯', shortDesc: 'Stay focused' }];
  const html = renderApp(sampleApp, 'https://x.com', related);
  assert.match(html, /Other Apps from Dhanuk Softwares/);
  assert.match(html, /href="\/apps\/focus-app\/"/);
});
