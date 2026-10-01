'use client';

import {useEffect,useState} from 'react';
import {DEFAULT_SOUND,STRINGS,noteName,type InstrumentEngine,type SoundSettings} from '@/lib/instrument-engine';

const PRESETS:Record<string,{name:string;en:string;notes:number[]}[]>={
  acoustic:[{name:'Стандартный E A D G B E',en:'Standard E A D G B E',notes:[40,45,50,55,59,64]},{name:'Drop D',en:'Drop D',notes:[38,45,50,55,59,64]},{name:'Open G',en:'Open G',notes:[38,43,50,55,59,62]},{name:'DADGAD',en:'DADGAD',notes:[38,45,50,55,57,62]}],
  electric:[{name:'Стандартный E A D G B E',en:'Standard E A D G B E',notes:[40,45,50,55,59,64]},{name:'Drop D',en:'Drop D',notes:[38,45,50,55,59,64]},{name:'Drop C',en:'Drop C',notes:[36,43,48,53,57,62]}],
  bass:[{name:'Стандартный E A D G',en:'Standard E A D G',notes:[28,33,38,43]},{name:'Drop D',en:'Drop D',notes:[26,33,38,43]},{name:'На полтона ниже',en:'Half step down',notes:[27,32,37,42]}],
  violin:[{name:'Стандартный G D A E',en:'Standard G D A E',notes:[55,62,69,76]},{name:'Скордатура A E A E',en:'Scordatura A E A E',notes:[57,64,69,76]}],
};

export function InstrumentSoundSettings({engine,locale}:{engine:InstrumentEngine;locale:'ru'|'en'}){
  const ru=locale==='ru',storageKey=`resonance:sound:v1:${engine.id}`;
  const [settings,setSettings]=useState<SoundSettings>(()=>({...DEFAULT_SOUND,strings:{}}));
  useEffect(()=>{
    try{const saved=localStorage.getItem(storageKey);if(saved)engine.setSound({...DEFAULT_SOUND,...JSON.parse(saved)});}catch{/* Storage can be unavailable. */}
    setSettings(engine.settings);
  },[engine,storageKey]);
  const update=(next:SoundSettings)=>{engine.setSound(next);setSettings(engine.settings);try{localStorage.setItem(storageKey,JSON.stringify(engine.settings));}catch{/* Audio controls still work without storage. */}};
  const strings=STRINGS[engine.id as keyof typeof STRINGS];
  const presets=PRESETS[engine.id];
  const selected=presets?.findIndex(p=>p.notes.every((n,i)=>n===(settings.strings[strings[i]]??strings[i])))??-1;
  return <section className="instrument-sound-settings" aria-label={ru?'Настройки звука инструмента':'Instrument sound settings'}>
    <div className="sound-settings-head"><div><span>SOUND / TUNING</span><h2>{ru?'Настройки звука':'Sound settings'}</h2><p>{ru?'Изменения слышны сразу. Настройки сохраняются для этого инструмента.':'Changes are audible immediately and saved for this instrument.'}</p></div><button onClick={()=>update({...DEFAULT_SOUND,strings:{}})}>{ru?'Сбросить':'Reset'}</button></div>
    <div className="sound-controls">
      <label><span>{ru?'Громкость':'Volume'}<output>{settings.volume}%</output></span><input aria-label={ru?'Громкость инструмента':'Instrument volume'} type="range" min="0" max="100" value={settings.volume} onChange={e=>update({...settings,volume:Number(e.target.value)})}/></label>
      <label><span>{ru?'Теплота тембра':'Tone warmth'}<output>{settings.warmth>0?'+':''}{settings.warmth} dB</output></span><input aria-label={ru?'Теплота тембра':'Tone warmth'} type="range" min="-12" max="12" value={settings.warmth} onChange={e=>update({...settings,warmth:Number(e.target.value)})}/><small>{ru?'Слева — тоньше · справа — теплее':'Left — thinner · right — warmer'}</small></label>
      {engine.id!=='drums'&&<><label><span>{ru?'Камертон A4':'Reference A4'}<output>{settings.reference} Hz</output></span><input aria-label={ru?'Камертон A4':'Reference A4'} type="range" min="415" max="466" step="1" value={settings.reference} onChange={e=>update({...settings,reference:Number(e.target.value)})}/></label><label><span>{ru?'Транспозиция':'Transpose'}<output>{settings.transpose>0?'+':''}{settings.transpose} {ru?'полутонов':'semitones'}</output></span><input aria-label={ru?'Транспозиция инструмента':'Instrument transpose'} type="range" min="-12" max="12" value={settings.transpose} onChange={e=>update({...settings,transpose:Number(e.target.value)})}/></label></>}
    </div>
    {strings&&<div className="string-tuning"><label className="tuning-preset"><span>{ru?'Строй струн':'String tuning'}</span><select aria-label={ru?'Строй струн':'String tuning'} value={selected<0?'custom':String(selected)} onChange={e=>{const preset=presets[Number(e.target.value)];if(preset)update({...settings,strings:Object.fromEntries(strings.map((m,i)=>[m,preset.notes[i]]))});}}><option value="custom" disabled>{ru?'Свой строй':'Custom tuning'}</option>{presets.map((p,i)=><option key={p.en} value={i}>{ru?p.name:p.en}</option>)}</select></label><div className="string-tuning-notes">{strings.map((m,i)=><label key={m}><span>{ru?'Струна':'String'} {i+1}<strong>{noteName(engine.soundingNote(m))}</strong></span><input aria-label={`${ru?'Настройка струны':'Tune string'} ${i+1}`} type="number" min="-12" max="12" step="1" value={(settings.strings[m]??m)-m} onChange={e=>update({...settings,strings:{...settings.strings,[m]:m+Number(e.target.value)}})}/><small>{ru?'полутонов от стандартного':'semitones from standard'}</small></label>)}</div></div>}
  </section>;
}
