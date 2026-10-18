import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';import {pathToFileURL} from 'node:url';
if(!process.env.FIRECAM_DOM_MODULE){console.log('Set FIRECAM_DOM_MODULE to linkedom/esm/index.js to run this isolated DOM check.');process.exit(0);}const {parseHTML}=await import(pathToFileURL(process.env.FIRECAM_DOM_MODULE).href);
const {window,document}=parseHTML('<html><body><div id="app"></div><div id="toast"></div><dialog id="modal"></dialog></body></html>');window.HTMLElement.prototype.close=function(){};window.scrollTo=()=>{};
const location={hash:'#/dashboard',protocol:'https:'};const storage={getItem:()=> 'demo',removeItem(){}};
const context=vm.createContext({window,document,location,localStorage:storage,sessionStorage:storage,navigator:{onLine:true},console,URL,Blob,AbortSignal,Event:window.Event,setInterval:()=>0,setTimeout,clearTimeout});
const config=new vm.SourceTextModule(await readFile('docs/firebase-config.js','utf8'),{context});const data=new vm.SourceTextModule(await readFile('docs/data.js','utf8'),{context});const app=new vm.SourceTextModule(await readFile('docs/app.js','utf8'),{context});await config.link(()=>{});await data.link(()=>config);await app.link(()=>data);await app.evaluate();assert.equal(document.querySelector('.workspace'),null);assert.match(document.querySelector('.info-note').textContent,/being configured/);assert.equal(document.querySelector('form'),null);assert.equal(location.hash,'/login');
const manifest=JSON.parse(await readFile('docs/manifest.webmanifest'));assert.equal(manifest.scope,'./');assert.equal(manifest.start_url,'./#/');
console.log('PASS: unconfigured sign-in fails closed, legacy demo cannot bypass it, and Pages manifest uses project-relative paths.');

