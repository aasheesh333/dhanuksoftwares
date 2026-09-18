import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateBlogPost, validateBlogPosts } from '../lib/blog-schema.mjs';

const validPost = {
  slug: 'focus-guide', title: 'Focus Guide', tagline: 'Study better every day',
  description: 'A practical guide for better study sessions.', publishedDate: '2026-09-18',
  author: 'Aasheesh Katheriya', category: 'Productivity', tags: ['Focus'],
  coverImage: 'https://dhanuksoftwares.com/og-banner.png', readTime: '5 min read',
  contentHtml: '<p>Article content.</p>', faq: [{ q: 'Why focus?', a: 'It helps.' }]
};

test('validateBlogPost accepts a valid post', () => {
  assert.deepEqual(validateBlogPost(validPost), { ok: true });
});

test('validateBlogPost rejects overlong SEO fields and unsafe slugs', () => {
  assert.equal(validateBlogPost({ ...validPost, title: 'x'.repeat(121) }).ok, false);
  assert.equal(validateBlogPost({ ...validPost, slug: 'Bad Slug' }).ok, false);
});

test('validateBlogPosts rejects duplicate slugs and too many FAQs', () => {
  assert.equal(validateBlogPosts([validPost, { ...validPost, title: 'Second' }]).ok, false);
  assert.equal(validateBlogPost({ ...validPost, faq: Array.from({ length: 11 }, () => ({ q: 'Q', a: 'A' })) }).ok, false);
});
