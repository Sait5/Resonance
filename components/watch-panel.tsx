"use client";
import {useMemo,useState} from 'react';
import {AudioLines,ChevronDown,Gauge,Pause,Play} from 'lucide-react';
import {arrangeSong,performanceDuration,SONGS} from '@/lib/performance';
import {type InstrumentId} from '@/lib/instrument-engine';
const fmt=(time:number)=>`${Math.floor(time/60).toString().padStart(2,'0')}:${Math.floor(time%60).toString().padStart(2,'0')}`;
export function WatchPanel({locale,id,playing,setPlaying,speed,setSpeed,songIndex,setSongIndex,elapsed}:{locale:'ru'|'en';id:InstrumentId;playing:boolean;setPlaying:(v:boolean)=>void;speed:number;setSpeed:(v:number)=>void;songIndex:number;setSongIndex:(v:number)=>void;elapsed:number}){
  const [open,setOpen]=useState(false),song=SONGS[songIndex];
  const events=useMemo(()=>arrangeSong(id,songIndex),[id,songIndex]);
  const lanes=useMemo(()=>[...new Set(events.flatMap(e=>e.notes))].sort((a,b)=>a-b),[events]);
  const duration=performanceDuration(events);
  return <aside className="watch-panel">
    <div className="watch-head"><span>{locale==='ru'?'РЕЖИМ WATCH':'WATCH MODE'}</span><i>{playing?'PLAY':'READY'}</i></div>
    <button className="song-row song-button" onClick={()=>setOpen(!open)}><div className="song-art"><AudioLines/></div><div><strong>{song[locale]}</strong><span>{song.author}</span></div><ChevronDown size={17}/></button>
    {open&&<div className="song-menu">{SONGS.map((s,i)=><button key={s.ru} className={i===songIndex?'active':''} onClick={()=>{setSongIndex(i);setOpen(false);}}><span>{i+1}</span><div><strong>{s[locale]}</strong><small>{s.author}</small></div></button>)}</div>}
    <p className="arrangement-label">{locale==='ru'?(id==='drums'?'Ритмическая версия':id==='acoustic'||id==='electric'||id==='bass'?'Версия для открытых струн':'Аранжировка для этого инструмента'):'Instrument arrangement'}</p>
    <div className="sync-roll"><div className="roll-lanes">{lanes.map(n=><i key={n}/>)}</div>
      {events.flatMap((event,index)=>event.time>=elapsed-.3&&event.time<=elapsed+3.4?event.notes.map(note=><span key={`${index}:${note}`} className={event.time<=elapsed?'passed':''} style={{left:`calc(${lanes.indexOf(note)/lanes.length*100}% + 2px)`,top:`${86-(event.time-elapsed)/3.4*86}%`,width:`calc(${100/lanes.length}% - 4px)`,height:`${Math.max(3,event.duration/3.4*86)}%`}}/>):[])}
      <div className="hit-line"><b/> HIT</div>
    </div>
    <div className="transport"><button aria-label={playing?'Приостановить композицию':'Воспроизвести композицию'} onClick={()=>setPlaying(!playing)}>{playing?<Pause/>:<Play/>}</button><div><span>{fmt(elapsed)}</span><div><i style={{width:`${elapsed/duration*100}%`}}/></div><span>{fmt(duration)}</span></div></div>
    <div className="speed-row"><span><Gauge size={15}/>{locale==='ru'?'СКОРОСТЬ':'SPEED'}</span><div>{[.5,.75,1].map(v=><button key={v} className={speed===v?'active':''} onClick={()=>setSpeed(v)}>{v}×</button>)}</div></div>
  </aside>;
}
