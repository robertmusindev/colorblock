import { writeFileSync } from 'fs';

// Character bounding box: 0.7 wide, 1.8 tall, 0.5 deep
const W = 0.35, H = 0.9, D = 0.25;

const positions = [];
const normals = [];
const indices = [];

function addFace(verts, nx, ny, nz) {
  const base = positions.length / 3;
  for (const v of verts) positions.push(...v);
  for (let i = 0; i < 4; i++) normals.push(nx, ny, nz);
  indices.push(base, base+1, base+2, base, base+2, base+3);
}

// 6 faces, CCW winding, outward normals
addFace([[-W,H,D],[W,H,D],[W,H,-D],[-W,H,-D]],    0, 1, 0);  // +Y top
addFace([[-W,-H,-D],[W,-H,-D],[W,-H,D],[-W,-H,D]], 0,-1, 0);  // -Y bottom
addFace([[W,H,D],[W,-H,D],[W,-H,-D],[W,H,-D]],     1, 0, 0);  // +X right
addFace([[-W,H,-D],[-W,-H,-D],[-W,-H,D],[-W,H,D]],-1, 0, 0); // -X left
addFace([[-W,H,D],[-W,-H,D],[W,-H,D],[W,H,D]],     0, 0, 1);  // +Z front
addFace([[W,H,-D],[W,-H,-D],[-W,-H,-D],[-W,H,-D]], 0, 0,-1);  // -Z back

// --- Binary buffer ---
const posBytes = 24 * 3 * 4;  // 288
const normBytes = 24 * 3 * 4; // 288
const idxBytes = 36 * 2;      // 72  (36 indices * uint16)
const totalBytes = posBytes + normBytes + idxBytes; // 648

const bin = Buffer.allocUnsafe(totalBytes);
let off = 0;
for (const f of positions) { bin.writeFloatLE(f, off); off += 4; }
for (const f of normals)   { bin.writeFloatLE(f, off); off += 4; }
for (const i of indices)   { bin.writeUInt16LE(i, off); off += 2; }

// --- GLTF JSON ---
const gltf = {
  asset: { version: "2.0", generator: "generate_cube.mjs" },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0, name: "CharacterCube" }],
  meshes: [{
    name: "CharacterCube",
    primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2 }]
  }],
  accessors: [
    { bufferView: 0, componentType: 5126, count: 24, type: "VEC3",
      min: [-W, -H, -D], max: [W, H, D] },
    { bufferView: 1, componentType: 5126, count: 24, type: "VEC3" },
    { bufferView: 2, componentType: 5123, count: 36, type: "SCALAR" }
  ],
  bufferViews: [
    { buffer: 0, byteOffset: 0,                  byteLength: posBytes  },
    { buffer: 0, byteOffset: posBytes,            byteLength: normBytes },
    { buffer: 0, byteOffset: posBytes + normBytes, byteLength: idxBytes }
  ],
  buffers: [{ byteLength: totalBytes }]
};

const jsonRaw = JSON.stringify(gltf);
// JSON chunk must be padded to 4-byte boundary with spaces
const jsonPad = Math.ceil(jsonRaw.length / 4) * 4 - jsonRaw.length;
const jsonBuf = Buffer.from(jsonRaw + ' '.repeat(jsonPad), 'utf8');

// BIN chunk already 648 bytes (divisible by 4 = no padding)

const HEADER = 12;
const CHUNK_HEADER = 8;
const totalGlb = HEADER + CHUNK_HEADER + jsonBuf.length + CHUNK_HEADER + totalBytes;

const glb = Buffer.allocUnsafe(totalGlb);
let p = 0;

// GLB header
glb.writeUInt32LE(0x46546C67, p); p += 4; // "glTF"
glb.writeUInt32LE(2, p);          p += 4; // version 2
glb.writeUInt32LE(totalGlb, p);   p += 4; // total length

// Chunk 0: JSON
glb.writeUInt32LE(jsonBuf.length, p); p += 4;
glb.writeUInt32LE(0x4E4F534A, p);    p += 4; // "JSON"
jsonBuf.copy(glb, p); p += jsonBuf.length;

// Chunk 1: BIN
glb.writeUInt32LE(totalBytes, p); p += 4;
glb.writeUInt32LE(0x004E4942, p); p += 4; // "BIN\0"
bin.copy(glb, p);

writeFileSync('character_cube.glb', glb);
console.log(`character_cube.glb generato (${totalGlb} bytes)`);
console.log(`Dimensioni mesh: ${W*2}W x ${H*2}H x ${D*2}D`);
