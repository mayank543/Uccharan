import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const targetFile = resolve("node_modules/@heyputer/puter.js/dist/puter.cjs")
const original = readFileSync(targetFile, "utf8")
const needle =
  'tn||(globalThis.ReadableByteStreamController||await import("https://unpkg.com/web-streams-polyfill@3.0.2/dist/polyfill.js"),tn=await import("https://puter-net.b-cdn.net/rustls.js"),await tn.default("https://puter-net.b-cdn.net/rustls.wasm"))'
const replacement =
  'tn||(tn={default:async()=>{},ClientConnection:class{constructor(){throw new Error("PTLS is unavailable in extension builds.")}},TlsClientConnection:class{constructor(){throw new Error("PTLS is unavailable in extension builds.")}}})'

if (!original.includes(needle)) {
  process.exit(0)
}

writeFileSync(targetFile, original.replace(needle, replacement))
