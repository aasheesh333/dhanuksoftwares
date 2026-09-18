export const BLOG_LIMITS = Object.freeze({
  maxPosts: 100,
  slug: 80,
  title: 120,
  tagline: 180,
  description: 320,
  author: 80,
  category: 60,
  tag: 40,
  maxTags: 12,
  coverImage: 500,
  readTime: 30,
  relatedAppSlug: 80,
  contentHtml: 50000,
  maxFaq: 10,
  faqQuestion: 200,
  faqAnswer: 1000,
  maxPayloadBytes: 2_000_000
});

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function fail(message) {
  return { ok: false, error: message };
}

function checkString(value, field, max, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    return required ? `${field} is required` : null;
  }
  if (typeof value !== 'string') return `${field} must be a string`;
  if (required && !value.trim()) return `${field} is required`;
  if (value.length > max) return `${field} must be ${max} characters or fewer`;
  return null;
}

export function validateBlogPost(post, { requireContent = true } = {}) {
  if (!post || typeof post !== 'object' || Array.isArray(post)) return fail('Each blog post must be an object');

  const stringRules = [
    ['slug', BLOG_LIMITS.slug, true],
    ['title', BLOG_LIMITS.title, true],
    ['tagline', BLOG_LIMITS.tagline, true],
    ['description', BLOG_LIMITS.description, true],
    ['author', BLOG_LIMITS.author, true],
    ['category', BLOG_LIMITS.category, true],
    ['coverImage', BLOG_LIMITS.coverImage, false],
    ['readTime', BLOG_LIMITS.readTime, false],
    ['relatedAppSlug', BLOG_LIMITS.relatedAppSlug, false]
  ];

  for (const [field, max, required] of stringRules) {
    const error = checkString(post[field], field, max, { required });
    if (error) return fail(error);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug)) return fail('slug must contain only lowercase letters, numbers, and hyphens');
  if (post.coverImage && !/^https?:\/\//i.test(post.coverImage)) return fail('coverImage must be an http(s) URL');

  for (const field of ['publishedDate', 'lastModified']) {
    if (post[field] !== undefined && post[field] !== null && post[field] !== '') {
      if (typeof post[field] !== 'string' || !ISO_DATE_RE.test(post[field]) || Number.isNaN(Date.parse(`${post[field]}T00:00:00Z`))) {
        return fail(`${field} must be a valid YYYY-MM-DD date`);
      }
    }
  }
  if (!post.publishedDate) return fail('publishedDate is required');

  if (requireContent || post.contentHtml !== undefined) {
    const error = checkString(post.contentHtml, 'contentHtml', BLOG_LIMITS.contentHtml, { required: requireContent });
    if (error) return fail(error);
  }

  if (post.tags !== undefined) {
    if (!Array.isArray(post.tags) || post.tags.length > BLOG_LIMITS.maxTags) return fail(`tags must contain at most ${BLOG_LIMITS.maxTags} items`);
    for (const tag of post.tags) {
      const error = checkString(tag, 'each tag', BLOG_LIMITS.tag, { required: true });
      if (error) return fail(error);
    }
  }

  if (post.faq !== undefined) {
    if (!Array.isArray(post.faq) || post.faq.length > BLOG_LIMITS.maxFaq) return fail(`faq must contain at most ${BLOG_LIMITS.maxFaq} items`);
    for (const item of post.faq) {
      if (!item || typeof item !== 'object') return fail('each FAQ item must be an object');
      const qError = checkString(item.q, 'FAQ question', BLOG_LIMITS.faqQuestion, { required: true });
      const aError = checkString(item.a, 'FAQ answer', BLOG_LIMITS.faqAnswer, { required: true });
      if (qError) return fail(qError);
      if (aError) return fail(aError);
    }
  }

  return { ok: true };
}

export function validateBlogPosts(posts) {
  if (!Array.isArray(posts)) return fail('posts[] required');
  if (posts.length > BLOG_LIMITS.maxPosts) return fail(`Too many blog posts (max ${BLOG_LIMITS.maxPosts})`);
  const seen = new Set();
  for (const post of posts) {
    const result = validateBlogPost(post);
    if (!result.ok) return result;
    if (seen.has(post.slug)) return fail(`Duplicate blog slug: ${post.slug}`);
    seen.add(post.slug);
  }
  const bytes = new TextEncoder().encode(JSON.stringify(posts)).length;
  if (bytes > BLOG_LIMITS.maxPayloadBytes) return fail('Blog content is too large');
  return { ok: true };
}
