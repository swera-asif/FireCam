import {firebaseConfig} from './firebase-config.js';
export const state={mode:'',backend:false,authMode:'firebase',signedIn:false,registrationRequired:false,realtime:'poll',data:null,lastSync:null,connected:true,setupError:''};
let auth,db,A,F;
const kinds=['cameras','sensors','zones','alerts','contacts','floors'];
export function clearSession(){state.mode='';state.data=null;state.lastSync=null;}
const need=()=>{if(!auth?.currentUser)throw Error('Please sign in to continue.');return auth.currentUser;};
const userRef=()=>F.doc(db,'users',need().uid);
const records=kind=>{if(!kinds.includes(kind))throw Error('Unknown record type.');return F.collection(userRef(),kind);};
const freshId=()=>{const a=crypto.getRandomValues(new Uint32Array(2));return a[0]*1048576+(a[1]&1048575);};
export async function init(){
 try{sessionStorage.removeItem('firecam-mode');localStorage.removeItem('firecam-demo-v2');}catch{}
 if(!firebaseConfig?.projectId){state.setupError='Account sign-in is being configured. Please check back soon.';return;}
 try{
  const app=await import('https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js');
  [A,F]=await Promise.all([import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js')]);
  const instance=app.initializeApp(firebaseConfig);auth=A.getAuth(instance);db=F.getFirestore(instance);
  await A.setPersistence(auth,A.browserSessionPersistence);await auth.authStateReady();state.backend=true;state.signedIn=!!auth.currentUser;
  A.onAuthStateChanged(auth,user=>{state.signedIn=!!user;if(!user&&state.data){clearSession();window.dispatchEvent(new Event('firecam:auth-required'));}});
  if(auth.currentUser)try{await refresh();}catch{clearSession();}
 }catch{state.setupError='Sign-in is unavailable. Please reload and try again.';state.backend=false;}
}
async function registerProfile(fullName){
 const user=need();if(!fullName?.trim())throw Error('Enter your full name.');
 await F.runTransaction(db,async transaction=>{const ref=userRef(),existing=await transaction.get(ref);if(existing.exists())return;
 transaction.set(ref,{fullName:fullName.trim().slice(0,100),phoneNumber:'',settings:{}});
 transaction.set(F.doc(records('floors'),'1'),{id:1,name:'Ground floor',level:'0',background:''});});
}
export async function refresh(){
 const user=need();const profile=await F.getDocFromServer(userRef());
 if(!profile.exists()){state.registrationRequired=true;clearSession();throw Error('Complete your FireCam registration.');}
 const all=await Promise.all(kinds.map(async kind=>[kind,(await F.getDocsFromServer(records(kind))).docs.map(d=>d.data())]));
 if(auth.currentUser?.uid!==user.uid)throw Error('Your session changed. Please sign in again.');
 const p=profile.data();state.data={user:{id:user.uid,username:user.email||user.phoneNumber||'',fullName:p.fullName,phoneNumber:p.phoneNumber||''},settings:p.settings||{},...Object.fromEntries(all)};
 state.mode='account';state.signedIn=true;state.registrationRequired=false;state.lastSync=new Date();return state.data;
}
export async function verifySession(){if(!state.data)return false;try{await need().getIdToken();const p=await F.getDocFromServer(userRef());if(!p.exists())throw Error('Register to continue.');return true;}catch(error){clearSession();throw error;}}
export async function login(values,create=false){
 if(!state.backend)throw Error(state.setupError);clearSession();
 if(create&&auth.currentUser){await registerProfile(values.fullName);}else if(create){await A.createUserWithEmailAndPassword(auth,values.email,values.password);await registerProfile(values.fullName);}else await A.signInWithEmailAndPassword(auth,values.email,values.password);
 return refresh();
}
export async function googleLogin(){if(!state.backend)throw Error(state.setupError);await A.signInWithPopup(auth,new A.GoogleAuthProvider());state.signedIn=true;const p=await F.getDocFromServer(userRef());if(!p.exists()){state.registrationRequired=true;return false;}await refresh();return true;}
export async function resetPassword(email){if(!state.backend)throw Error(state.setupError);if(!email)throw Error('Enter your email address first.');await A.sendPasswordResetEmail(auth,email);}
export async function logout(){try{if(auth)await A.signOut(auth);}finally{clearSession();state.signedIn=false;state.registrationRequired=false;}}
export async function save(kind,values,id){
 need();const recordId=Number(id)||freshId();const ref=F.doc(records(kind),String(recordId));const value={...values,id:recordId};
 if(kind==='alerts'){value.simulated=true;value.aiVerified=false;if(!id){value.status='active';value.timestamp=new Date().toISOString();}}
 if(!id&&kind==='cameras')value.status='offline';if(!id&&kind==='sensors')value.status='unconnected';
 if(kind==='floors'&&value.background?.length>700000)throw Error('Use a floor-plan image smaller than 500 KB.');
 if(id)await F.updateDoc(ref,value);else await F.setDoc(ref,value);await refresh();return value;
}
export async function remove(kind,id){await F.deleteDoc(F.doc(records(kind),String(id)));await refresh();}
export async function preferences(settings){await F.updateDoc(userRef(),{settings});await refresh();}
export async function profile(values){await F.updateDoc(userRef(),{fullName:values.fullName.trim().slice(0,100),phoneNumber:values.phoneNumber||''});await refresh();}
