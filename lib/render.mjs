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

const ALLOWED_TAGS = new Set(['p', 'br', 'strong', 'em', 'b', 'i', 'u', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'a', 'blockquote', 'code', 'pre', 'hr']);

const DUPLICATE_HEADING_PATTERNS = [
  /^key\s+features\b/i,
  /^features\b/i,
  /^what'?s?\s+new\b/i,
  /^highlights\b/i,
  /^frequently\s+asked\s+questions\b/i,
  /^faqs?\b/i,
  /^about\s+/i,
  /^how\s+to\s+(download|install|use|set\s*up)\b/i,
  /^how\s+\w+\s+works\b/i,
  /^installation\b/i,
  /^getting\s+started\b/i,
  /^technical\s+(details|specifications|info(rmation)?|requirements)\b/i,
  /^specifications\b/i,
  /^requirements\b/i,
  /^screenshots?\b/i,
  /^gallery\b/i,
  /^benefits?\s+of\b/i,
  /^why\s+choose\b/i,
  /^conclusion\b/i,
  /^final\s+thoughts\b/i,
  /^summary\b/i,
  /^wrap(ping)?\s+up\b/i,
  /^disclaim(er|er)\b/i,
  /^privacy\s+(policy|notice)\b/i
];

function stripDuplicateSections(html) {
  if (!html) return html;
  let s = String(html);
  s = s.replace(/<h([234])[^>]*>([\s\S]*?)<\/h\1>/gi, (m, level, text) => {
    const t = text.replace(/<[^>]+>/g, '').trim();
    for (const re of DUPLICATE_HEADING_PATTERNS) {
      if (re.test(t)) return '';
    }
    return m;
  });
  return s;
}

function convertMarkdownLists(html) {
  if (!html) return html;
  let s = String(html);
  s = s.replace(/(^|\n)\s*[*\-+]\s+([^\n]+)/g, (m, prefix, item) => {
    return `${prefix}<li>${item.trim()}</li>`;
  });
  s = s.replace(/(<li>[^<]*<\/li>\s*)+/g, (m) => `<ul>${m}</ul>`);
  s = s.replace(/([\.\!\?\:])\s+\*\s+([A-Z][^*\n]*?)(?=[\.\!\?]\s|\n|$)/g, (m, punct, item) => {
    const trimmed = item.trim();
    return `${punct}</p><ul><li>${trimmed}</li></ul><p>`;
  });
  s = s.replace(/<ul>\s*<ul[^>]*>/gi, '<ul>');
  s = s.replace(/<\/ul>\s*<\/ul>/gi, '</ul>');
  s = s.replace(/<p>\s*<\/p>/g, '');
  return s;
}

export function sanitizeRichText(str) {
  if (str == null) return '';
  let s = String(str);
  s = convertMarkdownLists(s);
  s = stripDuplicateSections(s);
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '');
  s = s.replace(/<iframe[\s\S]*?<\/iframe>/gi, '');
  s = s.replace(/<object[\s\S]*?<\/object>/gi, '');
  s = s.replace(/<embed[\s\S]*?<\/embed>/gi, '');
  s = s.replace(/<form[\s\S]*?<\/form>/gi, '');
  s = s.replace(/ on\w+="[^"]*"/gi, '');
  s = s.replace(/ on\w+='[^']*'/gi, '');
  s = s.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*?)>/g, (m, slash, tag, attrs) => {
    const t = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(t)) return '';
    if (slash) {
      if (t === 'a') return '|CLOSE_A|';
      return `</${t}>`;
    }
    if (t === 'a') {
      const hrefMatch = attrs.match(/href\s*=\s*["']([^"']+)["']/i);
      if (!hrefMatch) return '|CLOSE_A|';
      const href = hrefMatch[1];
      if (/javascript:/i.test(href) || /data:/i.test(href) || /vbscript:/i.test(href)) return '|CLOSE_A|';
      return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">`;
    }
    if (t === 'br' || t === 'hr') return `<${t}>`;
    return `<${t}>`;
  });
  s = s.replace(/\|CLOSE_A\|/g, '');
  return s;
}

