// Sends a Web Push message to every subscribed device of a home. Called by the FireCam app
// when an alert is raised or escalates. Runs as a Netlify function (free tier). Dependencies
// are injected so the logic is testable without network access.
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const bounded=(v,n)=>typeof v==='string'&&v.length<=n;

export async function handlePush(request,{supabase,webpush,now=()=>Date.now()}){
  if(request.method!=='POST')return json(405,{error:'POST only'});
  const auth=request.headers.get('authorization')||'';
  const token=auth.startsWith('Bearer ')?auth.slice(7):'';
  if(!token)return json(401,{error:'Sign in first.'});
  let body;try{body=await request.json();}catch{return json(400,{error:'Bad request'});}
  const {homeId,title,text,tag,url,alertId,lang}=body||{};
  if(!/^[0-9a-f-]{36}$/.test(homeId||'')||!bounded(title,120)||!bounded(text||'',300)||!bounded(tag||'',60)||!bounded(url||'',200)||!bounded(alertId||'',40)||!/^\/(#.*)?$/.test(url||'/'))
    return json(400,{error:'Bad request'});
  const {data:{user}={},error:userError}=await supabase.auth.getUser(token);
  if(userError||!user)return json(401,{error:'Sign in again.'});
  const {data:member}=await supabase.from('home_members').select('role').eq('home_id',homeId).eq('user_id',user.id).maybeSingle();
  if(!member)return json(403,{error:'Not a member of this home.'});
  const {data:subs,error}=await supabase.from('push_subscriptions').select('id,endpoint,subscription').eq('home_id',homeId);
  if(error)return json(502,{error:'Could not load devices.'});
  const payload=JSON.stringify({title,body:text||'',tag:tag||'firecam-alert',url:url||'/#/home',alertId:alertId||'',lang:lang||'en',sentAt:now()});
  let sent=0,failed=0;const stale=[];
  await Promise.all((subs||[]).map(async s=>{
    try{await webpush.sendNotification(s.subscription,payload,{TTL:180,urgency:'high',topic:(tag||'firecam').slice(0,32).replace(/[^A-Za-z0-9_-]/g,'')});sent++;}
    catch(e){failed++;if(e?.statusCode===404||e?.statusCode===410)stale.push(s.id);}
  }));
  if(stale.length)await supabase.from('push_subscriptions').delete().in('id',stale);
  return json(200,{sent,failed,removed:stale.length});
}
