"use client";
import { useEffect, useRef } from "react";
import { clsx } from "clsx";
import type { SimState, EWState } from "@/lib/hooks/useSimulator";

interface Props { state:SimState; ewState:EWState; mode:"fpv"|"third"|"map"; }

export function SimViewport({state,ewState,mode}:Props){
  const mountRef=useRef<HTMLDivElement>(null);
  const sceneRef=useRef<{scene:any;camera:any;renderer:any;uavMesh:any;animFrame:number;L:any}|null>(null);

  useEffect(()=>{
    if(!mountRef.current||sceneRef.current) return;
    import("three").then((THREE)=>{
      const mount=mountRef.current!;
      const w=mount.clientWidth; const h=mount.clientHeight;
      const scene=new THREE.Scene();
      scene.background=new THREE.Color(0x0a0e1a);
      scene.fog=new THREE.FogExp2(0x0a0e1a,0.002);
      const camera=new THREE.PerspectiveCamera(75,w/h,0.1,5000);
      camera.position.set(0,-15,5); camera.lookAt(0,0,0);
      const renderer=new THREE.WebGLRenderer({antialias:true});
      renderer.setSize(w,h); renderer.setPixelRatio(window.devicePixelRatio);
      renderer.shadowMap.enabled=true;
      mount.appendChild(renderer.domElement);
      scene.add(new THREE.AmbientLight(0x223344,0.8));
      const sun=new THREE.DirectionalLight(0x8899aa,1.2);
      sun.position.set(100,200,100); sun.castShadow=true; scene.add(sun);
      scene.add(new THREE.GridHelper(2000,100,0x1e2d47,0x162035));
      const ground=new THREE.Mesh(new THREE.PlaneGeometry(2000,2000),new THREE.MeshLambertMaterial({color:0x0a1020}));
      ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; scene.add(ground);
      const uavGroup=new THREE.Group();
      const fuselage=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.1,2.0,8),new THREE.MeshLambertMaterial({color:0x334455}));
      fuselage.rotation.z=Math.PI/2; fuselage.castShadow=true; uavGroup.add(fuselage);
      const wings=new THREE.Mesh(new THREE.BoxGeometry(4.0,0.05,0.6),new THREE.MeshLambertMaterial({color:0x223344}));
      wings.castShadow=true; uavGroup.add(wings);
      const tail=new THREE.Mesh(new THREE.BoxGeometry(1.2,0.05,0.4),new THREE.MeshLambertMaterial({color:0x223344}));
      tail.position.set(-0.9,0,0.15); uavGroup.add(tail);
      const rl=new THREE.PointLight(0xff0000,0.5,3); rl.position.set(0,-2.1,0); uavGroup.add(rl);
      const gl=new THREE.PointLight(0x00ff00,0.5,3); gl.position.set(0,2.1,0); uavGroup.add(gl);
      scene.add(uavGroup);
      sceneRef.current={scene,camera,renderer,uavMesh:uavGroup,animFrame:0,L:THREE};
      const onResize=()=>{
        if(!mount) return;
        camera.aspect=mount.clientWidth/mount.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(mount.clientWidth,mount.clientHeight);
      };
      window.addEventListener("resize",onResize);
      const animate=()=>{
        if(!sceneRef.current) return;
        sceneRef.current.animFrame=requestAnimationFrame(animate);
        renderer.render(scene,camera);
      };
      animate();
    });
    return()=>{
      if(sceneRef.current){
        cancelAnimationFrame(sceneRef.current.animFrame);
        sceneRef.current.renderer.dispose();
        if(mountRef.current&&sceneRef.current.renderer.domElement)
          mountRef.current.removeChild(sceneRef.current.renderer.domElement);
        sceneRef.current=null;
      }
    };
  },[]);

  useEffect(()=>{
    if(!sceneRef.current) return;
    const {uavMesh,camera}=sceneRef.current;
    const posX=state.y*0.1; const posY=-state.z*0.1; const posZ=-state.x*0.1;
    uavMesh.position.set(posX,posY,posZ);
    uavMesh.rotation.set(-state.pitch,state.yaw,state.roll,"ZYX");
    if(mode==="fpv"){
      camera.position.set(posX,posY+0.1,posZ);
      camera.rotation.set(-state.pitch,state.yaw,state.roll,"ZYX");
    } else if(mode==="third"){
      const d=15;
      const tx=posX-Math.sin(state.yaw)*d; const tz=posZ-Math.cos(state.yaw)*d;
      camera.position.x+=(tx-camera.position.x)*0.05;
      camera.position.y+=(posY+5-camera.position.y)*0.05;
      camera.position.z+=(tz-camera.position.z)*0.05;
      camera.lookAt(posX,posY,posZ);
    } else {
      camera.position.set(posX,posY+50,posZ); camera.lookAt(posX,posY,posZ);
    }
  },[state,mode]);

  useEffect(()=>{
    if(!sceneRef.current) return;
    const canvas=sceneRef.current.renderer.domElement;
    if(ewState.gps_effect==="DENIED") canvas.style.filter="hue-rotate(20deg) contrast(0.9)";
    else if(ewState.datalink_effect==="DENIED") canvas.style.filter="brightness(0.8) contrast(1.1)";
    else if(ewState.gps_effect==="DEGRADED") canvas.style.filter="saturate(0.8)";
    else canvas.style.filter="none";
  },[ewState]);

  const heading=(((state.yaw*180/Math.PI)%360)+360)%360;

  return(
    <div className="relative w-full h-full">
      <div ref={mountRef} className="w-full h-full"/>
      {mode==="fpv"&&(
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <OSD label="ALT" value={`${state.altitude_m.toFixed(0)}m`} warn={state.altitude_m<20}/>
              <OSD label="SPD" value={`${state.airspeed_ms.toFixed(1)}m/s`}/>
              <OSD label="BAT" value={`${(state.fuel_remaining*100).toFixed(0)}%`} warn={state.fuel_remaining<0.2}/>
            </div>
            <div className="flex items-center gap-2">
              {ewState.gps_effect!=="NONE"&&(
                <span className={clsx("font-mono text-xs px-2 py-0.5 rounded",
                  ewState.gps_effect==="DENIED"?"bg-threat-high/80 text-white":
                  ewState.gps_effect==="SPOOFED"?"bg-purple-500/80 text-white":"bg-threat-medium/80 text-white")}>
                  GPS {ewState.gps_effect}
                </span>
              )}
              {ewState.datalink_effect!=="NONE"&&(
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-threat-high/80 text-white">
                  LINK {ewState.datalink_effect}
                </span>
              )}
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-8 h-8">
              <div className="absolute top-1/2 left-0 right-0 h-px bg-white/40"/>
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/40"/>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 border border-white/60 rounded-full"/>
            </div>
          </div>
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
            <OSD label="HDG" value={`${heading.toFixed(0)}°`}/>
            <div>
              {ewState.radar_lock&&(
                <span className="font-mono text-xs text-threat-high animate-pulse px-2 py-0.5 rounded bg-threat-high/20 border border-threat-high">
                  ⚠ RADAR LOCK
                </span>
              )}
            </div>
            <OSD label="LINK" value={`${(ewState.link_quality*100).toFixed(0)}%`} warn={ewState.link_quality<0.5}/>
          </div>
        </div>
      )}
    </div>
  );
}

function OSD({label,value,warn}:{label:string;value:string;warn?:boolean}){
  return(
    <div className={clsx("font-mono text-xs px-2 py-0.5 rounded bg-black/60",warn?"text-threat-high":"text-white/90")}>
      <span className="text-white/50 mr-1 text-2xs">{label}</span>{value}
    </div>
  );
}
