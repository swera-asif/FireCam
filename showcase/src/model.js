export const KEY = 'firecam-showcase-v1';
export const scenarios = {
  fire: { title:'Suspected fire', room:'Kitchen', trigger:'Kitchen smoke + heat sensor', temperature:68, smoke:'Elevated', assessment:'Suspected fire', reasoning:'Illustrative flame/smoke cues and elevated sample readings require review. They do not confirm a real fire.', evidence:'fire' },
  steam: { title:'Likely false alarm', room:'Kitchen', trigger:'Kitchen smoke sensor', temperature:29, smoke:'Brief spike', assessment:'Likely false alarm', reasoning:'Sample vapour is associated with cooking, with a stable heat reading. A person still needs to review; physical alarms stay active.', evidence:'steam' },
  uncertain: { title:'Missing evidence', room:'Bedroom', trigger:'Bedroom smoke sensor', temperature:null, smoke:'Reading unavailable', assessment:'Uncertain', reasoning:'The sample camera is obscured and heat data is missing. Missing evidence is not proof of safety.', evidence:'uncertain' }
};
export const stages = ['Event received','Evidence collected','Simulated AI assessment','Owner notification','Review','Outcome'];
export function initialState() {
  return {
    version:1, preferences:{home:'The Morgan home',name:'Alex Morgan',theme:'light'},
    contacts:[{id:'owner',name:'Alex Morgan',role:'Homeowner · primary',phone:'DEMO-OWNER-001'},{id:'backup',name:'Sam Taylor',role:'Neighbour · backup',phone:'DEMO-BACKUP-002'}],
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
export function validState(v) {
  return v?.version===1 && bounded(v.preferences?.home) && bounded(v.preferences?.name) && ['light','dark'].includes(v.preferences?.theme)
    && Array.isArray(v.contacts) && v.contacts.length===2 && ['owner','backup'].every(id=>v.contacts.filter(c=>c.id===id).length===1)
    && v.contacts.every(c=>bounded(c.name)&&bounded(c.role)&&bounded(c.phone,40))
    && Array.isArray(v.incidents) && v.incidents.length<=100 && new Set(v.incidents.map(i=>i.id)).size===v.incidents.length
    && v.incidents.every(i=>Object.hasOwn(scenarios,i.kind)&&bounded(i.id)&&Number.isFinite(Date.parse(i.time))&&Number.isInteger(i.step)&&i.step>=0&&i.step<=5&&typeof i.noResponse==='boolean'&&typeof i.acknowledged==='boolean'&&['Active','Acknowledged','Resolved','Escalated (simulated)'].includes(i.status)&&Array.isArray(i.timeline)&&i.timeline.length<=30&&i.timeline.every(t=>bounded(t.text,500)&&Number.isFinite(Date.parse(t.time))))
    && Array.isArray(v.devices) && v.devices.length===6 && v.devices.every(d=>bounded(d.id)&&bounded(d.name)&&['Ground floor','First floor'].includes(d.floor)&&['Camera','Smoke sensor','Heat sensor'].includes(d.kind)&&['Online','Offline'].includes(d.status)&&bounded(d.updated)&&(!d.image||['living.webp','kitchen.webp','bedroom.webp'].includes(d.image)));
}
export function loadState(storage) {
  try { const raw=storage.getItem(KEY); if(!raw)return {data:initialState(),warning:''}; const data=JSON.parse(raw); if(!validState(data))throw Error(); return {data,warning:''}; }
  catch {return {data:initialState(),warning:'Saved demo data could not be read. Fresh samples are in memory; existing storage has not been deleted.'};}
}
export function saveState(storage,data) {try{storage.setItem(KEY,JSON.stringify(data));return true;}catch{return false;}}
export function csv(incidents) {
  const cell=v=>`"${String(v).replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')}"`;
  return [['DEMO DATA','Timestamp','Scenario','Status'],...incidents.map(i=>[i.id,i.time,scenarios[i.kind].title,i.status])].map(r=>r.map(cell).join(',')).join('\r\n');
}
