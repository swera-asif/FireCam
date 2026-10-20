import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,validState,loadState,saveState,makeIncident,advance,csv} from '../src/model.js';
import {inspectFrame,CuePersistence} from '../src/detector.js';
import {validate,models,runProvider} from '../netlify/providers.mjs';
import {handle} from '../netlify/handler.mjs';
import {Microphone,LocalCamera} from '../src/media.js';
test('three scenarios terminate; advancing again cannot duplicate activity',()=>{
  const contacts=initialState().contacts;
  for(const kind of ['fire','steam','uncertain']){
    const i=makeIncident(kind,kind,new Date().toISOString());
    for(let j=0;j<10;j++)advance(i,contacts);
    assert.equal(i.step,5);assert.equal(i.timeline.length,6);
    assert.equal(i.status,kind==='steam'?'Resolved':'Escalated (simulated)');
    assert.match(i.timeline[3].text,/DEMO-OWNER-001/);
  }
});
test('acknowledged owner does not get no-response handoff; resolution stops workflow',()=>{
  const i=makeIncident('fire','a',new Date().toISOString());i.acknowledged=true;
  for(let j=0;j<5;j++)advance(i,initialState().contacts);
  assert.equal(i.status,'Acknowledged');
  assert.doesNotMatch(i.timeline.at(-1).text,/handoff/);
  const resolved=makeIncident('steam','b',new Date().toISOString());resolved.status='Resolved';
  assert.equal(advance(resolved,initialState().contacts),false);
});
test('schema and storage recover from corrupt, unavailable and malicious shapes',()=>{
  const s=initialState();assert.ok(validState(s));
  s.contacts[0].name='Changed';let memory='';
  const storage={getItem:()=>memory,setItem:(_,v)=>memory=v};
  assert.ok(saveState(storage,s));assert.equal(loadState(storage).data.contacts[0].name,'Changed');
  memory='{';assert.ok(loadState(storage).warning);
  memory=JSON.stringify({...s,incidents:[{kind:'__proto__'}]});assert.ok(loadState(storage).warning);
  assert.equal(saveState({setItem(){throw Error();}},s),false);
});
test('CSV escapes spreadsheet formula prefixes and quotation marks',()=>{
  const i=makeIncident('fire','=CMD("x")',new Date().toISOString());
  assert.match(csv([i]),/"'=CMD\(""x""\)"/);assert.match(csv([i]),/DEMO DATA/);
});
const frame=(r,g,b)=>new Uint8ClampedArray(Array.from({length:100},()=>[r,g,b,255]).flat());
test('rules distinguish cue, darkness, frame movement and no-cue uncertainty',()=>{
  assert.ok(inspectFrame(frame(240,130,35)).cue);
  assert.ok(inspectFrame(frame(0,0,0)).obscured);
  assert.match(inspectFrame(frame(60,110,80)).label,/safety unknown/);
  assert.ok(inspectFrame(frame(180,180,180),frame(60,60,60)).obscured);
  const p=new CuePersistence();assert.equal(p.next({cue:true}),false);assert.equal(p.next({cue:true}),false);assert.equal(p.next({cue:true}),true);assert.equal(p.next({cue:false}),false);
});
const image='data:image/jpeg;base64,'+Buffer.from([255,216,255,224,0,0,255,217]).toString('base64');
const request={action:'review',provider:'openrouter',key:'fake-test-key',freeOnly:true,model:'test/free:free',image,consent:true};
const catalog={data:[
  {id:'test/free:free',name:'Free vision',architecture:{input_modalities:['text','image'],output_modalities:['text']},pricing:{prompt:'0',completion:'0'}},
  {id:'test/paid',name:'Paid vision',architecture:{input_modalities:['text','image'],output_modalities:['text']},pricing:{prompt:'.01',completion:'.01'}},
  {id:'test/hidden-cost:free',name:'Hidden charge',architecture:{input_modalities:['text','image'],output_modalities:['text']},pricing:{prompt:'0',completion:'0',image:'.1'}},
  {id:'test/text:free',name:'Text only',architecture:{input_modalities:['text'],output_modalities:['text']},pricing:{prompt:'0',completion:'0'}}
]};
const fakeFetch=async url=>Response.json(url.includes('models')?catalog:{choices:[{message:{content:'Possible visual cue. Review required.'}}]});
test('free model catalog excludes paid, image-priced and text-only models',async()=>{
  assert.deepEqual((await models('openrouter','key',true,fakeFetch)).map(m=>m.id),['test/free:free']);
});
test('request validation requires image consent and explicit billing acknowledgement',()=>{
  assert.doesNotThrow(()=>validate(request));
  assert.throws(()=>validate({...request,consent:false}));
  assert.throws(()=>validate({...request,freeOnly:false}));
  assert.throws(()=>validate({...request,provider:'gemini'}));
  assert.throws(()=>validate({...request,image:'https://internal.example'}));
  assert.throws(()=>validate({...request,provider:'arbitrary-endpoint'}));
});
test('server rechecks selected model pricing before inference',async()=>{
  let inference=0;
  const fetcher=async url=>{if(url.includes('chat'))inference++;return fakeFetch(url);};
  await assert.rejects(runProvider({...request,model:'test/paid'},fetcher),/unavailable/);
  assert.equal(inference,0);
  const r=await runProvider(request,fetcher);assert.match(r.text,/review/i);assert.equal(inference,1);
});
test('Gemini uses stateless image interaction with output bound',async()=>{
  let sent;
  const r=await runProvider({...request,provider:'gemini',model:'gemini-3.5-flash-lite',billingConfirmed:true},
    async()=>Response.json({models:[{name:'models/gemini-3.5-flash-lite'}]}),
    ()=>({interactions:{create:async body=>{sent=body;return {output_text:'Uncertain.'};}}}));
  assert.equal(r.text,'Uncertain.');assert.equal(sent.store,false);assert.equal(sent.input[1].type,'image');assert.equal(sent.generation_config.max_output_tokens,800);
});
const req=(body=request,origin='https://firecam.example',method='POST')=>new Request('https://firecam.example/.netlify/functions/ai',{method,headers:{origin,'content-type':'application/json'},...(method==='POST'?{body:JSON.stringify(body)}:{})});
test('AI boundary blocks anonymous, cross-origin, malformed and oversized requests',async()=>{
  let calls=0;const run=async()=>{calls++;return {text:'ok'};};
  assert.equal((await handle(req(),async()=>null,run)).status,401);
  assert.equal((await handle(req(request,'https://evil.example'),async()=>({id:'u'}),run)).status,403);
  assert.equal((await handle(req(request,undefined,'GET'),async()=>({id:'u'}),run)).status,405);
  assert.equal((await handle(req({image:'a'.repeat(1500001)}),async()=>({id:'u'}),run)).status,413);
  assert.equal(calls,0);
  const ok=await handle(req(),async()=>({id:'u'}),run);assert.equal(ok.status,200);assert.match(ok.headers.get('cache-control'),/no-store/);
});
test('unexpected provider errors cannot leak keys to clients',async()=>{
  const r=await handle(req(),async()=>({id:'u'}),()=>{throw Error('secret-api-key-and-image');});
  assert.equal(r.status,502);assert.doesNotMatch(await r.text(),/secret-api-key/);
});
test('late microphone permission is stopped after release; repeated stop is safe',async()=>{
  let resolve,stopped=0;
  const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:()=>new Promise(r=>resolve=r)}}});
  globalThis.cancelAnimationFrame=()=>{};
  const mic=new Microphone(()=>{},()=>{});
  const pending=mic.start();mic.stop();resolve({getTracks:()=>[{stop:()=>stopped++}]});await pending;mic.stop();
  assert.equal(stopped,1);assert.equal(mic.active,false);assert.equal(mic.pending,false);
  if(original)Object.defineProperty(globalThis,'navigator',original);
});
test('late camera permission cannot restart capture after navigation',async()=>{
  let resolve,stopped=0;
  const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:()=>new Promise(r=>resolve=r)}}});
  const camera=new LocalCamera(()=>{},()=>{});
  const pending=camera.start({});camera.stop();resolve({getTracks:()=>[{stop:()=>stopped++}]});await pending;
  assert.equal(stopped,1);assert.equal(camera.stream,null);
  if(original)Object.defineProperty(globalThis,'navigator',original);
});
