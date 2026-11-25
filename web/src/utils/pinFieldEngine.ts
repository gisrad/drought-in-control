import * as THREE from 'three';
import {
  hexToRgbNorm,
  METRIC_VISUALS,
  type CameraPose,
  type MetricVisualSpec,
} from './pinFieldConfig';
import type { DroughtIndexKey } from '../types/drought';

export interface PinGeometryLayout {
  lons: Float32Array | number[];
  lats: Float32Array | number[];
  stepDeg: number;
  pinScale: number;
  heightScale: number;
}

export interface HoveredPinInfo {
  index: number;
  lon: number;
  lat: number;
}

const VERTEX_SHADER = /* glsl */ `
  attribute vec2 aPosXZ;
  attribute float aValPrev;
  attribute float aValNext;
  attribute float aMask;

  uniform float uBlend;
  uniform float uMode; // 0.0 = bipolar, 1.0 = unipolar
  uniform float uPinWidth;
  uniform float uBaseHalf;
  uniform float uMaxHeight;

  varying vec3 vNormalW;
  varying float vNormVal;
  varying float vShaftT;
  varying float vMask;
  varying float vDepth;
  varying float vIsNeg;

  void main() {
    float raw = mix(aValPrev, aValNext, smoothstep(0.0, 1.0, uBlend));
    vNormVal = raw;
    vMask = aMask;

    float bottomY = -uBaseHalf;
    float topY = uBaseHalf;
    vIsNeg = 0.0;

    if (uMode > 0.5) {
      // Unipolar hazard spires (PDLVI: 0..1)
      float v = clamp(raw, 0.0, 1.0);
      float shaped = pow(v, 1.08);
      bottomY = 0.0;
      topY = max(uBaseHalf * 1.15, uBaseHalf + shaped * uMaxHeight * 1.32);
    } else {
      // Bipolar physical Pinscreen (SPI-3 / SSMA / VHI)
      float v = clamp(raw, -1.0, 1.0);
      float s = sign(v);
      float mag = pow(abs(v), 0.84);
      float shaped = s * mag;
      if (shaped >= 0.0) {
        bottomY = -uBaseHalf;
        topY = uBaseHalf + shaped * uMaxHeight;
      } else {
        vIsNeg = 1.0;
        // Depress top face into a true basin AND extend underside downward along coastlines
        topY = uBaseHalf * 0.35 + shaped * (uMaxHeight * 0.40);
        bottomY = -uBaseHalf + shaped * (uMaxHeight * 0.96);
      }
    }

    float height = max(0.008, topY - bottomY);
    float centerY = 0.5 * (topY + bottomY);

    // BoxGeometry spans [-0.5 .. +0.5] in local space
    vShaftT = clamp(position.y + 0.5, 0.0, 1.0);
    vec3 worldPos = vec3(
      aPosXZ.x + position.x * uPinWidth,
      centerY + position.y * height,
      aPosXZ.y + position.z * uPinWidth
    );

    vNormalW = normal;
    vec4 mvPos = viewMatrix * vec4(worldPos, 1.0);
    vDepth = -mvPos.z;
    gl_Position = projectionMatrix * mvPos;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform float uMode;
  uniform int uStopCount;
  uniform float uStopT[7];
  uniform vec3 uStopColor[7];
  uniform vec3 uBgColor;

  varying vec3 vNormalW;
  varying float vNormVal;
  varying float vShaftT;
  varying float vMask;
  varying float vDepth;
  varying float vIsNeg;

  vec3 sampleRamp(float t) {
    float tc = clamp(t, 0.0, 1.0);
    vec3 col = uStopColor[0];
    for (int i = 0; i < 6; i++) {
      if (i + 1 >= uStopCount) break;
      float t0 = uStopT[i];
      float t1 = uStopT[i + 1];
      if (tc >= t0 && tc <= t1) {
        float f = clamp((tc - t0) / max(t1 - t0, 0.0001), 0.0, 1.0);
        return mix(uStopColor[i], uStopColor[i + 1], f);
      }
    }
    return uStopColor[uStopCount - 1];
  }

  void main() {
    float rampT = uMode > 0.5 ? clamp(vNormVal, 0.0, 1.0) : clamp(vNormVal * 0.5 + 0.5, 0.0, 1.0);
    vec3 baseCol = sampleRamp(rampT);

    // Subtle zone-filter dimming & hover highlight encoded in vMask
    // vMask: 1.0 = active, 0.18 = dimmed outside BMKG climate zone, > 1.5 = hovered kabupaten
    if (vMask < 0.5) {
      float lum = dot(baseCol, vec3(0.299, 0.587, 0.114));
      baseCol = mix(vec3(lum) * 0.42, baseCol * 0.36, 0.35);
    } else if (vMask > 1.5) {
      baseCol = mix(baseCol, vec3(1.0), 0.20);
    }

    vec3 n = normalize(vNormalW);
    vec3 keyDir = normalize(vec3(-0.46, 0.84, 0.42));
    vec3 fillDir = normalize(vec3(0.58, 0.42, -0.52));

    float keyDiff = max(dot(n, keyDir), 0.0);
    float fillDiff = max(dot(n, fillDir), 0.0);

    // Top cap vs vertical sides + shaft ambient occlusion (creates crisp tactile pin separation)
    float isTop = step(0.65, n.y);
    float isBottom = step(0.65, -n.y);
    float ao = mix(0.56, 1.0, vShaftT);
    if (vIsNeg > 0.5) {
      // Sunken pins keep darker upper collar & subtle gradient down the hanging shaft
      ao = mix(0.46, 0.94, vShaftT);
    }

    float shade = (0.48 + 0.42 * keyDiff + 0.18 * fillDiff) * ao;
    shade = mix(shade, 1.04 + 0.08 * keyDiff, isTop);
    shade = mix(shade, 0.42, isBottom);

    vec3 lit = baseCol * shade;

    // Restrained studio depth blend (zero neon bloom)
    float fog = clamp((vDepth - 2.9) * 0.045, 0.0, 0.09);
    vec3 finalCol = mix(lit, uBgColor, fog);

    gl_FragColor = vec4(finalCol, 1.0);
  }
`;

