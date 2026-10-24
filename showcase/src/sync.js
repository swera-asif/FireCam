// Which parts of the local state are shared between a home's devices, and how a remote copy is
// merged back in. Pure functions; the network side is in cloud.js.
export const syncedKeys=['preferences','rooms','family','lastTest','setupDone'];
// Per-device preferences are never overwritten by another device.
const deviceOnly=['theme','lang','largeText','listen','lastReminder'];

export function pickDoc(state){
  const doc={};
  for(const k of syncedKeys)doc[k]=structuredClone(state[k]);
  for(const k of deviceOnly)delete doc.preferences[k];
  return doc;
}
export function applyDoc(state,doc){
  if(!doc||typeof doc!=='object')return state;
  const prefs={...state.preferences,...(doc.preferences||{})};
  for(const k of deviceOnly)prefs[k]=state.preferences[k];
  return {...state,preferences:prefs,rooms:Array.isArray(doc.rooms)?doc.rooms:state.rooms,family:Array.isArray(doc.family)?doc.family:state.family,
    lastTest:doc.lastTest===undefined?state.lastTest:doc.lastTest,setupDone:typeof doc.setupDone==='boolean'?doc.setupDone:state.setupDone};
}
export function docsEqual(a,b){return JSON.stringify(a)===JSON.stringify(b);}
// Alerts: the row's data wins when it is newer; unknown ids are added at the front.
export function mergeAlerts(local,remoteRows){
  const byId=new Map(local.map(a=>[a.id,a]));
  let changed=false;
  for(const row of remoteRows){
    const remote=row.data;if(!remote?.id)continue;
    const mine=byId.get(remote.id);
    if(!mine||JSON.stringify(mine)!==JSON.stringify(remote)){
      // A locally closed alert stays closed even if a stale remote copy says active.
      if(mine&&mine.status==='closed'&&remote.status==='active')continue;
      byId.set(remote.id,remote);changed=true;
    }
  }
  if(!changed)return {alerts:local,changed:false};
  const alerts=[...byId.values()].sort((a,b)=>Date.parse(b.time)-Date.parse(a.time)).slice(0,200);
  return {alerts,changed:true};
}
