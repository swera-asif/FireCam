export const KEY = 'firecam-showcase-v1';
export const scenarios = {
  fire: { title:'Suspected fire', room:'Kitchen', trigger:'Kitchen smoke + heat sensor', temperature:68, smoke:'Elevated', assessment:'Suspected fire', reasoning:'Illustrative flame/smoke cues and elevated sample readings require review. They do not confirm a real fire.', evidence:'fire' },
  steam: { title:'Likely false alarm', room:'Kitchen', trigger:'Kitchen smoke sensor', temperature:29, smoke:'Brief spike', assessment:'Likely false alarm', reasoning:'Sample vapour is associated with cooking, with a stable heat reading. A person still needs to review; physical alarms stay active.', evidence:'steam' },
  uncertain: { title:'Missing evidence', room:'Bedroom', trigger:'Bedroom smoke sensor', temperature:null, smoke:'Reading unavailable', assessment:'Uncertain', reasoning:'The sample camera is obscured and heat data is missing. Missing evidence is not proof of safety.', evidence:'uncertain' }
};
export const stages = ['Event received','Evidence collected','Simulated AI assessment','Owner notification','Review','Outcome'];
export const countries=['PK','IN','BD','AE','SA','GB','EU','US','CA','AU','OTHER'];
export function initialState() {
  return {
    version:2, preferences:{home:'My home',name:'',theme:'light',lang:'en',largeText:false,country:'PK',address:'',customService:'',listen:false},
    setupDone:false, lastTest:null,
    rooms:[], family:[], alerts:[],
    // Practice-mode sample data (incident simulator, floor plan, detection lab).
    contacts:[{id:'owner',name:'Alex Morgan',role:'Homeowner · primary',phone:'+92 300 0000001'},{id:'backup',name:'Sam Taylor',role:'Neighbour · backup',phone:'+92 300 0000002'}],
    incidents:[makeIncident('uncertain', 'sample-uncertain', '2026-10-20T09:12:00.000Z', false)],
    devices:[
      {id:'cam-living',name:'Living room',floor:'Ground floor',kind:'Camera',status:'Online',image:'living.webp',updated:'Sample · 09:40'},
      {id:'cam-kitchen',name:'Kitchen',floor:'Ground floor',kind:'Camera',status:'Online',image:'kitchen.webp',updated:'Sample · 09:40'},
      {id:'cam-bedroom',name:'Bedroom',floor:'First floor',kind:'Camera',status:'Offline',image:'bedroom.webp',updated:'Sample · 09:12'},
      {id:'smoke-kitchen',name:'Kitchen smoke',floor:'Ground floor',kind:'Smoke sensor',status:'Online',updated:'Sample · 09:40'},
      {id:'heat-kitchen',name:'Kitchen heat',floor:'Ground floor',kind:'Heat sensor',status:'Online',updated:'Sample · 09:40'},
      {id:'smoke-bedroom',name:'Bedroom smoke',floor:'First floor',kind:'Smoke sensor',status:'Offline',updated:'Sample · 09:12'}
    ]
  };
}
// Phone numbers: optional leading +, 7 to 15 digits (ITU E.164 length), spaces, dashes, dots and
// brackets allowed as separators. Returns the cleaned number or '' when invalid.
export function normalizePhone(raw) {
  const text=String(raw??'').trim();
  if(!/^\+?\(?[0-9][0-9 .()-]*$/.test(text)) return '';
  const digits=text.replace(/\D/g,'');
  if(digits.length<7||digits.length>15) return '';
  return (text.startsWith('+')?'+':'')+digits;
}
// HTML pattern attributes compile with the regex v flag, so brackets and dashes inside the class are escaped.
export const phonePattern='\\+?\\(?[0-9][0-9 .\\(\\)\\-]{5,24}';
export function makeIncident(kind,id,time,noResponse=true) {
  return {id,kind,time,noResponse,step:0,status:'Active',acknowledged:false,timeline:[{time,text:'Simulated event received'}]};
}
export function advance(incident, contacts) {
  if(incident.step >= 5 || incident.status === 'Resolved') return false;
  incident.step++;
  const owner=contacts.find(c=>c.id==='owner');
  const lines = [
    '',
    'Illustrative evidence and sample sensor readings collected',
    `Simulated assessment: ${scenarios[incident.kind].assessment}`,
    `Simulated push, SMS and phone attempt to ${owner.name} (${owner.phone}); nothing sent`,
    incident.acknowledged ? 'Simulated owner acknowledgement received; review continues' : incident.noResponse ? 'Simulated owner response timeout; backup contact attempt simulated' : 'Simulated owner acknowledgement received; review continues',
    incident.kind==='steam' ? 'Simulated review resolved as cooking vapour; no physical alarm changed' : incident.acknowledged || !incident.noResponse ? 'Simulated owner review recorded; assessment still needs human verification' : 'Simulated monitoring-centre handoff for fire-service review; no service contacted'
  ];
  incident.timeline.push({time:incident.time,text:lines[incident.step]});
  if (incident.step===5) incident.status=incident.kind==='steam'?'Resolved':incident.acknowledged||!incident.noResponse?'Acknowledged':'Escalated (simulated)';
  return true;
}
const bounded = (s,n=100) => typeof s==='string' && s.length<=n;
const isoDate=s=>typeof s==='string'&&Number.isFinite(Date.parse(s));
const validRoom=r=>bounded(r.id,40)&&bounded(r.name,60)&&r.name.trim()&&['phone','url','sample'].includes(r.source)&&bounded(r.url,500)&&(r.source!=='url'||/^https?:\/\//.test(r.url))&&['ok','offline','unknown'].includes(r.status)
  &&(r.camera===undefined||typeof r.camera==='boolean')&&(r.lastSeen===undefined||r.lastSeen===null||isoDate(r.lastSeen));
const validPerson=p=>bounded(p.id,40)&&bounded(p.name,100)&&p.name.trim()&&['owner','family'].includes(p.role)&&bounded(p.phone,40)&&normalizePhone(p.phone)!=='';
const validAlert=a=>bounded(a.id,40)&&isoDate(a.time)&&bounded(a.room,60)&&['smoke','co','test','practice'].includes(a.kind)&&['sound','camera','manual'].includes(a.source)&&typeof a.image==='string'&&a.image.length<=400000&&(a.evidence===undefined||bounded(a.evidence,40))&&['active','closed'].includes(a.status)&&['owner','family','service'].includes(a.stage)&&bounded(a.outcome,40)&&Array.isArray(a.steps)&&a.steps.length<=20&&a.steps.every(s=>isoDate(s.time)&&bounded(s.code,40));
export function validState(v) {
  const p=v?.preferences;
  return v?.version===2 && bounded(p?.home) && p.home.trim() && bounded(p?.name) && ['light','dark'].includes(p?.theme) && ['en','ur'].includes(p?.lang) && typeof p.largeText==='boolean' && typeof p.listen==='boolean'
    && countries.includes(p.country) && bounded(p.address,300) && bounded(p.customService,20) && (p.lastReminder===undefined||p.lastReminder===null||isoDate(p.lastReminder)) && (p.customService===''||normalizePhone(p.customService)!=='') && typeof v.setupDone==='boolean' && (v.lastTest===null||isoDate(v.lastTest))
    && Array.isArray(v.rooms) && v.rooms.length<=20 && v.rooms.every(validRoom) && new Set(v.rooms.map(r=>r.id)).size===v.rooms.length
    && Array.isArray(v.family) && v.family.length<=10 && v.family.every(validPerson) && v.family.filter(f=>f.role==='owner').length<=1
    && Array.isArray(v.alerts) && v.alerts.length<=200 && v.alerts.every(validAlert) && v.alerts.filter(a=>a.status==='active').length<=1
    && Array.isArray(v.contacts) && v.contacts.length===2 && ['owner','backup'].every(id=>v.contacts.filter(c=>c.id===id).length===1)
    && v.contacts.every(c=>bounded(c.name)&&bounded(c.role)&&bounded(c.phone,40)&&(c.phone===''||c.phone.startsWith('DEMO-')||normalizePhone(c.phone)!==''))
    && Array.isArray(v.incidents) && v.incidents.length<=100 && new Set(v.incidents.map(i=>i.id)).size===v.incidents.length
    && v.incidents.every(i=>Object.hasOwn(scenarios,i.kind)&&bounded(i.id)&&Number.isFinite(Date.parse(i.time))&&Number.isInteger(i.step)&&i.step>=0&&i.step<=5&&typeof i.noResponse==='boolean'&&typeof i.acknowledged==='boolean'&&['Active','Acknowledged','Resolved','Escalated (simulated)'].includes(i.status)&&Array.isArray(i.timeline)&&i.timeline.length<=30&&i.timeline.every(t=>bounded(t.text,500)&&Number.isFinite(Date.parse(t.time))))
    && Array.isArray(v.devices) && v.devices.length===6 && v.devices.every(d=>bounded(d.id)&&bounded(d.name)&&['Ground floor','First floor'].includes(d.floor)&&['Camera','Smoke sensor','Heat sensor'].includes(d.kind)&&['Online','Offline'].includes(d.status)&&bounded(d.updated)&&(!d.image||['living.webp','kitchen.webp','bedroom.webp'].includes(d.image)));
}
export function loadState(storage) {
  try {
    const raw=storage.getItem(KEY); if(!raw)return {data:initialState(),warning:''};
    let data=JSON.parse(raw);
    if(data?.version===1)data=migrateV1(data);
    if(!validState(data))throw Error();
    return {data,warning:''};
  }
  catch {return {data:initialState(),warning:'Saved demo data could not be read. Fresh samples are in memory; existing storage has not been deleted.'};}
}
// Review actions available from the incident dialog. 'escalate' mirrors the owner → backup →
// fire-service handoff that the landing page describes; in the demo nothing is contacted.
export const reviewActions={
  ack:{status:'Acknowledged',text:'User acknowledged this simulated incident'},
  escalate:{status:'Escalated (simulated)',text:'User escalated this simulated incident to the backup contact and fire-service handoff; nothing was contacted'},
  resolve:{status:'Resolved',text:'User resolved this simulated incident; no physical alarm changed'}
};
export function review(incident,action) {
  const next=reviewActions[action];
  if(!next||incident.status==='Resolved') return false;
  incident.acknowledged=true;incident.status=next.status;
  incident.timeline.push({time:new Date().toISOString(),text:next.text});
  incident.timeline=incident.timeline.slice(-30);
  return true;
}
// Version 1 (demo workspace) → version 2 (everyday app + practice data).
export function migrateV1(old) {
  const fresh=initialState(),samples=fresh.contacts;
  const contacts=(old.contacts||[]).map(c=>({...c,phone:String(c.phone||'').startsWith('DEMO-')?samples.find(s=>s.id===c.id)?.phone||'':c.phone}));
  const owner=contacts.find(c=>c.id==='owner'),backup=contacts.find(c=>c.id==='backup');
  const family=[];
  const sampleOwner=samples.find(s=>s.id==='owner');
  if(owner&&normalizePhone(owner.phone)&&owner.phone!==sampleOwner.phone)family.push({id:'owner',name:owner.name,phone:owner.phone,role:'owner'});
  if(backup&&normalizePhone(backup.phone)&&backup.phone!==samples.find(s=>s.id==='backup').phone)family.push({id:'backup',name:backup.name,phone:backup.phone,role:'family'});
  const home=old.preferences?.home==='The Morgan home'?'My home':old.preferences?.home||'My home';
  return {...fresh,preferences:{...fresh.preferences,home,name:old.preferences?.name==='Alex Morgan'?'':old.preferences?.name||'',theme:old.preferences?.theme||'light'},
    contacts:contacts.length===2?contacts:fresh.contacts,incidents:old.incidents||fresh.incidents,devices:old.devices||fresh.devices,family,setupDone:false};
}
export function saveState(storage,data) {try{storage.setItem(KEY,JSON.stringify(data));return true;}catch{return false;}}
export function csv(incidents) {
  const cell=v=>`"${String(v).replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')}"`;
  return [['DEMO DATA','Timestamp','Scenario','Status'],...incidents.map(i=>[i.id,i.time,scenarios[i.kind].title,i.status])].map(r=>r.map(cell).join(',')).join('\r\n');
}
