import test from 'node:test';
import assert from 'node:assert/strict';
import {probeImage,captureSnapshot,applyProbe} from '../src/watch.js';
import {initialState,validState} from '../src/model.js';

// A fake Image that reports success for URLs containing "good", failure otherwise, after a tick.
class FakeImage{set src(v){this._src=v;setTimeout(()=>{if(v.includes('good')){this.naturalWidth=640;this.onload?.();}else this.onerror?.();},5);}}
class HangingImage{set src(v){}}

test('probeImage resolves true on load, false on error or timeout, and busts caches',async()=>{
  assert.equal(await probeImage('http://cam/good.jpg',{Img:FakeImage}),true);
  assert.equal(await probeImage('http://cam/bad.jpg',{Img:FakeImage}),false);
  assert.equal(await probeImage('http://cam/good.jpg?x=1',{Img:HangingImage,timeout:30}),false);
  let seen='';class Spy{set src(v){seen=v;this.naturalWidth=1;setTimeout(()=>this.onload(),1);}}
  await probeImage('http://cam/snap.jpg?x=1',{Img:Spy});assert.match(seen,/^http:\/\/cam\/snap\.jpg\?x=1&t=\d+$/);
  assert.equal(await probeImage('http://cam/x.jpg',{Img:undefined}),false);
});
test('applyProbe tracks online/offline transitions and last-seen time',()=>{
  const room={id:'c',name:'Hall',source:'url',url:'http://cam/snap.jpg',status:'unknown',lastSeen:null};
  assert.equal(applyProbe(room,true,'2026-10-24T10:00:00.000Z').changed,true);assert.equal(room.status,'ok');assert.equal(room.lastSeen,'2026-10-24T10:00:00.000Z');
  assert.equal(applyProbe(room,true,'2026-10-24T10:05:00.000Z').changed,false);assert.equal(room.lastSeen,'2026-10-24T10:05:00.000Z');
  assert.equal(applyProbe(room,false,'2026-10-24T10:10:00.000Z').changed,true);assert.equal(room.status,'offline');assert.equal(room.lastSeen,'2026-10-24T10:05:00.000Z','last seen is kept while offline');
  const s=initialState();s.rooms.push(room);assert.ok(validState(s));
});
test('captureSnapshot falls back to a cache-busted URL when the camera blocks cross-origin reads',async()=>{
  const blocked=async()=>{throw new TypeError('Failed to fetch');};
  assert.match(await captureSnapshot('http://cam/snap.jpg',{fetch:blocked}),/^http:\/\/cam\/snap\.jpg\?t=\d+$/);
  const notImage=async()=>new Response('<html>',{status:200,headers:{'content-type':'text/html'}});
  assert.match(await captureSnapshot('http://cam/snap.jpg',{fetch:notImage}),/\?t=\d+$/);
  const unauthorised=async()=>new Response('',{status:401});
  assert.match(await captureSnapshot('http://cam/snap.jpg',{fetch:unauthorised}),/\?t=\d+$/);
});
