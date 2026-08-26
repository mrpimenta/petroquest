const CACHE = 'petro-quest-v3';
const ASSETS = ['/', '/index.html', '/styles.css', '/anninha-pet.css', '/manifest.webmanifest', '/src/main.js', '/src/config.js', '/src/store.js', '/src/review.js', '/src/questions.js', '/src/gamification.js', '/src/cloud.js', '/src/quiz.js', '/src/ui.js', '/src/anninha-ai-client.js', '/src/anninha-pet.js', '/data/questions.json', '/data/exams.json', '/data/passages.json', '/data/syllabus.json'];
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
