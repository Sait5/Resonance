import manifest from './sample-manifest.json';

export type InstrumentId = 'piano' | 'acoustic' | 'electric' | 'bass' | 'violin' | 'drums' | 'saxophone' | 'trumpet';
export type NoteEvent = { midi: number; velocity: number; time: number; token: string; type: 'on' | 'off' };
type Voice = { midi: number; source: AudioBufferSourceNode; gain: GainNode };
export type SoundSettings = { volume:number; warmth:number; reference:number; transpose:number; strings:Record<number,number> };
export const DEFAULT_SOUND:SoundSettings={volume:85,warmth:0,reference:440,transpose:0,strings:{}};
export const noteName = (m: number) => ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][m%12]+(Math.floor(m/12)-1);
export const STRINGS = { acoustic:[40,45,50,55,59,64], electric:[40,45,50,55,59,64], bass:[28,33,38,43], violin:[55,62,69,76] };
// Concert-pitch notes; trumpet uses the middle (written G) harmonic of a Bb trumpet.
export const TRUMPET_FINGERINGS: Record<number, number[]> = {59:[1,2,3],60:[1,3],61:[2,3],62:[1,2],63:[1],64:[2],65:[],66:[2,3],67:[1,2],68:[1],69:[2],70:[]};
// Alto Eb saxophone: written C D E F G A B C, sounding Eb F G Ab Bb C D Eb.
export const SAX_FINGERINGS: Record<number, number[]> = {51:[1,2,3,4,5,6,7],53:[1,2,3,4,5,6],55:[1,2,3,4,5],56:[1,2,3,4],58:[1,2,3],60:[1,2],62:[1],63:[2]};
export const PLAYABLE: Record<InstrumentId, number[]> = {
  piano: Array.from({length:88},(_,i)=>21+i), ...STRINGS,
  drums:[36,38,42,46,45,47,43,49,51], saxophone:Object.keys(SAX_FINGERINGS).map(Number), trumpet:Object.keys(TRUMPET_FINGERINGS).map(Number),
};

let context: AudioContext | undefined;
let output: DynamicsCompressorNode;
function audioContext() {
  if(!context){
    context=new AudioContext({latencyHint:'interactive'});
    output=context.createDynamicsCompressor();
    output.threshold.value=-6;output.knee.value=6;output.ratio.value=12;
    output.attack.value=.003;output.release.value=.15;output.connect(context.destination);
  }
  return context;
}

