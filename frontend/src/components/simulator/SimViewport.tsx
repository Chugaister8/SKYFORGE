"use client";
import { useEffect, useRef, useCallback } from "react";
import { clsx } from "clsx";
import type { SimState, EWState } from "@/lib/hooks/useSimulatorWS";
import type { SavedMission } from "@/lib/hooks/useMission";

interface Props {
  state:    SimState;
  ewState:  EWState;
  mode:     "fpv"|"third"|"map";
  mission?: SavedMission | null;
}

// ── UAV model builders ────────────────────────────────────────────
function buildFixedWing(THREE: any, color = 0x2a3a4a) {
  const g = new THREE.Group();

  // Fuselage — tapered tube
  const fus = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.12, 2.4, 10),
    new THREE.MeshPhongMaterial({ color, shininess: 60 }),
  );
  fus.rotation.z = Math.PI / 2;
  g.add(fus);

  // Nose cone
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.08, 0.5, 8),
    new THREE.MeshPhongMaterial({ color: 0x1a2a3a, shininess: 80 }),
  );
  nose.rotation.z = -Math.PI / 2;
  nose.position.set(1.2, 0, 0);
  g.add(nose);

  // Main wings — swept
  const wingMat = new THREE.MeshPhongMaterial({ color: 0x1e2e3e, side: THREE.DoubleSide, shininess: 40 });
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.lineTo(-0.8, 1.8);
  wingShape.lineTo(-1.2, 1.9);
  wingShape.lineTo(-0.5, 0.1);
  const wingGeo = new THREE.ShapeGeometry(wingShape);
  const rightWing = new THREE.Mesh(wingGeo, wingMat);
  rightWing.rotation.x = -Math.PI / 2;
  rightWing.position.set(0.1, 0, 0);
  g.add(rightWing);
  const leftWing = rightWing.clone();
  leftWing.scale.z = -1;
  g.add(leftWing);

  // Tail fin (vertical)
  const vFin = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.5, 0.03),
    wingMat,
  );
  vFin.position.set(-1.0, 0.2, 0);
  g.add(vFin);

  // Horizontal stabs
  const hStab = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.03, 0.6),
    wingMat,
  );
  hStab.position.set(-1.0, 0, 0);
  g.add(hStab);

  // Nav lights
  const rl = new THREE.PointLight(0xff2222, 1.5, 4);
  rl.position.set(0, 0, -1.9); g.add(rl);
  const gl2 = new THREE.PointLight(0x22ff22, 1.5, 4);
  gl2.position.set(0, 0, 1.9); g.add(gl2);
  const wl = new THREE.PointLight(0xffffff, 0.8, 3);
  wl.position.set(-1.2, 0, 0); g.add(wl);

  return g;
}

function buildMultirotor(THREE: any, color = 0x2a3a4a) {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhongMaterial({ color, shininess: 50 });
  const darkMat = new THREE.MeshPhongMaterial({ color: 0x111822, shininess: 80 });

  // Central body — flat hexagon-ish
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.45, 0.12, 6),
    mat,
  );
  g.add(body);

  // Top plate
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.38, 0.03, 6),
    new THREE.MeshPhongMaterial({ color: 0x06B6D4, shininess: 120, emissive: 0x003344 }),
  );
  top.position.y = 0.07;
  g.add(top);

  // Camera gimbal
  const gimbal = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 6),
    darkMat,
  );
  gimbal.position.set(0.25, -0.08, 0);
  g.add(gimbal);
  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.06, 0.08, 8),
    new THREE.MeshPhongMaterial({ color: 0x222222, shininess: 200 }),
  );
  lens.position.set(0.35, -0.08, 0);
  lens.rotation.z = Math.PI / 2;
  g.add(lens);

  // Arms + motors + props
  const armAngles = [45, 135, 225, 315];
  armAngles.forEach((deg, i) => {
    const rad = (deg * Math.PI) / 180;
    const armLen = 0.7;

    // Arm
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(armLen, 0.06, 0.06),
      darkMat,
    );
    arm.position.set(
      Math.cos(rad) * armLen * 0.5,
      0,
      Math.sin(rad) * armLen * 0.5,
    );
    arm.rotation.y = -rad;
    g.add(arm);

    // Motor housing
    const motor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.1, 8),
      mat,
    );
    motor.position.set(Math.cos(rad) * armLen, 0.06, Math.sin(rad) * armLen);
    g.add(motor);

    // Propeller disc (spinning appearance)
    const propDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.01, 16),
      new THREE.MeshPhongMaterial({
        color: 0x334455,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
      }),
    );
    propDisc.position.set(Math.cos(rad) * armLen, 0.12, Math.sin(rad) * armLen);
    g.add(propDisc);

    // Prop blur ring
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.20, 0.01, 4, 24),
      new THREE.MeshBasicMaterial({ color: 0x445566, transparent: true, opacity: 0.4 }),
    );
    ring.position.set(Math.cos(rad) * armLen, 0.12, Math.sin(rad) * armLen);
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
  });

  // Status LED (pulsing)
  const led = new THREE.PointLight(0x06B6D4, 2, 2);
  led.position.set(0, 0.2, 0);
  g.add(led);

  return g;
}

