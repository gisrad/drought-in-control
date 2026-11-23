export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let p = url.pathname;

    if (p === '/kekeringan') {
      p = '/';
    } else if (p.startsWith('/kekeringan/')) {
      p = p.slice('/kekeringan'.length);
    } else if (p === '/wilayah' || p.startsWith('/wilayah/')) {
      p = '/';
    }

    const assetUrl = new URL(p + url.search, url.origin);
    let res = await env.ASSETS.fetch(new Request(assetUrl.toString(), { method: request.method, headers: request.headers }));

    // Gunakan '/' (bukan '/index.html') karena Workers Static Assets me-redirect '/index.html' -> 308 '/'
    const hasExt = /\.[a-zA-Z0-9]{1,8}$/.test(p);
    if (res.status === 404 && !hasExt) {
      const idxUrl = new URL('/', url.origin);
      res = await env.ASSETS.fetch(new Request(idxUrl.toString(), { method: request.method, headers: request.headers }));
    }

    return res;
  },
};