export function addUtm(url, slug, marketplace, source) {
  if (!url) return url;
  try {
    const u = new URL(url);
    u.searchParams.set('utm_source', 'dhanuksoftwares');
    u.searchParams.set('utm_medium', 'website');
    u.searchParams.set('utm_campaign', 'app_page');
    u.searchParams.set('utm_content', `${slug}_${source}`);
    u.searchParams.set('utm_term', marketplace);
    return u.toString();
  } catch (e) {
    return url;
  }
}

export function buildSchemaSoftwareApp(app, baseUrl) {
  const marketplaceOffers = (app.marketplaces || []).map(m => ({
    '@type': 'Offer',
    url: m.url,
    availability: 'https://schema.org/InStock',
    price: 0,
    priceCurrency: 'INR'
  }));
  if (marketplaceOffers.length === 0) {
    marketplaceOffers.push({
      '@type': 'Offer',
      url: `${baseUrl}/apps/${app.slug}/`,
      availability: 'https://schema.org/InStock',
      price: 0,
      priceCurrency: 'INR'
    });
  }
  const categoryMap = {
    'Astrology': 'LifestyleApplication',
    'Productivity': 'ProductivityApplication',
    'Tools': 'UtilitiesApplication',
    'Utility': 'UtilitiesApplication',
    'Entertainment': 'EntertainmentApplication',
    'Finance': 'FinanceApplication',
    'Health & Fitness': 'HealthApplication',
    'Health': 'HealthApplication',
    'Lifestyle': 'LifestyleApplication',
    'Business': 'BusinessApplication',
    'Communication': 'CommunicationApplication',
    'Education': 'EducationalApplication',
    'Photo & Video': 'MultimediaApplication',
    'Creative': 'MultimediaApplication',
    'Other': 'UtilitiesApplication'
  };
  const category = app.category || app.tag || '';
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': `${baseUrl}/apps/${app.slug}/#software`,
    name: app.name,
    description: app.shortDesc,
    applicationCategory: categoryMap[category] || 'UtilitiesApplication',
    operatingSystem: 'Android',
    softwareRequirements: app.softwareRequirements || 'Android 6.0+',
    inLanguage: app.inLanguage || 'en',
    offers: marketplaceOffers,
    url: `${baseUrl}/apps/${app.slug}/`,
    author: {
      '@type': 'Organization',
      name: 'Dhanuk Softwares',
      url: baseUrl + '/'
    },
    publisher: {
      '@type': 'Organization',
      name: 'Dhanuk Softwares',
      url: baseUrl + '/'
    }
  };
  if (app.features && app.features.length) {
    schema.featureList = app.features.join(', ');
  }
  if (app.totalDownloads) schema.totalDownloads = app.totalDownloads;
  if (app.appSize) schema.fileSize = app.appSize;
  if (app.version) schema.softwareVersion = app.version;
  if (app.contentRating) schema.contentRating = app.contentRating;
  if (app.releaseNotes) schema.releaseNotes = app.releaseNotes;
  const primaryImage = (app.screenshots && app.screenshots[0]) || app.icon;
  schema.image = primaryImage;
  schema.screenshot = (app.screenshots && app.screenshots.length) ? app.screenshots : [primaryImage];
  if (app.datePublished) {
    schema.datePublished = app.datePublished;
  }
  if (app.lastUpdated) {
    schema.dateModified = app.lastUpdated;
  }
  if (app.rating && typeof app.rating.value === 'number' && typeof app.rating.count === 'number') {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: app.rating.value,
      ratingCount: app.rating.count,
      bestRating: 5,
      worstRating: 1
    };
  }
  return JSON.stringify(schema, null, 2)
    .replace(/</g, '\\u003c');
}

export function buildSchemaFAQ(app) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: (app.faq || []).map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a }
    }))
  };
  return JSON.stringify(schema, null, 2);
}

