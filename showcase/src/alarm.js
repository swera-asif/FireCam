// Smoke and CO alarm sound recognition.
//
// Residential smoke alarms sound the ISO 8201 "Temporal-Three" (T3) pattern: three 0.5 s beeps
// separated by 0.5 s, then a 1.5 s pause, repeated. Carbon-monoxide alarms sound "Temporal-Four"
// (T4): four short beeps about 0.1 s apart, then about 5 s of silence. Both use a piezo tone in
// roughly the 2.8 to 3.8 kHz band. The detector below is fed a stream of (time, toneOn) samples
// and reports when a pattern repeats. It is pure JavaScript so it can be unit-tested; the audio
// front-end that produces the samples lives further down.
//
// This is a convenience listener, not a certified detector. It can miss alarms (phone in a bag,
// loud TV, muffled room) and it can be fooled by a recording of an alarm. Physical alarms stay essential.

export const patterns={
  T3:{kind:'smoke',beep:[0.25,0.9],gap:[0.25,0.9],pause:[1.0,3.0],count:3,groups:2,partial:3},
  T4:{kind:'co',beep:[0.04,0.3],gap:[0.04,0.35],pause:[2.5,8.0],count:4,groups:2,partial:2}
};
const within=(v,[lo,hi])=>v>=lo&&v<=hi;

// Returns the pattern name when the recent beeps end with `groups` matching groups (the last one
// may be partial with at least `partial` beeps), otherwise null.
export function matchPattern(beeps,name){
  const p=patterns[name];
  if(beeps.length<p.count*(p.groups-1)+p.partial)return null;
  let i=beeps.length-1,groupsSeen=0;
  while(i>=0){
    // Walk one group backwards from beep i.
    let n=1;
    if(!within(beeps[i].end-beeps[i].start,p.beep))return null;
    while(n<p.count&&i-n>=0){
      const gap=beeps[i-n+1].start-beeps[i-n].end;
      if(!within(gap,p.gap))break;
      if(!within(beeps[i-n].end-beeps[i-n].start,p.beep))return null;
      n++;
    }
    const complete=n===p.count,last=groupsSeen===0;
    if(!(complete||(last&&n>=p.partial)))return null;
    groupsSeen++;
    if(groupsSeen>=p.groups)return name;
    i-=n;
    if(i<0)return null;
    const pause=beeps[i+1].start-beeps[i].end;
    if(!within(pause,p.pause))return null;
  }
  return null;
}

export class AlarmPatternDetector {
  constructor({minBeep=0.03,maxGap=10,onAlarm=()=>{}}={}){this.minBeep=minBeep;this.maxGap=maxGap;this.onAlarm=onAlarm;this.reset();}
  reset(){this.beeps=[];this.on=false;this.onset=0;this.lastTime=0;this.cooldownUntil=0;}
  // Feed a sample. `time` is in seconds (monotonic), `on` is whether the alarm tone is currently heard.
  push(time,on){
    const last=this.beeps.at(-1);
    if((this.lastTime&&time-this.lastTime>this.maxGap)||(last&&!this.on&&time-last.end>this.maxGap))this.beeps=[];
    this.lastTime=time;
    if(on&&!this.on){this.on=true;this.onset=time;return null;}
    if(!on&&this.on){
      this.on=false;
      if(time-this.onset>=this.minBeep){
        this.beeps.push({start:this.onset,end:time});
        if(this.beeps.length>24)this.beeps.shift();
        return this.evaluate(time);
      }
    }
    return null;
  }
  evaluate(time){
    if(time<this.cooldownUntil)return null;
    const name=matchPattern(this.beeps,'T4')||matchPattern(this.beeps,'T3');
    if(!name)return null;
    const result={pattern:name,kind:patterns[name].kind,time,beeps:this.beeps.length};
    this.beeps=[];this.cooldownUntil=time+20;
    this.onAlarm(result);
    return result;
  }
}

