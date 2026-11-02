// Dependency-free fixture codec: non-interlaced, 8-bit RGB/RGBA PNG only.
const { deflateSync, inflateSync } = require('node:zlib')
const { readFileSync, writeFileSync } = require('node:fs')
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
function crc (data) {
  let c = 0xffffffff
  for (const b of data) {
    c ^= b
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0)
  }
  return (c ^ 0xffffffff) >>> 0
}
function chunk (name, bytes) {
  const type = Buffer.from(name); const out = Buffer.alloc(bytes.length + 12)
  out.writeUInt32BE(bytes.length); type.copy(out, 4); bytes.copy(out, 8)
  out.writeUInt32BE(crc(Buffer.concat([type, bytes])), bytes.length + 8)
  return out
}
function write (path, image) {
  const { width: w, height: h, data } = image
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6
  const raw = Buffer.alloc(h * (w * 4 + 1))
  for (let y = 0; y < h; y++) Buffer.from(data.subarray(y * w * 4, (y + 1) * w * 4)).copy(raw, y * (w * 4 + 1) + 1)
  writeFileSync(path, Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]))
}
function read (path) {
  const bytes = readFileSync(path)
  if (!bytes.subarray(0, 8).equals(signature)) throw new Error('Not PNG')
  let w; let h; let channels; const idat = []
  for (let p = 8; p < bytes.length;) {
    const n = bytes.readUInt32BE(p); const type = bytes.toString('ascii', p + 4, p + 8); const data = bytes.subarray(p + 8, p + 8 + n)
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4); channels = data[9] === 6 ? 4 : data[9] === 2 ? 3 : 0
      if (data[8] !== 8 || !channels || data[12]) throw new Error('Fixture PNG must be non-interlaced 8-bit RGB/RGBA')
    }
    if (type === 'IDAT') idat.push(data)
    p += n + 12
  }
  const raw = inflateSync(Buffer.concat(idat)); const stride = w * channels; const decoded = Buffer.alloc(h * stride)
  const paeth = (a, b, c) => { const p = a + b - c; const da = Math.abs(p - a); const db = Math.abs(p - b); const dc = Math.abs(p - c); return da <= db && da <= dc ? a : db <= dc ? b : c }
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)]
    if (filter > 4) throw new Error('Bad PNG filter')
    for (let x = 0; x < stride; x++) {
      const k = y * stride + x; const a = x >= channels ? decoded[k - channels] : 0; const b = y ? decoded[k - stride] : 0; const c = y && x >= channels ? decoded[k - stride - channels] : 0
      decoded[k] = raw[y * (stride + 1) + x + 1] + [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter]
    }
  }
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) { for (let c = 0; c < 3; c++) data[i * 4 + c] = decoded[i * channels + c]; data[i * 4 + 3] = channels === 4 ? decoded[i * channels + 3] : 255 }
  return { width: w, height: h, data }
}
module.exports = { read, write }