function buildStrikeFPV(THREE: any) {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhongMaterial({ color: 0x1a1a2e, shininess: 30 });

  // Squat aggressive body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.1, 0.3),
    mat,
  );
  g.add(body);

  // Camera mount (aggressive tilt)
  const camMount = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.14, 0.08),
    new THREE.MeshPhongMaterial({ color: 0x111111, shininess: 60 }),
  );
  camMount.position.set(0.12, 0.04, 0);
  camMount.rotation.z = -0.4;
  g.add(camMount);

  // Short arms
  const armMat = new THREE.MeshPhongMaterial({ color: 0x2a2a3e });
  [[0.18, 0.18], [-0.18, 0.18], [0.18, -0.18], [-0.18, -0.18]].forEach(([x, z]) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.04), armMat);
    arm.position.set(x * 0.5, 0.04, z * 0.5);
    arm.rotation.y = Math.atan2(z, x);
    g.add(arm);

    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 8), armMat);
    motor.position.set(x, 0.07, z);
    g.add(motor);

    const prop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.008, 12),
      new THREE.MeshPhongMaterial({ color: 0x888888, transparent: true, opacity: 0.65 }),
    );
    prop.position.set(x, 0.11, z);
    g.add(prop);
  });

  // VTX antenna
  const ant = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.008, 0.25, 4),
    new THREE.MeshBasicMaterial({ color: 0xff6600 }),
  );
  ant.position.set(-0.08, 0.18, 0.05);
  g.add(ant);

  const led = new THREE.PointLight(0xff4400, 2, 1.5);
  led.position.set(0, 0.15, 0);
  g.add(led);

  return g;
}

