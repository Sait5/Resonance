import fs from 'node:fs/promises';
import {fetchIowaSax} from './fetch-iowa-sax.mjs';
const base='https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/master/';
const sets={piano:['piano',[...Array.from({length:25},(_,i)=>['C','Ds','Fs','A'][i%4]+(1+Math.floor(i/4))),'Ds7','Fs7','A7','B7']],acoustic:['guitar-acoustic',['E2','A2','D3','G3','B3','E4']],electric:['guitar-electric',['E2','A2','C3','Ds3','Fs3','A3','C4','Ds4','Fs4']],bass:['bass-electric',['E1','G1','As1','Cs2','E2','G2']],violin:['violin',['A3','C4','E4','A4','C5','E5']],saxophone:['saxophone',['E3','F3','G3','Gs3','As3','C4','D4','Ds4']],trumpet:['trumpet',['F3','A3','C4','Ds4','F4','G4','As4','D5']]};
await fs.mkdir('public/audio/licenses',{recursive:true});
async function download(url,path){try {const s=await fs.stat(path);if(s.size)return s.size;}catch{} const r=await fetch(url);if(!r.ok)throw Error(`${r.status} ${url}`);const b=Buffer.from(await r.arrayBuffer());await fs.writeFile(path,b);return b.length;}
const manifest={};
for(const [id,[folder,notes]] of Object.entries(sets)){
  await fs.mkdir(`public/audio/${id}`,{recursive:true});manifest[id]=[];
  for(const note of notes){const url=`/audio/${id}/${note}.mp3`;const bytes=await download(`${base}samples/${folder}/${note}.mp3`,`public${url}`);const match=note.match(/^([A-G])(s?)(\d)$/);const midi=(Number(match[3])+1)*12+{C:0,D:2,E:4,F:5,G:7,A:9,B:11}[match[1]]+(match[2]?1:0);manifest[id].push({midi,url,bytes});}
  console.log(id,manifest[id].length);
}
const drumBase='https://raw.githubusercontent.com/samblenny/web-midi-drumkit/main/';
const drums={36:'drum_heavy_kick',38:'drum_snare_hard',42:'drum_cymbal_closed',46:'drum_cymbal_open',43:'drum_tom_lo_hard',45:'drum_tom_mid_hard',47:'drum_tom_hi_hard',49:'drum_splash_hard',51:'drum_cymbal_soft'};
await fs.mkdir('public/audio/drums',{recursive:true});manifest.drums=[];
for(const [midi,file] of Object.entries(drums)){const url=`/audio/drums/${file}.flac`;const bytes=await download(`${drumBase}samples/${file}.flac`,`public${url}`);manifest.drums.push({midi:Number(midi),url,bytes});}
for(const file of ['LICENSE.md','sample-source-info.txt'])await download(base+file,`public/audio/licenses/tonejs-${file}`);
await download(drumBase+'LICENSES/LICENSE_SAMPLES.md','public/audio/licenses/drums.md');
await download(drumBase+'samples/README.md','public/audio/licenses/drums-sources.md');
await fetchIowaSax(manifest);
await fs.writeFile('lib/sample-manifest.json',JSON.stringify(manifest,null,2));



