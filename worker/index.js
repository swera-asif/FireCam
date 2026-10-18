// Identity headers are supplied and verified by Sites dispatch, not browser storage.
const kinds = new Set(['cameras','sensors','zones','alerts','contacts','floors']);
const fail = (status,message,code) => Object.assign(new Error(message),{status,code});
const json = (data,status=200) => new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const identity = request => {
  const id=request.headers.get('oai-authenticated-user-id'), email=request.headers.get('oai-authenticated-user-email');
  return id && email ? {id,email} : null;
};
const cleanUser = row => ({id:row.id,username:row.email,fullName:row.full_name,phoneNumber:row.phone_number});
async function body(request) {
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw fail(415,'Send JSON data.');
  if(Number(request.headers.get('content-length')||0)>3000000)throw fail(413,'Upload is too large.');
  const reader=request.body?.getReader();let size=0, chunks=[];
  if(!reader)throw fail(400,'Missing request data.');
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>3000000){await reader.cancel();throw fail(413,'Upload is too large.');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}
  try{const data=JSON.parse(new TextDecoder().decode(bytes));if(!data||typeof data!=='object'||Array.isArray(data))throw Error();return data;}catch{throw fail(400,'Invalid JSON.');}
}
function validate(kind,value,create=false) {
  const allowed={cameras:['name','location','floorId','source','imageUrl','positionX','positionY'],sensors:['name','location','floorId','type','positionX','positionY'],zones:['name','floorId','positionX','positionY','width','height'],alerts:['type','status','location','message','severity','resolvedAt'],contacts:['name','phoneNumber','relationship','priority'],floors:['name','level','background']}[kind];
  const data=Object.fromEntries(Object.entries(value).filter(([k])=>allowed.includes(k)));
  for(const key of {cameras:['name','location'],sensors:['name','location'],zones:['name'],alerts:['location','message'],contacts:['name','phoneNumber'],floors:['name']}[kind]){
    if((create||key in data)&&(typeof data[key]!=='string'||!data[key].trim()||data[key].length>2000))throw fail(400,`Enter a valid ${key}.`);
  }
  for(const [key,val] of Object.entries(data)){
    if(typeof val==='string'&&val.length>(key==='background'?2800000:key==='imageUrl'?3000:2000))throw fail(400,`${key} is too long.`);
    if(['floorId','positionX','positionY','width','height','priority'].includes(key)&&(typeof val!=='number'||!Number.isFinite(val)))throw fail(400,`Invalid ${key}.`);
    if(['positionX','positionY'].includes(key)&&(val<0||val>95))throw fail(400,'Position must be between 0 and 95.');
    if(['width','height'].includes(key)&&(val<5||val>95))throw fail(400,'Size must be between 5 and 95.');
  }
  if(data.imageUrl&&!/^https:\/\//.test(data.imageUrl))throw fail(400,'Use an HTTPS image URL.');
  if(data.source&&!['url','device'].includes(data.source))throw fail(400,'Choose a device camera or image URL.');
  if(data.phoneNumber&&!/^[+\d ()-]{5,25}$/.test(data.phoneNumber))throw fail(400,'Enter a valid phone number.');
  if(data.background&&!/^data:image\/(png|jpeg|webp);base64,/.test(data.background))throw fail(400,'Use a PNG, JPEG, or WebP image.');
  if(kind==='alerts'){
    if(create)Object.assign(data,{status:'active',timestamp:new Date().toISOString()});
    data.simulated=true;data.aiVerified=false;
    if('status' in data&&!['active','resolved'].includes(data.status))throw fail(400,'Invalid alert status.');
  }
  if(create&&kind==='cameras')data.status='offline';
  if(create&&kind==='sensors')data.status='unconnected';
  return data;
}
export async function handleApi(request,env) {
  const url=new URL(request.url),path=url.pathname,who=identity(request),method=request.method;
  try {
    if(!['GET','HEAD'].includes(method)){
      const origin=request.headers.get('Origin');
      if(origin&&origin!==url.origin)throw fail(403,'Use the FireCam portal to make changes.');
      if(request.headers.get('Sec-Fetch-Site')==='cross-site')throw fail(403,'Cross-site changes are not allowed.');
    }
    if(path==='/api/health'&&method==='GET')return json({service:'firecam',version:3,authMode:'chatgpt',signedIn:!!who,realtime:'poll',storage:'d1',cameraAnalysis:false});
    if(!who)throw fail(401,'Sign in to continue.','SIGN_IN_REQUIRED');
    if(!env.DB)throw fail(503,'Portal storage is unavailable. Please try again later.');
    const db=env.DB;
    let user=await db.prepare('SELECT * FROM portal_users WHERE identity_id=?').bind(who.id).first();
    if(path==='/api/register'&&method==='POST'){
      if(user)return json(cleanUser(user));
      const b=await body(request);
      if(typeof b.fullName!=='string'||!b.fullName.trim()||b.fullName.length>100)throw fail(400,'Enter your full name (up to 100 characters).');
      const userId=crypto.randomUUID();
      await db.batch([
        db.prepare('INSERT OR IGNORE INTO portal_users(id,identity_id,email,full_name,phone_number) VALUES(?,?,?,?,?)').bind(userId,who.id,who.email,b.fullName.trim(),''),
        db.prepare('INSERT INTO portal_records(user_id,kind,data) SELECT id,?,? FROM portal_users WHERE identity_id=? AND NOT EXISTS (SELECT 1 FROM portal_records WHERE user_id=portal_users.id AND kind=?)').bind('floors',JSON.stringify({name:'Ground floor',level:'0',background:''}),who.id,'floors')
      ]);
      user=await db.prepare('SELECT * FROM portal_users WHERE identity_id=?').bind(who.id).first();
      return json(cleanUser(user),201);
    }
    if(!user)throw fail(403,'Complete your FireCam registration first.','REGISTRATION_REQUIRED');
    const records=async kind=>{const r=await db.prepare('SELECT id,data FROM portal_records WHERE user_id=? AND kind=? ORDER BY rowid DESC').bind(user.id,kind).all();return r.results.map(v=>({...JSON.parse(v.data),id:v.id}));};
    if(path==='/api/user'){
      if(method==='GET')return json(cleanUser(user));
      if(method==='PATCH'){const b=await body(request);const name=String(b.fullName??user.full_name).trim().slice(0,100),phone=String(b.phoneNumber??user.phone_number).slice(0,30);if(!name)throw fail(400,'Enter your full name.');await db.prepare('UPDATE portal_users SET full_name=?,phone_number=? WHERE id=?').bind(name,phone,user.id).run();return json(cleanUser({...user,full_name:name,phone_number:phone}));}
    }
    if(path==='/api/bootstrap'&&method==='GET'){
      const all=await Promise.all([...kinds].map(async k=>[k,await records(k)]));
      return json({user:cleanUser(user),...Object.fromEntries(all),settings:JSON.parse(user.settings||'{}')});
    }
    if(path==='/api/settings'){
      if(method==='GET')return json(JSON.parse(user.settings||'{}'));
      if(method==='POST'){const b=await body(request),settings={homeName:String(b.homeName||'My home').slice(0,100),desktopNotifications:Boolean(b.desktopNotifications),theme:b.theme==='dark'?'dark':'light'};await db.prepare('UPDATE portal_users SET settings=? WHERE id=?').bind(JSON.stringify(settings),user.id).run();return json(settings);}
    }
    const [, ,kind,id,...extra]=path.split('/');
    if(kinds.has(kind)&&!extra.length){
      if(!id&&method==='GET')return json(await records(kind));
      if(!id&&method==='POST'){const value=validate(kind,await body(request),true);const result=await db.prepare('INSERT INTO portal_records(user_id,kind,data) VALUES(?,?,?)').bind(user.id,kind,JSON.stringify(value)).run();return json({...value,id:Number(result.meta.last_row_id)},201);}
      if(id){const row=await db.prepare('SELECT data FROM portal_records WHERE id=? AND user_id=? AND kind=?').bind(id,user.id,kind).first();if(!row)throw fail(404,'Record not found.');const original=JSON.parse(row.data);
        if(method==='GET')return json({...original,id:Number(id)});
        if(method==='PATCH'){const value={...original,...validate(kind,await body(request))};await db.prepare('UPDATE portal_records SET data=? WHERE id=? AND user_id=?').bind(JSON.stringify(value),id,user.id).run();return json({...value,id:Number(id)});}
        if(method==='DELETE'){await db.prepare('DELETE FROM portal_records WHERE id=? AND user_id=?').bind(id,user.id).run();return json({success:true});}
      }
    }
    if(['/api/analyze-image','/api/verify-smoke','/api/notify-contacts'].includes(path))throw fail(503,'This service is not connected.');
    throw fail(404,'Endpoint not found.');
  }catch(error){return json({message:error.status?error.message:'The portal could not complete this request.',code:error.code||'REQUEST_FAILED'},error.status||500);}
}
export function createWorker(assets={}) {
  return {async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname.startsWith('/api/'))return handleApi(request,env);
    if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
    const name=url.pathname==='/'?'/index.html':url.pathname;
    const asset=assets[name];if(!asset)return new Response('Not found',{status:404});
    const bytes=Uint8Array.from(atob(asset.base64),c=>c.charCodeAt(0));
    return new Response(request.method==='HEAD'?null:bytes,{headers:{'Content-Type':asset.type,'Cache-Control':name.endsWith('.js')||name.endsWith('.html')?'no-cache':'public, max-age=3600','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Permissions-Policy':'camera=(self), microphone=(), geolocation=()'}});
  }};
}