export class PinFieldEngine {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private mesh: THREE.InstancedMesh | null = null;
  private material: THREE.ShaderMaterial;

  private posXZ = new Float32Array(0);
  private lons = new Float32Array(0);
  private lats = new Float32Array(0);
  private pinCount = 0;

  private centerLon = 110;
  private centerLat = -7;
  private cosLat = 1;
  private worldScale = 1;
  private stepWorld = 0.02;
  private baseHalf = 0.015;
  private maxHeight = 0.25;

  // Camera spherical coordinates around (offsetX, 0, offsetZ)
  private yawRad = 0;
  private pitchRad = 0.72;
  private distance = 3.35;
  private targetOffset = new THREE.Vector3(0, 0, 0);

  private attrPrev: THREE.InstancedBufferAttribute | null = null;
  private attrNext: THREE.InstancedBufferAttribute | null = null;
  private attrMask: THREE.InstancedBufferAttribute | null = null;

  public constructor(width = 1280, height = 720) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(26, width / height, 0.05, 30);

    const bg = hexToRgbNorm('#171A1F');
    const initStops = new Array(7).fill(0).map(() => new THREE.Vector3(0.5, 0.5, 0.5));
    const initT = new Array(7).fill(0);

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uBlend: { value: 0 },
        uMode: { value: 0 },
        uPinWidth: { value: 0.012 },
        uBaseHalf: { value: 0.014 },
        uMaxHeight: { value: 0.24 },
        uStopCount: { value: 7 },
        uStopT: { value: initT },
        uStopColor: { value: initStops },
        uBgColor: { value: new THREE.Vector3(bg[0], bg[1], bg[2]) },
      },
    });
    this.applyMetricSpec('spi3');
  }

  public get domElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  public resize(width: number, height: number): void {
    const w = Math.max(16, Math.round(width));
    const h = Math.max(16, Math.round(height));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  public applyMetricSpec(metric: DroughtIndexKey): void {
    const spec: MetricVisualSpec = METRIC_VISUALS[metric];
    this.material.uniforms.uMode.value = spec.mode === 'unipolar' ? 1.0 : 0.0;
    this.material.uniforms.uStopCount.value = spec.stops.length;
    const stopT: number[] = new Array(7).fill(1.0);
    const stopCols: THREE.Vector3[] = new Array(7).fill(0).map(() => new THREE.Vector3(0, 0, 0));
    for (let i = 0; i < spec.stops.length; i++) {
      stopT[i] = spec.stops[i].t;
      const [r, g, b] = hexToRgbNorm(spec.stops[i].hex);
      stopCols[i] = new THREE.Vector3(r, g, b);
    }
    this.material.uniforms.uStopT.value = stopT;
    this.material.uniforms.uStopColor.value = stopCols;
  }

  public setGrid(layout: PinGeometryLayout): void {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh = null;
    }

    const n = layout.lons.length;
    this.pinCount = n;
    this.lons = layout.lons instanceof Float32Array ? layout.lons : Float32Array.from(layout.lons);
    this.lats = layout.lats instanceof Float32Array ? layout.lats : Float32Array.from(layout.lats);

    let minLon = Infinity;
    let maxLon = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;
    for (let i = 0; i < n; i++) {
      const lo = this.lons[i];
      const la = this.lats[i];
      if (lo < minLon) minLon = lo;
      if (lo > maxLon) maxLon = lo;
      if (la < minLat) minLat = la;
      if (la > maxLat) maxLat = la;
    }

    this.centerLon = 0.5 * (minLon + maxLon);
    this.centerLat = 0.5 * (minLat + maxLat);
    this.cosLat = Math.cos((this.centerLat * Math.PI) / 180);

    const spanX = Math.max(0.05, (maxLon - minLon) * this.cosLat);
    const spanZ = Math.max(0.05, maxLat - minLat);
    const maxSpan = Math.max(spanX, spanZ);
    // Normalize longest horizontal axis to [-1.0 .. +1.0] (span = 2.0)
    this.worldScale = 2.0 / maxSpan;
    this.stepWorld = layout.stepDeg * this.worldScale;

    this.posXZ = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      this.posXZ[i * 2] = (this.lons[i] - this.centerLon) * this.cosLat * this.worldScale;
      this.posXZ[i * 2 + 1] = -(this.lats[i] - this.centerLat) * this.worldScale;
    }

    const prevArr = new Float32Array(n);
    const nextArr = new Float32Array(n);
    const maskArr = new Float32Array(n).fill(1.0);

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const attrPos = new THREE.InstancedBufferAttribute(this.posXZ, 2);
    this.attrPrev = new THREE.InstancedBufferAttribute(prevArr, 1);
    this.attrNext = new THREE.InstancedBufferAttribute(nextArr, 1);
    this.attrMask = new THREE.InstancedBufferAttribute(maskArr, 1);

    this.attrPrev.setUsage(THREE.DynamicDrawUsage);
    this.attrNext.setUsage(THREE.DynamicDrawUsage);
    this.attrMask.setUsage(THREE.DynamicDrawUsage);

    geo.setAttribute('aPosXZ', attrPos);
    geo.setAttribute('aValPrev', this.attrPrev);
    geo.setAttribute('aValNext', this.attrNext);
    geo.setAttribute('aMask', this.attrMask);

    this.mesh = new THREE.InstancedMesh(geo, this.material, n);
    this.mesh.frustumCulled = false;

    const identity = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      this.mesh.setMatrixAt(i, identity);
    }
    this.mesh.instanceMatrix.needsUpdate = true;

    this.material.uniforms.uPinWidth.value = Math.max(0.0055, this.stepWorld * layout.pinScale);
    this.baseHalf = Math.max(0.008, this.stepWorld * 0.45);
    this.maxHeight = layout.heightScale;
    this.material.uniforms.uBaseHalf.value = this.baseHalf;
    this.material.uniforms.uMaxHeight.value = this.maxHeight;

    this.scene.add(this.mesh);
  }

  public setValues(prevVals: Float32Array, nextVals: Float32Array, blend: number): void {
    if (!this.attrPrev || !this.attrNext) return;
    (this.attrPrev.array as Float32Array).set(prevVals);
    (this.attrNext.array as Float32Array).set(nextVals);
    this.attrPrev.needsUpdate = true;
    this.attrNext.needsUpdate = true;
    this.material.uniforms.uBlend.value = Math.max(0, Math.min(1, blend));
  }

  public setBlend(blend: number): void {
    this.material.uniforms.uBlend.value = Math.max(0, Math.min(1, blend));
  }

  public setMask(maskVals: Float32Array): void {
    if (!this.attrMask) return;
    (this.attrMask.array as Float32Array).set(maskVals);
    this.attrMask.needsUpdate = true;
  }

  public setCameraPose(pose: CameraPose): void {
    this.yawRad = (pose.yawDeg * Math.PI) / 180;
    this.pitchRad = Math.max(0.26, Math.min(1.32, (pose.pitchDeg * Math.PI) / 180));
    this.distance = Math.max(1.2, Math.min(7.5, pose.distance));
    this.targetOffset.set(pose.offsetX ?? 0, 0, pose.offsetZ ?? 0);
    this.updateCameraMatrices();
  }

  public orbitBy(deltaYawRad: number, deltaPitchRad: number): void {
    this.yawRad += deltaYawRad;
    this.pitchRad = Math.max(0.26, Math.min(1.32, this.pitchRad + deltaPitchRad));
    this.updateCameraMatrices();
  }

  public zoomBy(factor: number): void {
    this.distance = Math.max(1.3, Math.min(6.8, this.distance * factor));
    this.updateCameraMatrices();
  }

  public getCameraPose(): CameraPose {
    return {
      yawDeg: (this.yawRad * 180) / Math.PI,
      pitchDeg: (this.pitchRad * 180) / Math.PI,
      distance: this.distance,
      offsetX: this.targetOffset.x,
      offsetZ: this.targetOffset.z,
    };
  }

  private updateCameraMatrices(): void {
    const cosP = Math.cos(this.pitchRad);
    const sinP = Math.sin(this.pitchRad);
    const cx = this.targetOffset.x + Math.sin(this.yawRad) * cosP * this.distance;
    const cy = sinP * this.distance;
    const cz = this.targetOffset.z + Math.cos(this.yawRad) * cosP * this.distance;
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(this.targetOffset.x, 0, this.targetOffset.z);
    this.camera.updateMatrixWorld();
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /** Project a geographic (lon, lat) anchor to 2D canvas pixel coordinates. */
  public projectLonLatToScreen(
    lon: number,
    lat: number,
    canvasW: number,
    canvasH: number,
    yWorld = 0.04
  ): { x: number; y: number; visible: boolean } {
    const wx = (lon - this.centerLon) * this.cosLat * this.worldScale;
    const wz = -(lat - this.centerLat) * this.worldScale;
    const v = new THREE.Vector3(wx, yWorld, wz).project(this.camera);
    const x = (v.x * 0.5 + 0.5) * canvasW;
    const y = (-v.y * 0.5 + 0.5) * canvasH;
    const visible = v.z >= -1 && v.z <= 1 && x > 40 && x < canvasW - 40 && y > 40 && y < canvasH - 40;
    return { x, y, visible };
  }

  /** Fast screen-space pointer hit-test against land pins (no heavy raycaster mesh needed). */
  public pickPinAtCanvasPoint(px: number, py: number, canvasW: number, canvasH: number): HoveredPinInfo | null {
    if (this.pinCount === 0) return null;
    let bestIdx = -1;
    let bestDistSq = 24 * 24;
    const v = new THREE.Vector3();
    for (let i = 0; i < this.pinCount; i++) {
      v.set(this.posXZ[i * 2], 0, this.posXZ[i * 2 + 1]).project(this.camera);
      if (v.z < -1 || v.z > 1) continue;
      const sx = (v.x * 0.5 + 0.5) * canvasW;
      const sy = (-v.y * 0.5 + 0.5) * canvasH;
      const dx = sx - px;
      const dy = sy - py;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDistSq) {
        bestDistSq = d2;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) return null;
    return { index: bestIdx, lon: this.lons[bestIdx], lat: this.lats[bestIdx] };
  }

  public dispose(): void {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh = null;
    }
    this.material.dispose();
    this.renderer.dispose();
  }
}
