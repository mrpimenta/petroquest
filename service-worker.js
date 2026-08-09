const CACHE = 'petro-quest-v2';
const ASSETS = ['/', '/index.html', '/styles.css', '/manifest.webmanifest', '/src/main.js', '/src/config.js', '/src/store.js', '/src/review.js', '/src/questions.js', '/src/gamification.js', '/src/cloud.js', '/src/quiz.js', '/src/ui.js', '/data/questions.json', '/data/syllabus.json', '/data/target.json'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then(hit => hit || caches.match('/index.html'))));
});
