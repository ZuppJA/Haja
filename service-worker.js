/* Haja PWA: only the compact app shell is cached. Supabase API and Storage stay network-only. */
'use strict';
const CACHE_NAME = 'haja-v12-profile-privacy-sidebar-mine-agenda';
const BASE_URL = self.registration.scope;
const APP_ROOT_URL = new URL('./', BASE_URL);
const INDEX_URL = new URL('./index.html', BASE_URL);
const MANIFEST_URL = new URL('./site.webmanifest', BASE_URL);
const APP_PATHS = new Set([APP_ROOT_URL.pathname, INDEX_URL.pathname]);
const SHELL_FILES = [APP_ROOT_URL.href, INDEX_URL.href, MANIFEST_URL.href];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => (key.startsWith('haja-') || key.startsWith('rede-jovens-')) && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    if (!APP_PATHS.has(url.pathname)) return;
    const cacheKey = new URL(url.pathname, url.origin).href;
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(cacheKey, response.clone());
        }
        return response;
      } catch (_) {
        return (await caches.match(cacheKey)) || (await caches.match(INDEX_URL.href)) || (await caches.match(APP_ROOT_URL.href)) || Response.error();
      }
    })());
    return;
  }

  if (SHELL_FILES.includes(url.href)) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response && response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    })());
  }
});
