// FireCam service worker: receives Web Push messages and shows alarm notifications even when
// the FireCam tab is closed (the browser must be running). It deliberately does not cache pages,
// so every visit loads the current deployment.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('push',e=>{
  let d={};
  try{d=e.data?e.data.json():{};}catch{d={title:'FireCam',body:e.data?e.data.text():''};}
  const options={body:d.body||'',tag:d.tag||'firecam-alert',renotify:true,requireInteraction:true,vibrate:[600,250,600,250,900],
    icon:'/assets/firecam-logo-192.png',badge:'/assets/icon-192.png',lang:d.lang||'en',data:{url:d.url||'/#/home',alertId:d.alertId||''}};
  e.waitUntil(self.registration.showNotification(d.title||'FireCam',options));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  const url=e.notification.data?.url||'/#/home';
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async list=>{
    for(const c of list){if('focus' in c){try{await c.navigate(url);}catch{}return c.focus();}}
    return self.clients.openWindow(url);
  }));
});
