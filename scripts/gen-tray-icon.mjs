// Generates the menu-bar tray icon as a macOS *template* PNG (alpha-only mask;
// the system tints it for light/dark menu bars). Draws a simple clock glyph:
// a ring with two hands. Run: `node scripts/gen-tray-icon.mjs`.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, '../resources')
mkdirSync(outDir, { recursive: true })

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const body = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body) >>> 0, 0)
  return Buffer.concat([len, body, crc])
}

const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return c ^ 0xffffffff
}

function renderClock(size) {
  // RGBA, black pixels with alpha forming the glyph.
  const px = Buffer.alloc(size * size * 4, 0)
  const cx = (size - 1) / 2
  const cy = (size - 1) / 2
  const r = size * 0.42
  const ringW = Math.max(1, size * 0.09)
  const set = (x, y, a) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const i = (y * size + x) * 4
    const prev = px[i + 3]
    const alpha = Math.min(255, prev + a)
    px[i + 3] = alpha
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx
      const dy = y - cy
      const dist = Math.hypot(dx, dy)
      // ring
      if (Math.abs(dist - r) <= ringW / 2) set(x, y, 255)
      // hands: 12 o'clock (up) and 3 o'clock (right)
      if (dx >= 0 && dx <= ringW / 2 + 0.3 && dy <= 0 && dy >= -r * 0.7) set(x, y, 255)
      if (dy >= -ringW / 2 - 0.3 && dy <= 0 && dx >= 0 && dx <= r * 0.55) set(x, y, 255)
    }
  }
  return px
}

function writePng(size, filename) {
  const raw = renderClock(size)
  // Add per-row filter byte (0 = none).
  const stride = size * 4
  const filtered = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    filtered[y * (stride + 1)] = 0
    raw.copy(filtered, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const png = Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(filtered)),
    chunk('IEND', Buffer.alloc(0))
  ])
  writeFileSync(resolve(outDir, filename), png)
  console.log('wrote', filename, png.length, 'bytes')
}

writePng(16, 'trayTemplate.png')
writePng(32, 'trayTemplate@2x.png')
