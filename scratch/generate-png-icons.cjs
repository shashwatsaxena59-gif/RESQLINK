const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

function createPng(width, height) {
  // Simple CRC32 implementation
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    crcTable[n] = c;
  }

  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(4 + 4 + len + 4);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);
    const crcBuf = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    buf.writeUInt32BE(crc32(crcBuf), 8 + len);
    return buf;
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Raw image data: filter byte (0) + 4 bytes per pixel (RGBA)
  const rowBytes = 1 + width * 4;
  const rawData = Buffer.alloc(rowBytes * height);

  const cx = width / 2;
  const cy = height / 2;
  const rOuter = width * 0.45;
  const rShield = width * 0.32;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0; // filter None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Default background: dark navy #0c1827
      let r = 12, g = 24, b = 39, a = 255;

      // Rounded rect border
      const cornerR = width * 0.18;
      const innerX = Math.max(0, Math.abs(dx) - (cx - cornerR));
      const innerY = Math.max(0, Math.abs(dy) - (cy - cornerR));
      if (Math.sqrt(innerX * innerX + innerY * innerY) > cornerR) {
        a = 0; // Transparent outside corner
      }

      if (a > 0) {
        // Red Emergency Shield / Cross in center
        const inCrossV = Math.abs(dx) <= width * 0.08 && Math.abs(dy) <= height * 0.22;
        const inCrossH = Math.abs(dx) <= width * 0.22 && Math.abs(dy) <= height * 0.08;
        if (inCrossV || inCrossH) {
          r = 239; g = 68; b = 68; // #ef4444
        } else if (dist <= rShield) {
          // Inner shield glow
          r = 30; g = 41; b = 59; // slate-800
        } else if (dist <= rOuter && dist >= rOuter - 4) {
          // Cyan signal wave
          r = 56; g = 189; b = 248; // #38bdf8
        }
      }

      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

const iconsDir = path.join(__dirname, '../public/icons');
fs.mkdirSync(iconsDir, { recursive: true });

fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), createPng(192, 192));
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), createPng(512, 512));
fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon.png'), createPng(180, 180));
console.log('Generated PNG icons successfully.');
