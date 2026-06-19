const MARKETPLACE_MAP = {
  playUrl:     { name: 'Google Play', type: 'play' },
  uptodownUrl: { name: 'Uptodown',    type: 'uptodown' },
  oppoUrl:     { name: 'OPPO Store',  type: 'oppo' },
  vivoUrl:     { name: 'Vivo Store',  type: 'vivo' }
};

export function migrateApp(app) {
  if (!app) return app;
  if (Array.isArray(app.marketplaces)) return app;
  const marketplaces = [];
  for (const [field, meta] of Object.entries(MARKETPLACE_MAP)) {
    const url = (app[field] || '').trim();
    if (url) marketplaces.push({ name: meta.name, url, type: meta.type });
  }
  const result = { ...app };
  delete result.playUrl;
  delete result.uptodownUrl;
  delete result.oppoUrl;
  delete result.vivoUrl;
  if (app.desc && !app.shortDesc) {
    result.shortDesc = app.desc;
    delete result.desc;
  }
  if (!app.tagline && app.shortDesc) {
    result.tagline = app.shortDesc.slice(0, 60);
  }
  if (!app.slug && app.name) {
    result.slug = app.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  if (!app.longDescription) {
    result.longDescription = '';
  }
  if (!app.keywords) result.keywords = [];
  if (!app.features) result.features = [];
  if (!app.faq) result.faq = [];
  if (!app.screenshots) result.screenshots = [];
  if (!app.rating) result.rating = { value: 0, count: 0 };
  result.marketplaces = marketplaces;
  return result;
}

export function migrateAll(apps) {
  if (!Array.isArray(apps)) return [];
  return apps.map(migrateApp);
}
