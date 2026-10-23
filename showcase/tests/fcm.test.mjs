import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createVerify} from 'node:crypto';
import {createFcm} from '../netlify/fcm.mjs';
import {handlePush} from '../netlify/push-handler.mjs';

const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const account={project_id:'firecam-test',client_email:'fc@firecam-test.iam.gserviceaccount.com',private_key:privateKey.export({type:'pkcs8',format:'pem'})};
const b64=s=>Buffer.from(s.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString();

test('FCM sender mints a signed JWT, caches the access token and posts a high-priority alarm message',async()=>{
  const calls=[];let now=1_700_000_000_000;
  const fetch=async(url,init)=>{calls.push({url,init});if(url.includes('oauth2'))return Response.json({access_token:'tok',expires_in:3600});return new Response('{}',{status:200});};
  const fcm=createFcm(JSON.stringify(account),{fetch,now:()=>now});
  assert.equal(fcm.projectId,'firecam-test');
  await fcm.send('device-token',{title:'Possible smoke in Kitchen',body:'Open FireCam',url:'/#/home',alertId:'a1',tag:'firecam-a1'});
  const assertion=new URLSearchParams(calls[0].init.body).get('assertion');const [h,c,s]=assertion.split('.');
  assert.equal(JSON.parse(b64(h)).alg,'RS256');
  const claims=JSON.parse(b64(c));assert.equal(claims.iss,account.client_email);assert.match(claims.scope,/firebase\.messaging/);assert.equal(claims.exp-claims.iat,3600);
  const v=createVerify('RSA-SHA256');v.update(`${h}.${c}`);assert.ok(v.verify(publicKey,Buffer.from(s.replace(/-/g,'+').replace(/_/g,'/'),'base64')));
  assert.equal(calls[1].url,'https://fcm.googleapis.com/v1/projects/firecam-test/messages:send');
  assert.equal(calls[1].init.headers.authorization,'Bearer tok');
  const msg=JSON.parse(calls[1].init.body).message;
  assert.equal(msg.token,'device-token');assert.equal(msg.android.priority,'high');assert.equal(msg.android.notification.channel_id,'alarms');assert.equal(msg.data.alertId,'a1');
  await fcm.send('device-token',{title:'again'});assert.equal(calls.length,3,'token reused from cache');
  now+=3600*1000;await fcm.send('device-token',{title:'later'});assert.equal(calls.length,5,'token refreshed after expiry');
});
test('FCM UNREGISTERED tokens map to 410 so the push handler prunes them',async()=>{
  const fetch=async url=>url.includes('oauth2')?Response.json({access_token:'tok',expires_in:3600}):Response.json({error:{status:'NOT_FOUND',details:[{errorCode:'UNREGISTERED'}]}},{status:404});
  const fcm=createFcm(account,{fetch});
  const e=await fcm.send('dead',{title:'x'}).catch(e=>e);assert.equal(e.statusCode,410);
  assert.equal(createFcm(''),null);assert.throws(()=>createFcm('{nope'));assert.throws(()=>createFcm('{}'));
});
test('push handler routes FCM subscriptions to FCM, web ones to web-push, and counts skipped when FCM is unconfigured',async()=>{
  const subs=[{id:'w',endpoint:'https://push.example/1',subscription:{endpoint:'https://push.example/1',keys:{}}},{id:'a',endpoint:'fcm:abc',subscription:{type:'fcm',token:'abc'}}];
  const supabase={auth:{getUser:async()=>({data:{user:{id:'u'}}})},from:name=>({_f:{},select(){return this;},eq(){return this;},maybeSingle(){return {data:{role:'owner'}};},then(res){res({data:name==='push_subscriptions'?subs:null,error:null});},delete(){return {in:async()=>({})};}})};
  const web=[],native=[];
  const req=()=>new Request('https://firecam.example/.netlify/functions/push',{method:'POST',headers:{authorization:'Bearer t','content-type':'application/json'},body:JSON.stringify({homeId:'11111111-2222-3333-4444-555555555555',title:'T',text:'b',url:'/#/home'})});
  const r1=await handlePush(req(),{supabase,webpush:{sendNotification:async s=>{web.push(s);}},fcm:{send:async(token,m)=>{native.push({token,m});}}});
  assert.deepEqual(await r1.json(),{sent:2,failed:0,skipped:0,removed:0});assert.equal(web.length,1);assert.equal(native[0].token,'abc');assert.equal(native[0].m.title,'T');
  const r2=await handlePush(req(),{supabase,webpush:{sendNotification:async()=>{}},fcm:null});
  assert.deepEqual(await r2.json(),{sent:1,failed:0,skipped:1,removed:0});
});
