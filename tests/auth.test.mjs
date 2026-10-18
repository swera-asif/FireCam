import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handleApi} from '../worker/index.js';
function database(){const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../drizzle/0000_portal.sql',import.meta.url),'utf8'));return {prepare(query){let args=[];return {bind(...v){args=v;return this},async first(){return sql.prepare(query).get(...args)||null},async all(){return {results:sql.prepare(query).all(...args)}},async run(){const r=sql.prepare(query).run(...args);return {meta:{last_row_id:Number(r.lastInsertRowid)}}}}},async batch(statements){sql.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sql.exec('COMMIT');return results}catch(e){sql.exec('ROLLBACK');throw e}}}}
test('hosted portal requires identity and registration, and isolates records',async()=>{
 const env={DB:database()};
 const call=(path,user,method='GET',body,extra={})=>handleApi(new Request('https://firecam.example/api/'+path,{method,headers:{...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.com'}:{}),...(body?{'Content-Type':'application/json'}:{}),...extra},body:body?JSON.stringify(body):undefined}),env);
 for(const path of ['bootstrap','user','cameras','contacts','settings'])assert.equal((await call(path)).status,401);
 assert.equal((await call('bootstrap',null,'GET',null,{Cookie:'firecam-mode=account'})).status,401);
 assert.equal((await call('register',null,'POST',{fullName:'Someone'})).status,401);
 assert.equal((await call('bootstrap','alice')).status,403);
 assert.equal((await call('register','alice','POST',{fullName:''})).status,400);
 assert.equal((await call('register','alice','POST',{fullName:'Alice'})).status,201);
 assert.equal((await call('register','bob','POST',{fullName:'Bob'})).status,201);
 assert.equal((await call('register','alice','POST',{fullName:'Duplicate'})).status,200);
 const response=await call('bootstrap','alice');assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal((await response.json()).floors.length,1);
 const camera=await (await call('cameras','alice','POST',{name:'Private camera',location:'Bedroom',source:'device'})).json();assert.ok(Number.isInteger(camera.id));
 for(const method of ['GET','PATCH','DELETE'])assert.equal((await call('cameras/'+camera.id,'bob',method,method==='PATCH'?{name:'Stolen'}:undefined)).status,404);
 assert.deepEqual(await (await call('cameras','bob')).json(),[]);
 assert.equal((await call('cameras','alice','POST',{name:'x',location:'x'},{Origin:'https://attacker.example'})).status,403);
 assert.equal((await call('cameras/'+camera.id,'alice')).status,200);
 assert.equal((await call('bootstrap')).status,401);
});
