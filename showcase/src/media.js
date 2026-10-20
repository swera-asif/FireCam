export class Microphone {
  constructor(update,onRecording){this.update=update;this.onRecording=onRecording;this.generation=0;this.recordEpoch=0;this.stream=null;this.active=false;this.pending=false;}
  discardPending(){this.recordEpoch++;}
  async start(record=false) {
    if(this.active||this.pending)return;
    if(!navigator.mediaDevices?.getUserMedia)throw Error('Microphone capture is unavailable. Use HTTPS and a supported browser.');
    const generation=++this.generation;this.pending=true;this.update('Waiting for microphone permission…',0);
    try {
      const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
      if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}
      this.stream=stream;this.active=true;
      const Audio=window.AudioContext||window.webkitAudioContext;
      if(Audio){
        this.context=new Audio();const input=this.context.createMediaStreamSource(stream);const analyser=this.context.createAnalyser();analyser.fftSize=256;input.connect(analyser);
        // Deliberately never connect to destination: no live speaker feedback.
        const samples=new Uint8Array(analyser.fftSize);
        const tick=()=>{if(!this.active)return;analyser.getByteTimeDomainData(samples);let sum=0;for(const v of samples)sum+=((v-128)/128)**2;this.update(record?'Recording locally · microphone active':'Push-to-talk · local capture only',Math.min(1,Math.sqrt(sum/samples.length)*4));this.frame=requestAnimationFrame(tick);};tick();
      }else this.update('Microphone active · level meter unsupported',0);
      if(record){
        if(!window.MediaRecorder)throw Error('This browser supports capture but not local recording.');
        const recorder=new MediaRecorder(stream),chunks=[],started=Date.now(),epoch=this.recordEpoch;this.recorder=recorder;
        recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
        recorder.onstop=()=>{if(!chunks.length||epoch!==this.recordEpoch)return;const blob=new Blob(chunks,{type:recorder.mimeType});this.onRecording({id:crypto.randomUUID(),url:URL.createObjectURL(blob),type:blob.type,time:new Date(started).toISOString(),duration:Math.max(1,Math.round((Date.now()-started)/1000))});};
        recorder.start(250);
        this.limit=setTimeout(()=>this.stop(),120000);
      }
      stream.getTracks().forEach(t=>t.onended=()=>this.stop());
    }catch(error){if(generation===this.generation){this.stop();throw error;}}
    finally{if(generation===this.generation)this.pending=false;}
  }
  stop(){
    ++this.generation;this.pending=false;this.active=false;clearTimeout(this.limit);cancelAnimationFrame(this.frame);
    if(this.recorder?.state==='recording')this.recorder.stop();this.recorder=null;
    this.stream?.getTracks().forEach(t=>{t.onended=null;t.stop();});this.stream=null;
    this.context?.close().catch(()=>{});this.context=null;this.update('Microphone off',0);
  }
}
export class LocalCamera {
  constructor(onFrame,onStatus){this.onFrame=onFrame;this.onStatus=onStatus;this.generation=0;}
  async start(video){
    this.stop();const generation=++this.generation;
    if(!navigator.mediaDevices?.getUserMedia)throw Error('Camera capture is unavailable. Use HTTPS and a supported browser.');
    this.onStatus('Waiting for camera permission…');
    const stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480}},audio:false});
    if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}
    this.stream=stream;this.video=video;video.srcObject=stream;
    try{await video.play();}catch(error){this.stop();throw error;}
    if(generation!==this.generation)return;
    this.onStatus('Camera active · automatic local checks every second');
    const canvas=document.createElement('canvas');canvas.width=160;canvas.height=120;const ctx=canvas.getContext('2d',{willReadFrequently:true});
    this.timer=setInterval(()=>{
      if(video.readyState<2)return;
      ctx.drawImage(video,0,0,160,120);this.onFrame(ctx.getImageData(0,0,160,120).data);
    },1000);
    stream.getTracks().forEach(t=>t.onended=()=>this.stop());
  }
  stop(){
    ++this.generation;clearInterval(this.timer);this.stream?.getTracks().forEach(t=>{t.onended=null;t.stop();});this.stream=null;
    if(this.video){this.video.pause();this.video.srcObject=null;this.video=null;}
    this.onStatus('Camera off · no background monitoring');
  }
}
export function canvasJPEG(source){
  const width=source.videoWidth||source.naturalWidth||source.width,height=source.videoHeight||source.naturalHeight||source.height;
  if(!width||!height)throw Error('Image is not ready.');
  const scale=Math.min(1,800/Math.max(width,height)),canvas=document.createElement('canvas');
  canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/jpeg',.75);
}
export async function loadImage(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10000000)throw Error('Choose a JPEG, PNG or WebP image smaller than 10 MB.');
  const url=URL.createObjectURL(file);
  try{const img=new Image();img.src=url;await img.decode();if(img.naturalWidth*img.naturalHeight>40000000)throw Error('Image dimensions are too large. Resize it first.');return img;}finally{URL.revokeObjectURL(url);}
}
