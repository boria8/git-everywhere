/**
 * Generates images/screenshot.png — a mock of the GitEverywhere VS Code sidebar.
 * Shows the results tree with commit → file → line structure.
 * No npm dependencies.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT  = resolve(ROOT, 'images', 'screenshot.png');

const W = 320, H = 520;
const px = new Uint8Array(W * H * 3); // RGB (no alpha — screenshot)

function put(x, y, r, g, b) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = r; px[i+1] = g; px[i+2] = b;
}
function fillRect(x, y, w, h, r, g, b) {
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++)
      put(x+dx, y+dy, r, g, b);
}
function hline(x, y, w, r, g, b) { fillRect(x, y, w, 1, r, g, b); }
function vline(x, y, h, r, g, b) { fillRect(x, y, 1, h, r, g, b); }

// ─── Tiny 5×7 bitmap font ────────────────────────────────────────────────────
const GLYPHS = {
  ' ':[[0,0,0,0,3]],
  'A':[[0,1,1,0,0],[1,0,0,1,0],[1,1,1,1,0],[1,0,0,1,0],[1,0,0,1,0]],
  'B':[[1,1,1,0,0],[1,0,0,1,0],[1,1,1,0,0],[1,0,0,1,0],[1,1,1,0,0]],
  'C':[[0,1,1,1,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[0,1,1,1,0]],
  'D':[[1,1,0,0,0],[1,0,1,0,0],[1,0,0,1,0],[1,0,1,0,0],[1,1,0,0,0]],
  'E':[[1,1,1,1,0],[1,0,0,0,0],[1,1,1,0,0],[1,0,0,0,0],[1,1,1,1,0]],
  'F':[[1,1,1,1,0],[1,0,0,0,0],[1,1,1,0,0],[1,0,0,0,0],[1,0,0,0,0]],
  'G':[[0,1,1,1,0],[1,0,0,0,0],[1,0,1,1,0],[1,0,0,1,0],[0,1,1,1,0]],
  'H':[[1,0,0,1,0],[1,0,0,1,0],[1,1,1,1,0],[1,0,0,1,0],[1,0,0,1,0]],
  'I':[[1,1,1,0,0],[0,1,0,0,0],[0,1,0,0,0],[0,1,0,0,0],[1,1,1,0,0]],
  'J':[[0,1,1,1,0],[0,0,1,0,0],[0,0,1,0,0],[1,0,1,0,0],[0,1,1,0,0]],
  'K':[[1,0,0,1,0],[1,0,1,0,0],[1,1,0,0,0],[1,0,1,0,0],[1,0,0,1,0]],
  'L':[[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,0]],
  'M':[[1,0,0,0,1],[1,1,0,1,1],[1,0,1,0,1],[1,0,0,0,1],[1,0,0,0,1]],
  'N':[[1,0,0,1,0],[1,1,0,1,0],[1,0,1,1,0],[1,0,0,1,0],[1,0,0,1,0]],
  'O':[[0,1,1,0,0],[1,0,0,1,0],[1,0,0,1,0],[1,0,0,1,0],[0,1,1,0,0]],
  'P':[[1,1,1,0,0],[1,0,0,1,0],[1,1,1,0,0],[1,0,0,0,0],[1,0,0,0,0]],
  'Q':[[0,1,1,0,0],[1,0,0,1,0],[1,0,1,1,0],[1,0,0,1,0],[0,1,1,1,0]],
  'R':[[1,1,1,0,0],[1,0,0,1,0],[1,1,1,0,0],[1,0,1,0,0],[1,0,0,1,0]],
  'S':[[0,1,1,1,0],[1,0,0,0,0],[0,1,1,0,0],[0,0,0,1,0],[1,1,1,0,0]],
  'T':[[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0]],
  'U':[[1,0,0,1,0],[1,0,0,1,0],[1,0,0,1,0],[1,0,0,1,0],[0,1,1,0,0]],
  'V':[[1,0,0,0,1],[1,0,0,0,1],[0,1,0,1,0],[0,1,0,1,0],[0,0,1,0,0]],
  'W':[[1,0,0,0,1],[1,0,0,0,1],[1,0,1,0,1],[1,1,0,1,1],[1,0,0,0,1]],
  'X':[[1,0,0,1,0],[0,1,1,0,0],[0,1,1,0,0],[0,1,1,0,0],[1,0,0,1,0]],
  'Y':[[1,0,0,1,0],[1,0,0,1,0],[0,1,1,0,0],[0,1,0,0,0],[0,1,0,0,0]],
  'Z':[[1,1,1,1,0],[0,0,1,0,0],[0,1,0,0,0],[1,0,0,0,0],[1,1,1,1,0]],
  'a':[[0,1,1,0,0],[0,0,0,1,0],[0,1,1,1,0],[1,0,0,1,0],[0,1,1,1,0]],
  'b':[[1,0,0,0,0],[1,0,0,0,0],[1,1,1,0,0],[1,0,0,1,0],[1,1,1,0,0]],
  'c':[[0,1,1,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[0,1,1,0,0]],
  'd':[[0,0,0,1,0],[0,0,0,1,0],[0,1,1,1,0],[1,0,0,1,0],[0,1,1,1,0]],
  'e':[[0,1,1,0,0],[1,0,0,1,0],[1,1,1,1,0],[1,0,0,0,0],[0,1,1,1,0]],
  'f':[[0,0,1,1,0],[0,1,0,0,0],[1,1,1,0,0],[0,1,0,0,0],[0,1,0,0,0]],
  'g':[[0,1,1,1,0],[1,0,0,1,0],[0,1,1,1,0],[0,0,0,1,0],[0,1,1,0,0]],
  'h':[[1,0,0,0,0],[1,0,0,0,0],[1,1,1,0,0],[1,0,0,1,0],[1,0,0,1,0]],
  'i':[[0,1,0,0,0],[0,0,0,0,0],[0,1,0,0,0],[0,1,0,0,0],[0,1,1,0,0]],
  'j':[[0,0,1,0,0],[0,0,0,0,0],[0,0,1,0,0],[0,0,1,0,0],[1,1,0,0,0]],
  'k':[[1,0,0,0,0],[1,0,1,0,0],[1,1,0,0,0],[1,0,1,0,0],[1,0,0,1,0]],
  'l':[[1,1,0,0,0],[0,1,0,0,0],[0,1,0,0,0],[0,1,0,0,0],[1,1,1,0,0]],
  'm':[[0,0,0,0,0],[1,0,1,0,0],[1,1,0,1,0],[1,0,0,1,0],[1,0,0,1,0]],
  'n':[[0,0,0,0,0],[1,1,1,0,0],[1,0,0,1,0],[1,0,0,1,0],[1,0,0,1,0]],
  'o':[[0,0,0,0,0],[0,1,1,0,0],[1,0,0,1,0],[1,0,0,1,0],[0,1,1,0,0]],
  'p':[[0,0,0,0,0],[1,1,1,0,0],[1,0,0,1,0],[1,1,1,0,0],[1,0,0,0,0]],
  'q':[[0,0,0,0,0],[0,1,1,1,0],[1,0,0,1,0],[0,1,1,1,0],[0,0,0,1,0]],
  'r':[[0,0,0,0,0],[0,1,1,1,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0]],
  's':[[0,0,0,0,0],[0,1,1,1,0],[0,1,1,0,0],[0,0,0,1,0],[1,1,1,0,0]],
  't':[[0,1,0,0,0],[1,1,1,0,0],[0,1,0,0,0],[0,1,0,0,0],[0,0,1,1,0]],
  'u':[[0,0,0,0,0],[1,0,0,1,0],[1,0,0,1,0],[1,0,0,1,0],[0,1,1,1,0]],
  'v':[[0,0,0,0,0],[1,0,0,1,0],[1,0,0,1,0],[0,1,1,0,0],[0,1,1,0,0]],
  'w':[[0,0,0,0,0],[1,0,0,0,1],[1,0,1,0,1],[1,1,0,1,1],[0,1,0,1,0]],
  'x':[[0,0,0,0,0],[1,0,0,1,0],[0,1,1,0,0],[0,1,1,0,0],[1,0,0,1,0]],
  'y':[[0,0,0,0,0],[1,0,0,1,0],[1,0,0,1,0],[0,1,1,1,0],[0,0,0,1,0]],
  'z':[[0,0,0,0,0],[1,1,1,1,0],[0,0,1,0,0],[0,1,0,0,0],[1,1,1,1,0]],
  '0':[[0,1,1,0,0],[1,0,0,1,0],[1,0,0,1,0],[1,0,0,1,0],[0,1,1,0,0]],
  '1':[[0,1,0,0,0],[1,1,0,0,0],[0,1,0,0,0],[0,1,0,0,0],[1,1,1,0,0]],
  '2':[[1,1,1,0,0],[0,0,0,1,0],[0,1,1,1,0],[1,0,0,0,0],[1,1,1,1,0]],
  '3':[[1,1,1,0,0],[0,0,0,1,0],[0,1,1,0,0],[0,0,0,1,0],[1,1,1,0,0]],
  '4':[[1,0,0,1,0],[1,0,0,1,0],[1,1,1,1,0],[0,0,0,1,0],[0,0,0,1,0]],
  '5':[[1,1,1,1,0],[1,0,0,0,0],[1,1,1,0,0],[0,0,0,1,0],[1,1,1,0,0]],
  '6':[[0,1,1,1,0],[1,0,0,0,0],[1,1,1,0,0],[1,0,0,1,0],[0,1,1,0,0]],
  '7':[[1,1,1,1,0],[0,0,0,1,0],[0,0,1,0,0],[0,1,0,0,0],[1,0,0,0,0]],
  '8':[[0,1,1,0,0],[1,0,0,1,0],[0,1,1,0,0],[1,0,0,1,0],[0,1,1,0,0]],
  '9':[[0,1,1,0,0],[1,0,0,1,0],[0,1,1,1,0],[0,0,0,1,0],[0,1,1,0,0]],
  '.':[[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,1,0,0,0]],
  ':':[[0,1,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,1,0,0,0]],
  '/':[[0,0,0,1,0],[0,0,1,0,0],[0,0,1,0,0],[0,1,0,0,0],[1,0,0,0,0]],
  '-':[[0,0,0,0,0],[0,0,0,0,0],[1,1,1,0,0],[0,0,0,0,0],[0,0,0,0,0]],
  '_':[[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[1,1,1,1,0]],
  '·':[[0,0,0,0,0],[0,0,0,0,0],[0,1,0,0,0],[0,0,0,0,0],[0,0,0,0,0]],
  '(': [[0,1,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[0,1,0,0,0]],
  ')': [[1,0,0,0,0],[0,1,0,0,0],[0,1,0,0,0],[0,1,0,0,0],[1,0,0,0,0]],
  '▼': [[1,1,1,1,1],[0,1,1,1,0],[0,0,1,0,0],[0,0,0,0,0],[0,0,0,0,0]],
  '▶': [[1,0,0,0,0],[1,1,0,0,0],[1,1,1,0,0],[1,1,0,0,0],[1,0,0,0,0]],
  '─': [[0,0,0,0,0],[0,0,0,0,0],[1,1,1,1,1],[0,0,0,0,0],[0,0,0,0,0]],
  '⚠': [[0,0,1,0,0],[0,1,1,1,0],[0,1,0,1,0],[0,1,1,1,0],[0,0,0,0,0]],
  '✓': [[0,0,0,0,1],[0,0,0,1,0],[0,0,1,0,0],[1,0,1,0,0],[0,1,0,0,0]],
};
const DEFAULT_GLYPH = [[1,1,1,0,0],[1,0,1,0,0],[1,1,1,0,0],[1,0,1,0,0],[1,1,1,0,0]];

function drawText(str, ox, oy, r, g, b, scale = 1) {
  let cx = ox;
  for (const ch of str) {
    const glyph = GLYPHS[ch] ?? DEFAULT_GLYPH;
    for (let row = 0; row < glyph.length; row++) {
      for (let col = 0; col < glyph[row].length; col++) {
        if (glyph[row][col]) {
          for (let sy = 0; sy < scale; sy++)
            for (let sx = 0; sx < scale; sx++)
              put(cx + col*scale + sx, oy + row*scale + sy, r, g, b);
        }
      }
    }
    cx += (glyph[0].length + 1) * scale;
  }
  return cx;
}

function textWidth(str, scale = 1) {
  return str.split('').reduce((w, ch) => {
    const g = GLYPHS[ch] ?? DEFAULT_GLYPH;
    return w + (g[0].length + 1) * scale;
  }, 0);
}

// ─── Colors ─────────────────────────────────────────────────────────────────
const BG     = [30, 30, 30];    // sidebar bg
const BG2    = [37, 37, 38];    // slightly lighter
const BG3    = [44, 44, 44];    // hover/selected
const FG     = [204, 204, 204]; // normal text
const FG2    = [153, 153, 153]; // dim text
const FG3    = [106, 153, 85];  // green (git commit icon)
const ORANGE = [206, 145, 60];  // orange text
const YELLOW = [220, 220, 100]; // branch name
const BLUE   = [86, 156, 214];  // filename
const PINK   = [197, 134, 192]; // line number
const GREEN  = [78, 201, 176];  // reachable badge
const HDR    = [37, 37, 38];    // group header bg
const SEP    = [60, 60, 60];    // separator

// ─── Layout ─────────────────────────────────────────────────────────────────
// Fill background
fillRect(0, 0, W, H, ...BG);

let y = 0;

// Top bar: "GITEVERYWHERE" title
fillRect(0, y, W, 28, ...BG2);
drawText('GITEVERYWHERE', 12, y+10, ...FG);
// search icon (simple magnifier)
drawText('(search)', W-70, y+10, ...FG2);
y += 28;
hline(0, y, W, ...SEP); y++;

// Search bar row
fillRect(0, y, W, 24, ...BG);
fillRect(8, y+4, W-16, 16, 50, 50, 50);
drawText('parseToken', 16, y+8, ...FG2);
y += 24;
hline(0, y, W, ...SEP); y++;

// Mode row
fillRect(0, y, W, 20, ...BG);
const modeLabel = 'Content  Deep';
drawText('Content', 12, y+7, 86, 156, 214);
drawText('Deep', 80, y+7, ...FG2);
y += 20;
hline(0, y, W, ...SEP); y += 4;

// ── Group: Reachable Commits (3) ───────────────────────────────────────────
fillRect(0, y, W, 18, ...HDR);
drawText('▼', 8, y+6, ...FG3);
drawText('Reachable Commits', 20, y+6, ...FG);
drawText('(3)', W-28, y+6, ...FG2);
y += 18;

// Commit 1 (expanded)
fillRect(0, y, W, 18, ...BG3);
drawText('▼', 12, y+6, ...FG3);
drawText('f3a1b2c', 24, y+6, ...ORANGE);
drawText('·', 24 + textWidth('f3a1b2c') + 4, y+6, ...FG2);
drawText('fix: parse edge case', 24 + textWidth('f3a1b2c') + 10, y+6, ...FG2);
y += 18;

// File child 1 (expanded with lines)
fillRect(0, y, W, 16, ...BG);
drawText('▼', 28, y+5, ...FG2);
drawText('tokenizer.ts', 42, y+5, ...BLUE);
drawText('src/', 42 + textWidth('tokenizer.ts') + 4, y+5, ...FG2);
y += 16;

// Line 1
fillRect(0, y, W, 14, ...BG);
drawText('─', 44, y+4, ...SEP);
drawText('L42', 52, y+4, ...PINK);
drawText('parseToken(input', 76, y+4, ...FG2);
y += 14;

// Line 2
fillRect(0, y, W, 14, ...BG);
drawText('─', 44, y+4, ...SEP);
drawText('L91', 52, y+4, ...PINK);
drawText('return parseToken', 76, y+4, ...FG2);
y += 14;

// File child 2 (collapsed)
fillRect(0, y, W, 16, ...BG);
drawText('▶', 28, y+5, ...FG2);
drawText('parser.ts', 42, y+5, ...BLUE);
drawText('src/utils/', 42 + textWidth('parser.ts') + 4, y+5, ...FG2);
y += 16;

// Commit 2 (flat — no paths)
fillRect(0, y, W, 18, ...BG);
drawText('─', 12, y+6, ...FG2);
drawText('9d4c3a1', 20, y+6, ...ORANGE);
drawText('refactor: cleanup', 20 + textWidth('9d4c3a1') + 6, y+6, ...FG2);
y += 18;

// Commit 3
fillRect(0, y, W, 18, ...BG);
drawText('▼', 12, y+6, ...FG3);
drawText('1a2b3c4', 24, y+6, ...ORANGE);
drawText('feat: add tokenizer', 24 + textWidth('1a2b3c4') + 6, y+6, ...FG2);
y += 18;

// File child
fillRect(0, y, W, 16, ...BG);
drawText('▶', 28, y+5, ...FG2);
drawText('tokenizer.ts', 42, y+5, ...BLUE);
drawText('src/', 42 + textWidth('tokenizer.ts') + 4, y+5, ...FG2);
y += 16;

hline(0, y, W, ...SEP); y += 4;

// ── Group: Reflog (1) ──────────────────────────────────────────────────────
fillRect(0, y, W, 18, ...HDR);
drawText('▼', 8, y+6, 220, 170, 50);   // warning orange for non-reachable
drawText('Reflog', 20, y+6, ...FG);
drawText('(1)', W-28, y+6, ...FG2);
y += 18;

// Reflog commit
fillRect(0, y, W, 18, ...BG);
drawText('▼', 12, y+6, 220, 170, 50);
drawText('7f9e2d1', 24, y+6, ...ORANGE);
drawText('WIP changes', 24 + textWidth('7f9e2d1') + 6, y+6, ...FG2);
y += 18;

// File child
fillRect(0, y, W, 16, ...BG);
drawText('▼', 28, y+5, ...FG2);
drawText('tokenizer.ts', 42, y+5, ...BLUE);
drawText('src/', 42 + textWidth('tokenizer.ts') + 4, y+5, ...FG2);
y += 16;

// Line
fillRect(0, y, W, 14, ...BG);
drawText('─', 44, y+4, ...SEP);
drawText('L42', 52, y+4, ...PINK);
drawText('parseToken(input', 76, y+4, ...FG2);
y += 14;

hline(0, y, W, ...SEP); y += 4;

// ── Group: Stash (1) collapsed ─────────────────────────────────────────────
fillRect(0, y, W, 18, ...HDR);
drawText('▶', 8, y+6, 220, 170, 50);
drawText('Stash', 20, y+6, ...FG);
drawText('(1)', W-28, y+6, ...FG2);
y += 18;

hline(0, y, W, ...SEP); y += 4;

// ── Status bar ─────────────────────────────────────────────────────────────
fillRect(0, H-20, W, 20, 0, 122, 204);
drawText('GitEverywhere', 8, H-14, 255, 255, 255);
drawText('5 results', W-58, H-14, 200, 230, 255);

// ─── Encode PNG (RGB) ────────────────────────────────────────────────────────
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

const ihdr = Buffer.allocUnsafe(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8]=8; ihdr[9]=2; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0; // RGB

const raw = Buffer.allocUnsafe(H * (1 + W * 3));
for (let row = 0; row < H; row++) {
  raw[row * (1 + W * 3)] = 0;
  for (let col = 0; col < W; col++) {
    const pi = (row * W + col) * 3;
    const ri = row * (1 + W * 3) + 1 + col * 3;
    raw[ri] = px[pi]; raw[ri+1] = px[pi+1]; raw[ri+2] = px[pi+2];
  }
}

const PNG = Buffer.concat([
  Buffer.from([137,80,78,71,13,10,26,10]),
  pngChunk('IHDR', ihdr),
  pngChunk('IDAT', deflateSync(raw, { level: 9 })),
  pngChunk('IEND', Buffer.alloc(0)),
]);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, PNG);
console.log(`Generated ${OUT} (${PNG.length} bytes, ${W}x${H})`);
