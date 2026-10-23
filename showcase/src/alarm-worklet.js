// AudioWorklet processor: measures how much of the incoming sound is a tone in the smoke-alarm
// band (2.6 to 4 kHz) and posts one message per ~21 ms window. Runs on the audio thread, so it keeps
// working while the page is in the background. It never outputs audio.
const BAND=[2600,4000];
function goertzelPower(samples,sampleRate,freq){
  const k=2*Math.cos(2*Math.PI*freq/sampleRate);let s0=0,s1=0,s2=0;
  for(let i=0;i<samples.length;i++){s0=samples[i]+k*s1-s2;s2=s1;s1=s0;}
  return (s1*s1+s2*s2-k*s1*s2)/samples.length;
}
class AlarmAnalyser extends AudioWorkletProcessor{
  constructor(){super();this.size=1024;this.buffer=new Float32Array(this.size);this.fill=0;}
  process(inputs){
    const input=inputs[0]?.[0];
    if(!input)return true;
    for(let i=0;i<input.length;i++){
      this.buffer[this.fill++]=input[i];
      if(this.fill===this.size){this.fill=0;this.emit();}
    }
    return true;
  }
  emit(){
    const s=this.buffer;let total=0;for(let i=0;i<s.length;i++)total+=s[i]*s[i];total/=s.length;
    let ratio=0;
    if(total>0){let band=0;for(let f=BAND[0];f<=BAND[1];f+=40)band=Math.max(band,goertzelPower(s,sampleRate,f));ratio=Math.min(1,(band*2)/(total*s.length)*4);}
    this.port.postMessage({time:currentTime,ratio,power:total});
  }
}
registerProcessor('alarm-analyser',AlarmAnalyser);
