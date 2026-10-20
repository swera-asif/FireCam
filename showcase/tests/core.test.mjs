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
const vision=(id,extra={})=>({id,...extra});
const direct={
  anthropic:{models:{data:[{id:'claude-test-4',display_name:'Claude Test'}]},model:'claude-test-4',url:'https://api.anthropic.com/v1/messages',reply:{content:[{type:'text',text:'Smoke-like haze. Review required.'}]}},
  openai:{models:{data:[vision('gpt-5-mini'),vision('gpt-4o-audio-preview'),vision('text-embedding-3-small')]},model:'gpt-5-mini',url:'https://api.openai.com/v1/chat/completions',tokens:'max_completion_tokens',hidden:['gpt-4o-audio-preview','text-embedding-3-small']},
  xai:{models:{data:[vision('grok-4'),vision('grok-2-image-1212'),vision('grok-3-mini')]},model:'grok-4',url:'https://api.x.ai/v1/chat/completions',tokens:'max_tokens',hidden:['grok-2-image-1212','grok-3-mini']},
  groq:{models:{data:[vision('meta-llama/llama-4-scout-17b-16e-instruct'),vision('llama-3.3-70b-versatile')]},model:'meta-llama/llama-4-scout-17b-16e-instruct',url:'https://api.groq.com/openai/v1/chat/completions',tokens:'max_completion_tokens',hidden:['llama-3.3-70b-versatile']},
  mistral:{models:{data:[vision('pixtral-large-latest',{capabilities:{vision:true}}),vision('pixtral-large-latest',{capabilities:{vision:true}}),vision('codestral-latest',{capabilities:{vision:false}})]},model:'pixtral-large-latest',url:'https://api.mistral.ai/v1/chat/completions',tokens:'max_tokens',stringImage:true,hidden:['codestral-latest']},
  omniroute:{models:{data:[vision('gh/gpt-4.1'),vision('kr/text-only',{architecture:{input_modalities:['text']}})]},model:'gh/gpt-4.1',url:'https://gateway.example.com/omni/v1/chat/completions',tokens:'max_tokens',baseUrl:'https://gateway.example.com/omni/',hidden:['kr/text-only']}
};
test('each direct provider lists only vision models and sends a correctly shaped image review',async()=>{
  for(const [provider,c] of Object.entries(direct)){
    const calls=[];
    const fetcher=async(url,init={})=>{calls.push({url,init});return Response.json(init.method==='POST'?(c.reply||{choices:[{message:{content:'Flame-like cue. Review required.'}}]}):c.models);};
    const body={...request,provider,model:c.model,billingConfirmed:true,baseUrl:c.baseUrl};
    const listed=(await runProvider({...body,action:'models'},fetcher)).models.map(m=>m.id);
    assert.deepEqual(listed,[c.model],provider);assert.ok(!listed.some(id=>c.hidden?.includes(id)));
    const r=await runProvider(body,fetcher);
    assert.match(r.text,/review required/i,provider);assert.equal(r.provider,provider);
    const sent=calls.at(-1),payload=JSON.parse(sent.init.body);
    assert.equal(sent.url,c.url,provider);assert.equal(payload.model,c.model);
    if(provider==='anthropic'){
      assert.equal(sent.init.headers['x-api-key'],request.key);assert.equal(sent.init.headers['anthropic-version'],'2023-06-01');
      assert.equal(payload.max_tokens,800);assert.equal(payload.messages[0].content[0].source.media_type,'image/jpeg');
    }else{
      assert.equal(sent.init.headers.Authorization,`Bearer ${request.key}`);assert.equal(sent.init.redirect,'error');
      assert.ok(payload[c.tokens]>=800,provider);
      const part=payload.messages[0].content[1];assert.equal(part.type,'image_url');
      assert.equal(c.stringImage?part.image_url:part.image_url.url,image,provider);
    }
  }
});
test('non-OpenRouter providers always require billing confirmation, even with free-only checked',()=>{
  for(const provider of Object.keys(direct))assert.throws(()=>validate({...request,provider,baseUrl:direct[provider].baseUrl}),/billing/);
});
test('OmniRoute gateway must be a public HTTPS hostname',()=>{
  const omni={...request,provider:'omniroute',billingConfirmed:true};
  for(const baseUrl of [undefined,'http://gateway.example.com/v1','https://localhost:20128/v1','https://127.0.0.1/v1','https://[::1]/v1','https://gateway.example.com:20128/v1','https://metadata.google.internal/v1','https://user:pw@gateway.example.com/v1','https://router/v1'])
    assert.throws(()=>validate({...omni,baseUrl}),undefined,String(baseUrl));
  assert.doesNotThrow(()=>validate({...omni,baseUrl:'https://omniroute.example.com/v1'}));
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
test('flame cue needs a warm region where only part of it flickers',()=>{
  const mixed=(a,b,n)=>new Uint8ClampedArray(Array.from({length:100},(_,i)=>i<n?a:b).flat());
  const still=frame(240,130,35);
  assert.equal(inspectFrame(still,still).cue,false);
  assert.ok(inspectFrame(mixed([240,130,35,255],[240,130,35,255],100),mixed([200,90,20,255],[240,130,35,255],10)).cue);
});
test('provider rejection explains the upstream reason without leaking the key or image',async()=>{
  const body={...request,provider:'omniroute',model:'gh/gpt-4.1',billingConfirmed:true,baseUrl:'https://gateway.example.com/v1'};
  const fetcher=async(url,init={})=>init.method==='POST'?Response.json({error:{message:`Model gh/gpt-4.1 does not support image input (key ${request.key}, ${image})`}},{status:400}):Response.json(direct.omniroute.models);
  const error=await runProvider(body,fetcher).catch(e=>e);
  assert.match(error.message,/HTTP 400: Model gh\/gpt-4\.1 does not support image input/);
  assert.doesNotMatch(error.message,new RegExp(request.key));assert.doesNotMatch(error.message,/base64/);
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
