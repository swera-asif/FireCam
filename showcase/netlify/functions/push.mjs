import webpush from 'web-push';
import {createClient} from '@supabase/supabase-js';
import {handlePush} from '../push-handler.mjs';

const env=process.env;
const configured=env.SUPABASE_URL&&env.SUPABASE_SERVICE_ROLE_KEY&&env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY;
let supabase;
export default async function handler(request){
  if(!configured)return new Response(JSON.stringify({error:'Push is not configured on this deployment.'}),{status:503,headers:{'content-type':'application/json'}});
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)return new Response(JSON.stringify({error:'Forbidden'}),{status:403,headers:{'content-type':'application/json'}});
  webpush.setVapidDetails(env.VAPID_SUBJECT||'mailto:swerafa3@gmail.com',env.VAPID_PUBLIC_KEY,env.VAPID_PRIVATE_KEY);
  supabase??=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  try{return await handlePush(request,{supabase,webpush});}
  catch(e){console.error('push failed',e?.message);return new Response(JSON.stringify({error:'Push failed.'}),{status:502,headers:{'content-type':'application/json'}});}
}
export const config={path:'/.netlify/functions/push'};
