import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_BYTES = 2 * 1024 * 1024;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const DENIED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".test", ".invalid", ".example"];

function ipv4Number(address: string): number[] | null {
  const parts = address.split(".").map(Number);
  return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) ? parts : null;
}

function privateIpv4(address: string): boolean {
  const p = ipv4Number(address);
  if (!p) return true;
  const [a, b, c] = p as [number, number, number, number];
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
    || (a === 192 && b === 0 && (c === 0 || c === 2)) || (a === 192 && b === 88 && c === 99)
    || (a === 198 && (b === 18 || b === 19 || b === 51 && c === 100))
    || (a === 203 && b === 0 && c === 113);
}

/** Return true unless an address is a globally routable unicast IP. */
export function isPrivate(address: string): boolean {
  const ip = address.toLowerCase().split("%")[0] ?? "";
  const mapped = ip.match(/^(?:::ffff:)(\d{1,3}(?:\.\d{1,3}){3})$/u)?.[1];
  if (mapped) return privateIpv4(mapped);
  if (isIP(ip) === 4) return privateIpv4(ip);
  if (isIP(ip) !== 6) return true;
  if (ip === "::" || ip === "::1" || ip.startsWith("ff") || ip.startsWith("fc") || ip.startsWith("fd") || /^fe[89ab]/u.test(ip)) return true;
  if (/^2001:(?:0|2|db8|10):/u.test(ip) || ip.startsWith("2001:db8:")) return true;
  if (ip.startsWith("::ffff:") || ip.startsWith("::")) return true;
  return false;
}

type SafeFetchDependencies = {
  resolve?: (hostname: string) => Promise<Array<{ address: string }>>;
  fetch?: typeof fetch;
};

async function assertPublicUrl(url: URL, resolve: NonNullable<SafeFetchDependencies["resolve"]>): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only HTTP and HTTPS URLs are allowed.");
  if (url.username || url.password) throw new Error("URLs with embedded credentials are not allowed.");
  if (url.port && (url.protocol === "http:" && url.port !== "80" || url.protocol === "https:" && url.port !== "443")) throw new Error("Only standard HTTP and HTTPS ports are allowed.");
  const host = url.hostname.replace(/^\[|\]$/gu, "").toLowerCase().replace(/\.$/u, "");
  if (!host || DENIED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix)) || !host.includes(".") && isIP(host) === 0) {
    throw new Error("Local or non-public hostnames are not allowed.");
  }
  const addresses = isIP(host) ? [{ address: host }] : await resolve(host);
  if (!addresses.length || addresses.some(({ address }) => isPrivate(address))) throw new Error("Blocked: hostname resolves to a non-public address.");
}

async function readBounded(response: Response, maxBytes: number): Promise<Uint8Array> {
  const announcedSize = Number(response.headers.get("content-length"));
  if (Number.isFinite(announcedSize) && announcedSize > maxBytes) { await response.body?.cancel(); throw new Error("Response exceeds the 2 MB size limit."); }
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new Error("Response exceeds the 2 MB size limit."); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

/** GET only; validates every destination in a redirect chain and caps time, redirects, and body size. */
export async function safeFetch(input: string | URL, init: RequestInit = {}, timeoutMs = 8_000, dependencies: SafeFetchDependencies = {}): Promise<Response> {
  if (init.method && init.method.toUpperCase() !== "GET") throw new Error("safeFetch only allows GET requests.");
  const resolve = dependencies.resolve ?? (async (hostname) => lookup(hostname, { all: true }));
  const transport = dependencies.fetch ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let current = new URL(input);
    const headers = new Headers(init.headers);
    if (!headers.has("user-agent")) headers.set("user-agent", "EchoRankBot/1.0 (+crawl audit)");
    for (let redirects = 0; redirects <= 4; redirects += 1) {
      await assertPublicUrl(current, resolve);
      const response = await transport(current, { headers, signal: controller.signal, redirect: "manual" });
      if (REDIRECT_STATUSES.has(response.status)) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location || redirects === 4) throw new Error("Too many or invalid redirects.");
        current = new URL(location, current);
        continue;
      }
      const body = await readBounded(response, MAX_BYTES);
      const bodyBuffer = new ArrayBuffer(body.byteLength);
      new Uint8Array(bodyBuffer).set(body);
      const bounded = new Response(response.status === 204 || response.status === 304 ? null : bodyBuffer, { status: response.status, statusText: response.statusText, headers: response.headers });
      Object.defineProperty(bounded, "url", { value: response.url || current.toString() });
      return bounded;
    }
    throw new Error("Too many redirects.");
  } catch (cause) {
    if (controller.signal.aborted) throw new Error("Request timed out.");
    throw cause;
  } finally { clearTimeout(timer); }
}
