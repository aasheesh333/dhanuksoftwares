import fs from 'node:fs';
import path from 'node:path';

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  const date = new Date(isoStr);
  if (isNaN(date.getTime())) return isoStr;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function renderBlogPost(post, baseUrl, apps = []) {
  const templatePath = path.join(process.cwd(), 'blog-template.html');
  const template = fs.readFileSync(templatePath, 'utf8');

  const canonicalUrl = `${baseUrl}/blog/${post.slug}/`;
  const formattedPublishedDate = formatDate(post.publishedDate);
  const formattedLastModified = formatDate(post.lastModified || post.publishedDate);
  const keywords = (post.tags || []).join(', ');
  const coverImage = post.coverImage || `${baseUrl}/og-banner.png`;

  // Author initials
  const initials = (post.author || 'DS')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Open Graph article tags
  const articleTags = (post.tags || [])
    .map(tag => `  <meta property="article:tag" content="${escapeHtml(tag)}"/>`)
    .join('\n');

  // Tags pills
  const tagsPills = (post.tags || [])
    .map(tag => `<span class="blog-tag-pill">#${escapeHtml(tag)}</span>`)
    .join('\n    ');

  // Featured App Banner if relatedAppSlug matches
  let featuredAppBanner = '';
  if (post.relatedAppSlug) {
    const relatedApp = apps.find(a => a.slug === post.relatedAppSlug);
    if (relatedApp) {
      const appUrl = `${baseUrl}/apps/${relatedApp.slug}/`;
      const icon = relatedApp.icon
        ? `<img class="featured-app-icon" src="${escapeHtml(relatedApp.icon)}" alt="${escapeHtml(relatedApp.name)} icon" width="56" height="56" loading="lazy"/>`
        : `<div class="featured-app-icon" style="display:flex;align-items:center;justify-content:center;font-size:1.8rem;background:var(--surface);">${escapeHtml(relatedApp.emoji || '📱')}</div>`;
      featuredAppBanner = `
  <aside class="featured-app-banner">
    <div class="featured-app-info">
      ${icon}
      <div>
        <div class="featured-app-name">${escapeHtml(relatedApp.name)}</div>
        <div class="featured-app-desc">${escapeHtml(relatedApp.shortDesc || relatedApp.tagline || '')}</div>
      </div>
    </div>
    <a class="featured-app-btn" href="${appUrl}">Get The App &rarr;</a>
  </aside>`;
    }
  }

  // FAQ block
  let faqHtml = '';
  if (Array.isArray(post.faq) && post.faq.length > 0) {
    const faqItems = post.faq.map(item => `
    <details class="faq-item" style="background:var(--surface);border:1px solid var(--border);border-radius:12px;margin-bottom:0.8rem;padding:1rem;">
      <summary style="font-weight:600;cursor:pointer;color:#fff;font-size:1.05rem;">${escapeHtml(item.q)}</summary>
      <p style="margin-top:0.75rem;color:var(--muted);font-size:0.95rem;line-height:1.6;">${escapeHtml(item.a)}</p>
    </details>`).join('\n');

    faqHtml = `
  <section class="blog-faq" style="margin-top:3rem;">
    <h3 style="font-family:'Syne',sans-serif;font-size:1.5rem;font-weight:700;color:#fff;margin-bottom:1.5rem;">Frequently Asked Questions</h3>
    ${faqItems}
  </section>`;
  }

  // Structured Data (JSON-LD): BlogPosting
  const blogPostingSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": canonicalUrl
    },
    "headline": post.title,
    "description": post.description,
    "image": [coverImage],
    "datePublished": post.publishedDate,
    "dateModified": post.lastModified || post.publishedDate,
    "author": {
      "@type": "Person",
      "name": post.author,
      "url": `${baseUrl}/about`
    },
    "publisher": {
      "@type": "Organization",
      "name": "Dhanuk Softwares",
      "logo": {
        "@type": "ImageObject",
        "url": `${baseUrl}/favicon.svg`
      }
    },
    "articleSection": post.category || "Technology",
    "keywords": keywords
  };

  // Structured Data (JSON-LD): BreadcrumbList
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": `${baseUrl}/`
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Blog",
        "item": `${baseUrl}/blog/`
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": post.title,
        "item": canonicalUrl
      }
    ]
  };

  // Structured Data (JSON-LD): FAQPage
  let faqSchema = null;
  if (Array.isArray(post.faq) && post.faq.length > 0) {
    faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": post.faq.map(item => ({
        "@type": "Question",
        "name": item.q,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": item.a
        }
      }))
    };
  }

  let html = template
    .replace(/\{\{title\}\}/g, escapeHtml(post.title))
    .replace(/\{\{tagline\}\}/g, escapeHtml(post.tagline || ''))
    .replace(/\{\{description\}\}/g, escapeHtml(post.description || ''))
    .replace(/\{\{canonicalUrl\}\}/g, canonicalUrl)
    .replace(/\{\{coverImage\}\}/g, coverImage)
    .replace(/\{\{publishedDate\}\}/g, escapeHtml(post.publishedDate))
    .replace(/\{\{lastModified\}\}/g, escapeHtml(post.lastModified || post.publishedDate))
    .replace(/\{\{formattedPublishedDate\}\}/g, escapeHtml(formattedPublishedDate))
    .replace(/\{\{author\}\}/g, escapeHtml(post.author || 'Dhanuk Softwares'))
    .replace(/\{\{authorInitials\}\}/g, escapeHtml(initials))
    .replace(/\{\{category\}\}/g, escapeHtml(post.category || 'Android'))
    .replace(/\{\{readTime\}\}/g, escapeHtml(post.readTime || '5 min read'))
    .replace(/\{\{keywords\}\}/g, escapeHtml(keywords))
    .replace(/\{\{articleTags\}\}/g, articleTags)
    .replace(/\{\{tagsPills\}\}/g, tagsPills)
    .replace(/\{\{featuredAppBanner\}\}/g, featuredAppBanner)
    .replace(/\{\{contentHtml\}\}/g, post.contentHtml || '')
    .replace(/\{\{faqHtml\}\}/g, faqHtml)
    .replace(/\{\{schemaBlogPosting\}\}/g, JSON.stringify(blogPostingSchema, null, 2))
    .replace(/\{\{schemaBreadcrumb\}\}/g, JSON.stringify(breadcrumbSchema, null, 2));

  if (faqSchema) {
    html = html.replace(/\{\{#if schemaFAQ\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, p1) => {
      return p1.replace(/\{\{schemaFAQ\}\}/g, JSON.stringify(faqSchema, null, 2));
    });
  } else {
    html = html.replace(/\{\{#if schemaFAQ\}\}[\s\S]*?\{\{\/if\}\}/g, '');
  }

  return html;
}

export function renderBlogIndex(posts, baseUrl) {
  const cards = posts.map(post => {
    const postUrl = `${baseUrl}/blog/${post.slug}/`;
    const formattedDate = formatDate(post.publishedDate);
    return `
    <article class="blog-card" style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:2rem;display:flex;flex-direction:column;transition:border-color 0.2s,transform 0.2s;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
        <span class="blog-badge" style="margin-bottom:0;">${escapeHtml(post.category || 'General')}</span>
        <span style="font-size:0.85rem;color:var(--muted);">${escapeHtml(post.readTime || '')}</span>
      </div>
      <h2 style="font-family:'Syne',sans-serif;font-size:1.4rem;font-weight:700;margin-bottom:0.75rem;line-height:1.35;">
        <a href="${postUrl}" style="color:#fff;text-decoration:none;">${escapeHtml(post.title)}</a>
      </h2>
      <p style="color:var(--muted);font-size:0.95rem;line-height:1.6;margin-bottom:1.5rem;flex:1;">
        ${escapeHtml(post.description || post.tagline || '')}
      </p>
      <div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--border);padding-top:1.2rem;">
        <div style="font-size:0.85rem;color:var(--muted);">
          <span>By ${escapeHtml(post.author || 'Dhanuk Softwares')}</span> &bull; <time>${escapeHtml(formattedDate)}</time>
        </div>
        <a href="${postUrl}" style="color:var(--accent);text-decoration:none;font-weight:600;font-size:0.9rem;">Read More &rarr;</a>
      </div>
    </article>`;
  }).join('\n');

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Dhanuk Softwares Blog",
    "description": "Guides, productivity tips, and insights on Android apps by Dhanuk Softwares.",
    "url": `${baseUrl}/blog/`,
    "publisher": {
      "@type": "Organization",
      "name": "Dhanuk Softwares",
      "logo": `${baseUrl}/favicon.svg`
    }
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Blog - Android Tips, Productivity & App Guides | Dhanuk Softwares</title>
  <meta name="description" content="Explore expert articles, productivity workflows, Android tips, and inside looks into apps developed by Dhanuk Softwares."/>
  <meta name="keywords" content="Dhanuk Softwares Blog, Android app guides, productivity tips, habit streak, mobile app engineering"/>
  <meta name="robots" content="index, follow, max-image-preview:large"/>
  <link rel="canonical" href="${baseUrl}/blog/"/>

  <!-- Open Graph -->
  <meta property="og:title" content="Dhanuk Softwares Blog"/>
  <meta property="og:description" content="Explore expert articles, productivity workflows, and Android app guides from Dhanuk Softwares."/>
  <meta property="og:url" content="${baseUrl}/blog/"/>
  <meta property="og:type" content="website"/>
  <meta property="og:image" content="${baseUrl}/og-banner.png"/>

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="Dhanuk Softwares Blog"/>
  <meta name="twitter:description" content="Explore expert articles, productivity workflows, and Android app guides from Dhanuk Softwares."/>
  <meta name="twitter:image" content="${baseUrl}/og-banner.png"/>

  <link rel="icon" type="image/svg+xml" href="${baseUrl}/favicon.svg"/>
  <link rel="stylesheet" href="/assets/style.css"/>

  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Syne:wght@700;800&display=swap" rel="stylesheet"/>

  <style>
    .blog-header { padding: 4.5rem 1rem 3rem; text-align: center; max-width: 780px; margin: 0 auto; }
    .blog-header h1 { font-family: 'Syne', sans-serif; font-size: clamp(2.2rem, 5vw, 3.2rem); font-weight: 800; color: #fff; margin-bottom: 1rem; }
    .blog-header p { font-size: 1.15rem; color: var(--muted); line-height: 1.6; }
    .blog-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 2rem; max-width: 1100px; margin: 0 auto; padding: 1rem 1rem 5rem; }
    .blog-badge { display: inline-block; background: rgba(79,142,247,0.15); color: var(--accent); border: 1px solid rgba(79,142,247,0.3); border-radius: 999px; padding: 0.25rem 0.85rem; font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  </style>

  <script type="application/ld+json">
${JSON.stringify(collectionSchema, null, 2)}
  </script>
</head>
<body>

<nav>
  <a class="nav-logo" href="/">Dhanuk<span>Softwares</span></a>
  <div style="display:flex; align-items:center; gap: 1.5rem;">
    <a href="/apps/" style="color:var(--muted); text-decoration:none; font-size:0.92rem; font-weight:500;">Apps</a>
    <a href="/blog/" style="color:var(--text); text-decoration:none; font-size:0.92rem; font-weight:600;">Blog</a>
  </div>
</nav>

<header class="blog-header">
  <span class="blog-badge" style="margin-bottom:1rem;">Dhanuk Knowledge Base</span>
  <h1>Articles &amp; App Guides</h1>
  <p>Actionable advice on productivity, deep work, document management, and tutorials for Dhanuk Softwares Android apps.</p>
</header>

<main class="blog-grid">
  ${cards}
</main>

<footer>
  <p>&copy; <span id="footer-year">2026</span> <strong>Dhanuk Softwares</strong>. All rights reserved. &middot; <a href="/">Home</a> &middot; <a href="/apps/">All Apps</a> &middot; <a href="/blog/">Blog</a> &middot; <a href="/privacy/">Privacy</a> &middot; <a href="/terms/">Terms</a> &middot; <a href="mailto:support@dhanuksoftwares.com">Support</a></p>
  <p style="margin-top:0.4rem;">Made with &#9829; in India &middot; GST &amp; MSME Registered</p>
</footer>

<script>
  document.getElementById('footer-year').textContent = new Date().getFullYear();
</script>
</body>
</html>`;
}
