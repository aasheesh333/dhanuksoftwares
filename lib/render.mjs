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
  const offers = (app.marketplaces || []).map(m => ({
    '@type': 'Offer',
    url: m.url,
    availability: 'https://schema.org/InStock',
    price: '0',
    priceCurrency: 'INR'
  }));
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: app.name,
    description: app.shortDesc,
    applicationCategory: app.category || 'UtilitiesApplication',
    operatingSystem: 'Android',
    offers,
    url: `${baseUrl}/apps/${app.slug}/`
  };
  if (app.icon) schema.image = app.icon;
  if (app.screenshots && app.screenshots[0]) schema.screenshot = app.screenshots[0];
  if (app.rating && app.rating.count > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: app.rating.value,
      reviewCount: app.rating.count
    };
  }
  if (app.lastUpdated) schema.datePublished = app.lastUpdated;
  return JSON.stringify(schema, null, 2);
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

function renderScreenshotsHtml(screenshots) {
  if (!screenshots || !screenshots.length) return '';
  return screenshots.map((s, i) => `      <img src="${escapeHtml(s)}" alt="screenshot ${i + 1}" loading="lazy"/>`).join('\n');
}

function renderFaqHtml(faq) {
  if (!faq || !faq.length) return '';
  return faq.map(f => `    <div class="faq-item"><div class="faq-q">${escapeHtml(f.q)}</div><div class="faq-a">${escapeHtml(f.a)}</div></div>`).join('\n');
}

function renderRelatedHtml(related) {
  if (!related || !related.length) return '';
  return related.map(r =>
    `      <a class="related-card" href="/apps/${escapeHtml(r.slug)}/"><div class="related-emoji">${escapeHtml(r.emoji || '📱')}</div><div class="related-name">${escapeHtml(r.name)}</div><div class="related-desc">${escapeHtml(r.shortDesc || '')}</div></a>`
  ).join('\n');
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

export function renderApp(app, baseUrl, relatedApps) {
  const marketplaces = app.marketplaces || [];
  const primary = marketplaces[0];
  const secondary = marketplaces.slice(1);
  const keywordsString = (app.keywords || []).join(', ');
  const primaryScreenshot = (app.screenshots && app.screenshots[0]) || app.icon || `${baseUrl}/og-banner.png`;

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
  html = html.replace(/\{\{#if hasRating\}\}([\s\S]*?)\{\{\/if\}\}/g, (m, body) =>
    (app.rating && app.rating.count > 0) ? body : ''
  );
  html = html.replace(/\{\{#if lastUpdated\}\}([\s\S]*?)\{\{\/if\}\}/g, (m, body) =>
    app.lastUpdated ? body : ''
  );

  // 2. Each blocks (handle inner {{name}}/{{url}}/{{type}} before generic replacement)
  if (secondary.length > 0) {
    const heroSecondary = renderSecondaryHtml(secondary, app.slug);
    const finalSecondary = renderFinalSecondaryHtml(secondary, app.slug);
    html = html.replace(/\{\{#each secondaryDownloads\}\}[\s\S]*?\{\{\/each\}\}/g, heroSecondary);
    html = html.replace(/\{\{#each finalSecondaryDownloads\}\}[\s\S]*?\{\{\/each\}\}/g, finalSecondary);
    html = html.replace(/\{\{secondaryCount\}\}/g, String(secondary.length));
    html = html.replace(/\{\{#if hasSecondaryDownloads\}\}[\s\S]*?\{\{\/if\}\}/g, '');
  } else {
    html = html.replace(/\{\{#if hasSecondaryDownloads\}\}[\s\S]*?\{\{\/if\}\}/g, '');
  }

  html = html.replace(/\{\{#each features\}\}[\s\S]*?\{\{\/each\}\}/g, () => renderFeaturesHtml(app.features));
  html = html.replace(/\{\{#each faq\}\}[\s\S]*?\{\{\/each\}\}/g, () => renderFaqHtml(app.faq));
  html = html.replace(/\{\{#each screenshots\}\}[\s\S]*?\{\{\/each\}\}/g, () => renderScreenshotsHtml(app.screenshots));
  html = html.replace(/\{\{#each relatedApps\}\}[\s\S]*?\{\{\/each\}\}/g, () => renderRelatedHtml(relatedApps));

  // 3. If/else for icon
  if (app.icon) {
    html = html.replace(/\{\{#if icon\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g, '$1');
  } else {
    html = html.replace(/\{\{#if icon\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g, '$2');
  }

  // 4. If primaryDownloadUrl - keep only the if branch (no else support in template)
  html = html.replace(/\{\{#if primaryDownloadUrl\}\}([\s\S]*?)\{\{\/if\}\}/g, '$1');
  // 5. Generic replacements
  html = html.replace(/\{\{name\}\}/g, escapeHtml(app.name));
  html = html.replace(/\{\{slug\}\}/g, escapeHtml(app.slug));
  html = html.replace(/\{\{tagline\}\}/g, escapeHtml(app.tagline || app.shortDesc || ''));
  html = html.replace(/\{\{shortDesc\}\}/g, escapeHtml(app.shortDesc || ''));
  html = html.replace(/\{\{longDescription\}\}/g, escapeHtml(app.longDescription || ''));
  html = html.replace(/\{\{keywordsString\}\}/g, escapeHtml(keywordsString));
  html = html.replace(/\{\{emoji\}\}/g, escapeHtml(app.emoji || '📱'));
  html = html.replace(/\{\{icon\}\}/g, escapeHtml(app.icon || ''));
  html = html.replace(/\{\{category\}\}/g, escapeHtml(app.category || 'Utilities'));
  html = html.replace(/\{\{lastUpdated\}\}/g, escapeHtml(app.lastUpdated || ''));
  html = html.replace(/\{\{primaryScreenshot\}\}/g, escapeHtml(primaryScreenshot));
  html = html.replace(/\{\{ratingValue\}\}/g, String(app.rating?.value || 0));
  html = html.replace(/\{\{ratingCount\}\}/g, String(app.rating?.count || 0));

  if (primary) {
    html = html.replace(/\{\{primaryDownloadUrl\}\}/g, escapeHtml(addUtm(primary.url, app.slug, primary.type, 'primary')));
    html = html.replace(/\{\{primaryMarketplaceName\}\}/g, escapeHtml(primary.name));
    html = html.replace(/\{\{primaryMarketplaceType\}\}/g, escapeHtml(primary.type));
  } else {
    html = html.replace(/\{\{primaryDownloadUrl\}\}/g, 'mailto:support@dhanuksoftwares.com');
    html = html.replace(/\{\{primaryMarketplaceName\}\}/g, 'Contact Us');
    html = html.replace(/\{\{primaryMarketplaceType\}\}/g, 'contact');
  }

  // 5. Final cleanup of any remaining if/endif
  html = html.replace(/\{\{#if hasPrimaryDownload\}\}/g, '');
  html = html.replace(/\{\{\/if\}\}/g, '');

  // 6. Schema
  html = html.replace(/\{\{schemaSoftwareApp\}\}/g, buildSchemaSoftwareApp(app, baseUrl));
  html = html.replace(/\{\{schemaFAQ\}\}/g, buildSchemaFAQ(app));
  html = html.replace(/\{\{schemaBreadcrumb\}\}/g, buildSchemaBreadcrumb(app, baseUrl));

  return html;
}