export function buildSchemaBreadcrumb(app, baseUrl) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl + '/' },
      { '@type': 'ListItem', position: 2, name: 'Apps', item: baseUrl + '/apps/' },
      { '@type': 'ListItem', position: 3, name: app.name, item: `${baseUrl}/apps/${app.slug}/` }
    ]
  };
  return JSON.stringify(schema, null, 2);
}

function renderFeaturesHtml(features) {
  if (!features || !features.length) return '';
  return features.map(f => `      <div class="feature-card"><div class="feature-icon">&#10003;</div><div class="feature-title">${escapeHtml(f)}</div></div>`).join('\n');
}

function renderScreenshotsHtml(screenshots, appName) {
  if (!screenshots || !screenshots.length) return '';
  return screenshots.map((s, i) => `      <img src="${escapeHtml(normalizePlayStoreImage(s, 526))}" alt="${escapeHtml(appName)} screenshot ${i + 1}" loading="lazy" width="540" height="1170"/>`).join('\n');
}

function renderFaqHtml(faq) {
  if (!faq || !faq.length) return '';
  return faq.map(f => `    <details class="faq-item"><summary class="faq-q">${escapeHtml(f.q)}</summary><div class="faq-a">${escapeHtml(f.a)}</div></details>`).join('\n');
}

function renderRelatedHtml(related) {
  if (!related || !related.length) return '';
  return related.map(r => {
    const icon = r.icon
      ? `<img class="recommended-card-icon" src="${escapeHtml(normalizePlayStoreImage(r.icon, 96))}" alt="${escapeHtml(r.name)} icon" width="52" height="52"/>`
      : `<div class="recommended-card-emoji">${escapeHtml(r.emoji || '📱')}</div>`;
    const meta = r.category ? escapeHtml(r.category) : 'Free';
    return `      <a class="recommended-card" href="/apps/${escapeHtml(r.slug)}/">${icon}<div class="recommended-card-info"><div class="recommended-card-name">${escapeHtml(r.name)}</div><div class="recommended-card-meta"><span>${meta}</span></div></div><span class="recommended-card-go">&rarr;</span></a>`;
  }).join('\n');
}

// Ensure Play Store image URLs have a size param (Google Play 400s without one)
function normalizePlayStoreImage(url, size) {
  if (!url || !url.includes('play-lh.googleusercontent.com')) return url;
  if (/[=][wh]\d+/.test(url)) return url;
  const sep = url.includes('?') ? '&' : '=';
  return url + sep + 'w' + size;
}

function renderSecondaryHtml(marketplaces, slug) {
  if (!marketplaces || !marketplaces.length) return '';
  return marketplaces.map(m =>
    `<a class="btn-secondary" href="${escapeHtml(addUtm(m.url, slug, m.type, 'hero_more'))}" onclick="trackDl('${escapeHtml(slug)}','${escapeHtml(m.type)}','hero_more')" rel="noopener">${escapeHtml(m.name)}</a>`
  ).join('\n        ');
}

function renderFinalSecondaryHtml(marketplaces, slug) {
  if (!marketplaces || !marketplaces.length) return '';
  return marketplaces.map(m =>
    `<a class="btn-secondary" href="${escapeHtml(addUtm(m.url, slug, m.type, 'final_more'))}" onclick="trackDl('${escapeHtml(slug)}','${escapeHtml(m.type)}','final_more')" rel="noopener">${escapeHtml(m.name)}</a>`
  ).join('\n      ');
}

function renderMarketplaceRowsHtml(marketplaces, slug) {
  if (!marketplaces || !marketplaces.length) return '';
  return marketplaces.map(m =>
    `      <a class="marketplace-row" href="${escapeHtml(addUtm(m.url, slug, m.type, 'download_options_more'))}" onclick="trackDl('${escapeHtml(slug)}','${escapeHtml(m.type)}','download_options_more')" rel="noopener">
        <div class="mp-info">
          <span class="mp-name">${escapeHtml(m.name)}</span>
          <span class="mp-tag">Alternative store</span>
        </div>
        <span class="mp-go">&rarr;</span>
      </a>`
  ).join('\n');
}

