import {portalUrl} from './portal-config.js';
export const state={portalUrl,mode:'',backend:false,authMode:'email',signedIn:false,registrationRequired:false,realtime:'poll',data:null,lastSync:null,connected:true};
export function clearSession(){state.mode='';state.data=null;}
export async function init(){try{sessionStorage.removeItem('firecam-mode');localStorage.removeItem('firecam-demo-v2');}catch{}}
export async function verifySession(){return false;}
const unavailable=()=>{throw Error('Open the secure portal to sign in.');};
export const login=unavailable,logout=async()=>clearSession(),refresh=unavailable,save=unavailable,remove=unavailable,preferences=unavailable,profile=unavailable;
