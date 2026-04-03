/**
 * Watercolor Cannes Scene — OGL-based generative brushstroke background
 *
 * Decomposes a Dufy-style Cannes painting into hundreds of flat "brushstroke" meshes
 * with watercolor fragment shaders. Strokes react to mouse via raycasting parallax.
 *
 * Color palette from the painting:
 *   Teal canopy:    #3CC8AA / #2A9D8F
 *   Mauve trunk:    #C87E9E / #B56B88
 *   Lavender sky:   #9B8EC4 / #7E6BAD
 *   Sea blue:       #5B8DB8 / #4A7BA8
 *   Terracotta:     #D4A08C / #C28E78
 *   Cream ground:   #F5F0E8 / #EDE5D8
 *   Dark accents:   #2D2D3D / #1A1A2A
 */

import {
  Renderer,
  Camera,
  Transform,
  Program,
  Mesh,
  Plane,
  Vec2,
  Vec3,
  Color,
  Raycast,
} from 'ogl'

// ── Shaders ────────────────────────────────────────────────────

const vertex = /* glsl */ `
  attribute vec3 position;
  attribute vec2 uv;

  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uTime;
  uniform float uHover;
  uniform vec3 uOrigPos;

  varying vec2 vUv;
  varying float vHover;

  void main() {
    vUv = uv;
    vHover = uHover;

    vec3 pos = position;

    // Subtle wave animation
    float wave = sin(uTime * 0.8 + uOrigPos.x * 2.0 + uOrigPos.y * 1.5) * 0.02;
    pos.z += wave;

    // Hover lift
    pos.z += uHover * 0.15;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const fragment = /* glsl */ `
  precision highp float;

  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uHover;
  uniform float uTime;
  uniform float uSeed;

  varying vec2 vUv;
  varying float vHover;

  // Simplex-ish noise for watercolor edges
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p *= 2.0;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;

    // Watercolor edge bleed — organic shape via noise
    float edgeNoise = fbm(uv * 4.0 + uSeed * 10.0);
    float dist = length(uv - 0.5) * 2.0;

    // Softer, more organic shape than a circle
    float strokeShape = 1.0 - smoothstep(0.3 + edgeNoise * 0.3, 0.9 + edgeNoise * 0.1, dist);

    // Watercolor pigment concentration — darker at edges, lighter in center
    float pigment = 1.0 - fbm(uv * 6.0 + uSeed * 5.0) * 0.3;

    // Color variation within stroke
    float colorShift = fbm(uv * 3.0 + uSeed * 7.0) * 0.15;
    vec3 color = uColor + colorShift;

    // Hover brightening
    color = mix(color, color * 1.3 + 0.1, vHover * 0.5);

    // Paper texture (subtle grain)
    float grain = hash(uv * 500.0 + uTime * 0.1) * 0.04;

    float alpha = strokeShape * uOpacity * pigment + grain * strokeShape;

    gl_FragColor = vec4(color, alpha);
  }
