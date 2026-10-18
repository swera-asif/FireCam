const CACHE = 'firecam-shell-v3-auth';
const SHELL = ['/', '/styles.css', '/app.js', '/data.js', '/assets/firecam-logo.png', '/manifest.webmanifest'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('firecam-shell-') && key !== CACHE).map(key => caches.delete(key))))); self.clients.claim(); });
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || (url.pathname.startsWith('/api/') || url.pathname.includes('with-chatgpt'))) return;
  event.respondWith(fetch(event.request).then(response => { if (response.ok) { const clone=response.clone(); caches.open(CACHE).then(cache=>cache.put(event.request,clone)); } return response; }).catch(async () => (await caches.match(event.request)) || (event.request.mode === 'navigate' ? await caches.match('/') : Response.error())));
});
