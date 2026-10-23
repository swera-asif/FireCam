// Bridge to the Android app (Capacitor). On the web every export here is inert, so the rest of
// the code can call it without checking the platform first.
import {Capacitor,registerPlugin} from '@capacitor/core';
import {App} from '@capacitor/app';
import {PushNotifications} from '@capacitor/push-notifications';
import {config} from './config.js';

export const isNative=Capacitor.isNativePlatform();
export const platform=Capacitor.getPlatform();
// Absolute origin for Netlify functions and email links: inside the app, location.origin is the
// WebView's own https://localhost, which the outside world cannot reach.
export const siteUrl=(config.siteUrl||'https://firecam-showcase.netlify.app').replace(/\/$/,'');
export const apiBase=isNative?siteUrl:'';

const AlarmNative=isNative?registerPlugin('AlarmListener'):null;

// Same surface as AlarmListener in alarm.js, backed by the foreground service.
export function nativeListener({onStatus=()=>{},onLevel=()=>{},onAlarm=()=>{}}={}){
  const api={active:false,gate:{on:false},detector:{beeps:[]},
    async start(room=''){
      if(api.active)return;
      onStatus('permission');
      const r=await AlarmNative.start({room});
      api.active=!!r.listening;onStatus(api.active?'listening':'stopped');
    },
    async stop(reason='stopped'){await AlarmNative.stop().catch(()=>{});api.active=false;onStatus(reason);},
    status:()=>AlarmNative.status(),
    sample(){/* native side analyses audio */}
  };
  AlarmNative.addListener('status',({listening})=>{if(api.active!==listening){api.active=listening;onStatus(listening?'listening':'stopped');}});
  AlarmNative.addListener('level',l=>onLevel({level:l.level,tone:l.tone,beeps:l.beeps}));
  AlarmNative.addListener('alarm',a=>onAlarm({kind:a.kind,pattern:a.pattern,time:a.time}));
  AlarmNative.status().then(s=>{api.active=!!s.listening;if(api.active)onStatus('listening');}).catch(()=>{});
  return api;
}
export const nativeAlarm={
  pending:()=>AlarmNative?AlarmNative.getPendingAlarm():Promise.resolve({}),
  clearNotification:()=>AlarmNative?.clearAlarmNotification().catch(()=>{}),
  status:()=>AlarmNative?AlarmNative.status():Promise.resolve({}),
  openFullScreenSettings:()=>AlarmNative?.openFullScreenSettings(),
  openDndSettings:()=>AlarmNative?.openDndSettings(),
  openNotificationSettings:()=>AlarmNative?.openNotificationSettings()
};
// Runs cb when the app returns to the foreground (and once now).
export function onResume(cb){if(!isNative)return;App.addListener('appStateChange',({isActive})=>{if(isActive)cb();});App.addListener('resume',()=>cb());}

// Firebase Cloud Messaging token for this device (needs google-services.json in the Android build).
export async function nativePushToken(){
  if(!isNative)return null;
  const perm=await PushNotifications.requestPermissions();
  if(perm.receive!=='granted')return null;
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Push registration timed out. Is Firebase configured for this build?')),15000);
    PushNotifications.addListener('registration',t=>{clearTimeout(timer);resolve(t.value);});
    PushNotifications.addListener('registrationError',e=>{clearTimeout(timer);reject(Error(e.error||'Push registration failed'));});
    PushNotifications.register().catch(e=>{clearTimeout(timer);reject(e);});
  });
}
export function onPushTap(cb){if(!isNative)return;PushNotifications.addListener('pushNotificationActionPerformed',a=>cb(a.notification?.data||{}));}
