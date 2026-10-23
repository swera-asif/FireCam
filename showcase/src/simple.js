// The everyday FireCam app: Home, Alerts, Rooms, Family, Settings, first-run setup and the
// full-screen alert. Plain words, big buttons, English or Urdu. The older demo pages
// (simulator, detection lab, voice tools, floor plan) stay reachable from Settings → Advanced.
import {normalizePhone,phonePattern,countries} from './model.js';
import {AlarmListener,Siren,vibrate,stopVibration,speak,stopSpeaking,notify,playAlarmPattern} from './alarm.js';
import {createAlert,closeAlert,addStep,Escalation,alertSentence,formatWhen,daysSince,homeStatus,fireService,fireServices,telLink,smsLink} from './alerts.js';
import {t,setLanguage,language,locale,languages} from './i18n.js';
import {isNative,nativeListener,nativeAlarm,onResume} from './native.js';

export function createSimple(ctx){
  const {getState,persist,render,toast,dialog,closeDialog,icon,button,esc,confirmation,go,onAlert=()=>{},cloud=null,getUser=()=>null,isGuest=()=>false}=ctx;
  let pushOn=false;
  const S=()=>getState();
  const listenState={status:'off',level:0,tone:false};
  let wakeLock=null,siren=new Siren(),escalation=null,vibrateTimer=null,setup={step:1,source:'phone',url:'',room:'',name:'',phone:''};

  // ---- Listening -------------------------------------------------------------------------
  const phoneRoom=()=>S().rooms.find(r=>r.source==='phone')?.name||S().preferences.home;
  const listenerCallbacks={
    onStatus(s){listenState.status=s==='listening'?'on':s==='permission'?'permission':s==='lost'?'lost':'off';if(s==='lost')toast(t('home.listen.lost'));if(s!=='listening'&&s!=='permission')releaseWake();updateListenUI();},
    onLevel(l){listenState.level=l.level;listenState.tone=l.tone;const m=document.querySelector('#listen-level');if(m)m.style.width=`${Math.round(l.level*100)}%`;const b=document.querySelector('#listen-beeps');if(b)b.textContent=l.tone?'♪':l.beeps?'·'.repeat(Math.min(l.beeps,8)):'';},
    onAlarm(result){raise({kind:result.kind,source:'sound',room:phoneRoom()});}
  };
  // In the Android app a foreground service listens (and keeps listening with the screen off);
  // on the web the AudioWorklet in alarm.js does the same job while the page is open.
  const listener=isNative?nativeListener(listenerCallbacks):new AlarmListener(listenerCallbacks);
  async function requestWake(){if(isNative)return;try{wakeLock=await navigator.wakeLock?.request('screen');wakeLock?.addEventListener('release',()=>{wakeLock=null;});}catch{}}
  function releaseWake(){try{wakeLock?.release();}catch{}wakeLock=null;}
  async function startListening(){await listener.start(phoneRoom());S().preferences.listen=true;persist();requestWake();render();}
  // An alarm the service detected while the web layer was asleep (app closed or screen off).
  async function checkPendingAlarm(){
    if(!isNative)return;
    try{const p=await nativeAlarm.pending();if(p?.kind&&!activeAlert())raise({kind:p.kind,source:'sound',room:phoneRoom()});}catch{}
  }
  function stopListening(){listener.stop();S().preferences.listen=false;persist();render();}
  function updateListenUI(){if(document.querySelector('#listen-card'))render();}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&listener.active&&!wakeLock)requestWake();});

  // ---- Alerts ------------------------------------------------------------------------------
  const activeAlert=()=>S().alerts.find(a=>a.status==='active');
  const isReal=kind=>kind==='smoke'||kind==='co';
  function raise({kind,source,room,image=''}){
    if(activeAlert())return null;
    const state=S();
    if(!image&&source==='sound'){const r=state.rooms.find(r=>r.name===room);if(r?.source==='url')image=r.url;}
    const alert=createAlert({room,kind,source,image});
    state.alerts.unshift(alert);state.alerts=state.alerts.slice(0,200);persist();
    startLocalAlarm(alert,{escalate:isReal(kind)});
    onAlert(alert,'raised');
    return alert;
  }
  // Sounds, speech, notification and (optionally) the escalation timers for an active alert on
  // this device. Remote alerts from a family member's phone ring here too, but only the device
  // that raised the alert runs the timers.
  function startLocalAlarm(alert,{escalate}){
    const {kind,room}=alert;
    if(escalate){escalation=new Escalation(alert,{onStage(stage){persist();renderAlertScreen();onAlert(alert,'stage');if(stage==='family')notify('FireCam',t('alert.stage.family'));if(stage==='service'){speak(t('alert.stage.service'),languages[language()].speech);notify('FireCam',t('alert.stage.service'));}}}).start();}
    if(isNative)nativeAlarm.clearNotification();
    siren.start();vibrate();clearInterval(vibrateTimer);vibrateTimer=setInterval(()=>vibrate(),2600);
    speak(t(kind==='test'?'alert.spoken.test':kind==='co'?'alert.spoken.co':'alert.spoken.smoke',{room}),languages[language()].speech);
    notify(t(kind==='test'?'alert.title.test':kind==='co'?'alert.title.co':kind==='practice'?'alert.title.practice':'alert.title.smoke',{room}),isReal(kind)?t('alert.heard'):t('alert.manual'));
    renderAlertScreen();render();
  }
  function quiet(){siren.stop();stopVibration();clearInterval(vibrateTimer);vibrateTimer=null;stopSpeaking();if(isNative)nativeAlarm.clearNotification();}
  function finish(outcome){
    const alert=activeAlert();if(!alert)return;
    escalation?.stop();escalation=null;quiet();
    closeAlert(alert,alert.kind==='test'?'test':outcome);
    if(alert.kind==='test')S().lastTest=new Date().toISOString();
    persist();const el=document.querySelector('#alert-screen');if(el?.open)el.close();
    toast(alert.kind==='test'?t('alert.test.done'):t('alert.closed'));render();
    onAlert(alert,'closed');
  }
  // An alert row arrived from the shared home (another family member's device).
  function incoming(remote){
    if(!remote?.id)return;
    const state=S();const mine=state.alerts.find(a=>a.id===remote.id);
    if(remote.status==='active'){
      if(mine){if(mine.status==='closed')return;Object.assign(mine,remote);}
      else{state.alerts.unshift(remote);state.alerts=state.alerts.slice(0,200);if(!activeAlert()||activeAlert()===remote){if(isReal(remote.kind))startLocalAlarm(remote,{escalate:false});}}
    }else{
      if(mine&&mine.status==='active'){Object.assign(mine,remote);escalation?.stop();escalation=null;quiet();const el=document.querySelector('#alert-screen');if(el?.open)el.close();toast(t('alert.closed'));}
      else if(mine)Object.assign(mine,remote);
      else{state.alerts.unshift(remote);state.alerts.sort((a,b)=>Date.parse(b.time)-Date.parse(a.time));}
    }
    persist();renderAlertScreen();render();
  }
  function alertScreenBody(alert){
    const state=S(),p=state.preferences,service=fireService(p),family=state.family.filter(f=>f.role!=='owner').concat(state.family.filter(f=>f.role==='owner'));
    const what=t('what.'+alert.kind),title=t('alert.title.'+alert.kind,{room:alert.room});
    const smsText=t('alert.sms',{what,room:alert.room,home:p.home,address:p.address});
    const numbers=family.map(f=>normalizePhone(f.phone)).filter(Boolean);
    const callFamily=numbers[0]?`<a class="button big family" href="${telLink(numbers[0])}" data-action="alert-called-family">${icon('users')}<span>${t('alert.callFamily')}</span><small>${esc(family[0].name)}</small></a>`:`<a class="button big family" href="#/family" data-action="alert-add-family">${icon('users')}<span>${t('alert.callFamily')}</span><small>${t('family.empty')}</small></a>`;
    const callService=service.number?`<a class="button big service" href="${telLink(service.number)}" data-action="alert-called-service">${icon('fire')}<span>${t('alert.callService')}</span><small>${esc(service.name)} · ${esc(service.number)}</small></a>`:`<a class="button big service" href="#/settings">${icon('fire')}<span>${t('alert.callService')}</span><small>${t('settings.service')}</small></a>`;
    const test=alert.kind==='test'||alert.kind==='practice';
    return `<div class="alert-head ${alert.kind}"><div class="eyebrow">${esc(alert.kind==='co'?'CO':'FIRECAM')} · ${esc(formatWhen(alert.time,locale()))}</div><h1>${esc(title)}</h1><p>${esc(test?t('alert.manual'):alert.kind==='co'?t('alert.heard.co'):t('alert.heard'))}</p></div>
      ${alert.image?`<img class="alert-image" src="${esc(alert.image)}" alt="${esc(alert.room)}">`:''}
      <div class="alert-actions">${button(`${icon('check')}<span>${t('alert.false')}</span>`,'alert-false','big false')}${callService}${callFamily}</div>
      <div class="alert-meta">${test?'':`<p class="stage stage-${alert.stage}" role="status">${esc(t('alert.stage.'+alert.stage))}</p>`}${p.address?`<p><strong>${esc(t('alert.address',{address:p.address}))}</strong></p>`:`<p class="muted">${esc(t('alert.noAddress'))}</p>`}${service.number?`<p>${esc(t('alert.service.number',{name:service.name,number:service.number}))}${service.alt&&!service.custom?` · ${esc(service.alt.name)}: ${esc(service.alt.number)}`:''}</p>`:''}
      <div class="row">${numbers.length?`<a class="button" href="${smsLink(numbers.join(','),smsText)}" data-action="alert-texted">${icon('users')} ${t('alert.textFamily')}</a>`:''}${button(t('alert.safe'),'alert-safe','primary')}</div></div>`;
  }
  function renderAlertScreen(){
    const el=document.querySelector('#alert-screen');const alert=activeAlert();if(!el)return;
    if(!alert){if(el.open)el.close();return;}
    el.innerHTML=alertScreenBody(alert);
    if(!el.open){try{el.showModal();}catch{el.setAttribute('open','');}}
  }
  document.querySelector('#alert-screen')?.addEventListener('cancel',e=>e.preventDefault());

  // ---- Pages -------------------------------------------------------------------------------
  const notice=()=>`<p class="notice-line">${icon('shield')} ${esc(t('notice.short'))}</p>`;
  const sentence=a=>esc(alertSentence(a,t,locale()));
  function home(){
    const state=S(),status=homeStatus(state,{listening:listener.active}),p=state.preferences;
    const days=daysSince(state.lastTest);
    const lastTest=days===null?t('home.lastTest.never'):days===0?t('home.lastTest.today'):t('home.lastTest',{days});
    const phoneRoom=state.rooms.find(r=>r.source==='phone');
    const card=status.level==='alert'
      ?button(`<span class="status-label">${esc(t('status.alert',{what:t('what.'+status.alert.kind),room:status.alert.room}))}</span><small>${esc(t('alerts.open'))} →</small>`,'alert-open','status-card alert')
      :`<div class="status-card ${status.level}" role="status"><span class="status-label">${esc(t('status.'+status.level))}</span>${status.level==='safe'?`<small>${esc(t('status.safe.sub'))}</small>`:`<ul>${status.reasons.map(r=>`<li>${esc(t(r))}</li>`).join('')}</ul>`}</div>`;
    const listenCard=phoneRoom?`<section class="panel" id="listen-card"><div class="row between"><h2>${esc(phoneRoom.name)}</h2><span class="pill ${listener.active?'online':''}">${esc(listenState.status==='permission'?t('home.listen.permission'):listener.active?t('home.listen.on'):t('home.listen.off'))}</span></div><div class="meter" aria-hidden="true"><div id="listen-level"></div></div><div class="row between"><span id="listen-beeps" class="beeps" aria-hidden="true"></span></div>${button(`${icon('mic')}<span>${listener.active?t('home.listen.stop'):t('home.listen.start')}</span>`,listener.active?'listen-stop':'listen-start','big '+(listener.active?'':'primary'))}<p class="muted small-print">${esc(t('home.listen.help'))}</p></section>`:'';
    const recent=state.alerts.slice(0,3);
    return `<div class="simple-page">${card}${listenCard}
      <div class="chips">${chip('floor',state.rooms.length===1?t('home.room'):t('home.rooms',{n:state.rooms.length}),'#/rooms')}${chip('users',state.family.length===1?t('home.person'):t('home.family',{n:state.family.length}),'#/family')}${chip('clock',lastTest,'')}</div>
      ${button(`${icon('play')}<span>${t('home.test')}</span>`,'test-alerts','big')}
      <section class="panel"><h2>${esc(t('home.recent'))}</h2>${recent.length?`<ul class="plain-list">${recent.map(a=>`<li>${button(sentence(a),'alert-detail','link',`data-id="${a.id}"`)}</li>`).join('')}</ul><a href="#/alerts">${esc(t('home.seeAll'))} →</a>`:`<p class="muted">${esc(t('home.none'))}</p>`}</section>${notice()}</div>`;
  }
  const chip=(i,text,href)=>href?`<a class="chip" href="${href}">${icon(i)}<span>${esc(text)}</span></a>`:`<span class="chip">${icon(i)}<span>${esc(text)}</span></span>`;
  function alerts(){
    const items=S().alerts;
    return `<div class="simple-page"><h1>${esc(t('alerts.title'))}</h1>${items.length?`<ul class="plain-list">${items.map(a=>`<li class="${a.status==='active'?'active':''}">${button(sentence(a),a.status==='active'?'alert-open':'alert-detail','link',`data-id="${a.id}"`)}</li>`).join('')}</ul>`:`<p class="empty">${esc(t('alerts.empty'))}</p>`}${notice()}</div>`;
  }
  function rooms(){
    const items=S().rooms;
    return `<div class="simple-page"><div class="row between"><h1>${esc(t('rooms.title'))}</h1>${button(`${icon('floor')}<span>${t('rooms.add')}</span>`,'room-add','primary')}</div>${items.length?`<ul class="card-list">${items.map(r=>`<li><div><strong>${esc(r.name)}</strong><small>${esc(t('rooms.'+r.source))}${r.source==='url'?` · ${esc(r.url)}`:''}</small></div>${button(t('rooms.remove'),'room-remove','small',`data-id="${r.id}" aria-label="${esc(t('rooms.remove'))} ${esc(r.name)}"`)}</li>`).join('')}</ul>`:`<p class="empty">${esc(t('rooms.empty'))}</p>`}</div>`;
  }
  function family(){
    const items=S().family,signedIn=cloud&&getUser();
    const share=signedIn?`<section class="panel"><h2>${esc(t('share.title'))}</h2><p class="muted">${esc(t('share.sub'))}</p><div class="row">${button(`${icon('users')}<span>${t('share.invite')}</span>`,'invite-create','primary')}${button(t('share.join'),'invite-join','')}</div><div id="members" class="muted small-print">${esc(t('share.loading'))}</div></section>`
      :`<section class="panel"><h2>${esc(t('share.title'))}</h2><p class="muted">${esc(cloud?t('share.signin'):t('share.unavailable'))}</p>${cloud?`<a class="button" href="#/register">${esc(t('account.create'))}</a>`:''}</section>`;
    return `<div class="simple-page"><div class="row between"><h1>${esc(t('family.title'))}</h1>${button(`${icon('users')}<span>${t('family.add')}</span>`,'person-add','primary')}</div>${items.length?`<ul class="card-list">${items.map(f=>`<li><div><strong>${esc(f.name)}</strong><small>${esc(f.role==='owner'?t('family.owner'):t('family.member'))} · ${esc(f.phone)}</small></div><span class="row"><a class="button small" href="${telLink(f.phone)}">${icon('mic')} ${esc(t('family.call'))}</a>${button(t('family.remove'),'person-remove','small plain',`data-id="${f.id}" aria-label="${esc(t('family.remove'))} ${esc(f.name)}"`)}</span></li>`).join('')}</ul>`:`<p class="empty">${esc(t('family.empty'))}</p>`}${share}</div>`;
  }
  async function fillMembers(){
    const el=document.querySelector('#members');if(!el||!cloud?.homeId)return;
    try{const list=await cloud.members();const me=getUser()?.id;el.innerHTML=`<strong>${esc(t('share.members',{n:list.length}))}</strong><br>${list.map(m=>esc((m.display_name||t('family.member'))+(m.user_id===me?' ('+t('family.owner')+')':'')+(m.role==='owner'?' · '+t('share.ownerTag'):''))).join('<br>')}`;}
    catch{el.textContent='';}
  }
  function accountSection(){
    const user=getUser();
    if(!cloud)return '';
    if(!user)return `<section class="panel"><h2>${esc(t('account.title'))}</h2><p class="muted">${esc(isGuest()?t('account.guest'):t('account.signedOut'))}</p><div class="row"><a class="button primary" href="#/register">${esc(t('account.create'))}</a><a class="button" href="#/login">${esc(t('account.signin'))}</a></div></section>`;
    return `<section class="panel"><h2>${esc(t('account.title'))}</h2><p class="muted">${esc(t('account.signedInAs',{email:user.email||''}))}</p><label class="check"><input type="checkbox" id="push-toggle" ${pushOn?'checked':''} ${cloud.pushAvailable()?'':'disabled'}><span>${esc(t('account.push'))}</span></label><p class="muted small-print">${esc(cloud.pushAvailable()?t('account.pushHelp'):t('account.pushUnavailable'))}</p>${button(t('account.signout'),'logout','')}</section>`;
  }
  function settings(){
    const p=S().preferences;
    const select=(name,options,value)=>`<select name="${name}">${options.map(([v,l])=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(l)}</option>`).join('')}</select>`;
    return `<div class="simple-page"><h1>${esc(t('settings.title'))}</h1><form data-form="simple-settings" class="panel">
      <label class="field">${esc(t('settings.home'))}<input name="home" required maxlength="100" value="${esc(p.home)}"></label>
      <label class="field">${esc(t('settings.address'))}<textarea name="address" rows="2" maxlength="300">${esc(p.address)}</textarea><small>${esc(t('settings.addressHelp'))}</small></label>
      <label class="field">${esc(t('settings.country'))}${select('country',countries.map(c=>[c,`${fireServices[c].country} · ${fireServices[c].number||'—'}`]),p.country)}</label>
      <label class="field">${esc(t('settings.service'))}<input name="customService" type="tel" inputmode="tel" maxlength="20" value="${esc(p.customService)}" placeholder="${esc(fireService({country:p.country,customService:''}).number||'1122')}"><small>${esc(t('settings.serviceHelp'))}</small></label>
      <label class="field">${esc(t('settings.language'))}${select('lang',Object.entries(languages).map(([k,v])=>[k,v.name]),p.lang)}</label>
      <label class="field">${esc(t('settings.theme'))}${select('theme',[['light',t('settings.theme.light')],['dark',t('settings.theme.dark')]],p.theme)}</label>
      <label class="check"><input type="checkbox" name="largeText" ${p.largeText?'checked':''}><span>${esc(t('settings.largeText'))}</span></label>
      <button class="primary big">${esc(t('settings.save'))}</button></form>
      ${accountSection()}
      <div class="callout">${esc(t('notice.long'))}</div>
      <section class="panel"><h2>${esc(t('settings.advanced'))}</h2><p class="muted">${esc(t('settings.advanced.sub'))}</p><ul class="link-list">${[['scenarios','settings.practice','fire'],['lab','settings.lab','sensor'],['voice','settings.voice','mic'],['floor','settings.floor','floor'],['history','settings.history','clock']].map(([r,k,i])=>`<li><a href="#/${r}">${icon(i)}<span>${esc(t(k))}</span>${icon('arrow')}</a></li>`).join('')}</ul>${button(`${icon('play')}<span>${t('settings.playAlarm')}</span>`,'play-alarm','')}<p class="muted small-print">${esc(t('settings.playAlarm.help'))}</p>${button(t('settings.reset'),'reset','plain')}</section></div>`;
  }
  function setupPage(){
    const step=setup.step;
    const steps=`<div class="eyebrow">${esc(t('setup.step',{n:step}))}</div><div class="progress" aria-hidden="true">${[1,2,3].map(n=>`<span class="${n<=step?'done':''}"></span>`).join('')}</div>`;
    let body='';
    if(step===1)body=`<h1>${esc(t('setup.1.title'))}</h1><div class="choices">${button(`${icon('mic')}<span>${t('setup.1.phone')}</span><small>${t('setup.1.phone.sub')}</small>`,'setup-phone','choice '+(setup.source==='phone'?'selected':''))}${button(`${icon('camera')}<span>${t('setup.1.url')}</span><small>${t('setup.1.url.sub')}</small>`,'setup-url','choice '+(setup.source==='url'?'selected':''))}</div>${setup.source==='url'?`<form data-form="setup-1"><label class="field">${esc(t('setup.1.urlField'))}<input name="url" type="url" required maxlength="500" value="${esc(setup.url)}" placeholder="http://192.168.1.20/snapshot.jpg"></label><button class="primary big">${esc(t('setup.next'))}</button></form>`:`<p class="muted">${esc(t('setup.permission'))}</p><form data-form="setup-1"><button class="primary big">${esc(t('setup.next'))}</button></form>`}`;
    if(step===2)body=`<h1>${esc(t('setup.2.title'))}</h1><form data-form="setup-2"><label class="field">${esc(t('setup.2.field'))}<input name="room" required maxlength="60" value="${esc(setup.room)}" placeholder="${esc(t('setup.2.example'))}" autofocus></label><div class="row">${button(t('setup.back'),'setup-back')}<button class="primary big">${esc(t('setup.next'))}</button></div></form>`;
    if(step===3)body=`<h1>${esc(t('setup.3.title'))}</h1><p class="muted">${esc(t('setup.3.sub'))}</p><form data-form="setup-3"><label class="field">${esc(t('family.name'))}<input name="name" required maxlength="100" value="${esc(setup.name)}"></label><label class="field">${esc(t('family.phone'))}<input name="phone" type="tel" inputmode="tel" autocomplete="tel" required maxlength="25" pattern="${phonePattern}" value="${esc(setup.phone)}" placeholder="+92 300 1234567"><small>${esc(t('family.phoneHelp'))}</small></label><div class="row">${button(t('setup.back'),'setup-back')}<button class="primary big">${esc(t('setup.done'))}</button></div></form>`;
    return `<main id="main" class="setup container"><div class="setup-card">${steps}${body}<div class="row between setup-foot">${button(t('setup.skip'),'setup-skip','plain')}<small>${esc(t('notice.short'))}</small></div></div></main>`;
  }

  // ---- Actions -------------------------------------------------------------------------------
  function addRoom({name,source,url=''}){const state=S();if(state.rooms.length>=20)throw Error('Too many rooms.');if(source==='phone'&&state.rooms.some(r=>r.source==='phone'))source='sample';state.rooms.push({id:crypto.randomUUID().slice(0,8),name:name.trim().slice(0,60),source,url:source==='url'?url.trim():'',status:'ok'});}
  function addPerson({name,phone}){const state=S(),clean=normalizePhone(phone);if(!clean)throw Error(t('family.invalid'));if(state.family.length>=10)throw Error('Too many people.');state.family.push({id:crypto.randomUUID().slice(0,8),name:name.trim().slice(0,100),phone:String(phone).trim().replace(/\s+/g,' ').slice(0,25),role:state.family.some(f=>f.role==='owner')?'family':'owner'});}
  function applyPreferences(){const p=S().preferences;setLanguage(p.lang);document.documentElement.lang=p.lang;document.documentElement.dir=languages[p.lang].dir;document.documentElement.dataset.text=p.largeText?'large':'';document.documentElement.dataset.theme=p.theme;}
  function roomForm(){return `<form data-form="room-add"><label class="field">${esc(t('setup.2.field'))}<input name="name" required maxlength="60" placeholder="${esc(t('setup.2.example'))}"></label><label class="check"><input type="radio" name="source" value="phone" ${S().rooms.some(r=>r.source==='phone')?'':'checked'}><span>${esc(t('rooms.phone'))}</span></label><label class="check"><input type="radio" name="source" value="url" ${S().rooms.some(r=>r.source==='phone')?'checked':''}><span>${esc(t('rooms.url'))}</span></label><label class="field">${esc(t('setup.1.urlField'))}<input name="url" type="url" maxlength="500" placeholder="http://192.168.1.20/snapshot.jpg"></label><div class="row">${button(t('common.cancel'),'close')}<button class="primary">${esc(t('common.save'))}</button></div></form>`;}
  function personForm(){return `<form data-form="person-add"><label class="field">${esc(t('family.name'))}<input name="name" required maxlength="100"></label><label class="field">${esc(t('family.phone'))}<input name="phone" type="tel" inputmode="tel" autocomplete="tel" required maxlength="25" pattern="${phonePattern}" placeholder="+92 300 1234567"><small>${esc(t('family.phoneHelp'))}</small></label><div class="row">${button(t('common.cancel'),'close')}<button class="primary">${esc(t('common.save'))}</button></div></form>`;}

  async function handleAction(action,id){
    const state=S();
    switch(action){
      case 'listen-start':await startListening();return true;
      case 'listen-stop':stopListening();return true;
      case 'test-alerts':if(globalThis.Notification?.permission==='default')await Notification.requestPermission().catch(()=>{});raise({kind:'test',source:'manual',room:state.rooms[0]?.name||state.preferences.home});return true;
      case 'alert-open':renderAlertScreen();return true;
      case 'alert-false':finish('false');return true;
      case 'alert-safe':finish('safe');return true;
      case 'alert-called-service':{const a=activeAlert();if(a){addStep(a,'called:service');quiet();persist();}return true;}
      case 'alert-called-family':{const a=activeAlert();if(a){addStep(a,'called:family');quiet();persist();}return true;}
      case 'alert-texted':{const a=activeAlert();if(a){addStep(a,'texted:family');persist();}return true;}
      case 'alert-add-family':{const el=document.querySelector('#alert-screen');if(el?.open)el.close();quiet();return true;}
      case 'alert-detail':{const a=state.alerts.find(a=>a.id===id);if(!a)return true;if(a.status==='active'){renderAlertScreen();return true;}dialog(t('alerts.title'),`<p class="lead">${sentence(a)}</p>${a.image?`<img class="alert-image" src="${esc(a.image)}" alt="">`:''}<ol class="timeline">${a.steps.map(s=>`<li>${esc(stepText(s.code))}<small>${esc(formatWhen(s.time,locale()))}</small></li>`).join('')}</ol>${button(t('common.close'),'close')}`);return true;}
      case 'room-add':dialog(t('rooms.add'),roomForm());return true;
      case 'room-remove':{const r=state.rooms.find(r=>r.id===id);if(r)confirmation(t('rooms.removeConfirm',{room:r.name}),'','room-remove',id);return true;}
      case 'confirm-room-remove':state.rooms=state.rooms.filter(r=>r.id!==id);persist();closeDialog();render();toast(t('rooms.removed'));return true;
      case 'person-add':dialog(t('family.add'),personForm());return true;
      case 'person-remove':{const f=state.family.find(f=>f.id===id);if(f)confirmation(t('family.removeConfirm',{name:f.name}),'','person-remove',id);return true;}
      case 'confirm-person-remove':state.family=state.family.filter(f=>f.id!==id);if(!state.family.some(f=>f.role==='owner')&&state.family[0])state.family[0].role='owner';persist();closeDialog();render();return true;
      case 'play-alarm':playAlarmPattern('T3',8);return true;
      case 'invite-create':{
        const code=await cloud.createInvite();
        const text=t('share.message',{home:state.preferences.home,code,url:location.origin});
        dialog(t('share.invite'),`<p class="lead">${esc(t('share.codeIntro'))}</p><p class="invite-code" aria-label="${esc(t('share.code'))}">${esc(code)}</p><p class="muted">${esc(t('share.codeHelp'))}</p><div class="row">${navigator.share?button(`${icon('arrow')} ${t('share.send')}`,'invite-share','primary',`data-id="${esc(text)}"`):''}<a class="button" href="${smsLink('',text)}">${esc(t('share.sms'))}</a>${button(t('common.close'),'close')}</div>`);
        return true;
      }
      case 'invite-share':try{await navigator.share({title:'FireCam',text:id});}catch{}return true;
      case 'invite-join':dialog(t('share.join'),`<form data-form="invite-join"><label class="field">${esc(t('share.code'))}<input name="code" required minlength="6" maxlength="8" autocapitalize="characters" autocomplete="one-time-code" style="text-transform:uppercase;letter-spacing:4px;font-size:22px"></label><p class="muted">${esc(t('share.joinHelp'))}</p><div class="row">${button(t('common.cancel'),'close')}<button class="primary">${esc(t('share.join'))}</button></div></form>`);return true;
      case 'setup-phone':setup.source='phone';render();return true;
      case 'setup-url':setup.source='url';render();return true;
      case 'setup-back':setup.step=Math.max(1,setup.step-1);render();return true;
      case 'setup-skip':state.setupDone=true;persist();go('/home');return true;
      default:return false;
    }
  }
  function stepText(code){
    const map={detected:t('alert.heard'),'stage:family':t('alert.stage.family'),'stage:service':t('alert.stage.service'),'called:service':t('history.outcome.service'),'called:family':t('alert.callFamily'),'texted:family':t('alert.textFamily')};
    if(code.startsWith('closed:'))return t('history.outcome.'+code.slice(7));
    return map[code]||code;
  }
  async function handleSubmit(kind,values,form){
    const state=S();
    switch(kind){
      case 'setup-1':
        if(setup.source==='url'){setup.url=values.url.trim();if(!/^https?:\/\//.test(setup.url))throw Error(t('setup.1.urlField'));}
        else{try{await listener.start(setup.room||'');state.preferences.listen=true;requestWake();}catch(e){toast(e.message);}if(globalThis.Notification?.permission==='default')Notification.requestPermission().catch(()=>{});}
        setup.step=2;render();return true;
      case 'setup-2':setup.room=values.room.trim();if(!setup.room)throw Error(t('setup.2.field'));setup.step=3;render();return true;
      case 'setup-3':setup.name=values.name;setup.phone=values.phone;addPerson({name:values.name,phone:values.phone});addRoom({name:setup.room,source:setup.source,url:setup.url});state.setupDone=true;persist();setup={step:1,source:'phone',url:'',room:'',name:'',phone:''};go('/home');return true;
      case 'room-add':if(values.source==='url'&&!/^https?:\/\//.test((values.url||'').trim()))throw Error(t('setup.1.urlField'));addRoom({name:values.name,source:values.source||'sample',url:values.url});persist();closeDialog();render();return true;
      case 'person-add':addPerson(values);persist();closeDialog();render();toast(t('family.saved'));return true;
      case 'invite-join':{await cloud.joinHome(values.code);closeDialog();toast(t('share.joined'));ctx.onHomeChanged?.();return true;}
      case 'simple-settings':{
        const custom=(values.customService||'').trim();if(custom&&!normalizePhone(custom))throw Error(t('family.invalid'));
        Object.assign(state.preferences,{home:values.home.trim()||state.preferences.home,address:(values.address||'').trim().slice(0,300),country:countries.includes(values.country)?values.country:'PK',customService:custom,lang:languages[values.lang]?values.lang:'en',theme:values.theme==='dark'?'dark':'light',largeText:!!values.largeText});
        persist();applyPreferences();render();toast(t('settings.saved'));return true;
      }
      default:return false;
    }
  }
  // Called once after state is loaded, and whenever a page renders.
  async function boot(){
    applyPreferences();
    const p=S().preferences;
    if(p.listen&&S().setupDone&&!listener.active){try{await listener.start(phoneRoom());requestWake();}catch{listenState.status='off';}render();}
    renderAlertScreen();
    await checkPendingAlarm();
    onResume(()=>{checkPendingAlarm();render();});
  }
  document.addEventListener('change',async e=>{
    if(e.target.id!=='push-toggle'||!cloud)return;
    const box=e.target;box.disabled=true;
    try{if(box.checked){pushOn=await cloud.enablePush();if(!pushOn)toast(t('account.pushDenied'));}else{await cloud.disablePush();pushOn=false;}}
    catch(err){pushOn=false;toast(err.message);}
    finally{box.checked=pushOn;box.disabled=false;}
  });
  async function refreshPushState(){if(!cloud)return;try{pushOn=!!(await cloud.pushSubscription())&&(isNative||globalThis.Notification?.permission==='granted');}catch{pushOn=false;}}
  const tabs=[['home','tab.home','home'],['alerts','tab.alerts','fire'],['rooms','tab.rooms','floor'],['family','tab.family','users'],['settings','tab.settings','settings']];
  return {pages:{home,alerts,rooms,family,settings},setupPage,handleAction,handleSubmit,boot,applyPreferences,tabs,raise,finish,incoming,listener,activeAlert,t,refreshPushState,
    onRoute(view){if(view==='family')fillMembers();},
    reset(){listener.stop();escalation?.stop();escalation=null;quiet();setup={step:1,source:'phone',url:'',room:'',name:'',phone:''};}};
}
