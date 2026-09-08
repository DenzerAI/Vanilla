// Network-only by design: never cache private chats, files, login pages or API responses.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  if(event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(()=>new Response('<!doctype html><html lang="de"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Agent · Offline</title><h1>Dein Server ist nicht erreichbar</h1><p>Prüfe deine Verbindung und ob dein Rechner eingeschaltet ist.</p><button onclick="location.reload()">Erneut versuchen</button>',{headers:{'Content-Type':'text/html; charset=utf-8'}})));
});
