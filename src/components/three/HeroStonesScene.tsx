import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { ThemeMode } from "../../../shared/types";

interface HeroStonesSceneProps {
  theme: ThemeMode;
}

function createSubtleGrainTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = 22 + Math.floor(Math.sin(i * 0.13) * 5 + Math.cos(i * 0.07) * 4);
    img.data[i] = n;
    img.data[i + 1] = n;
    img.data[i + 2] = n;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function HeroStonesScene({ theme }: HeroStonesSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<ThemeMode>(theme);

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: "high-performance",
        alpha: false,
      });
    } catch {
      return;
    }

    let isSoftwareGl = false;
    try {
      const gl = renderer.getContext();
      const dbg = gl.getExtension("WEBGL_debug_renderer_info");
      if (dbg) {
        const rendererStr = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || "");
        isSoftwareGl = /SwiftShader|Software|llvmpipe/i.test(rendererStr);
      }
    } catch {
      isSoftwareGl = false;
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = false;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const nightBg = new THREE.Color("#0b0b0b");
    const dayBg = new THREE.Color("#1a1f1c");
    const currentBg = (themeRef.current === "day" ? dayBg : nightBg).clone();
    scene.background = currentBg;

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.06);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 80);
    camera.position.set(0, 0, 12.5);

    // Subtle soft key light from top-left (matching the dark block mosaic gradient in screenshot)
    const ambientLight = new THREE.AmbientLight(0xffffff, themeRef.current === "day" ? 0.9 : 0.25);
    scene.add(ambientLight);

    const topLeftLight = new THREE.DirectionalLight(0xe5e7eb, themeRef.current === "day" ? 2.2 : 1.35);
    topLeftLight.position.set(-8, 7, 7);
    scene.add(topLeftLight);

    const rightFillLight = new THREE.DirectionalLight(0x9ca3af, themeRef.current === "day" ? 0.7 : 0.22);
    rightFillLight.position.set(7, -4, 5);
    scene.add(rightFillLight);

    // Subtle neon green lights peeking through seams in the lower-left / center-bottom area
    const greenSeamLight1 = new THREE.PointLight(0x05ea00, 18, 6.5, 1.8);
    greenSeamLight1.position.set(-1.35, -0.75, 0.25);
    scene.add(greenSeamLight1);

    const greenSeamLight2 = new THREE.PointLight(0x05ea00, 14, 5.5, 1.8);
    greenSeamLight2.position.set(0.35, -1.65, 0.25);
    scene.add(greenSeamLight2);

    const greenSeamLight3 = new THREE.PointLight(0x00c853, 12, 5.0, 1.8);
    greenSeamLight3.position.set(-2.5, -2.1, 0.25);
    scene.add(greenSeamLight3);

    const grainTex = createSubtleGrainTexture();
    const blockMaterial = new THREE.MeshStandardMaterial({
      color: themeRef.current === "day" ? 0x262c28 : 0x131313,
      map: grainTex,
      roughness: 0.42,
      metalness: 0.48,
    });

    const greenGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0x05ea00,
    });

    const wallGroup = new THREE.Group();
    scene.add(wallGroup);

    const disposables: Array<{ dispose: () => void }> = [grainTex, blockMaterial, greenGlowMaterial, envTarget];

    // Dense 3D Mosaic Wall of Rectangular & Square Dark Blocks covering entire viewport
    const blockGeo = new THREE.BoxGeometry(1, 1, 1);
    disposables.push(blockGeo);

    interface TileInfo {
      mesh: THREE.Mesh;
      baseZ: number;
      phase: number;
    }
    const tiles: TileInfo[] = [];

    // Deterministic pseudo-random helper
    const hash = (x: number, y: number) => {
      const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      return s - Math.floor(s);
    };

    const cols = 16;
    const rows = 9;
    const cellW = 1.45;
    const cellH = 1.15;
    const startX = -((cols - 1) * cellW) / 2;
    const startY = -((rows - 1) * cellH) / 2;

    for (let r = 0; r < rows; r++) {
      let c = 0;
      while (c < cols) {
        const rnd = hash(c, r);
        const spanW = rnd > 0.66 && c + 1 < cols ? 2 : 1;
        const rndH = hash(c + 11, r + 5);
        const spanH = rndH > 0.78 && r + 1 < rows ? 1.28 : rndH < 0.25 ? 0.86 : 1.0;

        const w = spanW * cellW - 0.045;
        const h = cellH * spanH - 0.045;
        const depth = 0.75 + hash(c + 3, r + 9) * 0.75;

        const posX = startX + c * cellW + ((spanW - 1) * cellW) / 2;
        const posY = startY + r * cellH;
        const posZ = (hash(c + 19, r + 23) - 0.5) * 0.75;

        const mesh = new THREE.Mesh(blockGeo, blockMaterial);
        mesh.scale.set(w, h, depth);
        mesh.position.set(posX, posY, posZ);
        mesh.rotation.set(
          (hash(c + 1, r) - 0.5) * 0.035,
          (hash(c, r + 1) - 0.5) * 0.04,
          (hash(c + 7, r + 7) - 0.5) * 0.015
        );

        wallGroup.add(mesh);
        tiles.push({ mesh, baseZ: posZ, phase: hash(c + 31, r + 17) * Math.PI * 2 });
        c += spanW;
      }
    }

    // Small vivid green emissive strips tucked inside specific seams (just like the screenshot!)
    const greenSeamSpots: Array<[number, number, number, number, number]> = [
      [-1.35, -0.78, -0.25, 0.7, 0.1],
      [-0.65, -1.9, -0.22, 0.55, 0.08],
      [0.45, -1.65, -0.24, 0.85, 0.09],
      [-2.45, -2.05, -0.2, 0.5, 0.08],
      [1.2, -0.5, -0.26, 0.45, 0.07],
    ];
    for (const [gx, gy, gz, gw, gh] of greenSeamSpots) {
      const stripGeo = new THREE.PlaneGeometry(gw, gh);
      disposables.push(stripGeo);
      const strip = new THREE.Mesh(stripGeo, greenGlowMaterial);
      strip.position.set(gx, gy, gz);
      wallGroup.add(strip);
    }

    let targetMouseX = 0;
    let targetMouseY = 0;
    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      targetMouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      targetMouseY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    const clock = new THREE.Clock();
    let rafId = 0;
    let timeoutId = 0;
    let disposed = false;

    const tick = () => {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();
      const isDay = themeRef.current === "day";

      const targetBg = isDay ? dayBg : nightBg;
      currentBg.lerp(targetBg, Math.min(1, dt * 4.5));
      scene.background = currentBg;

      ambientLight.intensity = THREE.MathUtils.damp(ambientLight.intensity, isDay ? 0.95 : 0.25, 4.5, dt);
      topLeftLight.intensity = THREE.MathUtils.damp(topLeftLight.intensity, isDay ? 2.2 : 1.35, 4.5, dt);

      const targetColor = isDay ? new THREE.Color(0x282f2b) : new THREE.Color(0x131313);
      blockMaterial.color.lerp(targetColor, Math.min(1, dt * 4.5));

      // Gentle breathing depth shift on rectangular blocks & subtle mouse parallax
      camera.position.x = THREE.MathUtils.damp(camera.position.x, targetMouseX * 0.45, 3.0, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, -targetMouseY * 0.28, 3.0, dt);
      camera.lookAt(0, 0, 0);

      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i];
        t.mesh.position.z = t.baseZ + Math.sin(elapsed * 0.55 + t.phase) * 0.06;
      }

      greenSeamLight1.intensity = 17 + Math.sin(elapsed * 1.4) * 3;
      greenSeamLight2.intensity = 14 + Math.cos(elapsed * 1.2) * 2.5;

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        timeoutId = window.setTimeout(() => {
          rafId = requestAnimationFrame(tick);
        }, 32);
      } else {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0 w-full h-full pointer-events-none select-none" aria-hidden="true" />;
}
