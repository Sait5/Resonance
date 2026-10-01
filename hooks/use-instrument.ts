"use client";
import {useEffect,useRef,useState} from 'react';
import {InstrumentEngine,InstrumentId,handleMidi} from '@/lib/instrument-engine';

export function useInstrument(id:InstrumentId) {
  const [engine]=useState(()=>new InstrumentEngine(id));
  const [,render]=useState(0);
  const [midiConnected,setMidiConnected]=useState(false);
  const disposal=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  useEffect(()=>{
    clearTimeout(disposal.current);
    const unsub=engine.subscribe(()=>render(n=>n+1));
    void engine.load().catch(()=>{});
    const blur=()=>engine.stopAll();
    const visibility=()=>{if(document.hidden)engine.stopAll();};
    window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);
    return()=>{unsub();window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);engine.stopAll();disposal.current=setTimeout(()=>engine.dispose(),0);};
  },[engine]);
  useEffect(()=>{
    let access:MIDIAccess|undefined,cancelled=false;
    const ports=new Map<string,MIDIInput>();
    const attach=()=>{
      if(!access||cancelled)return;
      for(const [key,input] of ports)if(input.state==='disconnected'){input.onmidimessage=null;ports.delete(key);engine.stopPrefix(`midi:${key}:`);}
      for(const input of access.inputs.values())if(input.state==='connected'){
        ports.set(input.id,input);input.onmidimessage=event=>{if(event.data)handleMidi(engine,event.data,input.id);};
      }
      setMidiConnected(ports.size>0);
    };
    if(navigator.requestMIDIAccess)void navigator.requestMIDIAccess().then(a=>{if(cancelled)return;access=a;a.onstatechange=attach;attach();}).catch(()=>{});
    return()=>{cancelled=true;if(access)access.onstatechange=null;for(const input of ports.values())input.onmidimessage=null;engine.stopPrefix('midi:');};
  },[engine]);
  return {engine,midiConnected,active:[...new Set([...engine.active.values()].map(n=>n.midi))]};
}