`

// ── Stroke regions (painting decomposition) ────────────────────

interface StrokeRegion {
  name: string
  xRange: [number, number]
  yRange: [number, number]
  zBase: number
  colors: string[]
  count: number
  scaleRange: [number, number]
  rotRange: number
}

// Painting composition mapped to normalized coords (-3..3 x, -4..4 y)
const regions: StrokeRegion[] = [
  // Sky / clouds (top right, behind tree)
  {
    name: 'sky',
    xRange: [-3, 3],
    yRange: [1.5, 4],
    zBase: -0.5,
    colors: ['#9B8EC4', '#B8A9D4', '#C4B8DE', '#7E6BAD', '#D8D0E8'],
    count: 60,
    scaleRange: [0.3, 0.8],
    rotRange: 0.5,
  },
  // Tree canopy (upper area, teal brushstrokes)
  {
    name: 'canopy',
    xRange: [-2.5, 2],
    yRange: [1, 4],
    zBase: 0.1,
    colors: ['#3CC8AA', '#2A9D8F', '#45D4B4', '#1F8A7D', '#5EDCC0', '#2D8E7A'],
    count: 80,
    scaleRange: [0.15, 0.45],
    rotRange: 1.2,
  },
  // Tree trunk (left, mauve/pink)
  {
    name: 'trunk',
    xRange: [-2.2, -1.2],
    yRange: [-1, 3],
    zBase: 0.05,
    colors: ['#C87E9E', '#B56B88', '#D4928F', '#A85E78'],
    count: 25,
    scaleRange: [0.2, 0.5],
    rotRange: 0.3,
  },
  // Sea (right side, blue washes)
  {
    name: 'sea',
    xRange: [0, 3],
    yRange: [-0.5, 1.5],
    zBase: -0.3,
    colors: ['#5B8DB8', '#4A7BA8', '#6E9DC8', '#3A6B98', '#7EADD8'],
    count: 50,
    scaleRange: [0.4, 1.0],
    rotRange: 0.2,
  },
  // Terrace / ground (bottom, terracotta + pink)
  {
    name: 'terrace',
    xRange: [-3, 3],
    yRange: [-4, -0.5],
    zBase: -0.1,
    colors: ['#D4A08C', '#C28E78', '#E0B09A', '#B87E68', '#DDB8A8'],
    count: 45,
    scaleRange: [0.3, 0.8],
    rotRange: 0.6,
  },
  // Cream ground / paper showing through
  {
    name: 'paper',
    xRange: [-3, 3],
    yRange: [-4, 4],
    zBase: -0.8,
    colors: ['#F5F0E8', '#EDE5D8', '#F0EBE0', '#E8E0D0'],
    count: 30,
    scaleRange: [0.8, 1.5],
    rotRange: 0.3,
  },
  // Dark accents (people, laptops — small dark strokes at bottom)
  {
    name: 'figures',
    xRange: [-2.5, 2.5],
    yRange: [-3.5, -1],
    zBase: 0.2,
    colors: ['#2D2D3D', '#1A1A2A', '#3D3D4D', '#4A4A5A', '#0D0D1A'],
    count: 35,
    scaleRange: [0.08, 0.25],
    rotRange: 1.5,
  },
  // Laptop screens (tiny bright blue/white spots)
  {
    name: 'screens',
    xRange: [-2, 2],
    yRange: [-3, -1.5],
    zBase: 0.3,
    colors: ['#88CCFF', '#AADDFF', '#FFFFFF', '#66BBEE'],
    count: 15,
    scaleRange: [0.05, 0.12],
    rotRange: 0.8,
  },
]

// ── Hex to RGB ─────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return [r, g, b]
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

// ── Scene setup ────────────────────────────────────────────────

export interface WatercolorScene {
  destroy: () => void
}

export function createWatercolorScene(canvas: HTMLCanvasElement): WatercolorScene {
  const renderer = new Renderer({ canvas, alpha: true, antialias: true, dpr: Math.min(window.devicePixelRatio, 2) })
  const gl = renderer.gl
  gl.clearColor(0.96, 0.94, 0.91, 1) // warm cream

  const camera = new Camera(gl, { fov: 35 })
  camera.position.set(0, 0, 12)

  const scene = new Transform()
  const raycast = new Raycast()
  const mouse = new Vec2()

  // ── Create strokes ───────────────────────────────────────────

  const planeGeo = new Plane(gl, { width: 1, height: 1 })
  const allMeshes: Mesh[] = []
  const meshData: { origPos: Vec3; hover: { value: number } }[] = []

  for (const region of regions) {
    for (let i = 0; i < region.count; i++) {
      const color = hexToRgb(pick(region.colors))
      const seed = Math.random()
      const opacity = lerp(0.4, 0.85, Math.random())

      const program = new Program(gl, {
        vertex,
        fragment,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uColor: { value: new Color(...color) },
          uOpacity: { value: opacity },
          uHover: { value: 0 },
          uTime: { value: 0 },
          uSeed: { value: seed },
          uOrigPos: { value: new Vec3(0, 0, 0) },
        },
      })

      const mesh = new Mesh(gl, { geometry: planeGeo, program })

      // Position within region
      const x = lerp(region.xRange[0], region.xRange[1], Math.random())
      const y = lerp(region.yRange[0], region.yRange[1], Math.random())
      const z = region.zBase + (Math.random() - 0.5) * 0.1
      mesh.position.set(x, y, z)

      // Random scale and rotation for organic feel
      const s = lerp(region.scaleRange[0], region.scaleRange[1], Math.random())
      const aspect = lerp(0.6, 1.8, Math.random()) // brushstrokes are often elongated
      mesh.scale.set(s * aspect, s, 1)
      mesh.rotation.z = (Math.random() - 0.5) * region.rotRange

      program.uniforms.uOrigPos.value.set(x, y, z)

      scene.addChild(mesh)
      allMeshes.push(mesh)
      meshData.push({ origPos: new Vec3(x, y, z), hover: { value: 0 } })
    }
  }

  // ── Resize ───────────────────────────────────────────────────

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight)
    camera.perspective({ aspect: gl.canvas.width / gl.canvas.height })
  }
  window.addEventListener('resize', resize)
  resize()

  // ── Mouse tracking (parallax + proximity hover) ──────────────

  let mouseNorm = { x: 0, y: 0 }
  let targetMouse = { x: 0, y: 0 }

  function onMouseMove(e: MouseEvent) {
    // For raycasting
    mouse.set(
      (e.clientX / gl.canvas.width) * 2 - 1,
      -(e.clientY / gl.canvas.height) * 2 + 1
    )
    // Normalized for parallax
    targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1
    targetMouse.y = -(e.clientY / window.innerHeight) * 2 + 1
  }
  window.addEventListener('mousemove', onMouseMove)

  // ── Animation loop ───────────────────────────────────────────

  let animId: number
  let startTime = performance.now()

  function update() {
    animId = requestAnimationFrame(update)

    const elapsed = (performance.now() - startTime) / 1000

    // Smooth mouse follow
    mouseNorm.x += (targetMouse.x - mouseNorm.x) * 0.05
    mouseNorm.y += (targetMouse.y - mouseNorm.y) * 0.05

    // Subtle camera parallax
    camera.position.x = mouseNorm.x * 0.3
    camera.position.y = mouseNorm.y * 0.2

    // Raycast for proximity hover
    raycast.castMouse(camera, mouse)

    // Update all strokes
    for (let i = 0; i < allMeshes.length; i++) {
      const mesh = allMeshes[i]
      const data = meshData[i]
      const prog = mesh.program

      // Update time
      prog.uniforms.uTime.value = elapsed

      // Proximity-based hover (distance from ray to stroke center)
      const rayOrigin = raycast.origin
      const rayDir = raycast.direction
      const toStroke = new Vec3()
      toStroke.copy(data.origPos).sub(rayOrigin as any)
      const proj = toStroke.dot(rayDir as any)
      const closest = new Vec3()
      closest.copy(rayDir as any).multiply(proj as any).add(rayOrigin as any)
      const dist = closest.distance(data.origPos)

      const hoverTarget = dist < 1.2 ? Math.max(0, 1 - dist / 1.2) : 0
      data.hover.value += (hoverTarget - data.hover.value) * 0.08
      prog.uniforms.uHover.value = data.hover.value

      // Depth-based parallax — farther strokes move less
      const depthFactor = (data.origPos.z + 1) * 0.03
      mesh.position.x = data.origPos.x + mouseNorm.x * depthFactor
      mesh.position.y = data.origPos.y + mouseNorm.y * depthFactor
    }

    renderer.render({ scene, camera })
  }

  update()

  // ── Cleanup ──────────────────────────────────────────────────

  function destroy() {
    cancelAnimationFrame(animId)
    window.removeEventListener('resize', resize)
    window.removeEventListener('mousemove', onMouseMove)
    renderer.gl.getExtension('WEBGL_lose_context')?.loseContext()
  }

  return { destroy }
}
