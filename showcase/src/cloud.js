// Supabase (free tier) wrapper: accounts, one shared "home" document per family, shared alerts
// with realtime delivery, invite codes and Web Push subscriptions. Returns null when the
// deployment has no Supabase configuration, in which case the app runs in local mode.
import {createClient} from '@supabase/supabase-js';
import {config,cloudEnabled,pushEnabled} from './config.js';
import {isNative,nativePushToken,apiBase,siteUrl} from './native.js';

const HOME_KEY='firecam-home';
function urlBase64ToUint8Array(base64){const padding='='.repeat((4-base64.length%4)%4);const raw=atob((base64+padding).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,c=>c.charCodeAt(0));}
const fail=r=>{if(r.error)throw Error(r.error.message||'Request failed');return r.data;};

export function createCloud(){
  if(!cloudEnabled())return null;
  const sb=createClient(config.supabaseUrl,config.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  let homeId=null,channel=null;
  // Email links must open the public site, not the app WebView's https://localhost.
  const redirect=`${isNative?siteUrl:location.origin}/#/login`;
  const FCM_KEY='firecam-fcm';
  const api={
    get homeId(){return homeId;},
    pushAvailable:()=>cloudEnabled()&&(isNative||(pushEnabled()&&'serviceWorker' in navigator&&'PushManager' in window)),
    async session(){return (await sb.auth.getSession()).data.session;},
    async currentUser(){return (await api.session())?.user||null;},
    onAuth(cb){return sb.auth.onAuthStateChange((event,session)=>cb(event,session?.user||null));},
    signUp:(email,password)=>sb.auth.signUp({email,password,options:{emailRedirectTo:redirect}}).then(fail),
    signIn:(email,password)=>sb.auth.signInWithPassword({email,password}).then(fail),
    magicLink:email=>sb.auth.signInWithOtp({email,options:{emailRedirectTo:redirect,shouldCreateUser:true}}).then(fail),
    resetPassword:email=>sb.auth.resetPasswordForEmail(email,{redirectTo:redirect}).then(fail),
    updatePassword:password=>sb.auth.updateUser({password}).then(fail),
    async signOut(){api.unwatch();homeId=null;try{localStorage.removeItem(HOME_KEY);}catch{}await sb.auth.signOut();},

    // ---- Home document ---------------------------------------------------------------------
    async ensureHome(name='My home',displayName=''){
      const user=await api.currentUser();if(!user)throw Error('Sign in first.');
      let preferred='';try{preferred=localStorage.getItem(HOME_KEY)||'';}catch{}
      const memberships=fail(await sb.from('home_members').select('home_id,role,homes(id,name,data,updated_at,owner_id)').order('joined_at',{ascending:true}));
      let m=memberships.find(x=>x.home_id===preferred)||memberships[0];
      if(!m){const id=fail(await sb.rpc('create_home',{home_name:name}));const again=fail(await sb.from('home_members').select('home_id,role,homes(id,name,data,updated_at,owner_id)').eq('home_id',id));m=again[0];}
      homeId=m.home_id;try{localStorage.setItem(HOME_KEY,homeId);}catch{}
      if(displayName)sb.from('home_members').update({display_name:displayName.slice(0,100)}).eq('home_id',homeId).eq('user_id',user.id).then(()=>{});
      return {id:homeId,name:m.homes.name,data:m.homes.data||{},updatedAt:m.homes.updated_at,role:m.role,owner:m.homes.owner_id===user.id};
    },
    async saveHome(data,name){if(!homeId)return;fail(await sb.from('homes').update({data,name:(name||'My home').slice(0,100)}).eq('id',homeId));},
    async members(){if(!homeId)return [];return fail(await sb.from('home_members').select('user_id,role,display_name,joined_at').eq('home_id',homeId).order('joined_at'));},
    async createInvite(){return fail(await sb.rpc('create_invite',{h:homeId}));},
    async joinHome(code){const id=fail(await sb.rpc('join_home',{invite_code:String(code).trim().toUpperCase()}));try{localStorage.setItem(HOME_KEY,id);}catch{}api.unwatch();homeId=null;return id;},
    async leaveHome(){const user=await api.currentUser();if(!homeId||!user)return;fail(await sb.from('home_members').delete().eq('home_id',homeId).eq('user_id',user.id));try{localStorage.removeItem(HOME_KEY);}catch{}api.unwatch();homeId=null;},

    // ---- Alerts ------------------------------------------------------------------------------
    async listAlerts(limit=100){if(!homeId)return [];return fail(await sb.from('alerts').select('id,status,data,updated_at').eq('home_id',homeId).order('created_at',{ascending:false}).limit(limit));},
    async putAlert(alert){if(!homeId)return;const user=await api.currentUser();fail(await sb.from('alerts').upsert({id:alert.id,home_id:homeId,status:alert.status,data:alert,created_by:user?.id||null},{onConflict:'id'}));},
    watch({onHome,onAlert}){
      api.unwatch();if(!homeId)return;
      channel=sb.channel(`home-${homeId}`)
        .on('postgres_changes',{event:'UPDATE',schema:'public',table:'homes',filter:`id=eq.${homeId}`},p=>onHome?.(p.new))
        .on('postgres_changes',{event:'*',schema:'public',table:'alerts',filter:`home_id=eq.${homeId}`},p=>{if(p.new?.data)onAlert?.(p.new);})
        .subscribe();
    },
    unwatch(){if(channel){sb.removeChannel(channel);channel=null;}},

    // ---- Push ---------------------------------------------------------------------------------
    async pushSubscription(){
      if(isNative){let t='';try{t=localStorage.getItem(FCM_KEY)||'';}catch{}return t?{endpoint:'fcm:'+t}:null;}
      try{const reg=await navigator.serviceWorker?.getRegistration();return reg?await reg.pushManager.getSubscription():null;}catch{return null;}
    },
    async enablePush(){
      if(!api.pushAvailable()||!homeId)return false;
      const user=await api.currentUser();if(!user)return false;
      if(isNative){
        // Firebase Cloud Messaging token from the Android app (needs google-services.json in the build).
        const token=await nativePushToken();if(!token)return false;
        fail(await sb.from('push_subscriptions').upsert({user_id:user.id,home_id:homeId,endpoint:'fcm:'+token,subscription:{type:'fcm',token},user_agent:navigator.userAgent.slice(0,200)},{onConflict:'endpoint'}));
        try{localStorage.setItem(FCM_KEY,token);}catch{}
        return true;
      }
      const reg=await navigator.serviceWorker.ready;
      if(Notification.permission!=='granted'){const p=await Notification.requestPermission();if(p!=='granted')return false;}
      let sub=await reg.pushManager.getSubscription();
      if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(config.vapidPublicKey)});
      fail(await sb.from('push_subscriptions').upsert({user_id:user.id,home_id:homeId,endpoint:sub.endpoint,subscription:sub.toJSON(),user_agent:navigator.userAgent.slice(0,200)},{onConflict:'endpoint'}));
      return true;
    },
    async disablePush(){const sub=await api.pushSubscription();if(sub){await sb.from('push_subscriptions').delete().eq('endpoint',sub.endpoint);if(isNative){try{localStorage.removeItem(FCM_KEY);}catch{}}else await sub.unsubscribe();}},
    async notifyFamily(payload){
      const session=await api.session();if(!session||!homeId)return null;
      const r=await fetch(`${apiBase}/.netlify/functions/push`,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json',authorization:`Bearer ${session.access_token}`},body:JSON.stringify({homeId,...payload})});
      return r.ok?r.json():null;
    }
  };
  return api;
}
