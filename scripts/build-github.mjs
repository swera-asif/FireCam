// GitHub Pages now only forwards to the single site URL. The full site (pages, sign-in, dashboard, AI function) runs on Netlify.
import {rm,mkdir,writeFile} from 'node:fs/promises';
import {portalUrl} from '../github/portal-config.js';
if(!portalUrl)throw Error('Set portalUrl in github/portal-config.js first.');
const target=portalUrl.replace(/\/$/,'');
const html=`<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>FireCam</title><meta name="robots" content="noindex"><link rel="canonical" href="${target}/">
<meta http-equiv="refresh" content="0; url=${target}/">
<script>location.replace('${target}/'+location.hash);</script>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px/1.5 Arial,sans-serif;background:#f7f6f2;color:#242824}a{color:#e85b37}</style>
</head><body><p>FireCam has moved to <a href="${target}/">${target.replace('https://','')}</a>.</p></body></html>
`;
await rm('docs',{recursive:true,force:true});await mkdir('docs');
await writeFile('docs/index.html',html);await writeFile('docs/404.html',html);
// Replace any previously installed Pages service worker with one that removes itself.
await writeFile('docs/sw.js',"self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.registration.unregister().then(()=>caches.keys()).then(k=>Promise.all(k.map(c=>caches.delete(c))))));\n");
await writeFile('docs/.nojekyll','');console.log('GitHub Pages now redirects to '+target);
