/**
 * Generates images/icon.png — a 128x128 RGBA PNG for the GitEverywhere VS Code extension.
 * No npm dependencies: uses only Node.js built-ins (zlib, fs, path).
 *
 * Design: dark rounded-rect background, white magnifying glass, orange git-branch inside lens.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT  = resolve(ROOT, 'images', 'icon.png');

// ─── PNG helpers ────────────────────────────────────────────────────────────

const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[i] = c;
}
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf  = Buffer.allocUnsafe(4); lenBuf.writeUInt32BE(data.length);
  const crcBuf  = Buffer.allocUnsafe(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// ─── Canvas ─────────────────────────────────────────────────────────────────

const W = 128, H = 128;
const px = new Uint8Array(W * H * 4); // RGBA

function blend(i, r, g, b, a) {
  const fa = a / 255, fb = px[i + 3] / 255;
  const ao = fa + fb * (1 - fa);
  if (ao < 0.0001) { px[i]=px[i+1]=px[i+2]=px[i+3]=0; return; }
  px[i]   = Math.round((r * fa + px[i]   * fb * (1 - fa)) / ao);
  px[i+1] = Math.round((g * fa + px[i+1] * fb * (1 - fa)) / ao);
  px[i+2] = Math.round((b * fa + px[i+2] * fb * (1 - fa)) / ao);
  px[i+3] = Math.round(ao * 255);
}
function put(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  blend((y * W + x) * 4, r, g, b, a);
}

// Anti-aliased circle fill
function fillCircle(cx, cy, r, [r0,g0,b0], alpha = 255) {
  const ri = Math.ceil(r);
  for (let y = -ri; y <= ri; y++) {
    for (let x = -ri; x <= ri; x++) {
      const d = Math.sqrt(x*x + y*y);
      if (d <= r) {
        const aa = d > r - 1 ? Math.round((r - d) * 255) : alpha;
        put(Math.round(cx+x), Math.round(cy+y), r0, g0, b0, Math.min(alpha, aa));
      }
    }
  }
}

// Anti-aliased ring
function drawRing(cx, cy, r, thickness, [r0,g0,b0]) {
  const outer = r, inner = r - thickness;
  const ri = Math.ceil(outer + 1);
  for (let y = -ri; y <= ri; y++) {
    for (let x = -ri; x <= ri; x++) {
      const d = Math.sqrt(x*x + y*y);
      if (d >= inner - 1 && d <= outer + 1) {
        let alpha = 255;
        if (d < inner) alpha = Math.round((d - (inner - 1)) * 255);
        else if (d > outer) alpha = Math.round((outer + 1 - d) * 255);
        if (alpha > 0) put(Math.round(cx+x), Math.round(cy+y), r0, g0, b0, alpha);
      }
    }
  }
}

// Thick line via capsule
function drawLine(x1, y1, x2, y2, r, color) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx*dx + dy*dy);
  if (len < 0.001) return;
  const nx = dy/len, ny = -dx/len;
  const steps = Math.ceil(len) + 1;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    fillCircle(x1 + dx*t, y1 + dy*t, r, color);
  }
  fillCircle(x1, y1, r, color);
  fillCircle(x2, y2, r, color);
}

// ─── Draw ───────────────────────────────────────────────────────────────────

const BG      = [22, 27, 34];    // #161b22  GitHub dark
const BGINNER = [36, 41, 50];    // slightly lighter lens interior
const WHITE   = [235, 235, 235];
const ORANGE  = [240, 140, 64];  // git orange

// 1. Fill solid background
for (let i = 0; i < W * H; i++) {
  px[i*4] = BG[0]; px[i*4+1] = BG[1]; px[i*4+2] = BG[2]; px[i*4+3] = 255;
}

// 2. Rounded corners (radius 18) → make transparent
const CR = 18;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    let outside = false;
    if (x < CR   && y < CR)           outside = Math.sqrt((x-CR)**2   + (y-CR)**2)   > CR;
    if (x >= W-CR && y < CR)          outside = outside || Math.sqrt((x-(W-CR-1))**2 + (y-CR)**2)   > CR;
    if (x < CR   && y >= H-CR)        outside = outside || Math.sqrt((x-CR)**2   + (y-(H-CR-1))**2) > CR;
    if (x >= W-CR && y >= H-CR)       outside = outside || Math.sqrt((x-(W-CR-1))**2 + (y-(H-CR-1))**2) > CR;
    if (outside) px[(y*W+x)*4+3] = 0;
  }
}

// 3. Magnifying glass lens — center (50, 50), radius 32
const LX = 50, LY = 50, LR = 32;
fillCircle(LX, LY, LR - 5, BGINNER);          // lens interior
drawRing(LX, LY, LR, 6, WHITE);               // lens border

// 4. Handle — from lens edge to corner, thick rounded
const hx1 = LX + LR * 0.68, hy1 = LY + LR * 0.68;
drawLine(hx1, hy1, hx1 + 22, hy1 + 22, 5, WHITE);

// 5. Git branch inside lens
//    trunk: bottom commit → up → branches to two tips
const TX = LX - 4;
const commitA = [TX,      LY + 12]; // bottom
const commitB = [TX,      LY - 8 ]; // middle (branch point)
const commitC = [TX - 10, LY - 20]; // top-left (main)
const commitD = [TX + 10, LY - 20]; // top-right (branch)

drawLine(commitA[0], commitA[1], commitB[0], commitB[1], 2, ORANGE);
drawLine(commitB[0], commitB[1], commitC[0], commitC[1], 2, ORANGE);
drawLine(commitB[0], commitB[1], commitD[0], commitD[1], 2, ORANGE);

fillCircle(commitA[0], commitA[1], 4.5, ORANGE);
fillCircle(commitB[0], commitB[1], 4, ORANGE);
fillCircle(commitC[0], commitC[1], 4.5, ORANGE);
fillCircle(commitD[0], commitD[1], 4.5, ORANGE);

// ─── Encode PNG ─────────────────────────────────────────────────────────────

const ihdr = Buffer.allocUnsafe(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8]=8; ihdr[9]=6; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0; // RGBA

// Raw scanlines: 1 filter byte (0) + W*4 bytes per row
const raw = Buffer.allocUnsafe(H * (1 + W * 4));
for (let y = 0; y < H; y++) {
  const row = y * (1 + W * 4);
  raw[row] = 0; // filter: None
  for (let x = 0; x < W; x++) {
    const pi = (y * W + x) * 4;
    raw[row + 1 + x*4]     = px[pi];
    raw[row + 1 + x*4 + 1] = px[pi+1];
    raw[row + 1 + x*4 + 2] = px[pi+2];
    raw[row + 1 + x*4 + 3] = px[pi+3];
  }
}

const PNG = Buffer.concat([
  Buffer.from([137,80,78,71,13,10,26,10]), // PNG signature
  pngChunk('IHDR', ihdr),
  pngChunk('IDAT', deflateSync(raw, { level: 9 })),
  pngChunk('IEND', Buffer.alloc(0)),
]);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, PNG);
console.log(`Generated ${OUT} (${PNG.length} bytes)`);
