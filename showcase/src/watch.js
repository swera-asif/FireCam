// Camera support for the everyday app.
//  - Snapshot-URL rooms: periodic reachability checks (online/offline), thumbnails, and a snapshot
//    captured at alert time (a real copy when the camera allows cross-origin reads, else the URL).
//  - Phone camera watch: while listening, the phone's own camera keeps the latest frame so an
//    alert can carry a picture, and the colour/motion rules add an "extra evidence" line. The
//    rules never raise an alert by themselves.
import {inspectFrame,CuePersistence} from './detector.js';
import {LocalCamera,canvasJPEG} from './media.js';

export const CHECK_INTERVAL=5*60*1000;
const withBuster=url=>url+(url.includes('?')?'&':'?')+'t='+Date.now();

// Resolves true when the image at `url` loads within `timeout` ms. Works cross-origin because it
// only needs the load/error events, not the pixels.
export function probeImage(url,{timeout=12000,Img=globalThis.Image}={}){
  return new Promise(resolve=>{
    if(!Img)return resolve(false);
    const img=new Img();let done=false;
    const finish=ok=>{if(done)return;done=true;clearTimeout(timer);img.onload=img.onerror=null;resolve(ok);};
    const timer=setTimeout(()=>finish(false),timeout);
    img.onload=()=>finish(img.naturalWidth>0);img.onerror=()=>finish(false);
    img.src=withBuster(url);
  });
}
// Tries to capture a real copy of the snapshot (needs CORS on the camera). Falls back to the URL.
export async function captureSnapshot(url,{fetch=globalThis.fetch}={}){
  try{
    const r=await fetch(withBuster(url),{mode:'cors',cache:'no-store'});
    if(!r.ok)throw Error('status');
    const blob=await r.blob();if(!blob.type.startsWith('image/')||blob.size>8e6)throw Error('type');
    const bitmap=await createImageBitmap(blob);
    const data=canvasJPEG(bitmap);bitmap.close?.();
    return data.length<=380000?data:withBuster(url);
  }catch{return withBuster(url);}
}
// Pure: next room status after a probe. Keeps lastSeen for the "last seen" label.
export function applyProbe(room,ok,now=new Date().toISOString()){
  const was=room.status;
  room.status=ok?'ok':'offline';
  if(ok)room.lastSeen=now;
  return {changed:was!==room.status,room};
}

export function createWatch({getRooms,onChange=()=>{},onFrame=()=>{}}){
  let timer=null,lastFrame=null,lastResult=null,persistence=new CuePersistence(),previousFrame=null,video=null,checking=false;
  const camera=new LocalCamera(frame=>{
    const result=inspectFrame(frame,previousFrame);previousFrame=new Uint8ClampedArray(frame);
    const held=persistence.next(result);lastResult={...result,held};
    try{lastFrame=video&&video.readyState>=2?canvasJPEG(video):lastFrame;}catch{}
    onFrame({result:lastResult,frame:lastFrame});
  },()=>{});
  let again=false;
  async function checkAll(){
    if(checking){again=true;return;}
    checking=true;
    try{
      do{
        again=false;
        for(const room of getRooms().filter(r=>r.source==='url'&&r.url)){
          const ok=await probeImage(room.url);
          const {changed}=applyProbe(room,ok);
          if(changed)onChange(room);
        }
      }while(again);
    }finally{checking=false;}
  }
  return {
    start(){this.stop();checkAll();timer=setInterval(checkAll,CHECK_INTERVAL);},
    stop(){clearInterval(timer);timer=null;},
    checkAll,
    get running(){return !!timer;},
    async startCamera(el){video=el;previousFrame=null;persistence=new CuePersistence();await camera.start(el);},
    stopCamera(){camera.stop();video=null;lastFrame=null;lastResult=null;},
    get cameraActive(){return !!camera.stream;},
    // Evidence for an alert in `roomName`: {image, evidence} where evidence is an i18n key suffix.
    async evidenceFor(roomName){
      const room=getRooms().find(r=>r.name===roomName);
      if(room?.source==='url'&&room.url)return {image:await captureSnapshot(room.url),evidence:'snapshot'};
      if(camera.stream&&lastFrame)return {image:lastFrame,evidence:lastResult?.cue?'cue':lastResult?.obscured?'obscured':'clear'};
      return {image:'',evidence:'none'};
    }
  };
}
