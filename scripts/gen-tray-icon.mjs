// Generates the menu-bar tray icon as a macOS "template" image: black shape in
// the alpha channel, which macOS recolours for light/dark menu bars. No image
// deps — we hand-encode a grayscale+alpha PNG (color type 4).
//
// The glyph is a simple clock: a ring with an hour hand (up) and minute hand
// (right). Regenerate with `pnpm gen:icon`.
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, '..', 'resources')

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

// Smooth 0..1 coverage from a signed distance (in px) to an edge; ~1px band.
function edge(d) {
  return clamp01(0.5 - d)
}

function distToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax
  const aby = by - ay
  const apx = px - ax
  const apy = py - ay
  const len2 = abx * abx + aby * aby || 1
  let t = (apx * abx + apy * aby) / len2
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const cx = ax + t * abx
  const cy = ay + t * aby
  return Math.hypot(px - cx, py - cy)
}

function renderClock(size) {
  const c = (size - 1) / 2
  const rOuter = size * 0.44
  const ringHalf = size * 0.06 // half thickness of the ring stroke
  const handHalf = size * 0.05 // half thickness of a hand
  const data = Buffer.alloc(size * size * 2)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - c
      const dy = y - c
      const dist = Math.hypot(dx, dy)

      // Ring: coverage near the |dist - rOuter| == ringHalf band.
      const ring = edge(Math.abs(dist - rOuter) - ringHalf)

      // Hands from the centre.
      const hourEnd = { x: c, y: c - rOuter * 0.62 }
      const minEnd = { x: c + rOuter * 0.72, y: c }
      const hour = edge(distToSegment(x, y, c, c, hourEnd.x, hourEnd.y) - handHalf)
      const min = edge(distToSegment(x, y, c, c, minEnd.x, minEnd.y) - handHalf)

      const alpha = clamp01(Math.max(ring, hour, min))
      const i = (y * size + x) * 2
      data[i] = 0 // gray = black
      data[i + 1] = Math.round(alpha * 255)
    }
  }
  return data
}

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let k = 0; k < 8; k++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, body) {
  const typeBuf = Buffer.from(type, 'ascii')
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(body.length, 0)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, body])), 0)
  return Buffer.concat([lenBuf, typeBuf, body, crcBuf])
}

function encodePng(size, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 4 // color type: grayscale + alpha
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace

  // Prepend a filter byte (0 = none) to each scanline.
  const stride = size * 2
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync(outDir, { recursive: true })
for (const [size, name] of [
  [16, 'trayTemplate.png'],
  [32, 'trayTemplate@2x.png'],
]) {
  const png = encodePng(size, renderClock(size))
  writeFileSync(resolve(outDir, name), png)
  console.log(`wrote resources/${name} (${size}x${size}, ${png.length} bytes)`)
}
