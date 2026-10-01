import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const manifest=JSON.parse(fs.readFileSync('lib/sample-manifest.json','utf8'));
const sources=[];let resume=Promise.resolve();
const param=(value=0)=>({value,setTargetAtTime(v){this.value=v;},setValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;},cancelAndHoldAtTime(){}});
class FakeAudioContext {
  currentTime=1;destination={};
  resume(){return resume;}
  decodeAudioData(){return Promise.resolve({duration:2});}
  createDynamicsCompressor(){return {threshold:{value:0},knee:{value:0},ratio:{value:0},attack:{value:0},release:{value:0},connect(){}};}
  createBufferSource(){const s={buffer:null,playbackRate:param(1),detune:param(),connect(){},disconnect(){},start(time){this.started=time;},stop(time){this.stopped=time;}};sources.push(s);return s;}
  createGain(){return {gain:param(1),connect(){},disconnect(){}};}
  createBiquadFilter(){return {frequency:param(),gain:param(),connect(){},disconnect(){}};}
}
globalThis.AudioContext=FakeAudioContext;
globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)});
let code=ts.transpileModule(fs.readFileSync('lib/instrument-engine.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
code=code.replace(/import manifest from .*?;/,`const manifest=${JSON.stringify(manifest)};`);
const {InstrumentEngine,PLAYABLE,handleMidi}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
for(const [id,files] of Object.entries(manifest))for(const file of files){assert.equal(fs.statSync('public'+file.url).size,file.bytes);}
const piano=new InstrumentEngine('piano');await piano.load();assert.equal(piano.progress,1);
await Promise.all([piano.noteOn(60,'keyboard:C'),piano.noteOn(64,'keyboard:E'),piano.noteOn(60,'pointer:1')]);
assert.equal(piano.active.size,3);piano.noteOff('keyboard:C');assert.equal(piano.active.size,2);assert(piano.active.has('pointer:1'));
const waiting=new InstrumentEngine('piano');const pending=waiting.noteOn(67,'pending');waiting.noteOff('pending');await pending;assert(!waiting.active.has('pending'));waiting.dispose();
handleMidi(piano,new Uint8Array([0x92,72,100]),'test');await new Promise(r=>setImmediate(r));assert(piano.active.has('midi:test:2:72'));
handleMidi(piano,new Uint8Array([0x92,72,0]),'test');assert(!piano.active.has('midi:test:2:72'));
handleMidi(piano,new Uint8Array([0x91,69,80]),'test');await new Promise(r=>setImmediate(r));handleMidi(piano,new Uint8Array([0x81,69,10]),'test');assert(!piano.active.has('midi:test:1:69'));
piano.stopAll();assert.equal(piano.active.size,0);
for(const id of Object.keys(PLAYABLE)){
 const engine=new InstrumentEngine(id);await engine.load();
 for(const midi of PLAYABLE[id]){await engine.noteOn(midi,'test:'+midi);assert(engine.active.has('test:'+midi),`${id} ${midi}`);}
 assert.equal(engine.active.size,PLAYABLE[id].length);engine.dispose();assert.equal(engine.active.size,0);
}
assert.equal(PLAYABLE.piano.length,88);
const report=JSON.parse(fs.readFileSync('artifacts/prepared/validation.json','utf8'));
for(const [id,model] of Object.entries(report)){
 const b=fs.readFileSync('public/models/playable/'+id+'.glb');const j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));
 const names=new Set(j.nodes.map(n=>n.name));for(const part of model.parts)assert(names.has(part),part);
 assert(model.roundTripVerified);assert(j.animations?.length||['acoustic','violin','electric','bass'].includes(id));
}
const guitar=new InstrumentEngine('acoustic');await guitar.load();await guitar.noteOn(40,'one');assert.equal(guitar.active.size,1);
guitar.setSound({volume:0,warmth:5,reference:440,transpose:0,strings:{40:38}});assert.equal(guitar.soundingNote(40),38);assert.equal(sources.at(-1).detune.value,-200);assert.equal(guitar.bus.gain.value,0);assert.equal(guitar.tone.gain.value,5);
guitar.setSound({...guitar.settings,reference:442,transpose:1});assert(Math.abs(sources.at(-1).detune.value-(-100+1200*Math.log2(442/440)))<1e-8);
guitar.dispose();
let performanceCode=ts.transpileModule(fs.readFileSync('lib/performance.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/import.*?from.*?;/,`const PLAYABLE=${JSON.stringify(PLAYABLE)};`);
const {arrangeSong,numericNote}=await import('data:text/javascript;base64,'+Buffer.from(performanceCode).toString('base64'));
for(const id of Object.keys(PLAYABLE))for(let song=0;song<4;song++){const events=arrangeSong(id,song),notes=new Set(events.flatMap(e=>e.notes));for(const note of notes)assert(PLAYABLE[id].includes(note));if(id!=='piano')assert(notes.size>2);if(id==='drums')assert.equal(notes.size,9);if(id==='piano')assert(events.some(e=>e.notes.length>1));}
for(let i=0;i<12;i++){const code=i<9?`Digit${i+1}`:i===9?'Digit0':i===10?'Minus':'Equal';assert.equal(numericNote('trumpet',code),PLAYABLE.trumpet[i]);}
piano.dispose();console.log('PASS: single-note input, polyphony, live volume/tone/tuning, all 12 trumpet shortcuts, all instrument song arrangements, samples, MIDI, cleanup and GLB round trips.');