// ── Terrain builder ───────────────────────────────────────────────
function buildTerrain(THREE: any) {
  const g = new THREE.Group();

  // Ground base
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(4000, 4000, 80, 80),
    new THREE.MeshLambertMaterial({
      color: 0x0d1f0d,
      wireframe: false,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;

  // Subtle elevation noise (manual vertex displacement)
  const pos = ground.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    if (Math.abs(x) > 50 || Math.abs(z) > 50) {
      const noise = (Math.sin(x * 0.02) * Math.cos(z * 0.015) + Math.sin(x * 0.05 + z * 0.03)) * 8;
      pos.setZ(i, noise);
    }
  }
  pos.needsUpdate = true;
  ground.geometry.computeVertexNormals();
  g.add(ground);

  // Grid overlay (tactical grid)
  const grid = new THREE.GridHelper(4000, 200, 0x0d2a0d, 0x0a1a0a);
  grid.position.y = 0.05;
  (grid.material as any).transparent = true;
  (grid.material as any).opacity = 0.5;
  g.add(grid);

  // Runway / landing strip
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 30),
    new THREE.MeshLambertMaterial({ color: 0x1a1a1a }),
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.y = 0.1;
  g.add(strip);

  // Runway markings
  for (let i = -5; i <= 5; i++) {
    const mark = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    mark.rotation.x = -Math.PI / 2;
    mark.position.set(i * 28, 0.2, 0);
    g.add(mark);
  }

  // Tree clusters (simple cone+cylinder)
  for (let i = 0; i < 80; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist  = 100 + Math.random() * 600;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 1.2, 6, 5),
      new THREE.MeshLambertMaterial({ color: 0x2a1505 }),
    );
    trunk.position.set(x, 3, z);
    g.add(trunk);

    const foliage = new THREE.Mesh(
      new THREE.ConeGeometry(4 + Math.random() * 3, 10 + Math.random() * 5, 7),
      new THREE.MeshLambertMaterial({ color: 0x0d2a0d }),
    );
    foliage.position.set(x, 10 + Math.random() * 3, z);
    g.add(foliage);
  }

  // Buildings (city block far away)
  for (let i = 0; i < 30; i++) {
    const bx = 300 + Math.random() * 200 * (Math.random() > 0.5 ? 1 : -1);
    const bz = 200 + Math.random() * 150 * (Math.random() > 0.5 ? 1 : -1);
    const h  = 15 + Math.random() * 60;
    const w  = 10 + Math.random() * 20;
    const building = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, w * 0.8),
      new THREE.MeshLambertMaterial({ color: 0x151f2a }),
    );
    building.position.set(bx, h / 2, bz);
    g.add(building);

    // Windows (emissive dots)
    if (Math.random() > 0.4) {
      const winMesh = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.98, h * 0.98, w * 0.78),
        new THREE.MeshBasicMaterial({
          color: 0x1a2d3a,
          transparent: true,
          opacity: 0.3,
          wireframe: true,
        }),
      );
      winMesh.position.set(bx, h / 2, bz);
      g.add(winMesh);
    }
  }

  // Water body (reflective plane)
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(800, 400),
    new THREE.MeshPhongMaterial({
      color: 0x051525,
      shininess: 200,
      transparent: true,
      opacity: 0.85,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(-600, 0.15, 200);
  g.add(water);

  return g;
}

// ── Waypoint markers in 3D scene ─────────────────────────────────
function updateWaypointMarkers(THREE: any, scene: any, waypoints: any[], markersRef: any) {
  // Remove old
  markersRef.current.forEach((m: any) => scene.remove(m));
  markersRef.current = [];

  waypoints.forEach((wp, i) => {
    const lat = wp.lat - 48.3794;
    const lon = wp.lon - 31.1656;
    const x   = lon  * 111320 * 0.1;
    const z   = -lat * 111320 * 0.1;
    const y   = (wp.alt_m ?? 150) * 0.1;

    // Vertical pole
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, y, 4),
      new THREE.MeshBasicMaterial({ color: 0x06B6D4, transparent: true, opacity: 0.4 }),
    );
    pole.position.set(x, y / 2, z);
    scene.add(pole);
    markersRef.current.push(pole);

    // Marker disc
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(2, 2, 0.3, 8),
      new THREE.MeshBasicMaterial({ color: 0x06B6D4 }),
    );
    disc.position.set(x, y, z);
    scene.add(disc);
    markersRef.current.push(disc);

    // Number label (sprite)
    const canvas = document.createElement("canvas");
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#06B6D4";
    ctx.font = "bold 36px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(i + 1), 32, 32);
    const tex = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    sprite.scale.set(6, 6, 1);
    sprite.position.set(x, y + 4, z);
    scene.add(sprite);
    markersRef.current.push(sprite);

    // Line to next WP
    if (i < waypoints.length - 1) {
      const next = waypoints[i + 1];
      const nx   = (next.lon - 31.1656) * 111320 * 0.1;
      const nz   = -(next.lat - 48.3794) * 111320 * 0.1;
      const ny   = (next.alt_m ?? 150) * 0.1;
      const pts  = [
        new THREE.Vector3(x, y, z),
        new THREE.Vector3(nx, ny, nz),
      ];
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0x06B6D4, transparent: true, opacity: 0.5 }),
      );
      scene.add(line);
      markersRef.current.push(line);
    }
  });
}

