import "server-only";
import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import ipaddr from "ipaddr.js";
import type { Evidence } from "./contract";
export class UnsafeTarget extends Error {
  constructor() {
    super("Target is not permitted.");
  }
}
export function targetUrl(raw: string, allowedHosts: readonly string[]) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeTarget();
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.port ||
    url.hostname.endsWith(".") ||
    !allowedHosts.includes(url.hostname) ||
    ipaddr.isValid(url.hostname.replace(/^\[|\]$/g, ""))
  )
    throw new UnsafeTarget();
  return url;
}
export function publicAddress(address: string) {
  try {
    const parsed = ipaddr.process(address);
    return parsed.range() === "unicast";
  } catch {
    return false;
  }
}
export type Resolver = (
  hostname: string,
) => Promise<{ address: string; family: number }[]>;
export async function resolveTarget(
  url: URL,
  resolve: Resolver = (host) => dnsLookup(host, { all: true, verbatim: true }),
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let records: { address: string; family: number }[];
  try {
    records = await Promise.race([
      resolve(url.hostname),
      new Promise<never>((_ok, reject) => {
        timer = setTimeout(() => reject(new Error("probe_timeout")), 2000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
  if (!records.length || records.some((r) => !publicAddress(r.address)))
    throw new UnsafeTarget();
  return records[0];
}
export interface WireOptions {
  url: URL;
  address: string;
  family: number;
  timeoutMs: number;
  maxBytes: number;
}
export type Wire = (options: WireOptions) => Promise<{ statusCode: number }>;
export const httpsWire: Wire = ({
  url,
  address,
  family,
  timeoutMs,
  maxBytes,
}) =>
  new Promise((resolve, reject) => {
    // Pin the validated IP at the actual socket, preserving hostname/SNI and certificate validation.
    const req = httpsRequest(
      url,
      {
        method: "GET",
        agent: false,
        family,
        ...{ autoSelectFamily: false },
        rejectUnauthorized: true,
        servername: url.hostname,
        lookup: (_hostname, _options, callback) => {
          callback(null, address, family);
        },
        headers: {
          "User-Agent": "Ryn-Monitor/1",
          Accept: "*/*",
          "Accept-Encoding": "identity",
        },
        maxHeaderSize: 8192,
      },
      (res) => {
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            req.destroy(new Error("response_limit"));
          }
        });
        res.on("end", () => {
          if (!req.destroyed) resolve({ statusCode: res.statusCode ?? 500 });
        });
        res.on("aborted", () => reject(new Error("response_aborted")));
        res.on("error", reject);
      },
    );
    const timer = setTimeout(
      () => req.destroy(new Error("probe_timeout")),
      timeoutMs,
    );
    timer.unref();
    req.on("close", () => clearTimeout(timer));
    req.on("error", reject);
    req.end();
  });
export async function probe(
  raw: string,
  allowedHosts: readonly string[],
  options: { resolve?: Resolver; wire?: Wire; now?: () => number } = {},
): Promise<Evidence> {
  const now = options.now ?? Date.now;
  const start = now();
  const durationMs = () =>
    Math.min(15000, Math.max(0, Math.floor(now() - start)));
  try {
    const url = targetUrl(raw, allowedHosts);
    const record = await resolveTarget(url, options.resolve);
    const { statusCode } = await (options.wire ?? httpsWire)({
      url,
      ...record,
      timeoutMs: 10000,
      maxBytes: 65536,
    });
    // Redirects are evidence of a failed health endpoint, never followed to another destination.
    return {
      outcome: statusCode >= 200 && statusCode < 300 ? "healthy" : "unhealthy",
      statusCode,
      durationMs: durationMs(),
    };
  } catch (e) {
    return {
      outcome:
        e instanceof UnsafeTarget
          ? "blocked"
          : e instanceof Error && e.message === "probe_timeout"
            ? "timeout"
            : "network",
      statusCode: null,
      durationMs: durationMs(),
    };
  }
}
