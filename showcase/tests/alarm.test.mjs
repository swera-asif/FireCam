import test from 'node:test';
import assert from 'node:assert/strict';
import {AlarmPatternDetector,ToneGate,matchPattern,analyseWindow} from '../src/alarm.js';

// Feeds a detector with an on/off schedule at 20 ms resolution. `plan` is [[onSeconds,offSeconds],...].
function run(detector,plan,start=0){
  let t=start;const results=[];
  for(const [on,off] of plan){
    for(let x=0;x<on;x+=0.02){const r=detector.push(t,true);if(r)results.push(r);t+=0.02;}
    for(let x=0;x<off;x+=0.02){const r=detector.push(t,false);if(r)results.push(r);t+=0.02;}
  }
  return {results,time:t};
}
const t3=cycles=>Array.from({length:cycles},()=>[[0.5,0.5],[0.5,0.5],[0.5,1.5]]).flat();
const t4=cycles=>Array.from({length:cycles},()=>[[0.1,0.1],[0.1,0.1],[0.1,0.1],[0.1,5]]).flat();

test('T3 smoke pattern is recognised after two groups and reported once',()=>{
  const d=new AlarmPatternDetector();
  const {results,time}=run(d,t3(3));
  assert.equal(results.length,1);assert.equal(results[0].pattern,'T3');assert.equal(results[0].kind,'smoke');
  assert.ok(results[0].time<7,'should confirm within the second cycle, got '+results[0].time);
  assert.ok(time>10);
});
test('T4 carbon-monoxide pattern is recognised and distinguished from T3',()=>{
  const d=new AlarmPatternDetector();
  const {results}=run(d,t4(2));
  assert.equal(results.length,1);assert.equal(results[0].pattern,'T4');assert.equal(results[0].kind,'co');
});
test('timing tolerance: slow and fast T3 variants still match; wrong rhythms do not',()=>{
  assert.equal(run(new AlarmPatternDetector(),Array(3).fill([[0.4,0.4],[0.4,0.4],[0.4,1.2]]).flat()).results[0]?.pattern,'T3');
  assert.equal(run(new AlarmPatternDetector(),Array(3).fill([[0.7,0.6],[0.7,0.6],[0.7,2.2]]).flat()).results[0]?.pattern,'T3');
  // Continuous tone, steady 1 Hz beeping, two-beep groups: none of these are T3 or T4.
  assert.equal(run(new AlarmPatternDetector(),[[8,1]]).results.length,0);
  assert.equal(run(new AlarmPatternDetector(),Array(10).fill([0.5,0.5])).results.length,0);
  assert.equal(run(new AlarmPatternDetector(),Array(5).fill([[0.5,0.5],[0.5,1.5]]).flat()).results.length,0);
  // A doorbell-like pair of long notes, or a microwave's single long beeps.
  assert.equal(run(new AlarmPatternDetector(),Array(4).fill([[1.2,0.3],[1.2,3]]).flat()).results.length,0);
});
test('blips shorter than the minimum beep are ignored and a long silence resets the history',()=>{
  const d=new AlarmPatternDetector();
  const noisy=t3(2).flatMap(step=>[[0.01,0.02],step]);
  assert.equal(run(d,noisy).results.length,1);
  const d2=new AlarmPatternDetector();
  run(d2,[[0.5,0.5],[0.5,0.5],[0.5,15]]);
  assert.equal(d2.beeps.length,0,'history cleared after 15 s of silence');
});
test('matchPattern accepts a partial trailing T4 group of two beeps after one full group',()=>{
  const beeps=[];let t=0;
  for(let i=0;i<4;i++){beeps.push({start:t,end:t+0.1});t+=0.2;}
  t+=5;for(let i=0;i<2;i++){beeps.push({start:t,end:t+0.1});t+=0.2;}
  assert.equal(matchPattern(beeps,'T4'),'T4');
  assert.equal(matchPattern(beeps.slice(0,4),'T4'),null);
});
test('tone gate applies hysteresis and a quiet floor',()=>{
  const g=new ToneGate({onRatio:0.35,offRatio:0.2,floor:0.002,hold:0.03});
  assert.equal(g.next(0,0.9,0.0001),false,'too quiet');
  assert.equal(g.next(0.02,0.9,0.01),true);
  assert.equal(g.next(0.04,0.25,0.01),true,'stays on above off threshold');
  assert.equal(g.next(0.05,0.05,0.01),true,'brief dip held');
  assert.equal(g.next(0.1,0.05,0.01),false,'released after hold');
});
test('window analysis separates a 3.2 kHz tone from broadband noise',()=>{
  const rate=48000,n=1024,tone=new Float32Array(n),noise=new Float32Array(n),mix=new Float32Array(n);
  let seed=7;const rand=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff*2-1;};
  for(let i=0;i<n;i++){tone[i]=0.3*Math.sin(2*Math.PI*3200*i/rate);noise[i]=0.3*rand();mix[i]=tone[i]+0.08*rand();}
  assert.ok(analyseWindow(tone,rate).ratio>0.8,'pure tone ratio '+analyseWindow(tone,rate).ratio);
  for(const [f,sr] of [[3137,48000],[2960,44100],[3850,44100],[3100,48000]]){
    const off=new Float32Array(n);for(let i=0;i<n;i++)off[i]=0.3*Math.sin(2*Math.PI*f*i/sr);
    assert.ok(analyseWindow(off,sr).ratio>0.6,`off-grid ${f} Hz at ${sr}: `+analyseWindow(off,sr).ratio);
  }
  // A square wave (piezo buzzers are far from sinusoidal) still reads as alarm-band tone.
  const square=new Float32Array(n);for(let i=0;i<n;i++)square[i]=0.3*Math.sign(Math.sin(2*Math.PI*3100*i/rate));
  assert.ok(analyseWindow(square,rate).ratio>0.5,'square ratio '+analyseWindow(square,rate).ratio);
  assert.ok(analyseWindow(noise,rate).ratio<0.2,'noise ratio '+analyseWindow(noise,rate).ratio);
  assert.ok(analyseWindow(mix,rate).ratio>0.5,'tone in noise ratio '+analyseWindow(mix,rate).ratio);
  assert.deepEqual(analyseWindow(new Float32Array(n),rate),{ratio:0,power:0});
});
