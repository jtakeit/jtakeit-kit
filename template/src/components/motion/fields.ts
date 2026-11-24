/**
 * The hero fields, as GLSL.
 *
 * Data only — no DOM, no WebGL calls. `HeroField.astro` owns the canvas, the
 * palette, the sizing budget and every path back to the still CSS ground; this
 * file is what each field actually looks like, which is the part worth reading
 * on its own.
 *
 * Adding one is a fragment source plus a row in FRAGMENT. What it has to earn
 * is a *different job* — another variation on soft coloured blobs is the same
 * field with different constants.
 *
 * Every fragment shader is handed the same uniforms:
 *
 *   u_resolution  canvas pixels
 *   u_time        seconds, already multiplied by the component's `speed`
 *   u_grain       0–1
 *   u_colors[4]   the variant's tokens, in the order they were passed
 *   u_bg          the ground colour
 *   u_pointer     where the pointer is over the field, 0–1 from the bottom
 *                 left, eased; the middle where nobody points — `lacquer`
 *                 leans its light toward it
 */

export type Field =
  | 'drift'
  | 'aurora'
  | 'plasma'
  | 'glow'
  | 'flow'
  | 'silk'
  | 'smoke'
  | 'riso'
  | 'veil'
  | 'lacquer'
  | 'ribbons';

/** The fields drawn by a fragment shader. `ribbons` is Canvas 2D and is not one. */
export type ShaderField = Exclude<Field, 'ribbons'>;

export const VERTEX = `attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`;

/*
 * highp where it exists, mediump where it does not. A phone GPU without highp
 * in the fragment stage renders the noise as banding rather than failing, so
 * the guard is worth the four lines.
 */
const HEAD = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_grain;
uniform vec3 u_colors[4];
uniform vec3 u_bg;
uniform vec2 u_pointer;

// Even, unstructured noise for the grain. A multiply hash shows a faint
// axis-aligned mesh at integer fragment coordinates, which reads as a net.
float grainHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
`;

/** Value noise: cheap, slightly blocky, right for large soft shapes. */
const VALUE_NOISE = `
float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(17.0, 9.2);
    a *= 0.5;
  }
  return v;
}
`;

/** Simplex noise: smoother and directionless, right for anything flowing. */
const SIMPLEX = `
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
`;

/**
 * A ramp through the four colours. WebGL1 forbids indexing a uniform array by
 * a computed value in the fragment stage, so the steps are written out.
 */
const PALETTE = `
vec3 palette(float x) {
  float f = clamp(x, 0.0, 1.0) * 3.0;
  vec3 col = u_colors[0];
  col = mix(col, u_colors[1], smoothstep(0.0, 1.0, clamp(f, 0.0, 1.0)));
  col = mix(col, u_colors[2], smoothstep(0.0, 1.0, clamp(f - 1.0, 0.0, 1.0)));
  col = mix(col, u_colors[3], smoothstep(0.0, 1.0, clamp(f - 2.0, 0.0, 1.0)));
  return col;
}
`;

/** Four lamps of colour on slow orbits through a warped field. */
const DRIFT = `
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  float m = min(u_resolution.x, u_resolution.y);
  // Aspect-corrected, so the field does not stretch with the window.
  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / m * 1.3;
  float t = u_time;

  p += 0.15 * vec2(sin(t * 0.31), cos(t * 0.23));
  p += 0.19 * (vec2(fbm(p * 2.0), fbm(p * 2.0 + vec2(5.2, 1.3))) - 0.5);

  vec3 acc = u_bg * 0.25;
  float total = 0.25;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 c = vec2(
      sin(t * (0.21 + fi * 0.071) + fi * 2.4),
      cos(t * (0.17 + fi * 0.093) + fi * 1.7)) * 0.75;
    float w = exp(-dot(p - c, p - c) * 3.4);
    acc += u_colors[i] * w;
    total += w;
  }
  vec3 col = acc / total;

  float vd = length(uv - 0.5) * 1.41421356;
  col *= 1.0 - 0.15 * smoothstep(0.35, 1.0, vd);
  col += (grainHash(gl_FragCoord.xy + vec2(t * 17.0)) - 0.5) * u_grain * 0.09;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

