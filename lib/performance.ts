import {PLAYABLE,type InstrumentId} from './instrument-engine';
export type PerformanceEvent={time:number;duration:number;notes:number[];velocity:number};
export const SONGS=[
  {ru:'Световые годы',en:'Light Years',author:'Resonance Original',motif:[0,2,4,7,6,4,2,1,3,5,7,4],beat:.42},
  {ru:'Орбитальный этюд',en:'Orbital Study',author:'Resonance Original',motif:[0,4,7,4,1,4,6,4,2,5,7,5],beat:.48},
  {ru:'Лунные арпеджио',en:'Moonlit Arpeggios',author:'Resonance Original',motif:[0,2,5,0,2,5,1,3,6,1,3,6],beat:.38},
  {ru:'Ночная серенада',en:'Night Serenade',author:'Resonance Original',motif:[4,7,4,7,4,7,6,5,3,6,3,6],beat:.34},
];
export function arrangeSong(id:InstrumentId,index:number):PerformanceEvent[]{
  const song=SONGS[index],events:PerformanceEvent[]=[];
  const add=(time:number,notes:number[],duration:number,velocity=.75)=>events.push({time,notes,duration,velocity});
  if(id==='drums'){
    for(let bar=0;bar<12;bar++)for(let beat=0;beat<8;beat++){
      const time=(bar*8+beat)*song.beat;
      add(time,[beat===7&&bar%4===3?46:42],.15,.5);
      if(beat===0||beat===4||beat===5&&bar%2===1)add(time,[36],.3,.85);
      if(beat===2||beat===6)add(time,[38],.25,.8);
      if(beat===0&&bar%4===0)add(time,[bar%8===0?49:51],.9,.65);
      if(bar%4===3&&beat>=5)add(time,[[45,47,43][beat-5]],.3,.75);
    }
  }else{
    const range=id==='piano'?[60,62,64,65,67,69,71,72]:PLAYABLE[id];
    for(let phrase=0;phrase<8;phrase++)for(let step=0;step<song.motif.length;step++){
      const time=(phrase*song.motif.length+step)*song.beat;
      const degree=song.motif[step];
      const note=range[Math.round(degree*(range.length-1)/7)];
      add(time,[note],song.beat*(step%3===2?1.35:.8),.65+step%3*.07);
      if(id==='piano'&&step%6===0){const root=[48,45,53,43][phrase%4];add(time,[root,root+7,root+12],song.beat*5.5,.42);}
      if(['acoustic','electric'].includes(id)&&step===0)add(time,[range[0],range[3],range[4],range[5]],song.beat*2,.4);
    }
  }
  return events.sort((a,b)=>a.time-b.time);
}
export function performanceDuration(events:PerformanceEvent[]){return Math.max(...events.map(e=>e.time+e.duration));}
export const NUMERIC_ALIASES:Partial<Record<InstrumentId,number[]>>={
  acoustic:PLAYABLE.acoustic,electric:PLAYABLE.electric,bass:PLAYABLE.bass,violin:PLAYABLE.violin,
  drums:[36,38,42,46,45,47,43,49,51],saxophone:PLAYABLE.saxophone,trumpet:PLAYABLE.trumpet,
};
export function numericNote(id:InstrumentId,code:string){
  if(id==='trumpet'&&['Minus','NumpadSubtract','Equal','NumpadAdd'].includes(code))return PLAYABLE.trumpet[code==='Minus'||code==='NumpadSubtract'?10:11];
  const match=code.match(/^(?:Digit|Numpad)([0-9])$/);if(!match)return;
  const index=match[1]==='0'?9:Number(match[1])-1;
  return NUMERIC_ALIASES[id]?.[index];
}
