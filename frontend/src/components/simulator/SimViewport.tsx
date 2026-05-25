"use client";
import { useEffect, useRef } from "react";
import { clsx } from "clsx";
import type { SimState, EWState } from "@/lib/hooks/useSimulator";

interface Props { state:SimState; ewState:EWState; mode:"fpv"|"third"|"map"; }

export function SimViewport({state,ewState,mode}:Props){
  const mountRef=useRef<HTMLDivElement>(null);
  const refs=useRef<{scene:any;camera:any;renderer:any;uavMesh:any;animFrame:number;THREE:any}|null>(null);

  useEffect(()=>{
    if(!mountRef.current||refs.current) return;
    const mount=mountRef.current;

    import("three").then((THREE)=>{
      const w=mount.clientWidth; const h=mount.clientHeight;

      // Scene
      const scene=new THREE.Scene();
      scene.background=new THREE.Color(0x0a0e1a);
      scene.fog=new THREE.FogExp2(0x0a0e1a,0.002);

      // Camera
      const camera=new THREE.PerspectiveCamera(75,w/h,0.1,5000);
      camera.position.set(0,-15,5); camera.lookAt(0,0,0);

      // Renderer
      const renderer=new THREE.WebGLRenderer({antialias:true});
      renderer.setSize(w,h); renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
      renderer.shadowMap.enabled=true;
      mount.appendChild(renderer.domElement);

      // Lights
      scene.add(new THREE.AmbientLight(0x223344,0.8));
      const sun=new THREE.DirectionalLight(0x8899aa,1.2);
      sun.position.set(100,200,100); sun.castShadow=true; scene.add(sun);

      // Grid + ground
      scene.add(new THREE.GridHelper(2000,100,0x1e2d47,0x162035));
      const ground=new THREE.Mesh(
        new THREE.PlaneGeometry(2000,2000),
        new THREE.MeshLambertMaterial({color:0x0a1020})
      );
      ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; scene.add(ground);

      // UAV mesh
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

      refs.current={scene,camera,renderer,uavMesh:uavGroup,animFrame:0,THREE};

      const onResize=()=>{
        if(!mount||!refs.current) return;
        const {camera:cam,renderer:ren}=refs.current;
        cam.aspect=mount.clientWidth/mount.clientHeight;
        cam.updateProjectionMatrix();
        ren.setSize(mount.clientWidth,mount.clientHeight);
      };
      window.addEventListener("resize",onResize);

      // Animate loop
      const animate=()=>{
        if(!refs.current) return;
        refs.current.animFrame=requestAnimationFrame(animate);
        renderer.render(scene,camera);
      };
      animate();
    });

    return()=>{
      if(refs.current){
        cancelAnimationFrame(refs.current.animFrame);
        refs.current.renderer.dispose();
        if(mount.contains(refs.current.renderer.domElement))
          mount.removeChild(refs.current.renderer.domElement);
        refs.current=null;
      }
    };
  },[]);

  // Sync UAV position + camera with physics state
  useEffect(()=>{
    if(!refs.current) return;
    const {uavMesh,camera,THREE}=refs.current;

    // NED → Three.js (Y-up): North→-Z, East→X, Down→-Y
    const posX = state.y * 0.1;
    const posY = -state.z * 0.1;
    const posZ = -state.x * 0.1;

    uavMesh.position.set(posX,posY,posZ);
    uavMesh.rotation.set(-state.pitch, state.yaw, state.roll, "ZYX");

    if(mode==="fpv"){
      camera.position.set(posX,posY+0.1,posZ);
      camera.rotation.set(-state.pitch,state.yaw,state.roll,"ZYX");
    } else if(mode==="third"){
      const followDist=15;
      const tx=posX-Math.sin(state.yaw)*followDist;
      const tz=posZ-Math.cos(state.yaw)*followDist;
      // Smooth camera follow
      camera.position.x+=(tx-camera.position.x)*0.05;
      camera.position.y+=(posY+5-camera.position.y)*0.05;
      camera.position.z+=(tz-camera.position.z)*0.05;
      camera.lookAt(posX,posY,posZ);
    } else {
      // Map view - top down
      camera.position.set(posX,posY+80,posZ);
      camera.lookAt(posX,posY,posZ);
    }
  },[state,mode]);

  // EW visual effects
  useEffect(()=>{
    if(!refs.current) return;
    const canvas=refs.current.renderer.domElement;
    if(ewState.gps_effect==="DENIED")
      canvas.style.filter="hue-rotate(20deg) contrast(0.85) brightness(0.9)";
    else if(ewState.gps_effect==="SPOOFED")
      canvas.style.filter="hue-rotate(270deg) saturate(0.7)";
    else if(ewState.datalink_effect==="DENIED")
      canvas.style.filter="brightness(0.75) contrast(1.15) saturate(0.5)";
    else if(ewState.gps_effect==="DEGRADED")
      canvas.style.filter="saturate(0.7) contrast(0.95)";
    else
      canvas.style.filter="none";
  },[ewState]);

  const heading=(((state.yaw*180/Math.PI)%360)+360)%360;

  return(
    <div className="relative w-full h-full bg-bg-base">
      <div ref={mountRef} className="w-full h-full"/>

      {/* FPV OSD overlay */}
      {mode==="fpv"&&(
        <div className="absolute inset-0 pointer-events-none">
          {/* Top bar */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <OSD label="ALT"  value={`${state.altitude_m.toFixed(0)}m`}   warn={state.altitude_m<20}/>
              <OSD label="SPD"  value={`${state.airspeed_ms.toFixed(1)}m/s`}/>
              <OSD label="BAT"  value={`${(state.fuel_remaining*100).toFixed(0)}%`} warn={state.fuel_remaining<0.2}/>
              <OSD label="THRO" value={`${(state.actual_throttle*100).toFixed(0)}%`}/>
            </div>
            <div className="flex items-center gap-2">
              {ewState.gps_effect!=="NONE"&&(
                <span className={clsx("font-mono text-xs px-2 py-0.5 rounded",
                  ewState.gps_effect==="DENIED"?"bg-red-600/90 text-white":
                  ewState.gps_effect==="SPOOFED"?"bg-purple-600/90 text-white":"bg-yellow-600/90 text-white")}>
                  GPS {ewState.gps_effect}
                </span>
              )}
              {ewState.datalink_effect!=="NONE"&&(
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-red-600/90 text-white">
                  LINK {ewState.datalink_effect}
                </span>
              )}
            </div>
          </div>

          {/* Crosshair */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-8 h-8">
              <div className="absolute top-1/2 left-0 right-0 h-px bg-white/50"/>
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/50"/>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 border border-white/70 rounded-full"/>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
            <OSD label="HDG" value={`${heading.toFixed(0)}°`}/>
            <div>
              {ewState.radar_lock&&(
                <span className="font-mono text-xs text-red-400 animate-pulse px-3 py-1 rounded bg-red-500/20 border border-red-500">
                  ⚠ RADAR LOCK
                </span>
              )}
            </div>
            <OSD label="LINK" value={`${(ewState.link_quality*100).toFixed(0)}%`} warn={ewState.link_quality<0.5}/>
          </div>
        </div>
      )}

      {/* Third person info overlay */}
      {mode==="third"&&(
        <div className="absolute top-3 left-3 pointer-events-none">
          <div className="bg-black/60 rounded border border-border-dim px-3 py-2 space-y-1">
            {[
              ["ALT", `${state.altitude_m.toFixed(0)} m`],
              ["SPD", `${state.airspeed_ms.toFixed(1)} m/s`],
              ["HDG", `${heading.toFixed(0)}°`],
            ].map(([l,v])=>(
              <div key={l} className="flex items-center gap-3">
                <span className="font-mono text-2xs text-white/50 w-8">{l}</span>
                <span className="font-mono text-2xs text-white">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OSD({label,value,warn}:{label:string;value:string;warn?:boolean}){
  return(
    <div className={clsx("font-mono text-xs px-2 py-0.5 rounded bg-black/70",
      warn?"text-red-400 border border-red-500/50":"text-white/90")}>
      <span className="text-white/40 mr-1 text-2xs">{label}</span>{value}
    </div>
  );
}
