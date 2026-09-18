import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderBlogPost, renderBlogIndex } from '../lib/render-blog.mjs';

const samplePost = {
  slug: 'test-study-post',
  title: 'Test Study Post: Secrets to Studying Faster',
  tagline: 'Learn how to master focus and study faster.',
  description: 'A comprehensive guide to boosting your daily study sessions.',
  publishedDate: '2026-08-01',
  lastModified: '2026-08-02',
  author: 'Aasheesh Katheriya',
  category: 'Productivity',
  tags: ['Study Tips', 'Focus'],
  coverImage: 'https://dhanuksoftwares.com/test-cover.png',
  readTime: '4 min read',
  relatedAppSlug: 'focusstreak',
  contentHtml: '<p>This is the test article body.</p><h2>Section One</h2><p>Deep work tips.</p>',
  faq: [
    { q: 'What is this article about?', a: 'Focus and study tips.' }
  ]
};

const sampleApps = [
  {
    name: 'FocusStreak',
    slug: 'focusstreak',
    tagline: 'Stay Focused Daily',
    shortDesc: 'Productivity timer and habit tracker.',
    emoji: '🔥'
  }
];

test('renderBlogPost produces valid HTML and rich meta', () => {
  const html = renderBlogPost(samplePost, 'https://dhanuksoftwares.com', sampleApps);
  assert.match(html, /<title>Test Study Post: Secrets to Studying Faster \| Dhanuk Softwares Blog<\/title>/);
  assert.match(html, /<meta property="og:title" content="Test Study Post: Secrets to Studying Faster"\/>/);
  assert.match(html, /<meta property="article:published_time" content="2026-08-01"\/>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/dhanuksoftwares\.com\/blog\/test-study-post\/"\/>/);
  assert.match(html, /Get The App &rarr;/);
});

test('renderBlogPost injects valid BlogPosting, Breadcrumb, and FAQ schemas', () => {
  const html = renderBlogPost(samplePost, 'https://dhanuksoftwares.com', sampleApps);
  assert.match(html, /"@type": "BlogPosting"/);
  assert.match(html, /"@type": "BreadcrumbList"/);
  assert.match(html, /"@type": "FAQPage"/);
  assert.match(html, /"headline": "Test Study Post: Secrets to Studying Faster"/);
});

test('renderBlogIndex produces blog catalog and CollectionPage schema', () => {
  const html = renderBlogIndex([samplePost], 'https://dhanuksoftwares.com');
  assert.match(html, /<title>Blog - Android Tips, Productivity & App Guides \| Dhanuk Softwares<\/title>/);
  assert.match(html, /"@type": "CollectionPage"/);
  assert.match(html, /Test Study Post: Secrets to Studying Faster/);
  assert.match(html, /href="https:\/\/dhanuksoftwares\.com\/blog\/test-study-post\/"/);
});
