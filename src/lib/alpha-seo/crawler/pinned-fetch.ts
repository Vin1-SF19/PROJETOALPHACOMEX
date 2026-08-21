import "server-only";

import { isIP } from "node:net";
import http from "node:http";
import https from "node:https";
import {
  defaultDnsResolver,
  isBlockedIpAddress,
  normalizeCrawlUrl,
  type DnsResolver,
} from "./url-policy";

export interface PinnedFetchOptions {
  url: string;
  method?: "GET" | "HEAD";
  headers?: Readonly<Record<string, string>>;
  resolver?: DnsResolver;
  timeoutMs?: number;
  maxBytes?: number;
}

/**
 * Faz a conexão diretamente a um IP público previamente validado. Assim o
 * hostname não é resolvido uma segunda vez pelo cliente HTTP (DNS rebinding).
 */
export async function fetchPinnedPublicUrl(input: PinnedFetchOptions): Promise<Response> {
  const normalized = normalizeCrawlUrl(input.url);
  const url = new URL(normalized);
  const resolver = input.resolver ?? defaultDnsResolver;
  const addresses = isIP(url.hostname) ? [url.hostname] : await resolver(url.hostname);
  if (addresses.length === 0) throw new Error("CRAWL_DNS_FAILED");
  if (addresses.some(isBlockedIpAddress)) throw new Error("CRAWL_ADDRESS_BLOCKED");

  const address = addresses[0];
  const timeoutMs = input.timeoutMs ?? 15_000;
  const maxBytes = input.maxBytes ?? 1_048_576;
  const client = url.protocol === "https:" ? https : http;

  return new Promise<Response>((resolve, reject) => {
    const request = client.request(
      {
        protocol: url.protocol,
        hostname: address,
        port: url.port || undefined,
        method: input.method ?? "GET",
        path: `${url.pathname}${url.search}`,
        headers: { ...input.headers, Host: url.host },
        servername: url.protocol === "https:" && !isIP(url.hostname) ? url.hostname : undefined,
        timeout: timeoutMs,
      },
      (response) => {
        const declaredLength = Number(response.headers["content-length"] ?? 0);
        if (input.method !== "HEAD" && Number.isFinite(declaredLength) && declaredLength > maxBytes) {
          response.destroy();
          reject(new Error("CRAWL_RESPONSE_TOO_LARGE"));
          return;
        }
        const chunks: Buffer[] = [];
        let bytes = 0;
        response.on("data", (chunk: Buffer | string) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          bytes += buffer.byteLength;
          if (bytes > maxBytes) {
            response.destroy(new Error("CRAWL_RESPONSE_TOO_LARGE"));
            return;
          }
          chunks.push(buffer);
        });
        response.once("error", reject);
        response.once("end", () => {
          const headers = new Headers();
          for (const [name, value] of Object.entries(response.headers)) {
            if (Array.isArray(value)) for (const item of value) headers.append(name, item);
            else if (value !== undefined) headers.set(name, String(value));
          }
          const status = response.statusCode ?? 500;
          const body = input.method === "HEAD" || status === 204 || status === 304
            ? null
            : Buffer.concat(chunks);
          resolve(new Response(body, {
            status,
            statusText: response.statusMessage,
            headers,
          }));
        });
      },
    );
    request.once("timeout", () => request.destroy(new Error("CRAWL_TIMEOUT")));
    request.once("error", reject);
    request.end();
  });
}
