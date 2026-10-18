export const state={mode:'',backend:false,authMode:'local',signedIn:false,registrationRequired:false,realtime:'sse',data:null,lastSync:null,connected:true};
export function clearSession(){state.mode='';state.data=null;state.lastSync=null;}
export async function api(path,method='GET',body){
 const response=await fetch('/api'+path,{method,credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});
 const result=await response.json().catch(()=>({message:'The FireCam server is unavailable.'}));
 if(!response.ok){
  if(response.status===401||result.code==='REGISTRATION_REQUIRED'){
   const hadSession=!!state.data;clearSession();state.registrationRequired=result.code==='REGISTRATION_REQUIRED';
   if(response.status===401)state.signedIn=false;
   if(hadSession)window.dispatchEvent(new Event('firecam:auth-required'));
  }
  throw Object.assign(new Error(result.message||'The request could not be completed.'),{status:response.status,code:result.code});
 }
 return result;
}
export async function init(){
 try{sessionStorage.removeItem('firecam-mode');localStorage.removeItem('firecam-demo-v2');}catch{}
 try{const health=await api('/health');state.backend=health.service==='firecam';state.authMode=health.authMode||'local';state.signedIn=!!health.signedIn;state.realtime=health.realtime||'sse';}catch{state.backend=false;}
 if(state.backend)try{await refresh();}catch{}
}
export async function refresh(){const result=await api('/bootstrap');state.data=result;state.mode='account';state.signedIn=true;state.registrationRequired=false;state.lastSync=new Date();state.connected=true;return result;}
export async function verifySession(){if(!state.data)return false;try{await api('/user');return true;}catch(error){clearSession();throw error;}}
export async function login(values,create=false){clearSession();const user=await api(create?'/register':'/login','POST',values);await refresh();return user;}
export async function logout(){try{await api('/logout','POST',{});}finally{clearSession();}}
export async function save(kind,values,id){const result=await api(`/${kind}${id?'/'+id:''}`,id?'PATCH':'POST',values);await refresh();return result;}
export async function remove(kind,id){await api(`/${kind}/${id}`,'DELETE',{});await refresh();}
export async function preferences(values){await api('/settings','POST',values);await refresh();}
export async function profile(values){await api('/user','PATCH',values);await refresh();}
