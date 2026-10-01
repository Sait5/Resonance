import * as THREE from 'three';

export type StringIntersection = THREE.Intersection & { stringDistance?: number };

/** Pixel tolerance on the existing string surface; no proxy mesh is created. */
export function installStringRaycast(mesh: THREE.Mesh, camera: THREE.Camera, viewport:()=>{width:number;height:number}) {
  const original=mesh.raycast;
  const positions=mesh.geometry.getAttribute('position');
  mesh.geometry.computeBoundingBox();
  const box=mesh.geometry.boundingBox!;
  const bins=Array.from({length:48},()=>[] as number[]);
  for(let i=0;i<positions.count;i++){
    const t=(positions.getY(i)-box.min.y)/(box.max.y-box.min.y);
    bins[Math.min(47,Math.floor(t*48))].push(i);
  }
  const sections=bins.filter(bin=>bin.length);
  mesh.raycast=(raycaster,hits)=>{
    const size=viewport();
    const pixel=(p:THREE.Vector3)=>new THREE.Vector2((p.x+1)*size.width/2,(1-p.y)*size.height/2);
    const pointer=pixel(raycaster.ray.at(1,new THREE.Vector3()).project(camera));
    const centers=sections.map(indices=>{
      const low=new THREE.Vector3(Infinity,Infinity,Infinity),high=new THREE.Vector3(-Infinity,-Infinity,-Infinity);
      for(const i of indices){const p=new THREE.Vector3().fromBufferAttribute(positions,i);low.min(p);high.max(p);}
      return low.add(high).multiplyScalar(.5).applyMatrix4(mesh.matrixWorld);
    });
    let best=Infinity,point:THREE.Vector3|undefined;
    for(let i=1;i<centers.length;i++){
      const a=pixel(centers[i-1].clone().project(camera)),b=pixel(centers[i].clone().project(camera));
      const ab=b.clone().sub(a),length=ab.lengthSq();
      const t=length?THREE.MathUtils.clamp(pointer.clone().sub(a).dot(ab)/length,0,1):0;
      const distance=pointer.distanceTo(a.addScaledVector(ab,t));
      if(distance<best){best=distance;point=centers[i-1].clone().lerp(centers[i],t);}
    }
    if(point&&best<=5){
      const distance=point.distanceTo(raycaster.ray.origin);
      if(distance>=raycaster.near&&distance<=raycaster.far)hits.push({distance,point,object:mesh,stringDistance:best} as StringIntersection);
    }
  };
  return()=>{mesh.raycast=original;};
}