// Turns a noisy "how much of the sound is alarm-band tone" ratio into a clean on/off decision with
// hysteresis, so brief dips inside a beep or ticks between beeps do not create false edges.
export class ToneGate {
  constructor({onRatio=0.35,offRatio=0.2,floor=0.002,hold=0.03}={}){this.onRatio=onRatio;this.offRatio=offRatio;this.floor=floor;this.hold=hold;this.on=false;this.lastOn=-1;}
  next(time,ratio,power){
    const loud=power>=this.floor;
    if(!this.on&&loud&&ratio>=this.onRatio){this.on=true;this.lastOn=time;}
    else if(this.on){if(loud&&ratio>=this.offRatio)this.lastOn=time;else if(time-this.lastOn>this.hold)this.on=false;}
    return this.on;
  }
}

// ---- Browser front-end ---------------------------------------------------------------------

const BAND=[2600,4000];
function goertzelPower(samples,sampleRate,freq){
  const k=2*Math.cos(2*Math.PI*freq/sampleRate);let s0=0,s1=0,s2=0;
  for(let i=0;i<samples.length;i++){s0=samples[i]+k*s1-s2;s2=s1;s1=s0;}
  return (s1*s1+s2*s2-k*s1*s2)/samples.length;
}
// Analyse one window of PCM samples: returns the alarm-band ratio and the total power.
export function analyseWindow(samples,sampleRate){
  let total=0;for(let i=0;i<samples.length;i++)total+=samples[i]*samples[i];
  total/=samples.length;
  if(total<=0)return {ratio:0,power:0};
  // Scan the band in steps below one DFT bin (≈47 Hz for 1024 samples at 48 kHz) so a tone
  // between scan points still registers most of its energy.
  let band=0;
  for(let f=BAND[0];f<=BAND[1];f+=40)band=Math.max(band,goertzelPower(samples,sampleRate,f));
  // Goertzel power of a pure tone at the exact bin ≈ (amplitude²/4)·N; normalise so a clean tone gives ~1.
  const ratio=Math.min(1,(band*2)/(total*samples.length)*4);
  return {ratio,power:total};
}

export class AlarmListener {
  constructor({onStatus=()=>{},onLevel=()=>{},onAlarm=()=>{}}={}){
    this.onStatus=onStatus;this.onLevel=onLevel;this.onAlarm=onAlarm;this.active=false;this.generation=0;
    this.gate=new ToneGate();this.detector=new AlarmPatternDetector({onAlarm:r=>this.onAlarm(r)});this.toneSince=0;
  }
  async start(){
    if(this.active)return;
    if(!navigator.mediaDevices?.getUserMedia)throw Error('This browser cannot use the microphone. Use HTTPS and a current browser.');
    const generation=++this.generation;this.onStatus('permission');
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
    if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio){stream.getTracks().forEach(t=>t.stop());throw Error('This browser cannot analyse sound.');}
    this.stream=stream;this.context=new Audio();this.active=true;this.gate=new ToneGate();this.detector.reset();
    const source=this.context.createMediaStreamSource(stream);
    try{
      await this.context.audioWorklet.addModule('/alarm-worklet.js');
      if(generation!==this.generation)return;
      this.node=new AudioWorkletNode(this.context,'alarm-analyser');
      this.node.port.onmessage=e=>this.sample(e.data.time,e.data.ratio,e.data.power);
      source.connect(this.node);
      // The worklet produces no audio; nothing is connected to the speakers.
    }catch{
      // Fallback for browsers without AudioWorklet: poll an analyser from a timer.
      const analyser=this.context.createAnalyser();analyser.fftSize=2048;source.connect(analyser);
      const buffer=new Float32Array(analyser.fftSize);
      this.timer=setInterval(()=>{analyser.getFloatTimeDomainData(buffer);const {ratio,power}=analyseWindow(buffer,this.context.sampleRate);this.sample(this.context.currentTime,ratio,power);},25);
    }
    stream.getTracks().forEach(t=>t.onended=()=>this.stop('lost'));
    await this.context.resume();
    this.onStatus('listening');
  }
  sample(time,ratio,power){
    const on=this.gate.next(time,ratio,power);
    this.detector.push(time,on);
    this.onLevel({level:Math.min(1,Math.sqrt(power)*6),tone:on,beeps:this.detector.beeps.length});
  }
  stop(reason='stopped'){
    if(!this.active&&!this.stream)return;
    ++this.generation;this.active=false;clearInterval(this.timer);this.timer=null;
    this.node?.port.close();this.node=null;
    this.stream?.getTracks().forEach(t=>{t.onended=null;t.stop();});this.stream=null;
    this.context?.close().catch(()=>{});this.context=null;
    this.onStatus(reason);
  }
}

