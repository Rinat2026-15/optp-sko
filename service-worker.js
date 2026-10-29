// Кэшируется только оболочка приложения. ОПТП/схемы загружаются из Supabase через интернет.
const CACHE = 'optp-sko-shell-v3.8';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png','./icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('optp-sko-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request=event.request;
  if(request.method!=='GET') return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin) return; // никогда не кэшируем Supabase
  if(url.pathname.endsWith('/config.js')) return; // публичный ключ: сеть, без кэша
  if(request.mode==='navigate') {
    event.respondWith(fetch(request).then(resp=>{if(resp.ok){const c=resp.clone();caches.open(CACHE).then(cache=>cache.put('./index.html',c));}return resp;}).catch(()=>caches.match('./index.html')));
    return;
  }
  event.respondWith(fetch(request).catch(()=>caches.match(request)));
});