// ── Main component ────────────────────────────────────────────────
export function SimViewport({ state, ewState, mode, mission }: Props) {
  const mountRef   = useRef<HTMLDivElement>(null);
  const refs       = useRef<any>(null);
  const wpMarkersRef = useRef<any[]>([]);
  const prevMode   = useRef(mode);
  const ledPhase   = useRef(0);

  // ── Init Three.js scene ─────────────────────────────────────────
  useEffect(() => {
    if (!mountRef.current || refs.current) return;
    const mount = mountRef.current;

    import("three").then((THREE) => {
      const w = mount.clientWidth || 800;
      const h = mount.clientHeight || 600;

      // Renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
      renderer.toneMapping       = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.9;
      mount.appendChild(renderer.domElement);

      // Scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x060c14);
      scene.fog = new THREE.FogExp2(0x060c14, 0.0012);

      // Camera
      const camera = new THREE.PerspectiveCamera(70, w / h, 0.1, 8000);
      camera.position.set(0, 20, 40);

      // ── Lighting ──────────────────────────────────────────────
      // Ambient — night sky glow
      scene.add(new THREE.AmbientLight(0x1a2a3a, 1.2));

      // Moon (directional)
      const moon = new THREE.DirectionalLight(0x8899bb, 0.8);
      moon.position.set(200, 400, 100);
      moon.castShadow = true;
      moon.shadow.mapSize.width = 2048;
      moon.shadow.mapSize.height = 2048;
      moon.shadow.camera.near = 0.5;
      moon.shadow.camera.far  = 1500;
      moon.shadow.camera.left = -300;
      moon.shadow.camera.right = 300;
      moon.shadow.camera.top  = 300;
      moon.shadow.camera.bottom = -300;
      scene.add(moon);

      // Horizon glow (hemisphere)
      scene.add(new THREE.HemisphereLight(0x0a1520, 0x050a05, 0.6));

      // Stars
      const starGeo = new THREE.BufferGeometry();
      const starPos = new Float32Array(3000);
      for (let i = 0; i < 1000; i++) {
        const r = 3000 + Math.random() * 1000;
        const t = Math.acos(2 * Math.random() - 1);
        const p = Math.random() * Math.PI * 2;
        starPos[i * 3]     = r * Math.sin(t) * Math.cos(p);
        starPos[i * 3 + 1] = Math.abs(r * Math.cos(t));
        starPos[i * 3 + 2] = r * Math.sin(t) * Math.sin(p);
      }
      starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
      scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
        color: 0xffffff, size: 1.5, sizeAttenuation: true, transparent: true, opacity: 0.8,
      })));

      // ── Terrain ──────────────────────────────────────────────
      const terrain = buildTerrain(THREE);
      scene.add(terrain);

      // ── UAV model selection ───────────────────────────────────
      const libId = (mission as any)?.library_id ?? "mavic-3t";
      let uavGroup: any;
      if (libId.includes("fpv") || libId.includes("strike")) {
        uavGroup = buildStrikeFPV(THREE);
      } else if (libId.includes("tb2") || libId.includes("leleka") || libId.includes("uj-22")) {
        uavGroup = buildFixedWing(THREE, 0x2a3a2a);
      } else {
        uavGroup = buildMultirotor(THREE);
      }
      uavGroup.castShadow = true;
      scene.add(uavGroup);

      // ── Exhaust/thruster particles ────────────────────────────
      const particleGeo = new THREE.BufferGeometry();
      const pCount = 80;
      const pPos = new Float32Array(pCount * 3);
      particleGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
      const particles = new THREE.Points(particleGeo, new THREE.PointsMaterial({
        color: 0x06B6D4, size: 0.3, transparent: true, opacity: 0.6,
      }));
      scene.add(particles);

      refs.current = {
        THREE, scene, camera, renderer, uavGroup,
        particles, particleGeo, moon, pPos,
        frameCount: 0,
      };

      // Resize handler
      const onResize = () => {
        if (!mount || !refs.current) return;
        const { camera: cam, renderer: ren } = refs.current;
        cam.aspect = mount.clientWidth / mount.clientHeight;
        cam.updateProjectionMatrix();
        ren.setSize(mount.clientWidth, mount.clientHeight);
      };
      window.addEventListener("resize", onResize);

      // Animate
      const animate = () => {
        if (!refs.current) return;
        refs.current.animFrame = requestAnimationFrame(animate);

        // Animate LED pulse
        ledPhase.current += 0.08;
        const ledIntensity = 0.5 + Math.sin(ledPhase.current) * 0.5;
        uavGroup.traverse((child: any) => {
          if (child.isLight && child.color?.b > 0.5) {
            child.intensity = ledIntensity * 2;
          }
        });

        // Particle system — wake turbulence
        const { pPos: pp } = refs.current;
        const ux = uavGroup.position.x;
        const uy = uavGroup.position.y;
        const uz = uavGroup.position.z;
        for (let i = 0; i < pCount; i++) {
          const age = pp[i * 3 + 1] - uy;
          if (Math.abs(age) > 8) {
            pp[i * 3]     = ux + (Math.random() - 0.5) * 2;
            pp[i * 3 + 1] = uy;
            pp[i * 3 + 2] = uz + (Math.random() - 0.5) * 2;
          } else {
            pp[i * 3]     += (Math.random() - 0.5) * 0.1;
            pp[i * 3 + 1] -= 0.08;
            pp[i * 3 + 2] += (Math.random() - 0.5) * 0.1;
          }
        }
        refs.current.particleGeo.attributes.position.needsUpdate = true;

        refs.current.renderer.render(refs.current.scene, refs.current.camera);
        refs.current.frameCount++;
      };
      animate();
    });

    return () => {
      if (refs.current) {
        cancelAnimationFrame(refs.current.animFrame);
        refs.current.renderer.dispose();
        if (mount.contains(refs.current.renderer.domElement))
          mount.removeChild(refs.current.renderer.domElement);
        refs.current = null;
      }
    };
  }, []);

  // ── Sync UAV + camera to physics state ─────────────────────────
  useEffect(() => {
    if (!refs.current) return;
    const { uavGroup, camera, THREE } = refs.current;

    // NED → Three.js: East→X, Up→Y, North→-Z
    const M_TO_LAT = 1 / 111320;
    const mToLon   = (lat: number) => 1 / (111320 * Math.cos(lat * Math.PI / 180));
    const baseLat  = mission?.waypoints?.[0]?.lat ?? 48.3794;
    const baseLon  = mission?.waypoints?.[0]?.lon ?? 31.1656;

    const posX = (state.lon - baseLon) / mToLon(state.lat) * 0.1;
    const posY =  state.altitude_m * 0.1;
    const posZ = -(state.lat - baseLat) / M_TO_LAT * 0.1;

    uavGroup.position.set(posX, posY, posZ);
    uavGroup.rotation.set(state.pitch, -state.yaw, state.roll, "ZYX");

    // Camera modes
    if (mode === "fpv") {
      camera.position.set(posX + 0.3, posY + 0.05, posZ);
      camera.rotation.set(state.pitch - 0.35, -state.yaw, state.roll, "ZYX");
    } else if (mode === "third") {
      const followDist  = 18;
      const followHeight = 5;
      const behindX = posX - Math.sin(-state.yaw) * followDist;
      const behindZ = posZ - Math.cos(-state.yaw) * followDist;
      // Smooth lerp
      camera.position.x += (behindX - camera.position.x) * 0.06;
      camera.position.y += (posY + followHeight - camera.position.y) * 0.06;
      camera.position.z += (behindZ - camera.position.z) * 0.06;
      camera.lookAt(posX, posY, posZ);
    } else {
      // Map — top down
      camera.position.set(posX, posY + 120, posZ + 20);
      camera.lookAt(posX, posY, posZ);
    }
  }, [state, mode, mission]);

  // ── Update waypoint markers ────────────────────────────────────
  useEffect(() => {
    if (!refs.current || !mission?.waypoints?.length) return;
    const { THREE, scene } = refs.current;
    updateWaypointMarkers(THREE, scene, mission.waypoints, wpMarkersRef);
  }, [mission?.waypoints]);

  // ── EW visual distortion ───────────────────────────────────────
  useEffect(() => {
    if (!refs.current) return;
    const canvas = refs.current.renderer.domElement;
    const { gps_effect, datalink_effect, radar_lock, link_quality } = ewState;

    if (radar_lock) {
      canvas.style.filter = "brightness(1.1) contrast(1.2) sepia(0.3) hue-rotate(350deg)";
    } else if (gps_effect === "DENIED") {
      canvas.style.filter = "brightness(0.85) contrast(1.05) hue-rotate(15deg) saturate(0.7)";
    } else if (gps_effect === "SPOOFED") {
      canvas.style.filter = "hue-rotate(280deg) saturate(0.6) contrast(0.9)";
    } else if (datalink_effect === "DENIED") {
      canvas.style.filter = "brightness(0.7) contrast(1.3) saturate(0.3) grayscale(0.5)";
    } else if (link_quality < 0.5) {
      canvas.style.filter = `brightness(${0.75 + link_quality * 0.4}) saturate(${0.5 + link_quality})`;
    } else {
      canvas.style.filter = "none";
    }
  }, [ewState]);

  // ── Derived values for HUD ─────────────────────────────────────
  const heading    = (((state.yaw * 180 / Math.PI) % 360) + 360) % 360;
  const roll       = state.roll  * 180 / Math.PI;
  const pitch      = state.pitch * 180 / Math.PI;
  const batPct     = state.fuel_remaining * 100;
  const batColor   = batPct < 15 ? "text-red-400" : batPct < 30 ? "text-yellow-400" : "text-white/90";
  const altColor   = state.altitude_m < 20 ? "text-red-400" : "text-white/90";
  const linkColor  = ewState.link_quality < 0.5 ? "text-red-400" : ewState.link_quality < 0.8 ? "text-yellow-400" : "text-white/70";

  return (
    <div className="relative w-full h-full bg-bg-base overflow-hidden">
      {/* Three.js canvas */}
      <div ref={mountRef} className="w-full h-full" />

      {/* ── FPV OSD ──────────────────────────────────────────── */}
      {mode === "fpv" && (
        <div className="absolute inset-0 pointer-events-none select-none">

          {/* Scan line effect (CRT-ish) */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.015] to-transparent"
            style={{ backgroundSize: "100% 4px" }} />

          {/* Top bar — primary flight data */}
          <div className="absolute top-0 left-0 right-0 flex items-start justify-between p-3">
            {/* Left cluster */}
            <div className="space-y-1">
              <FpvGauge label="ALT" value={`${state.altitude_m.toFixed(0)}`} unit="m"   color={altColor}  />
              <FpvGauge label="SPD" value={`${state.airspeed_ms.toFixed(1)}`} unit="m/s" />
              <FpvGauge label="VSI" value={`${(-state.vz).toFixed(1)}`} unit="m/s"
                color={Math.abs(state.vz) > 5 ? "text-yellow-400" : "text-white/70"} />
            </div>

            {/* Center — heading tape */}
            <div className="flex flex-col items-center gap-2">
              <HeadingTape heading={heading} />
              {/* EW status pills */}
              <div className="flex gap-1.5">
                {ewState.gps_effect !== "NONE" && (
                  <EwPill label={`GPS ${ewState.gps_effect}`}
                    color={ewState.gps_effect === "DENIED" ? "bg-red-600/90" :
                           ewState.gps_effect === "SPOOFED" ? "bg-purple-600/90" : "bg-yellow-600/80"} />
                )}
                {ewState.datalink_effect !== "NONE" && (
                  <EwPill label="LINK LOST" color="bg-red-600/90" pulse />
                )}
                {ewState.radar_warning && !ewState.radar_lock && (
                  <EwPill label="RWR" color="bg-yellow-600/90" pulse />
                )}
              </div>
            </div>

            {/* Right cluster */}
            <div className="space-y-1 items-end flex flex-col">
              <FpvGauge label="BAT" value={`${batPct.toFixed(0)}`} unit="%" color={batColor}
                bar={batPct / 100} barColor={batPct < 20 ? "#ef4444" : batPct < 40 ? "#f59e0b" : "#10b981"} />
              <FpvGauge label="THR" value={`${(state.actual_throttle*100).toFixed(0)}`} unit="%"
                bar={state.actual_throttle}
                barColor={state.actual_throttle > 0.85 ? "#ef4444" : "#06b6d4"} />
              <FpvGauge label="LNK" value={`${(ewState.link_quality*100).toFixed(0)}`} unit="%" color={linkColor} />
            </div>
          </div>

          {/* Center — artificial horizon + crosshair */}
          <div className="absolute inset-0 flex items-center justify-center">
            <ArtificialHorizon roll={roll} pitch={pitch} />
          </div>

          {/* Radar lock warning — full screen flash */}
          {ewState.radar_lock && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="border-2 border-red-500 animate-ping absolute inset-8 rounded opacity-40" />
              <div className="font-mono text-red-400 text-sm font-bold tracking-[0.3em] animate-pulse
                bg-red-950/60 border border-red-500 px-6 py-2 rounded">
                ⚠ RADAR LOCK — BREAK BREAK
              </div>
            </div>
          )}

          {/* Bottom bar */}
          <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between p-3">
            {/* Roll indicator */}
            <div className="space-y-0.5">
              <FpvGauge label="ROL" value={`${roll.toFixed(1)}`} unit="°"
                color={Math.abs(roll) > 35 ? "text-red-400" : Math.abs(roll) > 20 ? "text-yellow-400" : "text-white/70"} />
              <FpvGauge label="PIT" value={`${pitch.toFixed(1)}`} unit="°"
                color={Math.abs(pitch) > 25 ? "text-red-400" : "text-white/70"} />
            </div>

            {/* Center — altitude tape */}
            <AltitudeTape altitude={state.altitude_m} />

            {/* Time + coords */}
            <div className="space-y-0.5 items-end flex flex-col">
              <div className="font-mono text-2xs text-white/40">
                {state.lat.toFixed(4)}N {state.lon.toFixed(4)}E
              </div>
              <div className="font-mono text-2xs text-white/40">
                T+{state.sim_time_s.toFixed(0)}s
              </div>
              <div className={clsx("font-mono text-xs",
                ewState.gps_effect === "DENIED" ? "text-red-400" : "text-white/40")}>
                {ewState.gps_effect === "DENIED" ? "GPS: DENIED" :
                 ewState.gps_effect === "SPOOFED" ? "GPS: SPOOFED" :
                 `GPS ±${ewState.gps_accuracy_m.toFixed(0)}m`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Third person overlay ─────────────────────────────── */}
      {mode === "third" && (
        <div className="absolute top-3 left-3 pointer-events-none">
          <div className="bg-black/60 backdrop-blur-sm rounded border border-white/10 px-3 py-2.5 space-y-1.5">
            {([
              ["ALT",  `${state.altitude_m.toFixed(0)} m`,   altColor],
              ["GS",   `${state.groundspeed_ms.toFixed(1)} m/s`, "text-white/80"],
              ["HDG",  `${heading.toFixed(0)}°`,              "text-white/80"],
              ["BAT",  `${batPct.toFixed(0)}%`,               batColor],
              ["LINK", `${(ewState.link_quality*100).toFixed(0)}%`, linkColor],
            ] as [string,string,string][]).map(([l, v, c]) => (
              <div key={l} className="flex items-center gap-3">
                <span className="font-mono text-2xs text-white/35 w-8">{l}</span>
                <span className={clsx("font-mono text-xs tabular-nums", c)}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Map mode compass ─────────────────────────────────── */}
      {mode === "map" && (
        <div className="absolute top-3 right-3 pointer-events-none">
          <Compass heading={heading} />
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────

function FpvGauge({ label, value, unit, color = "text-white/90", bar, barColor }: {
  label:string; value:string; unit:string; color?:string; bar?:number; barColor?:string;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-1 bg-black/55 backdrop-blur-sm px-2 py-0.5 rounded">
        <span className="font-mono text-2xs text-white/35 w-7">{label}</span>
        <span className={clsx("font-mono text-xs tabular-nums font-medium", color)}>{value}</span>
        <span className="font-mono text-2xs text-white/30">{unit}</span>
      </div>
      {bar !== undefined && (
        <div className="h-0.5 bg-white/10 rounded mx-0.5 mt-0.5 overflow-hidden">
          <div className="h-full rounded transition-all duration-200"
            style={{ width: `${Math.min(100, bar * 100)}%`, background: barColor ?? "#06B6D4" }} />
        </div>
      )}
    </div>
  );
}

function EwPill({ label, color, pulse }: { label:string; color:string; pulse?:boolean }) {
  return (
    <span className={clsx(
      "font-mono text-2xs text-white px-2 py-0.5 rounded tracking-wider",
      color, pulse && "animate-pulse",
    )}>
      {label}
    </span>
  );
}

function HeadingTape({ heading }: { heading: number }) {
  const ticks = [];
  for (let d = -40; d <= 40; d += 10) {
    const h = ((heading + d) % 360 + 360) % 360;
    const cardinals: Record<number, string> = { 0:"N", 90:"E", 180:"S", 270:"W" };
    ticks.push({ offset: d, label: cardinals[h] ?? String(Math.round(h / 10) * 10) });
  }
  return (
    <div className="relative overflow-hidden bg-black/50 border border-white/10 rounded"
      style={{ width: "200px", height: "22px" }}>
      {ticks.map(({ offset, label }) => (
        <div key={offset} className="absolute top-0 h-full flex flex-col items-center justify-between py-0.5"
          style={{ left: `calc(50% + ${offset * 2}px)`, transform: "translateX(-50%)" }}>
          <span className="font-mono text-2xs text-white/60">{label}</span>
        </div>
      ))}
      {/* Center marker */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-full w-px bg-cyan-400/80" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0"
        style={{ borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: "5px solid #06B6D4" }} />
    </div>
  );
}

function AltitudeTape({ altitude }: { altitude: number }) {
  const ticks = [];
  const step = 20;
  const range = 4;
  for (let i = -range; i <= range; i++) {
    const alt = Math.round(altitude / step) * step + i * step;
    ticks.push({ alt, offset: (altitude - alt) / step });
  }
  return (
    <div className="relative overflow-hidden bg-black/50 border border-white/10 rounded flex flex-col items-center"
      style={{ width: "60px", height: "120px" }}>
      {ticks.map(({ alt, offset }) => (
        <div key={alt} className="absolute flex items-center gap-1"
          style={{ top: `calc(50% + ${offset * 30}px)`, transform: "translateY(-50%)" }}>
          <div className="w-2 h-px bg-white/30" />
          <span className={clsx("font-mono text-2xs",
            alt === Math.round(altitude / step) * step ? "text-white/90" : "text-white/35")}>
            {alt}
          </span>
        </div>
      ))}
      <div className="absolute top-1/2 -translate-y-1/2 left-0 w-full h-px bg-cyan-400/60" />
    </div>
  );
}

function ArtificialHorizon({ roll, pitch }: { roll: number; pitch: number }) {
  return (
    <div className="relative pointer-events-none" style={{ width: "180px", height: "120px" }}>
      {/* Horizon clip area */}
      <div className="absolute inset-0 overflow-hidden rounded">
        {/* Sky */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/40 to-blue-900/20"
          style={{
            transform: `rotate(${-roll}deg) translateY(${pitch * 2}px)`,
            transformOrigin: "center center",
          }} />
        {/* Ground */}
        <div className="absolute left-0 right-0 bottom-0"
          style={{
            height: `${50 + pitch * 2}%`,
            background: "linear-gradient(to bottom, rgba(20,40,10,0.5), rgba(10,25,5,0.6))",
            transform: `rotate(${-roll}deg)`,
            transformOrigin: "center top",
          }} />
        {/* Horizon line */}
        <div className="absolute left-0 right-0 h-px bg-white/60"
          style={{
            top: `${50 - pitch * 2}%`,
            transform: `rotate(${-roll}deg)`,
          }} />
      </div>

      {/* Fixed aircraft reference */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative">
          {/* Left wing */}
          <div className="absolute bg-cyan-400" style={{ width: "40px", height: "2px", right: "12px", top: "-1px" }} />
          {/* Right wing */}
          <div className="absolute bg-cyan-400" style={{ width: "40px", height: "2px", left: "12px", top: "-1px" }} />
          {/* Center dot */}
          <div className="w-3 h-3 border-2 border-cyan-400 rounded-full" />
          {/* Bottom pip */}
          <div className="absolute bg-cyan-400 left-1/2 -translate-x-1/2" style={{ width: "2px", height: "10px", top: "12px" }} />
        </div>
      </div>

      {/* Roll indicator tick marks */}
      {[-60, -45, -30, -20, 0, 20, 30, 45, 60].map(deg => (
        <div key={deg} className="absolute left-1/2 -translate-x-1/2" style={{
          bottom: 0, height: "50%",
          transform: `rotate(${deg}deg)`,
          transformOrigin: "bottom center",
        }}>
          <div className={clsx("mx-auto bg-white/40",
            deg === 0 ? "w-0.5 h-3" : [30, -30].includes(deg) ? "w-0.5 h-2.5" : "w-px h-2")} />
        </div>
      ))}
    </div>
  );
}

function Compass({ heading }: { heading: number }) {
  return (
    <div className="bg-black/60 border border-white/10 rounded p-2 flex flex-col items-center gap-1">
      <div className="relative w-10 h-10">
        <svg viewBox="0 0 40 40" className="w-full h-full">
          <circle cx="20" cy="20" r="18" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
          {["N","E","S","W"].map((d, i) => {
            const angle = i * 90 - heading;
            const rad   = angle * Math.PI / 180;
            const x = 20 + 13 * Math.sin(rad);
            const y = 20 - 13 * Math.cos(rad);
            return <text key={d} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
              className="font-mono" fontSize="7"
              fill={d === "N" ? "#06B6D4" : "rgba(255,255,255,0.5)"}>{d}</text>;
          })}
          <polygon points="20,4 22,18 20,20 18,18" fill="#06B6D4"
            transform={`rotate(${-heading},20,20)`} />
          <polygon points="20,36 22,22 20,20 18,22" fill="rgba(255,255,255,0.3)"
            transform={`rotate(${-heading},20,20)`} />
        </svg>
      </div>
      <span className="font-mono text-2xs text-white/60 tabular-nums">
        {heading.toFixed(0).padStart(3, "0")}°
      </span>
    </div>
  );
}
