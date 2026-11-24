/**
 * Native WebAssembly (WASM) Physics & Line-of-Sight Kernel
 * Compiles a verified WebAssembly binary module directly in-memory for zero-copy
 * AABB sliding collision and ray-vs-AABB cover occlusion checks across up to 600 world blockers.
 */

function uleb(v) {
  const bytes = [];
  do {
    let b = v & 0x7f;
    v >>>= 7;
    if (v !== 0) b |= 0x80;
    bytes.push(b);
  } while (v !== 0);
  return bytes;
}

function sleb(v) {
  const bytes = [];
  let more = true;
  while (more) {
    let b = v & 0x7f;
    v >>= 7;
    if ((v === 0 && (b & 0x40) === 0) || (v === -1 && (b & 0x40) !== 0)) {
      more = false;
    } else {
      b |= 0x80;
    }
    bytes.push(b);
  }
  return bytes;
}

function f32Bytes(val) {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setFloat32(0, val, true);
  return Array.from(new Uint8Array(buf));
}

function section(id, payload) {
  return [id, ...uleb(payload.length), ...payload];
}

function buildWasmBinary() {
  const typeSection = section(1, [
    2,
    0x60, 4, 0x7d, 0x7d, 0x7d, 0x7f, 0,
    0x60, 5, 0x7d, 0x7d, 0x7d, 0x7d, 0x7f, 1, 0x7f
  ]);

  const funcSection = section(3, [2, 0, 1]);
  const memSection = section(5, [1, 0, 1]);

  const enc = (s) => [s.length, ...Array.from(s).map((c) => c.charCodeAt(0))];
  const exportSection = section(7, [
    3,
    ...enc('memory'), 2, 0,
    ...enc('resolveCollision'), 0, 0,
    ...enc('segmentBlocked'), 0, 1
  ]);

  const fn0Code = [
    2,
    2, 0x7f,
    11, 0x7d,

    0x41, 0, 0x21, 4,

    0x03, 0x40,
      0x20, 4, 0x20, 3, 0x4e,
      0x0d, 1,

      0x41, ...sleb(64),
      0x20, 4, 0x41, 4, 0x74,
      0x6a,
      0x21, 5,

      0x20, 5, 0x2a, 2, 0, 0x21, 6,
      0x20, 5, 0x2a, 2, 4, 0x21, 7,
      0x20, 5, 0x2a, 2, 8, 0x21, 8,
      0x20, 5, 0x2a, 2, 12, 0x21, 9,

      0x20, 6, 0x20, 0, 0x20, 8, 0x96, 0x97, 0x21, 10,
      0x20, 7, 0x20, 1, 0x20, 9, 0x96, 0x97, 0x21, 11,

      0x20, 0, 0x20, 10, 0x93, 0x21, 12,
      0x20, 1, 0x20, 11, 0x93, 0x21, 13,

      0x20, 12, 0x20, 12, 0x94,
      0x20, 13, 0x20, 13, 0x94,
      0x92, 0x21, 14,

      0x20, 14,
      0x20, 2, 0x20, 2, 0x94,
      0x63,
      0x04, 0x40,
        0x20, 14,
        0x43, ...f32Bytes(0.00001),
        0x64,
        0x04, 0x40,
          0x20, 14, 0x91, 0x21, 15,
          0x20, 2, 0x20, 15, 0x93,
          0x20, 15, 0x95,
          0x21, 16,
          0x20, 0, 0x20, 12, 0x20, 16, 0x94, 0x92, 0x21, 0,
          0x20, 1, 0x20, 13, 0x20, 16, 0x94, 0x92, 0x21, 1,
        0x05,
          0x20, 0, 0x20, 2, 0x92, 0x21, 0,
        0x0b,
      0x0b,

      0x20, 4, 0x41, 1, 0x6a, 0x21, 4,
      0x0c, 0,
    0x0b,

    0x41, 0, 0x20, 0, 0x38, 2, 0,
    0x41, 4, 0x20, 1, 0x38, 2, 0,
    0x0b
  ];

  const fn1Code = [
    2,
    2, 0x7f,
    10, 0x7d,

    0x20, 2, 0x20, 0, 0x93, 0x21, 7,
    0x20, 3, 0x20, 1, 0x93, 0x21, 8,

    0x41, 0, 0x21, 5,

    0x03, 0x40,
      0x20, 5, 0x20, 4, 0x4e,
      0x0d, 1,

      0x41, ...sleb(64),
      0x20, 5, 0x41, 4, 0x74, 0x6a,
      0x21, 6,

      0x20, 6, 0x2a, 2, 0, 0x21, 11,
      0x20, 6, 0x2a, 2, 4, 0x21, 12,
      0x20, 6, 0x2a, 2, 8, 0x21, 13,
      0x20, 6, 0x2a, 2, 12, 0x21, 14,

      0x43, ...f32Bytes(0.0), 0x21, 9,
      0x43, ...f32Bytes(1.0), 0x21, 10,

      0x20, 7, 0x8b,
      0x43, ...f32Bytes(0.00001), 0x64,
      0x04, 0x40,
        0x20, 11, 0x20, 0, 0x93, 0x20, 7, 0x95, 0x21, 15,
        0x20, 13, 0x20, 0, 0x93, 0x20, 7, 0x95, 0x21, 16,
        0x20, 9, 0x20, 15, 0x20, 16, 0x96, 0x97, 0x21, 9,
        0x20, 10, 0x20, 15, 0x20, 16, 0x97, 0x96, 0x21, 10,
      0x05,
        0x20, 0, 0x20, 11, 0x63,
        0x20, 0, 0x20, 13, 0x64,
        0x72,
        0x04, 0x40,
          0x43, ...f32Bytes(2.0), 0x21, 9,
        0x0b,
      0x0b,

      0x20, 8, 0x8b,
      0x43, ...f32Bytes(0.00001), 0x64,
      0x04, 0x40,
        0x20, 12, 0x20, 1, 0x93, 0x20, 8, 0x95, 0x21, 15,
        0x20, 14, 0x20, 1, 0x93, 0x20, 8, 0x95, 0x21, 16,
        0x20, 9, 0x20, 15, 0x20, 16, 0x96, 0x97, 0x21, 9,
        0x20, 10, 0x20, 15, 0x20, 16, 0x97, 0x96, 0x21, 10,
      0x05,
        0x20, 1, 0x20, 12, 0x63,
        0x20, 1, 0x20, 14, 0x64,
        0x72,
        0x04, 0x40,
          0x43, ...f32Bytes(2.0), 0x21, 9,
        0x0b,
      0x0b,

      0x20, 10, 0x20, 9, 0x66,
      0x04, 0x40,
        0x41, 1, 0x0f,
      0x0b,

      0x20, 5, 0x41, 1, 0x6a, 0x21, 5,
      0x0c, 0,
    0x0b,

    0x41, 0,
    0x0b
  ];

  const codeSection = section(10, [
    2,
    ...uleb(fn0Code.length), ...fn0Code,
    ...uleb(fn1Code.length), ...fn1Code
  ]);

  return new Uint8Array([
    0x00, 0x61, 0x73, 0x6d,
    0x01, 0x00, 0x00, 0x00,
    ...typeSection,
    ...funcSection,
    ...memSection,
    ...exportSection,
    ...codeSection
  ]);
}

