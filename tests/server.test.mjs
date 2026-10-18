import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server.mjs';

test('persistent, isolated FireCam API workflows', async t => {
  const dataDir=await mkdtemp(join(tmpdir(),'firecam-test-'));
  let app=await createApp({dataDir});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  let base=`http://127.0.0.1:${app.server.address().port}`;
  t.after(async()=>app.close());
  async function request(path,{method='GET',body,cookie,headers={}}={}) {
    const response=await fetch(base+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...headers},body:body?JSON.stringify(body):undefined});
    const value=await response.json().catch(()=>null);return {response,value,cookie:response.headers.get('set-cookie')?.split(';')[0]};
  }
  let alice,bob,camera,contact,event;
  await t.test('static entry and health are accessible',async()=>{
    const r=await fetch(base+'/');assert.equal(r.status,200);assert.match(await r.text(),/FireCam/);
    assert.equal((await request('/api/health')).value.storage,'sqlite');
    assert.equal((await fetch(base+'/app.js')).headers.get('content-type'),'text/javascript; charset=utf-8');
    assert.equal((await fetch(base+'/missing.png')).status,404);
  });
  await t.test('anonymous workspace reads are rejected',async()=>{
    for(const path of ['/api/cameras','/api/bootstrap','/api/contacts','/api/alerts'])assert.equal((await request(path)).response.status,401);
  });
  await t.test('registration validates passwords',async()=>{
    assert.equal((await request('/api/register',{method:'POST',body:{username:'bad-user',password:'short'}})).response.status,400);
  });
  await t.test('account creation returns a secure session and no password',async()=>{
    alice=await request('/api/register',{method:'POST',body:{username:'alice',password:'correct-horse-47',fullName:'Alice Test'}});
    assert.equal(alice.response.status,201);assert.ok(alice.cookie);assert.match(alice.response.headers.get('set-cookie'),/HttpOnly/);assert.match(alice.response.headers.get('set-cookie'),/SameSite=Strict/);assert.equal(alice.value.password,undefined);
    bob=await request('/api/register',{method:'POST',body:{username:'bob',password:'different-horse-47',fullName:'Bob Test'}});assert.equal(bob.response.status,201);
  });
  await t.test('duplicate usernames and bad credentials fail',async()=>{
    assert.equal((await request('/api/register',{method:'POST',body:{username:'ALICE',password:'correct-horse-47'}})).response.status,409);
    assert.equal((await request('/api/login',{method:'POST',body:{username:'alice',password:'wrong'}})).response.status,401);
  });
  await t.test('new workspaces contain no misleading demo telemetry',async()=>{
    const r=await request('/api/bootstrap',{cookie:alice.cookie});assert.equal(r.value.cameras.length,0);assert.equal(r.value.alerts.length,0);assert.equal(r.value.floors.length,1);
  });
  await t.test('camera creation is validated and starts disconnected',async()=>{
    const invalid=await request('/api/cameras',{method:'POST',cookie:alice.cookie,body:{name:'Kitchen',location:'Kitchen',imageUrl:'javascript:alert(1)'}});assert.equal(invalid.response.status,400);
    const r=await request('/api/cameras',{method:'POST',cookie:alice.cookie,body:{name:'Kitchen',location:'Kitchen',source:'device',status:'online',positionX:20,positionY:30}});assert.equal(r.response.status,201);assert.equal(r.value.status,'offline');camera=r.value;
  });
  await t.test('other accounts cannot read, modify, or delete a camera',async()=>{
    assert.deepEqual((await request('/api/cameras',{cookie:bob.cookie})).value,[]);
    for(const method of ['GET','PATCH','DELETE'])assert.equal((await request('/api/cameras/'+camera.id,{method,cookie:bob.cookie,...(method==='PATCH'?{body:{name:'stolen'}}:{})})).response.status,404);
  });
  await t.test('contact creation, edits, and profile updates persist',async()=>{
    contact=(await request('/api/contacts',{method:'POST',cookie:alice.cookie,body:{name:'Neighbour',phoneNumber:'+44 7700 900123',relationship:'Neighbour',password:'unwanted'}})).value;
    assert.equal(contact.password,undefined);
    const edit=await request('/api/contacts/'+contact.id,{method:'PATCH',cookie:alice.cookie,body:{name:'Neighbour updated'}});assert.equal(edit.value.name,'Neighbour updated');
    const profile=await request('/api/user',{method:'PATCH',cookie:alice.cookie,body:{fullName:'Alice Updated',phoneNumber:'+44 7700 900321',password:'ignored'}});assert.equal(profile.value.fullName,'Alice Updated');assert.equal(profile.value.password,undefined);
  });
  await t.test('manual alerts stay explicitly simulated and can be resolved',async()=>{
    event=(await request('/api/alerts',{method:'POST',cookie:alice.cookie,body:{message:'Demo smoke event',location:'Kitchen',type:'smoke',aiVerified:true,simulated:false}})).value;
    assert.equal(event.simulated,true);assert.equal(event.aiVerified,false);
    const resolved=(await request('/api/alerts/'+event.id,{method:'PATCH',cookie:alice.cookie,body:{status:'resolved',aiVerified:true,simulated:false}})).value;assert.equal(resolved.status,'resolved');assert.equal(resolved.simulated,true);assert.equal(resolved.aiVerified,false);
  });
  await t.test('cross-origin writes are rejected',async()=>{
    const r=await request('/api/contacts',{method:'POST',cookie:alice.cookie,headers:{Origin:'https://untrusted.example'},body:{name:'Intruder',phoneNumber:'12345678'}});assert.equal(r.response.status,403);
  });
  await t.test('floor geometry and uploaded image types are validated',async()=>{
    assert.equal((await request('/api/zones',{method:'POST',cookie:alice.cookie,body:{name:'Invalid room',positionX:-1}})).response.status,400);
    assert.equal((await request('/api/floors',{method:'POST',cookie:alice.cookie,body:{name:'Upper',background:'data:text/html;base64,AAAA'}})).response.status,400);
    assert.equal((await request('/api/floors',{method:'POST',cookie:alice.cookie,body:{name:'Upper',level:'1'}})).response.status,201);
  });
  await t.test('unconnected services fail explicitly',async()=>{
    for(const endpoint of ['analyze-image','verify-smoke','notify-contacts'])assert.equal((await request('/api/'+endpoint,{method:'POST',cookie:alice.cookie,body:{}})).response.status,503);
  });
  await t.test('preferences persist and unknown fields are excluded',async()=>{
    const r=await request('/api/settings',{method:'POST',cookie:alice.cookie,body:{homeName:'Test home',theme:'dark',desktopNotifications:false,secret:'ignore'}});assert.equal(r.value.homeName,'Test home');assert.equal(r.value.secret,undefined);
  });
  await t.test('SQLite records and sessions survive a server restart',async()=>{
    await app.close();app=await createApp({dataDir});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${app.server.address().port}`;
    const r=await request('/api/bootstrap',{cookie:alice.cookie});assert.equal(r.response.status,200);assert.equal(r.value.cameras[0].id,camera.id);assert.equal(r.value.settings.homeName,'Test home');assert.equal(r.value.user.fullName,'Alice Updated');
  });
  await t.test('deletion and logout are scoped and effective',async()=>{
    assert.equal((await request('/api/contacts/'+contact.id,{method:'DELETE',cookie:alice.cookie})).response.status,200);
    assert.equal((await request('/api/contacts/'+contact.id,{cookie:alice.cookie})).response.status,404);
    assert.equal((await request('/api/logout',{method:'POST',cookie:alice.cookie,body:{}})).response.status,200);
    assert.equal((await request('/api/bootstrap',{cookie:alice.cookie})).response.status,401);
    assert.equal((await request('/api/bootstrap',{cookie:bob.cookie})).response.status,200);
  });
});

test('web app assets and manifest are present',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'));
  assert.equal(manifest.display,'standalone');
  for(const icon of manifest.icons)assert.ok((await readFile(new URL('../public'+icon.src,import.meta.url))).length>100);
  const assets=await readdir(new URL('../public/assets/',import.meta.url));assert.ok(assets.includes('hero.webp'));
});
