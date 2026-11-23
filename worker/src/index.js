export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let p = url.pathname;

    // Strip prefix /kekeringan atau /wilayah ketika dipanggil lewat Service Binding agri-gateway
    if (p === '/kekeringan') {
      p = '/';
    } else if (p.startsWith('/kekeringan/')) {
      p = p.slice('/kekeringan'.length);
    }

    const assetUrl = new URL(p + url.search, url.origin);
    let res = await env.ASSETS.fetch(new Request(assetUrl.toString(), request));

    // Fallback ke index.html untuk rute dinamis seperti /kekeringan/3312/
    const hasExt = /\.[a-zA-Z0-9]{1,8}$/.test(p);
    if (res.status === 404 && !hasExt) {
      const idxUrl = new URL('/index.html', url.origin);
      res = await env.ASSETS.fetch(new Request(idxUrl.toString(), request));
    }

    return res;
  },
};