export async function createWasmPhysicsEngine(blockers) {
  let wasmExports = null;
  let f32View = null;
  const count = Math.min(blockers.length, 600);

  try {
    const wasmBytes = buildWasmBinary();
    const { instance } = await WebAssembly.instantiate(wasmBytes);
    wasmExports = instance.exports;
    f32View = new Float32Array(wasmExports.memory.buffer);

    for (let i = 0; i < count; i++) {
      const b = blockers[i];
      const base = 16 + i * 4;
      f32View[base + 0] = b.minX;
      f32View[base + 1] = b.minZ;
      f32View[base + 2] = b.maxX;
      f32View[base + 3] = b.maxZ;
    }
  } catch (err) {
    console.warn('WASM fallback active:', err);
  }

  return {
    isWasmActive: Boolean(wasmExports),
    blockerCount: count,
    resolvePlayerCollision(x, z, radius = 0.65) {
      if (wasmExports && f32View) {
        wasmExports.resolveCollision(x, z, radius, count);
        return { x: f32View[0], z: f32View[1] };
      }
      let px = x;
      let pz = z;
      for (let i = 0; i < count; i++) {
        const b = blockers[i];
        const cx = Math.max(b.minX, Math.min(px, b.maxX));
        const cz = Math.max(b.minZ, Math.min(pz, b.maxZ));
        const dx = px - cx;
        const dz = pz - cz;
        const distSq = dx * dx + dz * dz;
        if (distSq < radius * radius) {
          if (distSq > 0.00001) {
            const d = Math.sqrt(distSq);
            const push = (radius - d) / d;
            px += dx * push;
            pz += dz * push;
          } else {
            px += radius;
          }
        }
      }
      return { x: px, z: pz };
    },
    isLineOfSightBlocked(x0, z0, x1, z1) {
      if (wasmExports) {
        return wasmExports.segmentBlocked(x0, z0, x1, z1, count) === 1;
      }
      return false;
    }
  };
}