export function renderApp(app, baseUrl, relatedApps) {
  const marketplaces = app.marketplaces || [];
  const primary = marketplaces[0];
  const secondary = marketplaces.slice(1);
  const keywordsString = (app.keywords || []).join(', ');
  const primaryScreenshot = (app.screenshots && app.screenshots[0]) || app.icon || `${baseUrl}/og-banner.png`;
  const hasStats = !!(app.totalDownloads || app.appSize || app.contentRating || app.lastUpdated);
  let shortSnippet = (app.shortDesc || '').trim();
  if (!shortSnippet && app.longDescription) {
    const stripped = sanitizeRichText(app.longDescription).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    shortSnippet = stripped.length > 220 ? stripped.slice(0, 217).trim() + '…' : stripped;
  }
  if (shortSnippet.length > 220) shortSnippet = shortSnippet.slice(0, 217).trim() + '…';

  const template = fs.readFileSync(path.join(process.cwd(), 'template.html'), 'utf8');

  let html = template;

  // 1. Conditional sections (must run before generic replacement so {{var}} inside preserved)
  html = html.replace(/\{\{#if features\.length\}\}([\s\S]*?)\{\{\/if\}\}/g, (m, body) =>
    (app.features && app.features.length) ? body : ''
  );
  html = html.replace(/\{\{#if screenshots\.length\}\}([\s\S]*?)\{\{\/if\}\}/g, (m, body) =>
    (app.screenshots && app.screenshots.length) ? body : ''
  );
  html = html.replace(/\{\{#if faq\.length\}\}([\s\S]*?)\{\{\/if\}\}/g, (m, body) =>
    (app.faq && app.faq.length) ? body : ''
  );
  html = html.replace(/\{\{#if relatedApps\.length\}\}([\s\S]*?)\{\{\/if\}\}/g, (m, body) =>
    (relatedApps && relatedApps.length) ? body : ''
  );
  html = html.replace(/\{\{#if hasStats\}\}([\s\S]*?)\{\{\/if\}\}/g, (m, body) =>
    hasStats ? body : ''
  );
  html = html.replace(/\{\{#if totalDownloads\}\}([\s\S]*?)\{\{\/if\}\}/g, (m, body) =>
    app.totalDownloads ? body : ''
  );
  html = html.replace(/\{\{#if appSize\}\}([\s\S]*?)\{\{\/if\}\}/g, (m, body) =>
    app.appSize ? body : ''
  );
  html = html.replace(/\{\{#if contentRating\}\}([\s\S]*?)\{\{\/if\}\}/g, (m, body) =>
    app.contentRating ? body : ''
  );
  html = html.replace(/\{\{#if tagline\}\}([\s\S]*?)\{\{\/if\}\}/g, (m, body) =>
    app.tagline ? body : ''
  );
  html = html.replace(/\{\{#if softwareRequirements\}\}([\s\S]*?)\{\{\/if\}\}/g, (m, body) =>
    app.softwareRequirements ? body : ''
  );
  html = html.replace(/\{\{#if inLanguage\}\}([\s\S]*?)\{\{\/if\}\}/g, (m, body) =>
    app.inLanguage ? body : ''
  );
  html = html.replace(/\{\{#if lastUpdated\}\}([\s\S]*?)\{\{\/if\}\}/g, (m, body) =>
    app.lastUpdated ? body : ''
  );
  html = html.replace(/\{\{#if shortSnippet\}\}([\s\S]*?)\{\{\/if\}\}/g, (m, body) =>
    shortSnippet ? body : ''
  );

  // 2. Each blocks (handle inner {{name}}/{{url}}/{{type}} before generic replacement)
  if (secondary.length > 0) {
    const heroSecondary = renderSecondaryHtml(secondary, app.slug);
    const finalSecondary = renderFinalSecondaryHtml(secondary, app.slug);
    const marketplaceRows = renderMarketplaceRowsHtml(secondary, app.slug);
    html = html.replace(/\{\{#each secondaryDownloads\}\}[\s\S]*?\{\{\/each\}\}/g, heroSecondary);
    html = html.replace(/\{\{#each finalSecondaryDownloads\}\}[\s\S]*?\{\{\/each\}\}/g, finalSecondary);
    html = html.replace(/\{\{#each marketplaceRows\}\}[\s\S]*?\{\{\/each\}\}/g, marketplaceRows);
    html = html.replace(/\{\{secondaryCount\}\}/g, String(secondary.length));
  } else {
    // No secondary: remove any bare each blocks
    html = html.replace(/\{\{#each secondaryDownloads\}\}[\s\S]*?\{\{\/each\}\}/g, '');
    html = html.replace(/\{\{#each marketplaceRows\}\}[\s\S]*?\{\{\/each\}\}/g, '');
  }

  html = html.replace(/\{\{#each features\}\}[\s\S]*?\{\{\/each\}\}/g, () => renderFeaturesHtml(app.features));
  html = html.replace(/\{\{#each faq\}\}[\s\S]*?\{\{\/each\}\}/g, () => renderFaqHtml(app.faq));
  html = html.replace(/\{\{#each screenshots\}\}[\s\S]*?\{\{\/each\}\}/g, () => renderScreenshotsHtml(app.screenshots, app.name));
  html = html.replace(/\{\{#each relatedApps\}\}[\s\S]*?\{\{\/each\}\}/g, () => renderRelatedHtml(relatedApps));

  // 3. If/else for icon
  if (app.icon) {
    html = html.replace(/\{\{#if icon\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g, '$1');
  } else {
    html = html.replace(/\{\{#if icon\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g, '$2');
  }

  // 4. If primaryDownloadUrl - keep only the if branch (no else support in template)
  if (primary) {
    html = html.replace(/\{\{#if primaryDownloadUrl\}\}([\s\S]*?)\{\{\/if\}\}/g, '$1');
  } else {
    html = html.replace(/\{\{#if primaryDownloadUrl\}\}[\s\S]*?\{\{\/if\}\}/g, '');
  }
  // 4b. If hasPrimaryDownload - hide nav and sticky bar entirely when no marketplace
  if (primary) {
    html = html.replace(/\{\{#if hasPrimaryDownload\}\}([\s\S]*?)\{\{\/if\}\}/g, '$1');
    html = html.replace(/\{\{#unless hasPrimaryDownload\}\}[\s\S]*?\{\{\/unless\}\}/g, '');
  } else {
    html = html.replace(/\{\{#if hasPrimaryDownload\}\}[\s\S]*?\{\{\/if\}\}/g, '');
    html = html.replace(/\{\{#unless hasPrimaryDownload\}\}([\s\S]*?)\{\{\/unless\}\}/g, '$1');
  }
  // 4c. hasSecondaryDownloads if/unless
  if (secondary.length > 0) {
    html = html.replace(/\{\{#if hasSecondaryDownloads\}\}([\s\S]*?)\{\{\/if\}\}/g, '$1');
    html = html.replace(/\{\{#unless hasSecondaryDownloads\}\}[\s\S]*?\{\{\/unless\}\}/g, '');
  } else {
    html = html.replace(/\{\{#if hasSecondaryDownloads\}\}[\s\S]*?\{\{\/if\}\}/g, '');
    html = html.replace(/\{\{#unless hasSecondaryDownloads\}\}([\s\S]*?)\{\{\/unless\}\}/g, '$1');
  }
  // 5. Generic replacements
  html = html.replace(/\{\{baseUrl\}\}/g, baseUrl);
  html = html.replace(/\{\{name\}\}/g, escapeHtml(app.name));
  html = html.replace(/\{\{nameUrlEncoded\}\}/g, encodeURIComponent(app.name));
  html = html.replace(/\{\{slug\}\}/g, escapeHtml(app.slug));
  html = html.replace(/\{\{tagline\}\}/g, escapeHtml(app.tagline || app.shortDesc || ''));
  html = html.replace(/\{\{shortDesc\}\}/g, escapeHtml(app.shortDesc || ''));
  html = html.replace(/\{\{longDescription\}\}/g, sanitizeRichText(app.longDescription || ''));
  if (keywordsString) {
    html = html.replace(/\{\{keywordsString\}\}/g, escapeHtml(keywordsString));
  } else {
    html = html.replace(/\s*<meta name="keywords" content="\{\{keywordsString\}\}"\/>/g, '');
    html = html.replace(/\{\{keywordsString\}\}/g, '');
  }
  html = html.replace(/\{\{emoji\}\}/g, escapeHtml(app.emoji || '📱'));
  html = html.replace(/\{\{icon\}\}/g, escapeHtml(normalizePlayStoreImage(app.icon || '', 96)));
  html = html.replace(/\{\{category\}\}/g, escapeHtml(app.category || 'Utilities'));
  html = html.replace(/\{\{lastUpdated\}\}/g, escapeHtml(app.lastUpdated || ''));
  html = html.replace(/\{\{primaryScreenshot\}\}/g, escapeHtml(normalizePlayStoreImage(primaryScreenshot, 526)));
  html = html.replace(/\{\{shortSnippet\}\}/g, escapeHtml(shortSnippet));
  html = html.replace(/\{\{hasStats\}\}/g, hasStats ? 'true' : '');
  html = html.replace(/\{\{totalDownloads\}\}/g, escapeHtml(app.totalDownloads || ''));
  html = html.replace(/\{\{appSize\}\}/g, escapeHtml(app.appSize || '—'));
  html = html.replace(/\{\{contentRating\}\}/g, escapeHtml(app.contentRating || ''));
  html = html.replace(/\{\{softwareRequirements\}\}/g, escapeHtml(app.softwareRequirements || 'Android 6.0+'));
  html = html.replace(/\{\{inLanguage\}\}/g, escapeHtml(app.inLanguage || 'en'));
  html = html.replace(/\{\{developer\}\}/g, escapeHtml(app.developer || 'Dhanuk Softwares'));
  html = html.replace(/\{\{datePublished\}\}/g, escapeHtml(app.datePublished || app.lastUpdated || ''));

  if (primary) {
    html = html.replace(/\{\{primaryDownloadUrl\}\}/g, escapeHtml(addUtm(primary.url, app.slug, primary.type, 'primary')));
    html = html.replace(/\{\{primaryMarketplaceName\}\}/g, escapeHtml(primary.name));
    html = html.replace(/\{\{primaryMarketplaceType\}\}/g, escapeHtml(primary.type));
  } else {
    html = html.replace(/\{\{primaryDownloadUrl\}\}/g, 'mailto:support@dhanuksoftwares.com');
    html = html.replace(/\{\{primaryMarketplaceName\}\}/g, 'Contact Us');
    html = html.replace(/\{\{primaryMarketplaceType\}\}/g, 'contact');
  }

  // 5. Final cleanup of any remaining if/endif (defensive)
  html = html.replace(/\{\{\/if\}\}/g, '');
  html = html.replace(/\{\{\/unless\}\}/g, '');
  html = html.replace(/\{\{#if hasPrimaryDownload\}\}/g, '');
  html = html.replace(/\{\{#unless hasPrimaryDownload\}\}/g, '');

  // 6. Schema
  html = html.replace(/\{\{schemaSoftwareApp\}\}/g, buildSchemaSoftwareApp(app, baseUrl));
  html = html.replace(/\{\{schemaFAQ\}\}/g, buildSchemaFAQ(app));
  html = html.replace(/\{\{schemaBreadcrumb\}\}/g, buildSchemaBreadcrumb(app, baseUrl));

  return html;
}
