// Isolated DOM checks, without browser or network access.
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';import {pathToFileURL} from 'node:url';
const domPath=process.env.FIRECAM_DOM_MODULE;
for(const scenario of ['anonymous','unregistered','registered'])test('dashboard access: '+scenario,{skip:!domPath},async()=>{
 const {parseHTML}=await import(pathToFileURL(domPath).href);const {window,document}=parseHTML('<html><body><div id="app"></div><div id="toast"></div><dialog id="modal"></dialog></body></html>');
 window.HTMLElement.prototype.close=function(){this.open=false};window.scrollTo=()=>{};
 const location={hash:'#/dashboard',protocol:'https:'};const listeners={};const originalAdd=window.addEventListener.bind(window);window.addEventListener=(name,fn)=>{listeners[name]=fn};
 const storage={getItem:()=> 'demo',removeItem(){},setItem(){}};let expired=false;
 const workspace={user:{id:'a',fullName:'Alice',username:'alice'},cameras:[],sensors:[],zones:[],alerts:[],contacts:[],floors:[],settings:{}};
 const fetch=async path=>{let status=200,value;if(path==='/api/health')value={service:'firecam',authMode:'chatgpt',signedIn:scenario!=='anonymous',realtime:'poll'};else if(scenario==='anonymous'||expired){status=401;value={code:'SIGN_IN_REQUIRED'}}else if(scenario==='unregistered'){status=403;value={code:'REGISTRATION_REQUIRED'}}else value=path==='/api/user'?workspace.user:workspace;return {ok:status===200,status,json:async()=>value}};
 const context=vm.createContext({window,document,location,localStorage:storage,sessionStorage:storage,navigator:{onLine:true},console,URL,Blob,AbortSignal,Event:window.Event,fetch,setTimeout,clearTimeout,setInterval:()=>0,scrollY:0});
 const data=new vm.SourceTextModule(await readFile(new URL('../public/data.js',import.meta.url),'utf8'),{context});const app=new vm.SourceTextModule(await readFile(new URL('../public/app.js',import.meta.url),'utf8'),{context});await data.link(()=>{});await app.link(()=>data);await data.evaluate();await app.evaluate();
 if(scenario==='registered'){assert.ok(document.querySelector('.workspace'));expired=true;await listeners.focus();assert.equal(document.querySelector('.workspace'),null);assert.equal(location.hash,'/login');}
 else {assert.equal(document.querySelector('.workspace'),null);assert.equal(location.hash,scenario==='anonymous'?'/login':'/register');assert.equal(document.querySelector('[data-action="demo"]'),null);}
});

