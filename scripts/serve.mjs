// Zero-dependency static server for development and local use.
// Usage: node scripts/serve.mjs [port]  ->  http://localhost:8080  (LAN: http://<ip>:8080)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "www");
const port = +(process.argv[2] || process.env.PORT || 8080);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".wasm": "application/wasm", ".bin": "application/octet-stream", ".img": "application/octet-stream", ".bzImage": "application/octet-stream" };

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(root, path.normalize(p));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { "content-type": "text/plain" }); return res.end("404"); }
    const headers = { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "content-length": st.size, "cache-control": "no-cache", "accept-ranges": "bytes" };
    const range = req.headers.range?.match(/bytes=(\d+)-(\d*)/);
    if (range) {
      const start = +range[1], end = range[2] ? +range[2] : st.size - 1;
      res.writeHead(206, { ...headers, "content-length": end - start + 1, "content-range": `bytes ${start}-${end}/${st.size}` });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, headers);
    fs.createReadStream(file).pipe(res);
  });
}).listen(port, "0.0.0.0", () => {
  const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === "IPv4" && !i.internal).map((i) => i.address);
  console.log(`Virtual PC rodando em http://localhost:${port}`);
  ips.forEach((ip) => console.log(`  na rede local: http://${ip}:${port}`));
});
