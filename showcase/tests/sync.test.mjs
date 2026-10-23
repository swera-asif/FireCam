import test from 'node:test';
import assert from 'node:assert/strict';
import {pickDoc,applyDoc,mergeAlerts} from '../src/sync.js';
import {handlePush} from '../netlify/push-handler.mjs';
import {initialState,validState} from '../src/model.js';
import {createAlert,closeAlert} from '../src/alerts.js';

globalThis.crypto??={randomUUID:()=>'0123456789abcdef'};
test('synced document excludes device-only preferences and practice data; applying keeps local device settings',()=>{
  const s=initialState();s.preferences.theme='dark';s.preferences.lang='ur';s.preferences.listen=true;s.preferences.home='Casa';s.rooms.push({id:'r',name:'Kitchen',source:'phone',url:'',status:'ok'});
  const doc=pickDoc(s);
  assert.equal(doc.preferences.theme,undefined);assert.equal(doc.preferences.lang,undefined);assert.equal(doc.preferences.home,'Casa');
  assert.equal(doc.incidents,undefined);assert.equal(doc.alerts,undefined);
  const other=initialState();other.preferences.theme='light';other.preferences.lang='en';
  const merged=applyDoc(other,{...doc,preferences:{...doc.preferences,home:'Casa Nueva',address:'Street 9'},lastTest:'2026-10-01T00:00:00.000Z'});
  assert.equal(merged.preferences.theme,'light');assert.equal(merged.preferences.lang,'en');assert.equal(merged.preferences.home,'Casa Nueva');assert.equal(merged.preferences.address,'Street 9');
  assert.equal(merged.rooms.length,1);assert.equal(merged.lastTest,'2026-10-01T00:00:00.000Z');assert.ok(validState(merged));
  assert.equal(applyDoc(other,null),other);
});
test('alert merge adds unknown alerts, updates changed ones and never reopens a locally closed alert',()=>{
  const a=createAlert({room:'Kitchen',id:'a',time:'2026-10-20T10:00:00.000Z'}),b=createAlert({room:'Hall',id:'b',time:'2026-10-21T10:00:00.000Z'});
  const r1=mergeAlerts([a],[{data:b}]);assert.ok(r1.changed);assert.deepEqual(r1.alerts.map(x=>x.id),['b','a']);
  const r2=mergeAlerts(r1.alerts,[{data:b}]);assert.equal(r2.changed,false);
  const closedA=structuredClone(a);closeAlert(closedA,'safe');
  const r3=mergeAlerts([closedA],[{data:a}]);assert.equal(r3.changed,false);assert.equal(r3.alerts[0].status,'closed');
  const remoteClosed=structuredClone(b);closeAlert(remoteClosed,'false');
  const r4=mergeAlerts(r1.alerts,[{data:remoteClosed}]);assert.ok(r4.changed);assert.equal(r4.alerts.find(x=>x.id==='b').outcome,'false');
});
function fakeSupabase({user='u1',member=true,subs=[]}={}){
  const calls={deleted:[]};
  const table=name=>{
    const q={_f:{},select(){return q;},eq(k,v){q._f[k]=v;return q;},maybeSingle(){return name==='home_members'?{data:member?{role:'owner'}:null}:{data:null};},
      then(res){res(name==='push_subscriptions'?{data:subs,error:null}:{data:null,error:null});},delete(){return {in(_,ids){calls.deleted.push(...ids);return Promise.resolve({});}};}};
    return q;
  };
  return {calls,auth:{getUser:async token=>token==='good'?{data:{user:{id:user}}}:{data:{},error:Error('bad')}},from:table};
}
const req=(body,token='good',method='POST')=>new Request('https://firecam.example/.netlify/functions/push',{method,headers:{authorization:token?`Bearer ${token}`:'', 'content-type':'application/json'},...(method==='POST'?{body:JSON.stringify(body)}:{})});
const home='11111111-2222-3333-4444-555555555555';
const good={homeId:home,title:'Possible smoke in Kitchen',text:'Open FireCam',tag:'firecam-alert',url:'/#/home',alertId:'abc'};
test('push function rejects anonymous, non-member, malformed and off-site URLs',async()=>{
  const sends=[];const webpush={sendNotification:async(...a)=>{sends.push(a);}};
  assert.equal((await handlePush(req(good,''),{supabase:fakeSupabase(),webpush})).status,401);
  assert.equal((await handlePush(req(good,'bad'),{supabase:fakeSupabase(),webpush})).status,401);
  assert.equal((await handlePush(req(good),{supabase:fakeSupabase({member:false}),webpush})).status,403);
  assert.equal((await handlePush(req({...good,homeId:'x'}),{supabase:fakeSupabase(),webpush})).status,400);
  assert.equal((await handlePush(req({...good,url:'https://evil.example'}),{supabase:fakeSupabase(),webpush})).status,400);
  assert.equal((await handlePush(req(good,'good','GET'),{supabase:fakeSupabase(),webpush})).status,405);
  assert.equal(sends.length,0);
});
test('push function sends to every device of the home and prunes dead subscriptions',async()=>{
  const subs=[{id:'s1',endpoint:'e1',subscription:{endpoint:'e1'}},{id:'s2',endpoint:'e2',subscription:{endpoint:'e2'}},{id:'s3',endpoint:'e3',subscription:{endpoint:'e3'}}];
  const sb=fakeSupabase({subs});const sends=[];
  const webpush={sendNotification:async(sub,payload,opts)=>{sends.push({sub,payload:JSON.parse(payload),opts});if(sub.endpoint==='e2'){const e=Error('gone');e.statusCode=410;throw e;}if(sub.endpoint==='e3'){const e=Error('rate');e.statusCode=429;throw e;}}};
  const r=await handlePush(req(good),{supabase:sb,webpush,now:()=>123});
  assert.equal(r.status,200);assert.deepEqual(await r.json(),{sent:1,failed:2,skipped:0,removed:1});
  assert.deepEqual(sb.calls.deleted,['s2']);
  assert.equal(sends[0].payload.title,'Possible smoke in Kitchen');assert.equal(sends[0].payload.url,'/#/home');assert.equal(sends[0].opts.urgency,'high');assert.equal(sends[0].opts.TTL,180);
});