/** Three layers of simplex noise riding each other. Weather. */
const AURORA = `
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = uv - 0.5;
  p.x *= u_resolution.x / u_resolution.y;
  float t = u_time * 0.1;

  // The second and third layers take the one above as an offset, which is what
  // turns noise into weather.
  float n1 = snoise(p * 0.4 + vec2(t * 0.2, -t * 0.3));
  float n2 = snoise(p * 0.55 + vec2(-t * 0.15, t * 0.25) + n1 * 0.25);
  float n3 = snoise(p * 0.75 + vec2(t * 0.1, -t * 0.2) + n2 * 0.2);

  float dist = length(p) * 1.5;
  float vignette = 1.0 - smoothstep(0.3, 1.2, dist);

  vec3 col = u_bg;
  col = mix(col, u_colors[0], smoothstep(-0.2, 0.5, n1) * 0.85);
  col = mix(col, u_colors[1], smoothstep(-0.1, 0.6, n2) * 0.70);
  col = mix(col, u_colors[2], smoothstep(-0.3, 0.4, n3) * 0.60);
  col = mix(col, u_colors[3], smoothstep(0.0, 0.7, n1 * n2) * 0.50);
  col += u_colors[1] * smoothstep(0.8, 0.0, dist) * 0.3;
  col = mix(u_bg, col, 0.2 + 0.8 * vignette);

  col += (grainHash(gl_FragCoord.xy + vec2(u_time * 17.0)) - 0.5) * u_grain * 0.1;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

/**
 * Interference. Four sine fields summed and read through the palette, which
 * produces bands and rings rather than blobs — the one field in the set with
 * visible structure to it.
 */
const PLASMA = `
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  float m = min(u_resolution.x, u_resolution.y);
  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / m * 1.5;
  float t = u_time;

  p += 0.32 * vec2(sin(t * 0.31), cos(t * 0.23));

  // Higher k is more rings in the same frame. Past ~9 a phone shows moiré.
  float k = 7.0;
  float v = sin(p.x * k + t)
    + sin(p.y * k * 0.8 - t * 0.7)
    + sin((p.x + p.y) * k * 0.6 + t * 0.5)
    + sin(length(p) * k * 1.2 - t);
  vec3 col = palette(0.5 + 0.5 * sin(v));

  float vd = length(uv - 0.5) * 1.41421356;
  col = mix(col, u_bg, 0.61 * smoothstep(0.35, 1.0, vd));
  col += (grainHash(gl_FragCoord.xy + vec2(t * 17.0)) - 0.5) * u_grain * 0.12;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

/**
 * One bright filament of light in a dark room. Almost all of the frame stays
 * near the ground colour, which is what makes the lit part read as light rather
 * than as paint — and what makes this the only field in the set that needs a
 * dark ground to work at all.
 */