// ---- Alert sounds ---------------------------------------------------------------------------

let shared;
function audio(){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return null;if(!shared||shared.state==='closed')shared=new Audio();shared.resume().catch(()=>{});return shared;}

// Plays a genuine T3 (or T4) alarm pattern through the speaker, for testing the listener and for
// practice. Resolves when finished. Returns a stop function via the returned object.
export function playAlarmPattern(name='T3',seconds=8){
  const ctx=audio();if(!ctx)return {done:Promise.resolve(),stop(){}};
  const p=patterns[name],beep=name==='T3'?0.5:0.1,gap=name==='T3'?0.5:0.1,pause=name==='T3'?1.5:5;
  const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='square';osc.frequency.value=3200;gain.gain.value=0;
  osc.connect(gain).connect(ctx.destination);
  let t=ctx.currentTime+0.05;const start=t;
  while(t-start<seconds){
    for(let i=0;i<p.count;i++){gain.gain.setValueAtTime(0.4,t);gain.gain.setValueAtTime(0,t+beep);t+=beep+gap;}
    t+=pause-gap;
  }
  osc.start(start);osc.stop(t);
  const done=new Promise(r=>{osc.onended=r;});
  return {done,stop(){try{osc.stop();}catch{}}};
}

// A loud two-tone siren for the alert screen. Loops until stop() is called.
export class Siren {
  start(){
    const ctx=audio();if(!ctx||this.osc)return;
    this.osc=ctx.createOscillator();this.gain=ctx.createGain();this.osc.type='square';this.gain.gain.value=0.5;
    this.osc.connect(this.gain).connect(ctx.destination);this.osc.start();
    let high=false;this.timer=setInterval(()=>{high=!high;this.osc.frequency.setValueAtTime(high?1000:750,ctx.currentTime);},350);
  }
  stop(){clearInterval(this.timer);try{this.osc?.stop();}catch{}this.osc=null;}
  get active(){return !!this.osc;}
}

export function vibrate(pattern=[600,250,600,250,900]){try{return navigator.vibrate?.(pattern)||false;}catch{return false;}}
export function stopVibration(){try{navigator.vibrate?.(0);}catch{}}
export function speak(text,lang='en-GB'){
  try{
    if(!window.speechSynthesis)return false;
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);u.lang=lang;u.rate=0.95;u.volume=1;
    const voice=speechSynthesis.getVoices().find(v=>v.lang.toLowerCase().startsWith(lang.slice(0,2)));if(voice)u.voice=voice;
    speechSynthesis.speak(u);return true;
  }catch{return false;}
}
export function stopSpeaking(){try{speechSynthesis?.cancel();}catch{}}
export async function notify(title,body,tag='firecam-alert'){
  try{
    if(!('Notification' in window)||Notification.permission!=='granted')return false;
    const reg=await navigator.serviceWorker?.getRegistration?.();
    const options={body,tag,renotify:true,requireInteraction:true,vibrate:[600,250,600],icon:'/assets/firecam-logo-192.png'};
    if(reg?.showNotification){await reg.showNotification(title,options);return true;}
    new Notification(title,options);return true;
  }catch{return false;}
}
