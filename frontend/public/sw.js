const CACHE_NAME = 'lanterna-static-v2';
const STATIC_FILES = ['/logo.svg', '/logowhite.png', '/manifest.json'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key === 'cmoc-brasil-v1' || (key.startsWith('lanterna-static-') && key !== CACHE_NAME)).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  const isStatic = STATIC_FILES.includes(url.pathname) || url.pathname.startsWith('/assets/');
  if (isStatic) event.respondWith(fetch(event.request).then(response => {
    if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy))); }
    return response;
  }).catch(async () => (await caches.match(event.request)) || new Response('Recurso indisponível', { status: 503 })));
  else if (event.request.mode === 'navigate') event.respondWith(fetch(event.request).catch(() => new Response(
    '<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sem conexão</title><body style="font-family:system-ui;padding:48px;color:#292338"><h1>Sem conexão com o servidor</h1><p>As operações precisam de confirmação online. Verifique a rede e recarregue a página.</p><button onclick="location.reload()" style="padding:16px">Tentar novamente</button></body></html>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )));
});
