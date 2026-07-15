/* Scene Cut Splitter — offline service worker (#45)
   Caches the app shell so it opens fully offline once installed.
   Bump CACHE when you change any cached file so clients update. */
var CACHE = 'scs-v2.3';

/* Notebook-skin fonts: cached on first fetch so the skin works offline */
var FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
var ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      /* add individually so one missing asset can't fail the whole install */
      return Promise.all(ASSETS.map(function(url){
        return c.add(url).catch(function(){});
      }));
    })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if(k !== CACHE) return caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

/* Cache-first for our own GET assets; network-first fallback for the page. */
self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then(function(hit){
      if(hit) return hit;
      return fetch(req).then(function(res){
        /* stash same-origin successes + font files for next time */
        try{
          var u = new URL(req.url);
          var cacheable = u.origin === self.location.origin ||
                          FONT_HOSTS.indexOf(u.hostname) !== -1;
          if(res && (res.ok || res.type === 'opaque') && cacheable){
            var copy = res.clone();
            caches.open(CACHE).then(function(c){ c.put(req, copy); });
          }
        }catch(err){}
        return res;
      }).catch(function(){
        /* offline and not cached: fall back to the app shell for navigations */
        if(req.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
