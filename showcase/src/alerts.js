// Alerts, escalation and plain-language history. Pure functions and a timer class with an
// injectable clock so everything is testable without a browser.

export const fireServices={
  PK:{country:'Pakistan',name:'Rescue 1122',number:'1122',alt:{name:'Fire brigade',number:'16'}},
  IN:{country:'India',name:'Fire service',number:'101'},
  BD:{country:'Bangladesh',name:'Emergency',number:'999'},
  AE:{country:'United Arab Emirates',name:'Civil Defence',number:'997'},
  SA:{country:'Saudi Arabia',name:'Civil Defense',number:'998'},
  GB:{country:'United Kingdom',name:'Emergency services',number:'999'},
  EU:{country:'Europe',name:'Emergency services',number:'112'},
  US:{country:'United States',name:'Emergency services',number:'911'},
  CA:{country:'Canada',name:'Emergency services',number:'911'},
  AU:{country:'Australia',name:'Emergency services',number:'000'},
  OTHER:{country:'Other',name:'Fire service',number:''}
};
export function fireService(preferences){
  const base=fireServices[preferences.country]||fireServices.OTHER;
  const number=(preferences.customService||'').trim()||base.number;
  return {...base,number,custom:!!(preferences.customService||'').trim()};
}
export const telLink=number=>`tel:${String(number).replace(/[^+\d]/g,'')}`;
export const smsLink=(number,text)=>`sms:${String(number).replace(/[^+\d]/g,'')}?body=${encodeURIComponent(text)}`;

// Escalation timing (ms). Owner first, then family, then the fire-service prompt.
export const escalation={owner:30000,family:60000,maxCycles:3};

export function createAlert({room,kind='smoke',source='sound',image='',time=new Date().toISOString(),id=crypto.randomUUID().slice(0,8)}){
  return {id,time,room,kind,source,image,status:'active',stage:'owner',outcome:'',steps:[{time,code:'detected'}]};
}
export function stageAt(alert,elapsedMs){
  if(alert.status!=='active')return alert.stage;
  if(elapsedMs>=escalation.family)return 'service';
  if(elapsedMs>=escalation.owner)return 'family';
  return 'owner';
}
export function addStep(alert,code,time=new Date().toISOString()){alert.steps.push({time,code});alert.steps=alert.steps.slice(-20);}
export function closeAlert(alert,outcome,time=new Date().toISOString()){
  if(alert.status!=='active')return false;
  alert.status='closed';alert.outcome=outcome;addStep(alert,'closed:'+outcome,time);return true;
}

// Drives escalation for one active alert. `onStage(stage)` fires when the stage changes;
// `now`/`setTimeout`/`clearTimeout` are injectable for tests.
export class Escalation {
  constructor(alert,{onStage,now=()=>Date.now(),setTimer=(f,ms)=>setTimeout(f,ms),clearTimer=id=>clearTimeout(id)}={}){
    this.alert=alert;this.onStage=onStage;this.now=now;this.setTimer=setTimer;this.clearTimer=clearTimer;this.started=now();this.timers=[];
  }
  start(){
    for(const [stage,ms] of [['family',escalation.owner],['service',escalation.family]])
      this.timers.push(this.setTimer(()=>{if(this.alert.status!=='active')return;this.alert.stage=stage;addStep(this.alert,'stage:'+stage);this.onStage?.(stage);},ms));
    return this;
  }
  stop(){this.timers.forEach(id=>this.clearTimer(id));this.timers=[];}
  elapsed(){return this.now()-this.started;}
}

// ---- Plain sentences --------------------------------------------------------------------------

export function alertSentence(alert,t,locale='en-GB',now=new Date()){
  const when=formatWhen(alert.time,locale,now);
  const what=t(alert.kind==='co'?'history.co':alert.kind==='test'?'history.test':alert.kind==='practice'?'history.practice':'history.smoke',{room:alert.room});
  const outcome=alert.status==='active'?t('history.active'):t('history.outcome.'+(alert.outcome||'unknown'));
  return `${when}: ${what} ${outcome}`.trim();
}
export function formatWhen(iso,locale='en-GB',now=new Date()){
  const d=new Date(iso);
  const sameDay=d.toDateString()===now.toDateString();
  const yesterday=new Date(now);yesterday.setDate(now.getDate()-1);
  const time=d.toLocaleTimeString(locale,{hour:'numeric',minute:'2-digit'});
  if(sameDay)return `${locale.startsWith('ur')?'آج':'Today'} ${time}`;
  if(d.toDateString()===yesterday.toDateString())return `${locale.startsWith('ur')?'کل':'Yesterday'} ${time}`;
  if(now-d<6*864e5)return `${d.toLocaleDateString(locale,{weekday:'long'})} ${time}`;
  return `${d.toLocaleDateString(locale,{day:'numeric',month:'short'})} ${time}`;
}
export function daysSince(iso,now=new Date()){if(!iso)return null;return Math.max(0,Math.floor((now-new Date(iso))/864e5));}

// Home status card. Returns {level:'safe'|'check'|'alert', reasons:[keys]}.
export function homeStatus(state,{listening=false,now=new Date()}={}){
  const active=state.alerts.find(a=>a.status==='active'&&a.kind!=='test'&&a.kind!=='practice');
  if(active)return {level:'alert',alert:active,reasons:[]};
  const reasons=[];
  if(!state.rooms.length)reasons.push('status.noRooms');
  if(!state.family.length)reasons.push('status.noFamily');
  if(state.rooms.some(r=>r.source==='phone')&&!listening)reasons.push('status.notListening');
  if(state.rooms.some(r=>r.status==='offline'))reasons.push('status.roomOffline');
  const days=daysSince(state.lastTest,now);
  if(days===null||days>30)reasons.push('status.testDue');
  return {level:reasons.length?'check':'safe',reasons};
}