const GLOW = `
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = uv * vec2(u_resolution.x / u_resolution.y, 1.0);
  float t = u_time * 0.2;

  float n1 = snoise(p * 0.5 + t);
  float n2 = snoise(p * 0.9 - t * 0.5 + n1);
  float n3 = snoise(p * 1.6 + t * 0.35 + n2 * 0.5);
  // The power is what thins the lit band into a filament: everything but the
  // ridge of the noise falls away to nothing.
  float light = pow(abs(n2), 2.5) * 0.5;

  vec3 col = u_bg;
  col += u_colors[0] * smoothstep(0.1, 1.0, n1) * 0.5;
  col += u_colors[1] * light;
  col += u_colors[2] * pow(abs(n3), 4.0) * 0.35;

  col += (grainHash(gl_FragCoord.xy + vec2(u_time * 17.0)) - 0.5) * u_grain * 0.16;
  // Toward the ground rather than toward black, so a light palette is possible
  // even though this field does not really want one.
  col = mix(u_bg, col, smoothstep(1.2, 0.2, length(uv - 0.5)));
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

/**
 * A flow field. An fbm sample decides a direction at every point, and a second
 * one is read along it — which is what turns noise into something that appears
 * to be *moving somewhere*, like ink pulled through water or marbled paper.
 */
const FLOW = `
void main() {
  float m = min(u_resolution.x, u_resolution.y);
  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / m * 1.5;
  float t = u_time;

  float angle = fbm(p * 2.0 + 1.7) * 6.2831;
  vec2 dir = vec2(cos(angle), sin(angle));
  vec3 col = palette(fbm(p * 3.0 + dir * 1.1 + t * 0.10));

  col += (grainHash(gl_FragCoord.xy + vec2(t * 17.0)) - 0.5) * u_grain * 0.06;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

/**
 * Silk. Four rounds of feeding the coordinate back through a cosine of itself
 * fold the plane into smooth creases — the softest field in the set, and the
 * one that survives being put behind a lot of text.
 */
const SILK = `
void main() {
  float m = min(u_resolution.x, u_resolution.y);
  vec2 q = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / m * 1.5 * 1.6;
  float t = u_time * 0.35;

  float amp = 0.72;
  for (float i = 1.0; i < 5.0; i += 1.0) {
    q.x += amp / i * cos(i * 2.4 * q.y + t * 0.8 + 1.0);
    q.y += amp / i * cos(i * 1.7 * q.x + t * 0.6);
  }
  vec3 col = palette(0.5 + 0.5 * sin(q.x + q.y));

  col += (grainHash(gl_FragCoord.xy + vec2(u_time * 17.0)) - 0.5) * u_grain * 0.06;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;


/**
 * Smoke. Two rounds of domain warping — an fbm pair displaces the plane, and a
 * second pair displaces it again — which is what produces volume: plumes that
 * fold over each other and read as depth rather than as a pattern on a wall.
 *
 * The behaviour is the classic Iñigo Quilez warp, by way of the 21st.dev shader
 * builder's "Smoke". What arrived with it was a fixed blue palette, and that is
 * the half that had to go: the ramp is `u_colors` here, so it is their smoke.
 *
 * It is not `flow`. That one is a single flow field — one direction per point,
 * one sample read along it — and it reads as marbling, flat and streaked. This
 * has an inside.
 */
const SMOKE = `
void main() {
  float m = min(u_resolution.x, u_resolution.y);
  // Deliberately wider than the flow field. At the same scale the two are the
  // same picture: what separates them is that this has a handful of large
  // plumes crossing the frame, where flow is even everywhere.
  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / m * 1.1;
  float t = u_time;

  // How far the second warp pushes. Past ~6 the plumes stop reading as one
  // volume and start reading as noise.
  const float warp = 5.0;
  vec2 q = vec2(fbm(p + t * 0.08), fbm(p + vec2(5.2, 1.3) - t * 0.06));
  vec2 r = vec2(fbm(p + warp * q + vec2(1.7, 9.2)),
                fbm(p + warp * q + vec2(8.3, 2.8)));
  // The contrast goes on the ramp coordinate, not on the finished colour.
  // Two rounds of warping pull fbm hard toward its average, so the field needs
  // spreading — but spreading the *colour* blows the light end of the palette
  // to white, and the centre below 0.5 is what keeps the dark end in the frame.
  vec3 col = palette(clamp((fbm(p + 3.0 * r) - 0.5) * 1.4 + 0.4, 0.0, 1.0));

  col += (grainHash(gl_FragCoord.xy + vec2(t * 17.0)) - 0.5) * u_grain * 0.07;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

/**
 * Riso. A slow wave through the palette, read through a coarse *quantised*
 * noise — the ramp is dithered into cells of flat colour before it is looked
 * up, which is the risograph and newsprint fault, not a texture laid on top.
 *
 * That distinction is the whole field. `u_grain` adds noise to the finished
 * pixel and every field here has it; this adds noise to the *position in the
 * ramp*, so the speckle lands as neighbouring bands of solid colour with a
 * ragged border between them. It is the one field in the set that does not
 * produce a smooth gradient, and the one that survives being printed.
 *
 * The cell is in device pixels and does not move. A dither that drifts shimmers,
 * which is a screen effect; a dither that sits still is ink.
 */
const RISO = `
void main() {
  float m = min(u_resolution.x, u_resolution.y);
  // Two or three bands across the frame, not six. Wide bands leave flat areas
  // for the dither to *not* be in, and a speckle that is everywhere is a
  // texture rather than a print.
  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / m * 1.4;
  float t = u_time;

  vec2 q = p;
  q.x += sin(q.y * 2.1 + t * 0.2) * 0.33;
  q.y += cos(q.x * 2.7 - t * 0.17) * 0.26;
  float wave = 0.5 + 0.5 * sin(q.x * 2.4 + q.y * 1.6 + fbm(q * 2.0) * 3.0);

  // Three device pixels: coarse enough to see as ink, fine enough that it is
  // not a mosaic. The amplitude decides how far into the neighbouring band a
  // speckle can reach — past ~0.3 the ramp stops being a gradient at all.
  float cell = hash21(floor(gl_FragCoord.xy / 3.0));
  vec3 col = palette(clamp(wave + (cell - 0.5) * 0.22, 0.0, 1.0));

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

/**
 * Veil. A curtain: one fbm decides where the drapery hangs, a second is read
 * *along* it, and the whole thing fades out toward the top and bottom edges of
 * the frame.
 *
 * It is the field anchored to an edge. `aurora` is centred — a glow in the
 * middle with a vignette around it — and everything in it points inward; this
 * hangs from the horizontal and thins as it rises, so the hero's copy sits in
 * the quiet part rather than on top of the bright part. Two fields of weather
 * with two different compositions.
 *
 * Where the curtain is absent the ground shows through, which is why it wants a
 * ground worth showing.
 */
const VEIL = `
void main() {
  float m = min(u_resolution.x, u_resolution.y);
  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / m * 1.88;
  float t = u_time;

  float curtain = fbm(vec2(p.x * 2.0 + t * 0.15, p.y * 0.6 - t * 0.05));
  // The second sample is indexed by the first rather than offset by it, which
  // is what makes the bands hang vertically instead of drifting sideways.
  float band = fbm(vec2(p.x * 2.2 - t * 0.1, curtain * 2.4));
  // The upper bound sits past 1: the curtain never quite reaches the brightest
  // colour, which is the difference between a veil and a floodlight.
  float glow = smoothstep(0.18, 1.05, band) * (1.0 - abs(p.y) * 0.55);

  vec3 col = mix(u_bg, palette(clamp(glow, 0.0, 1.0)),
    0.12 + 0.88 * smoothstep(0.0, 0.35, glow));

  col += (grainHash(gl_FragCoord.xy + vec2(t * 17.0)) - 0.5) * u_grain * 0.08;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

/**
 * Lacquer. Liquid polish, slowly flowing: a height field warped twice through
 * itself, lit like a wet surface — a broad diffuse light, a tight highlight and
 * a rim where the surface turns away — with the light leaning toward the
 * pointer. Ported from Lacqué's hero on the jtakeit landing (lacquer.ts).
 *
 * It is the one field with *depth*: the others are colour laid flat, this is a
 * surface the light moves over, which is why it reads as a material rather than
 * as a gradient. It is also the heaviest — three samples of a twice-warped fbm a
 * pixel — so HeroField gives it a smaller pixel budget, refuses a software
 * renderer, and starts it only after the page has loaded.
 *
 * The four colours are the polish, not a ramp:
 *
 *   u_colors[0]  the lacquer — the polish's body, in shadow
 *   u_colors[1]  the lacquer lit — the same polish where the light lands
 *   u_colors[2]  the deep — what the polish is poured over; nearly black
 *   u_colors[3]  the sheen — the highlight's own colour; nearly white
 *
 * The lower left of the frame is kept quiet (toward the deep), so a heading
 * set there reads in every frame.
 */
const LACQUER = `
float lqHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float lqNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(lqHash(i), lqHash(i + vec2(1.0, 0.0)), u.x), mix(lqHash(i + vec2(0.0, 1.0)), lqHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float lqFbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++) { v += a * lqNoise(p); p = r * p * 2.02; a *= 0.5; }
  return v;
}
float lqHeight(vec2 p) {
  // Forty seconds in, as the landing starts it: the first frame is already a
  // poured surface, not the noise's grid at rest.
  float t = (u_time + 40.0) * 0.06;
  vec2 q = vec2(lqFbm(p + vec2(0.0, t)), lqFbm(p + vec2(5.2, 1.3) - t));
  vec2 w = vec2(lqFbm(p + 3.0 * q + vec2(1.7, 9.2) + t * 0.7), lqFbm(p + 3.0 * q + vec2(8.3, 2.8) - t * 0.5));
  return lqFbm(p + 2.1 * w);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  p *= 0.9;

  float e = 0.004;
  float h = lqHeight(p);
  float hx = lqHeight(p + vec2(e, 0.0));
  float hy = lqHeight(p + vec2(0.0, e));
  vec3 n = normalize(vec3((h - hx) / e * 0.9, (h - hy) / e * 0.9, 1.0));

  vec2 m = (u_pointer - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
  vec3 L = normalize(vec3(m * 1.6 - p * 0.35 + vec2(0.4, 0.5), 0.9));
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));

  vec3 lacq = u_colors[0];
  vec3 bright = u_colors[1];
  vec3 deep = u_colors[2];
  vec3 pearl = u_colors[3];

  float diff = clamp(dot(n, L), 0.0, 1.0);
  float spec = pow(max(dot(n, H), 0.0), 90.0);
  float soft = pow(max(dot(n, H), 0.0), 12.0);
  float fres = pow(1.0 - max(n.z, 0.0), 2.2);

  vec3 col = mix(deep, lacq, smoothstep(0.22, 0.72, h));
  col = mix(col, bright, diff * diff * 0.7 * smoothstep(0.3, 0.8, h));
  col += pearl * (spec * 1.1 + soft * 0.12);
  col += mix(pearl, bright, 0.5) * fres * 0.35;

  float quiet = smoothstep(0.0, 0.75, uv.x) * smoothstep(0.0, 0.55, uv.y);
  col = mix(deep * 1.1, col, 0.35 + 0.65 * quiet);

  col += (grainHash(gl_FragCoord.xy + vec2(u_time * 17.0)) - 0.5) * (1.0 + u_grain * 3.0) / 255.0;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export const FRAGMENT: Record<ShaderField, string> = {
  drift: HEAD + VALUE_NOISE + DRIFT,
  aurora: HEAD + SIMPLEX + AURORA,
  plasma: HEAD + PALETTE + PLASMA,
  glow: HEAD + SIMPLEX + GLOW,
  flow: HEAD + VALUE_NOISE + PALETTE + FLOW,
  silk: HEAD + PALETTE + SILK,
  smoke: HEAD + VALUE_NOISE + PALETTE + SMOKE,
  riso: HEAD + VALUE_NOISE + PALETTE + RISO,
  veil: HEAD + VALUE_NOISE + PALETTE + VEIL,
  lacquer: HEAD + LACQUER,
};

/**
 * The fields that cost more than the rest a pixel: drawn on a smaller budget,
 * never on a software renderer, and started only once the page has loaded,
 * so they never race the first paint.
 */
export const HEAVY: ReadonlySet<Field> = new Set<Field>(['lacquer']);

/** The fields whose light leans toward the pointer unless told not to. */
export const LEANS: ReadonlySet<Field> = new Set<Field>(['lacquer']);
