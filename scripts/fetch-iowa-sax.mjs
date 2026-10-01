import fs from 'node:fs/promises';
const source='https://theremin.music.uiowa.edu/sound%20files/MIS%20Pitches%20-%202014/Woodwinds/Eb%20Alto%20Saxophone/';
export async function fetchIowaSax(manifest){
  await fs.mkdir('artifacts/audio-source',{recursive:true});
  manifest.saxophone=[];
  for(const [midi,note] of [[51,'Eb3'],[53,'F3'],[55,'G3'],[56,'Ab3'],[58,'Bb3'],[60,'C4'],[62,'D4'],[63,'Eb4']]){
    const name=`AltoSax.NoVib.ff.${note}.stereo.aif`,path=`artifacts/audio-source/${name}`;
    let data;try{data=await fs.readFile(path);}catch{const response=await fetch(source+name);if(!response.ok)throw Error(`${name}: ${response.status}`);data=Buffer.from(await response.arrayBuffer());await fs.writeFile(path,data);}
    let channels,frames,bits,rate,pcm;
    for(let p=12;p+8<data.length;){const id=data.toString('ascii',p,p+4),length=data.readUInt32BE(p+4),start=p+8;
      if(id==='COMM'){channels=data.readUInt16BE(start);frames=data.readUInt32BE(start+2);bits=data.readUInt16BE(start+6);const exponent=data.readUInt16BE(start+8)&0x7fff;rate=Math.round(Number(data.readBigUInt64BE(start+10))*2**(exponent-16383-63));}
      if(id==='SSND'){const offset=data.readUInt32BE(start);pcm=data.subarray(start+8+offset,start+length);}
      p=start+length+(length%2);
    }
    if(![16,24].includes(bits)||!pcm||!rate)throw Error(`Unsupported AIFF ${name}: ${bits}/${rate}`);
    const samples=new Float32Array(frames);
    for(let i=0;i<frames;i++){let total=0;for(let c=0;c<channels;c++)total+=pcm.readIntBE((i*channels+c)*(bits/8),bits/8)/2**(bits-1);samples[i]=total/channels;}
    let first=0,last=frames-1,peak=0;
    while(first<last&&Math.abs(samples[first])<.004)first++;
    first=Math.max(0,first-Math.round(rate*.01));
    while(last>first&&Math.abs(samples[last])<.002)last--;
    last=Math.min(frames-1,last+Math.round(rate*.06));
    for(let i=first;i<=last;i++)peak=Math.max(peak,Math.abs(samples[i]));
    const length=last-first+1,wav=Buffer.alloc(44+length*2),gain=Math.min(1,.75/peak);
    wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(length*2,40);
    for(let i=0;i<length;i++){const fade=Math.min(1,i/(rate*.003),(length-1-i)/(rate*.04));wav.writeInt16LE(Math.round(samples[first+i]*gain*fade*32767),44+i*2);}
    const url=`/audio/saxophone/iowa-${note}.wav`;await fs.writeFile('public'+url,wav);manifest.saxophone.push({midi,url,bytes:wav.length});
    console.log(note,rate,'Hz',Math.round(length/rate*1000),'ms');
  }
  await fs.writeFile('public/audio/licenses/iowa-sax.txt',`University of Iowa Musical Instrument Samples. Lawrence Fritts / Electronic Music Studios. Performer: Michael Giles. Alto saxophone, without vibrato. Source: ${source}\nLicense statement: https://theremin.music.uiowa.edu/mis.html — recordings may be downloaded and used for any projects, without restrictions.\nDerived files: stereo AIFF downmixed to mono PCM WAV, silence trimmed, short fades, peak attenuation where needed. No pitch shifting for the eight mapped notes.\n`);
}
if(process.argv[1]?.endsWith('fetch-iowa-sax.mjs')){const manifest=JSON.parse(await fs.readFile('lib/sample-manifest.json','utf8'));await fetchIowaSax(manifest);await fs.writeFile('lib/sample-manifest.json',JSON.stringify(manifest,null,2));}
