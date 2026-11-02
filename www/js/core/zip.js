// Minimal ZIP reader (stored + deflate) built on the native DecompressionStream.

export async function readZip(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  const dv = new DataView(buf.buffer);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("Arquivo ZIP inválido ou corrompido");
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const entries = [];
  const dec = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error("Diretório central do ZIP inválido");
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true);
    const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
    const off = dv.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nlen));
    entries.push({ name, method, csize, usize, off, dir: name.endsWith("/") });
    p += 46 + nlen + xlen + clen;
  }
  return {
    entries,
    async read(e) {
      const lnl = dv.getUint16(e.off + 26, true), lxl = dv.getUint16(e.off + 28, true);
      const start = e.off + 30 + lnl + lxl;
      const data = buf.subarray(start, start + e.csize);
      if (e.method === 0) return new Blob([data]);
      if (e.method !== 8) throw new Error(`Compressão ZIP não suportada (método ${e.method})`);
      const ds = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return new Response(ds).blob();
    },
  };
}
