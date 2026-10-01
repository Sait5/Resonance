"use client";
import {Canvas,ThreeEvent,useFrame,useThree} from '@react-three/fiber';
import {Bounds,ContactShadows,OrbitControls,useGLTF} from '@react-three/drei';
import {Component,Suspense,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import * as THREE from 'three';
import {InstrumentEngine,SAX_FINGERINGS,TRUMPET_FINGERINGS} from '@/lib/instrument-engine';
import {installStringRaycast,type StringIntersection} from '@/lib/string-raycast';

type Part={object:THREE.Object3D;position:THREE.Vector3;rotation:THREE.Euler;notes:number[];kind:string;axis:'x'|'y'|'z';amount:number;geometry?:THREE.BufferGeometry;base?:Float32Array;min?:number;length?:number;level:number};
const cleanupTimers=new Map<string,ReturnType<typeof setTimeout>>();
class SceneError extends Component<{children:ReactNode},{failed:boolean}>{
  state={failed:false};static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<div className="model-error" role="alert">Не удалось открыть 3D-модель. Обновите страницу.</div>:this.props.children;}
}
function InstrumentModel({engine,onCapture}:{engine:InstrumentEngine;onCapture:(locked:boolean)=>void}) {
  const path=`/models/playable/${engine.id}.glb`;
  const {scene,nodes}=useGLTF(path);
  const pointers=useRef(new Map<number,{token:string;valve?:number}>());
  const controls=useThree(s=>s.controls) as {enabled:boolean}|null;
  const camera=useThree(s=>s.camera),size=useThree(s=>s.size);
  const object=useMemo(()=>scene.clone(true),[scene]);
  const parts=useMemo(()=>{
    const result:Part[]=[];
    // Exported names are the contract; no proximity-generated control geometry.
    for(const name of Object.keys(nodes)){
      const source=nodes[name];if(typeof source.userData.note!=='number')continue;
      const o=object.getObjectByName(name);if(!o)throw Error(`Missing model part: ${name}`);
      const kind=source.userData.motion as string;
      let notes=[source.userData.note as number];
      if(kind==='bow')notes=[55,62,69,76];
      if(engine.id==='saxophone'||engine.id==='trumpet'){
        const index=Number(name.slice(-2)),table=engine.id==='saxophone'?SAX_FINGERINGS:TRUMPET_FINGERINGS;
        notes=Object.entries(table).filter(([,keys])=>keys.includes(index)).map(([m])=>Number(m));
        if(!notes.length)notes=[source.userData.note];
      }
      const p:Part={object:o,position:o.position.clone(),rotation:o.rotation.clone(),notes,kind,axis:source.userData.axis??'y',amount:source.userData.amount??.02,level:0};
      if(kind==='string'&&o instanceof THREE.Mesh){
        o.geometry=o.geometry.clone();p.geometry=o.geometry;
        p.base=new Float32Array(o.geometry.attributes.position.array);
        o.geometry.computeBoundingBox();p.min=o.geometry.boundingBox!.min.y;p.length=o.geometry.boundingBox!.max.y-p.min!;
      }
      result.push(p);
    }
    return result;
  },[engine.id,nodes,object]);
  useEffect(()=>{
    const restore=parts.filter(p=>p.kind==='string').map(p=>installStringRaycast(p.object as THREE.Mesh,camera,()=>size));
    return()=>{for(const fn of restore)fn();};
  },[parts,camera,size]);
  useEffect(()=>{
    clearTimeout(cleanupTimers.get(path));
    return()=>{
      engine.stopPrefix('pointer:');
      cleanupTimers.set(path,setTimeout(()=>{
        const geometry=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
        scene.traverse(o=>{if((o as THREE.Mesh).isMesh){const mesh=o as THREE.Mesh;geometry.add(mesh.geometry);for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])materials.add(m);}});
        for(const m of materials)for(const value of Object.values(m))if(value?.isTexture)textures.add(value);
        for(const p of parts)p.geometry?.dispose();for(const g of geometry)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();
        useGLTF.clear(path);cleanupTimers.delete(path);
      },0));
    };
  },[parts,engine,path,scene]);
  useFrame((_,delta)=>{
    const active=new Set([...engine.active.values()].map(n=>n.midi)),now=engine.now;
    for(const part of parts){
      const held=part.notes.some(n=>active.has(n));
      const strike=Math.max(-100,...part.notes.map(n=>engine.lastStrike.get(n)??-100));
      const age=now-strike;
      part.level=THREE.MathUtils.damp(part.level,held?1:0,held?35:13,delta);
      part.object.position.copy(part.position);part.object.rotation.copy(part.rotation);
      if(part.kind==='key')part.object.rotation.x=part.rotation.x-part.level*.075;
      else if(part.kind==='valve'||part.kind==='sax')part.object.position[part.axis]-=part.level*part.amount;
      else if(part.kind==='cymbal'&&age<1.8)part.object.rotation.x+=Math.sin(age*28)*Math.exp(-age*3)*part.amount;
      else if(part.kind==='drum'&&age<.5)part.object.position[part.axis]-=Math.sin(age*45)*Math.exp(-age*12)*part.amount;
      else if(part.kind==='bow'&&(held||age<.35))part.object.position.x+=Math.sin(age*5)*part.amount;
      else if(part.kind==='string'&&part.geometry&&part.base){
        const positions=part.geometry.attributes.position as THREE.BufferAttribute,base=part.base;
        const amplitude=age<1.6?Math.exp(-age*3)*Math.sin(age*110)*part.amount:0;
        for(let i=0;i<positions.count;i++)positions.setX(i,base[i*3]+amplitude*Math.sin(Math.PI*(base[i*3+1]-part.min!)/part.length!));
        positions.needsUpdate=true;
      }
    }
  });
  function findPart(e:ThreeEvent<PointerEvent>){let o:THREE.Object3D|null=e.object;while(o){const p=parts.find(p=>p.object===o);if(p)return p;o=o.parent;}return undefined;}
  function down(e:ThreeEvent<PointerEvent>){
    const strings=(e.intersections as StringIntersection[]).filter(hit=>hit.stringDistance!==undefined&&hit.distance<=e.intersections[0].distance+.06);
    const closest=strings.sort((a,b)=>a.stringDistance!-b.stringDistance!)[0];
    const part=closest?parts.find(p=>p.object===closest.object):findPart(e);if(!part)return;e.stopPropagation();
    if(process.env.NODE_ENV==='development')console.info('Instrument hit',part.object.name);
    if(!engine.ready)return;
    (e.target as Element).setPointerCapture(e.pointerId);if(controls)controls.enabled=false;onCapture(true);
    const token=`pointer:${e.pointerId}`;
    if(engine.id==='piano'&&e.shiftKey){
      const latch=`latch:piano:${part.object.userData.note}`;
      if(engine.active.has(latch))engine.noteOff(latch);else void engine.noteOn(part.object.userData.note,latch);
      pointers.current.set(e.pointerId,{token});return;
    }
    if(engine.id==='trumpet'){
      const valve=Number(part.object.name.slice(-2));
      if(e.shiftKey){const latch=`latch:valve:${valve}`;engine.setValve(latch,valve,!engine.pressedValves.has(latch));pointers.current.set(e.pointerId,{token});}
      else{pointers.current.set(e.pointerId,{token,valve});engine.setValve(token,valve,true);}
    }
    else{
      const midi=part.kind==='bow'?(engine.lastNote??69):engine.id==='saxophone'?([62,60,58,56,55,53,51,63,51,53][Number(part.object.name.slice(-2))-1]):engine.id==='drums'&&part.object.userData.note===42&&e.shiftKey?46:part.object.userData.note;
      pointers.current.set(e.pointerId,{token});void engine.noteOn(midi,token);
    }
  }
  function up(e:ThreeEvent<PointerEvent>){
    const pointer=pointers.current.get(e.pointerId);if(!pointer)return;e.stopPropagation();pointers.current.delete(e.pointerId);
    engine.noteOff(pointer.token);if(pointer.valve)engine.setValve(pointer.token,pointer.valve,false);
    if((e.target as Element).hasPointerCapture(e.pointerId))(e.target as Element).releasePointerCapture(e.pointerId);
    if(controls)controls.enabled=pointers.current.size===0;onCapture(pointers.current.size>0);
  }
  return <primitive object={object} dispose={null} onPointerDown={down} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up}/>;
}

