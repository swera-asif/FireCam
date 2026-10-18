import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';import {pathToFileURL} from 'node:url';
if(!process.env.FIRECAM_DOM_MODULE){console.log('Set FIRECAM_DOM_MODULE to linkedom/esm/index.js to run this isolated DOM check.');process.exit(0);}const {parseHTML}=await import(pathToFileURL(process.env.FIRECAM_DOM_MODULE).href);
const {window,document}=parseHTML('<html><body><div id="app"></div><div id="toast"></div><dialog id="modal"></dialog></body></html>');window.HTMLElement.prototype.close=function(){};window.scrollTo=()=>{};
const location={hash:'#/dashboard',protocol:'https:',assign(url){this.assigned=url;}};const storage={getItem:()=> 'demo',removeItem(){}};
const context=vm.createContext({window,document,location,localStorage:storage,sessionStorage:storage,navigator:{onLine:true},console,URL,Blob,AbortSignal,Event:window.Event,setInterval:()=>0,setTimeout,clearTimeout});
const load=async name=>new vm.SourceTextModule(await readFile('docs/'+name,'utf8'),{context,identifier:name});
const modules={'./portal-config.js':await load('portal-config.js'),'./data.js':await load('data.js'),'./install.js':await load('install.js')};const app=await load('app.js');
const link=spec=>modules[spec];for(const m of Object.values(modules))await m.link(link);await app.link(link);await app.evaluate();
const {portalUrl}=modules['./portal-config.js'].namespace;
if(portalUrl){assert.equal(location.assigned,portalUrl+'/#/dashboard');console.log('PASS: Pages hands workspace routes to the Vercel portal at '+portalUrl);}
else{assert.equal(document.querySelector('.workspace'),null);assert.match(document.querySelector('.info-note').textContent,/not available yet/);assert.equal(document.querySelector('form'),null);assert.equal(location.hash,'/login');console.log('PASS: without a portal URL, sign-in fails closed and the legacy demo cannot bypass it.');}
const manifest=JSON.parse(await readFile('docs/manifest.webmanifest'));assert.equal(manifest.scope,'./');assert.equal(manifest.start_url,'./#/');
for(const file of ['app.js','index.html','styles.css']){const s=await readFile('docs/'+file,'utf8');assert.doesNotMatch(s,/\.\.\/assets\//,file+' must not reference ../assets/');assert.doesNotMatch(s,/(?<![.])["'(]\/assets\//,file+' must use project-relative asset paths');}
console.log('PASS: Pages manifest and asset paths are project-relative.');