/** One voice per input token. Note ownership prevents one input releasing another. */
export class InstrumentEngine {
  readonly active = new Map<string, NoteEvent>();
  readonly lastStrike = new Map<number, number>();
  readonly pressedValves = new Map<string, number>();
  private voices = new Map<string, Voice>();
  private buffers = new Map<number, AudioBuffer>();
  private listeners = new Set<() => void>();
  private pending = new Map<string, number>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private loading?: Promise<void>;
  private abort = new AbortController();
  private disposed = false;
  private serial = 0;
  private sustain = new Set<string>();
  private sustained = new Map<string, string>();
  private bus?: GainNode;
  private tone?: BiquadFilterNode;
  settings:SoundSettings={...DEFAULT_SOUND,strings:{}};
  soundingNote(midi:number){return (this.settings.strings[midi]??midi)+this.settings.transpose;}
  private detune(midi:number){return (this.soundingNote(midi)-midi)*100+1200*Math.log2(this.settings.reference/440);}
  setSound(settings:SoundSettings) {
    const clamp=(n:number,min:number,max:number,fallback:number)=>Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
    const strings:Record<number,number>={};
    for(const midi of PLAYABLE[this.id])if(settings.strings?.[midi]!==undefined)strings[midi]=Math.round(clamp(settings.strings[midi],midi-12,midi+12,midi));
    this.settings={volume:clamp(settings.volume,0,100,85),warmth:clamp(settings.warmth,-12,12,0),reference:clamp(settings.reference,415,466,440),transpose:Math.round(clamp(settings.transpose,-12,12,0)),strings};
    if(context){this.bus?.gain.setTargetAtTime(this.settings.volume/100,context.currentTime,.02);this.tone?.gain.setTargetAtTime(this.settings.warmth,context.currentTime,.02);
      for(const voice of this.voices.values())voice.source.detune.setTargetAtTime(this.detune(voice.midi),context.currentTime,.02);}
    this.notify();
  }
  progress = 0;
  error = '';
  ready = false;
  lastNote: number | null = null;
  constructor(readonly id: InstrumentId) {}
  subscribe = (fn: () => void) => {this.listeners.add(fn); return () => {this.listeners.delete(fn);};};
  private notify() {for(const fn of this.listeners)fn();}
  get now() {return context?.currentTime ?? 0;}
  load() {
    return this.loading ??= (async()=>{
      const ctx=audioContext();
      if(!this.bus){this.bus=ctx.createGain();this.tone=ctx.createBiquadFilter();this.tone.type='lowshelf';this.tone.frequency.value=600;this.tone.gain.value=this.settings.warmth;this.bus.gain.value=this.settings.volume/100;this.tone.connect(this.bus);this.bus.connect(output);}
      const files=manifest[this.id];
      const total=files.reduce((n,f)=>n+f.bytes,0); let done=0;
      try {
        await Promise.all(files.map(async file=>{
          const response=await fetch(file.url,{signal:this.abort.signal});
          if(!response.ok)throw Error(`Audio ${response.status}: ${file.url}`);
          const data=await response.arrayBuffer();
          const buffer=await ctx.decodeAudioData(data);
          if(this.disposed)return;
          this.buffers.set(file.midi,buffer);done+=file.bytes;this.progress=done/total;this.notify();
        }));
        if(!this.disposed){this.ready=true;this.notify();}
      } catch(e) {if(!this.disposed){this.error=e instanceof Error?e.message:'Audio loading failed';this.notify();}throw e;}
    })();
  }
  async noteOn(midi:number,token:string,velocity=.8) {
    if(this.disposed||!PLAYABLE[this.id].includes(midi)||this.active.has(token)||this.pending.has(token))return;
    const generation=++this.serial;this.pending.set(token,generation);
    try {
      const ctx=audioContext();void ctx.resume().catch(()=>{});
      if(!this.ready)await this.load();
      if(this.disposed||this.pending.get(token)!==generation)return;
      this.pending.delete(token);
      const keys=[...this.buffers.keys()];
      const nearest=this.id==='drums'?midi:keys.reduce((a,b)=>Math.abs(a-midi)<=Math.abs(b-midi)?a:b);
      const buffer=this.buffers.get(nearest);if(!buffer)return;
      if(this.voices.has(token))this.release(token,.025);
      if(this.id==='drums'&&midi===42)for(const [t,v] of this.voices)if(v.midi===46)this.release(t,.045);
      const source=ctx.createBufferSource(),gain=ctx.createGain(),time=ctx.currentTime;
      source.buffer=buffer;source.playbackRate.value=2**((midi-nearest)/12);
      source.detune.value=this.detune(midi);
      gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(Math.min(1,Math.max(.01,velocity))*.65,time+.004);
      source.connect(gain);gain.connect(this.tone!);
      const voice={midi,source,gain};this.voices.set(token,voice);
      source.onended=()=>{source.disconnect();gain.disconnect();if(this.voices.get(token)===voice)this.voices.delete(token);};
      source.start(time);
      this.active.set(token,{midi,token,velocity,time,type:'on'});this.lastStrike.set(midi,time);this.lastNote=midi;this.notify();
    } catch {this.pending.delete(token);}
  }
  noteOff(token:string,owner?:string) {
    this.pending.delete(token);
    if(owner&&this.sustain.has(owner)&&this.id==='piano'){this.sustained.set(token,owner);this.active.delete(token);this.notify();return;}
    this.active.delete(token);this.sustained.delete(token);
    this.release(token,this.id==='piano'?.32:this.id==='drums'?1.2:.16);this.notify();
  }
  private release(token:string,duration:number) {
    const voice=this.voices.get(token);if(!voice||!context)return;
    // Percussion is a one-shot; pointer/key release must not cut its transient/tail.
    if(this.id==='drums'&&duration>1)return;
    const now=context.currentTime;
    voice.gain.gain.cancelAndHoldAtTime(now);voice.gain.gain.linearRampToValueAtTime(0,now+duration);
    voice.source.stop(now+duration+.01);this.voices.delete(token);
  }
  pulse(midi:number,duration=.5,velocity=.8) {
    const token=`auto:${++this.serial}`;
    void this.noteOn(midi,token,velocity).then(()=>{if(this.disposed)return;const timer=setTimeout(()=>{this.noteOff(token);this.timers.delete(timer);},duration*1000);this.timers.add(timer);});
  }
  pedal(owner:string,down:boolean) {
    if(down)this.sustain.add(owner);
    else {this.sustain.delete(owner);for(const [token,source] of this.sustained)if(source===owner)this.noteOff(token);}
  }
  setValve(token:string,valve:number,down:boolean) {
    if(this.id!=='trumpet')return;
    if(down)this.pressedValves.set(token,valve);else this.pressedValves.delete(token);
    this.soundValves();
  }
  private soundValves() {
    this.noteOff('valves:combined');
    const valves=[...new Set(this.pressedValves.values())];
    if(valves.length)void this.noteOn(65-valves.reduce((n,v)=>n+([0,2,1,3][v]??0),0),'valves:combined');
  }
  stopPrefix(prefix:string) {
    let valvesChanged=false;
    for(const token of this.pressedValves.keys())if(token.startsWith(prefix)){this.pressedValves.delete(token);valvesChanged=true;}
    for(const token of [...this.pending.keys(),...this.active.keys(),...this.voices.keys()])if(token.startsWith(prefix)){this.active.delete(token);this.pending.delete(token);this.sustained.delete(token);this.release(token,.04);}
    for(const owner of this.sustain)if(owner.startsWith(prefix))this.sustain.delete(owner);
    if(valvesChanged)this.soundValves();
    this.notify();
  }
  stopAll() {this.stopPrefix('');}
  dispose() {this.disposed=true;this.abort.abort();for(const t of this.timers)clearTimeout(t);this.stopAll();for(const v of this.voices.values()){v.source.stop();v.source.disconnect();v.gain.disconnect();}this.voices.clear();this.tone?.disconnect();this.bus?.disconnect();this.buffers.clear();this.listeners.clear();}
}

export function handleMidi(engine:InstrumentEngine,data:Uint8Array,port:string) {
  const [status,midi,velocity]=data,command=status&0xf0,owner=`midi:${port}:${status&15}`,token=`${owner}:${midi}`;
  if(command===0x90&&velocity>0)void engine.noteOn(midi,token,velocity/127);
  else if(command===0x80||(command===0x90&&velocity===0))engine.noteOff(token,owner);
  else if(command===0xb0&&midi===64)engine.pedal(owner,velocity>=64);
  else if(command===0xb0&&(midi===120||midi===123)){engine.pedal(owner,false);engine.stopPrefix(owner+':');}
}
