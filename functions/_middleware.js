// SEO: 301 redirect www.dhanuksoftwares.com → dhanuksoftwares.com
// Fixes duplicate content, canonical mismatch, and Bing "discovered but not crawled" issue.
// Cloudflare Pages _redirects doesn't handle hostname-based redirects when both
// domains are on the same project, so we use a middleware function instead.

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // Redirect www → non-www with 301
  if (url.hostname === 'www.dhanuksoftwares.com') {
    const redirectUrl = `https://dhanuksoftwares.com${url.pathname}${url.search}${url.hash}`;
    return Response.redirect(redirectUrl, 301);
  }

  // Pass through to next handler for all other requests
  return context.next();
}