export function InstrumentStage({engine,drag}:{engine:InstrumentEngine;drag:string}) {
  const [locked,setLocked]=useState(false);
  const piano=engine.id==='piano',drums=engine.id==='drums';
  return <div className="stage-canvas light-stage real-instrument-stage">
    <SceneError><Canvas camera={{position:piano?[.5,3.4,5.7]:drums?[0,5,4.8]:[.7,.8,6.1],fov:38,near:.1,far:40}} dpr={[1,1.5]}>
      <color attach="background" args={['#edf0e8']}/><ambientLight intensity={1.4}/><hemisphereLight intensity={2} color="#fffdf4" groundColor="#7b826f"/>
      <directionalLight position={[-3,6,5]} intensity={3}/><directionalLight position={[4,2,-3]} intensity={1.8}/>
      <Suspense fallback={null}>
        <Bounds fit observe margin={1.2}><InstrumentModel engine={engine} onCapture={setLocked}/></Bounds><ContactShadows position={[0,-2.03,0]} opacity={.25} scale={10} blur={3}/>
      </Suspense>
      <OrbitControls makeDefault enabled={!locked} enablePan={false} minDistance={4.5} maxDistance={9} minPolarAngle={.2} maxPolarAngle={Math.PI*.48} target={[0,0,0]} enableDamping/>
    </Canvas></SceneError>
    <div className="stage-play-label">{piano?'88 KEYS · A0–C8':'DIRECT TOUCH'}</div><div className="stage-hint dark-hint">{engine.id==='trumpet'?'Shift + click: hold valve · Esc: release':drag+' · 360°'}</div>
  </div>;
}
