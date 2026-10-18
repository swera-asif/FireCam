import {randomBytes,scrypt,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
const derive=promisify(scrypt),digest=v=>createHash('sha256').update(v).digest('hex');
const kinds=new Set(['cameras','sensors','zones','alerts','contacts','floors']);
const error=(status,message)=>Object.assign(new Error(message),{status});
const userView=u=>({id:u.id,username:u.email,fullName:u.full_name,phoneNumber:u.phone_number});
const cookie='__Host-firecam_session';
const sessionToken=req=>(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookie+'='))?.slice(cookie.length+1);
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
async function input(req){
 if(!req.headers.get('content-type')?.startsWith('application/json'))throw error(415,'Send JSON data.');
 const reader=req.body?.getReader();if(!reader)throw error(400,'Missing request data.');let chunks=[],size=0;
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>3000000){await reader.cancel();throw error(413,'The upload is too large.');}chunks.push(value);}
 try{const b=JSON.parse(Buffer.concat(chunks).toString());if(!b||typeof b!=='object'||Array.isArray(b))throw Error();return b;}catch{throw error(400,'Invalid JSON.');}
}
export function validateRecord(kind,b,create){
 const fields={cameras:['name','location','floorId','imageUrl','source','positionX','positionY'],sensors:['name','location','floorId','type','positionX','positionY'],zones:['name','floorId','positionX','positionY','width','height'],alerts:['type','status','location','message','severity','resolvedAt'],contacts:['name','phoneNumber','relationship','priority'],floors:['name','level','background']}[kind];
 const out=Object.fromEntries(Object.entries(b).filter(([k])=>fields.includes(k)));
 for(const k of {cameras:['name','location'],sensors:['name','location'],zones:['name'],alerts:['message','location'],contacts:['name','phoneNumber'],floors:['name']}[kind])if((create||k in out)&&(typeof out[k]!=='string'||!out[k].trim()||out[k].length>2000))throw error(400,`Enter a valid ${k}.`);
 for(const [k,v] of Object.entries(out)){
  if(typeof v==='string'&&v.length>(k==='background'?2800000:k==='imageUrl'?3000:2000))throw error(400,`${k} is too long.`);
  if(['floorId','positionX','positionY','width','height','priority'].includes(k)&&(typeof v!=='number'||!Number.isFinite(v)))throw error(400,`Invalid ${k}.`);
  if(['positionX','positionY'].includes(k)&&(v<0||v>95))throw error(400,'Position must be between 0 and 95.');
  if(['width','height'].includes(k)&&(v<5||v>95))throw error(400,'Room size must be between 5 and 95.');
 }
 if(out.phoneNumber&&!/^[+\d ()-]{5,25}$/.test(out.phoneNumber))throw error(400,'Enter a valid phone number.');
 if(out.imageUrl&&!/^https:\/\//i.test(out.imageUrl))throw error(400,'Use an HTTPS camera URL.');
 if(out.source&&!['url','device'].includes(out.source))throw error(400,'Choose a device camera or image URL.');
 if(out.background&&!/^data:image\/(png|jpeg|webp);base64,/.test(out.background))throw error(400,'Use a PNG, JPEG or WebP image.');
 if(kind==='alerts'){out.simulated=true;out.aiVerified=false;if(create)Object.assign(out,{timestamp:new Date().toISOString(),status:'active'});if(out.status&&!['active','resolved'].includes(out.status))throw error(400,'Invalid alert status.');}
 if(create&&kind==='cameras')out.status='offline';if(create&&kind==='sensors')out.status='unconnected';return out;
}
async function limit(db,key,max){
 const now=Date.now(),reset=now+600000;
 const {rows}=await db.query(`INSERT INTO firecam_rate_limits(key,attempts,reset_at) VALUES($1,1,$2) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN firecam_rate_limits.reset_at<$3 THEN 1 ELSE firecam_rate_limits.attempts+1 END, reset_at=CASE WHEN firecam_rate_limits.reset_at<$3 THEN $2 ELSE firecam_rate_limits.reset_at END RETURNING attempts`,[digest(key),reset,now]);
 if(rows[0].attempts>max)throw error(429,'Too many attempts. Please try again in 10 minutes.');
}
export async function handleApi(req,db){
 const path=new URL(req.url).pathname,method=req.method;
 try{
  if(!['GET','HEAD'].includes(method)){
   const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)throw error(403,'Use the FireCam portal to make changes.');
   if(req.headers.get('sec-fetch-site')==='cross-site')throw error(403,'Cross-site changes are not allowed.');
  }
  if(path==='/api/health'&&method==='GET'){
   let ready=false;if(db)try{await db.query('SELECT id FROM firecam_users LIMIT 1');ready=true;}catch{}
   return json({service:'firecam',version:4,storage:'postgres',authMode:'email',ready,realtime:'poll',cameraAnalysis:false});
  }
  if(!db)throw error(503,'Account service is unavailable. Please try again later.');
  const token=sessionToken(req);
  if(['/api/login','/api/register'].includes(path)&&method==='POST'){
   const b=await input(req),email=String(b.username||b.email||'').trim().toLowerCase();
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||typeof b.password!=='string'||b.password.length>256)throw error(400,'Enter your email address and password.');
   await limit(db,'ip:'+(req.headers.get('x-vercel-forwarded-for')?.split(',')[0]||'unknown'),60);
   await limit(db,'email:'+email,20);
   const registering=path==='/api/register';let user;
   if(registering){
    if(b.password.length<10)throw error(400,'Use a password with at least 10 characters.');
    if(typeof b.fullName!=='string'||!b.fullName.trim()||b.fullName.length>100)throw error(400,'Enter your full name.');
    const salt=randomBytes(16).toString('hex'),hash=(await derive(b.password,salt,64)).toString('hex');
    const client=await db.connect();try{
     await client.query('BEGIN');
     const r=await client.query('INSERT INTO firecam_users(email,password,full_name) VALUES($1,$2,$3) RETURNING *',[email,hash+'.'+salt,b.fullName.trim()]);user=r.rows[0];
     await client.query('INSERT INTO firecam_records(user_id,kind,data) VALUES($1,$2,$3)',[user.id,'floors',JSON.stringify({name:'Ground floor',level:'0',background:''})]);
     await client.query('COMMIT');
    }catch(e){await client.query('ROLLBACK');if(e.code==='23505')throw error(409,'An account already uses this email. Sign in instead.');throw e;}finally{client.release();}
   }else{
    user=(await db.query('SELECT * FROM firecam_users WHERE email=$1',[email])).rows[0];
    const [hash,salt]=(user?.password||'0'.repeat(128)+'.invalid-user-salt').split('.');
    const supplied=await derive(b.password,salt,64);
    if(!timingSafeEqual(supplied,Buffer.from(hash,'hex'))||!user)throw error(401,'Incorrect email or password.');
   }
   if(token)await db.query('DELETE FROM firecam_sessions WHERE token=$1',[digest(token)]);
   const raw=randomBytes(32).toString('hex');await db.query('INSERT INTO firecam_sessions(token,user_id,expires) VALUES($1,$2,$3)',[digest(raw),user.id,Date.now()+86400000]);
   return json(userView(user),registering?201:200,{'Set-Cookie':`${cookie}=${raw}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`});
  }
  if(path==='/api/logout'&&method==='POST'){
   if(token)await db.query('DELETE FROM firecam_sessions WHERE token=$1',[digest(token)]);
   return json({success:true},200,{'Set-Cookie':`${cookie}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`});
  }
  const user=token?.length===64?(await db.query('SELECT u.* FROM firecam_users u JOIN firecam_sessions s ON s.user_id=u.id WHERE s.token=$1 AND s.expires>$2',[digest(token),Date.now()])).rows[0]:null;
  if(!user)throw error(401,'Sign in to continue.');
  const list=async kind=>(await db.query('SELECT id,data FROM firecam_records WHERE user_id=$1 AND kind=$2 ORDER BY id DESC',[user.id,kind])).rows.map(r=>({...r.data,id:r.id}));
  if(path==='/api/bootstrap'&&method==='GET'){const all=await Promise.all([...kinds].map(async k=>[k,await list(k)]));return json({user:userView(user),settings:user.settings,...Object.fromEntries(all)});}
  if(path==='/api/user'){
   if(method==='GET')return json(userView(user));
   if(method==='PATCH'){const b=await input(req);if(typeof b.fullName!=='string'||!b.fullName.trim()||b.fullName.length>100)throw error(400,'Enter your full name.');const r=await db.query('UPDATE firecam_users SET full_name=$1,phone_number=$2 WHERE id=$3 RETURNING *',[b.fullName.trim(),String(b.phoneNumber||'').slice(0,30),user.id]);return json(userView(r.rows[0]));}
  }
  if(path==='/api/settings'){
   if(method==='GET')return json(user.settings);
   if(method==='POST'){const b=await input(req),settings={homeName:String(b.homeName||'My home').slice(0,100),theme:b.theme==='dark'?'dark':'light',desktopNotifications:!!b.desktopNotifications};await db.query('UPDATE firecam_users SET settings=$1 WHERE id=$2',[JSON.stringify(settings),user.id]);return json(settings);}
  }
  const [, ,kind,id,...tail]=path.split('/');
  if(kinds.has(kind)&&!tail.length){
   if(!id&&method==='GET')return json(await list(kind));
   if(!id&&method==='POST'){const value=validateRecord(kind,await input(req),true);const r=await db.query('INSERT INTO firecam_records(user_id,kind,data) VALUES($1,$2,$3) RETURNING id',[user.id,kind,JSON.stringify(value)]);return json({...value,id:r.rows[0].id},201);}
   if(id){if(!/^\d+$/.test(id)||Number(id)>2147483647)throw error(404,'Record not found.');const row=(await db.query('SELECT id,data FROM firecam_records WHERE user_id=$1 AND kind=$2 AND id=$3',[user.id,kind,id])).rows[0];if(!row)throw error(404,'Record not found.');
    if(method==='GET')return json({...row.data,id:row.id});
    if(method==='PATCH'){const value={...row.data,...validateRecord(kind,await input(req),false)};await db.query('UPDATE firecam_records SET data=$1 WHERE id=$2 AND user_id=$3',[JSON.stringify(value),row.id,user.id]);return json({...value,id:row.id});}
    if(method==='DELETE'){await db.query('DELETE FROM firecam_records WHERE id=$1 AND user_id=$2',[row.id,user.id]);return json({success:true});}
   }
  }
  if(['/api/analyze-image','/api/verify-smoke','/api/notify-contacts'].includes(path))throw error(503,'This service is not connected.');
  throw error(404,'Endpoint not found.');
 }catch(e){return json({message:e.status?e.message:'The account service could not complete this request. Please try again.'},e.status||500);}
}
