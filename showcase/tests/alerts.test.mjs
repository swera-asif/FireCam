import test from 'node:test';
import assert from 'node:assert/strict';
import {createAlert,closeAlert,stageAt,Escalation,escalation,alertSentence,homeStatus,fireService,telLink,smsLink,daysSince} from '../src/alerts.js';
import {t,setLanguage,missingKeys} from '../src/i18n.js';
import {initialState,validState,migrateV1,loadState} from '../src/model.js';

globalThis.crypto??={randomUUID:()=>'0123456789abcdef'};
test('alert lifecycle: stages by elapsed time, closing is final and records the outcome',()=>{
  const a=createAlert({room:'Kitchen',kind:'smoke',source:'sound',time:'2026-10-20T16:40:00.000Z'});
  assert.equal(stageAt(a,0),'owner');assert.equal(stageAt(a,escalation.owner),'family');assert.equal(stageAt(a,escalation.family),'service');
  assert.ok(closeAlert(a,'cooking'));assert.equal(a.status,'closed');assert.equal(closeAlert(a,'false'),false);
  assert.equal(stageAt(a,999999),'owner','closed alerts stop escalating');
  assert.ok(validState({...initialState(),alerts:[a]}));
});
test('escalation timers advance owner → family → service and stop cleanly',()=>{
  const a=createAlert({room:'Kitchen'});const fired=[],timers=[];let now=0;
  const e=new Escalation(a,{onStage:s=>fired.push(s),now:()=>now,setTimer:(f,ms)=>{timers.push({f,ms});return timers.length;},clearTimer:id=>{timers[id-1]=null;}}).start();
  assert.deepEqual(timers.map(x=>x.ms),[30000,60000]);
  timers[0].f();assert.deepEqual(fired,['family']);assert.equal(a.stage,'family');
  closeAlert(a,'safe');timers[1].f();assert.deepEqual(fired,['family'],'no stage change after close');
  e.stop();assert.deepEqual(timers,[null,null]);
});
test('history reads as a plain sentence in English and Urdu',()=>{
  const now=new Date('2026-10-22T20:00:00');
  const a=createAlert({room:'Kitchen',kind:'smoke',time:new Date('2026-10-20T21:40:00').toISOString()});closeAlert(a,'cooking');
  setLanguage('en');const en=alertSentence(a,t,'en-GB',now);
  assert.match(en,/^Tuesday .*: smoke in Kitchen\. You marked it as cooking\.$/);
  const today=createAlert({room:'Kitchen',kind:'test',time:new Date('2026-10-22T09:05:00').toISOString()});closeAlert(today,'test');
  assert.match(alertSentence(today,t,'en-GB',now),/^Today .*: you tested your alerts in Kitchen\. Everything worked\.$/);
  setLanguage('ur');assert.match(alertSentence(a,t,'ur-PK',now),/Kitchen میں دھواں/);setLanguage('en');
  assert.deepEqual(missingKeys(),[]);
});
test('home status: alert beats everything; check lists reasons; safe when set up, listening and tested',()=>{
  const s=initialState();
  assert.deepEqual(homeStatus(s).reasons.sort(),['status.noFamily','status.noRooms','status.testDue']);
  s.rooms.push({id:'r',name:'Kitchen',source:'phone',url:'',status:'ok'});s.family.push({id:'o',name:'Me',phone:'+92 300 1234567',role:'owner'});s.lastTest=new Date().toISOString();
  assert.equal(homeStatus(s,{listening:false}).reasons[0],'status.notListening');
  assert.equal(homeStatus(s,{listening:true}).level,'safe');
  s.lastTest=new Date(Date.now()-40*864e5).toISOString();assert.deepEqual(homeStatus(s,{listening:true}).reasons,['status.testDue']);
  s.alerts.push(createAlert({room:'Kitchen'}));assert.equal(homeStatus(s).level,'alert');
});
test('fire service number follows country, custom override and tel/sms links are clean',()=>{
  assert.equal(fireService({country:'PK',customService:''}).number,'1122');
  assert.equal(fireService({country:'GB',customService:''}).number,'999');
  assert.equal(fireService({country:'OTHER',customService:'+44 20 7946 0958'}).number,'+44 20 7946 0958');
  assert.equal(telLink('+92 300-123 4567'),'tel:+923001234567');
  assert.match(smsLink('+92 300 1234567','Fire in Kitchen & hall'),/^sms:\+923001234567\?body=Fire%20in%20Kitchen%20%26%20hall$/);
  assert.equal(daysSince(null),null);assert.equal(daysSince(new Date(Date.now()-3*864e5).toISOString()),3);
});
test('v1 demo saves migrate to v2 without inventing family members from sample data',()=>{
  const v1={version:1,preferences:{home:'The Morgan home',name:'Alex Morgan',theme:'dark'},contacts:[{id:'owner',name:'Alex Morgan',role:'r',phone:'DEMO-OWNER-001'},{id:'backup',name:'Nadia',role:'r',phone:'+92 321 7654321'}],incidents:[],devices:initialState().devices};
  let memory=JSON.stringify(v1);
  const {data,warning}=loadState({getItem:()=>memory,setItem:(_,v)=>memory=v});
  assert.equal(warning,'');assert.equal(data.version,2);assert.equal(data.preferences.home,'My home');assert.equal(data.preferences.theme,'dark');
  assert.deepEqual(data.family.map(f=>[f.name,f.role]),[['Nadia','family']]);
  assert.equal(data.setupDone,false);assert.ok(validState(data));
  assert.equal(migrateV1({version:1,preferences:{home:'Casa',name:'Me',theme:'light'}}).preferences.home,'Casa');
});
test('v2 validation rejects bad rooms, people, alerts and a second active alert',()=>{
  const s=initialState();assert.ok(validState(s));
  assert.equal(validState({...s,rooms:[{id:'r',name:'',source:'phone',url:'',status:'ok'}]}),false);
  assert.equal(validState({...s,rooms:[{id:'r',name:'Hall',source:'url',url:'javascript:alert(1)',status:'ok'}]}),false);
  assert.equal(validState({...s,family:[{id:'f',name:'A',phone:'12345',role:'owner'}]}),false);
  assert.equal(validState({...s,family:[{id:'f',name:'A',phone:'+92 300 1234567',role:'owner'},{id:'g',name:'B',phone:'+92 300 1234568',role:'owner'}]}),false);
  assert.equal(validState({...s,alerts:[createAlert({room:'A'}),createAlert({room:'B'})]}),false);
  assert.equal(validState({...s,preferences:{...s.preferences,lang:'fr'}}),false);
});
