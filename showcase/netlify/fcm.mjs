// Minimal Firebase Cloud Messaging (HTTP v1) sender for the Android app. Uses a Firebase service
// account (free Spark plan) and Node's crypto to mint the OAuth token, so no SDK is needed.
import {createSign} from 'node:crypto';

const b64url=buf=>Buffer.from(buf).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');

export function createFcm(serviceAccountJson,{fetch=globalThis.fetch,now=()=>Date.now()}={}){
  if(!serviceAccountJson)return null;
  let account;try{account=typeof serviceAccountJson==='string'?JSON.parse(serviceAccountJson):serviceAccountJson;}catch{throw Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON');}
  if(!account.client_email||!account.private_key||!account.project_id)throw Error('FIREBASE_SERVICE_ACCOUNT is missing fields');
  let cached={token:'',expires:0};
  async function accessToken(){
    if(cached.token&&cached.expires-60000>now())return cached.token;
    const iat=Math.floor(now()/1000);
    const header=b64url(JSON.stringify({alg:'RS256',typ:'JWT'}));
    const claims=b64url(JSON.stringify({iss:account.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat,exp:iat+3600}));
    const signer=createSign('RSA-SHA256');signer.update(`${header}.${claims}`);
    const jwt=`${header}.${claims}.${b64url(signer.sign(account.private_key))}`;
    const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:jwt})});
    if(!r.ok)throw Object.assign(Error('FCM auth failed'),{statusCode:r.status});
    const data=await r.json();cached={token:data.access_token,expires:now()+(data.expires_in||3600)*1000};
    return cached.token;
  }
  return {
    projectId:account.project_id,
    // Sends a high-priority notification on the "alarms" channel plus data for the app.
    async send(token,payload){
      const access=await accessToken();
      const message={token,
        notification:{title:payload.title,body:payload.body||''},
        data:{url:payload.url||'/#/home',alertId:payload.alertId||'',tag:payload.tag||'firecam-alert'},
        android:{priority:'high',ttl:'180s',notification:{channel_id:'alarms',sound:'default',default_vibrate_timings:true,notification_priority:'PRIORITY_MAX',visibility:'PUBLIC',tag:payload.tag||'firecam-alert'}}};
      const r=await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,{method:'POST',headers:{authorization:`Bearer ${access}`,'content-type':'application/json'},body:JSON.stringify({message})});
      if(r.ok)return true;
      let detail='';try{detail=JSON.stringify(await r.json()).slice(0,300);}catch{}
      // UNREGISTERED tokens come back as 404; the caller prunes those like dead Web Push endpoints.
      throw Object.assign(Error(`FCM ${r.status} ${detail}`),{statusCode:r.status===404||/UNREGISTERED/.test(detail)?410:r.status});
    }
  };
}
