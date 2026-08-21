import { validateCrawlUrl } from "@/lib/alpha-seo/crawler/url-policy";
import { fetchPinnedPublicUrl } from "@/lib/alpha-seo/crawler/pinned-fetch";
export async function assertPublicHttpUrl(value: string) {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port
  )
    throw new Error("URL_NOT_ALLOWED");
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  )
    throw new Error("URL_NOT_ALLOWED");
  try {
    return new URL(await validateCrawlUrl(url.toString()));
  } catch {
    throw new Error("URL_NOT_ALLOWED");
  }
}

function withAbort<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return operation;
  if (signal.aborted)
    return Promise.reject(
      signal.reason instanceof Error
        ? signal.reason
        : new DOMException("SAM request cancelled", "AbortError"),
    );
  return new Promise<T>((resolve, reject) => {
    const onAbort = () =>
      reject(
        signal.reason instanceof Error
          ? signal.reason
          : new DOMException("SAM request cancelled", "AbortError"),
      );
    signal.addEventListener("abort", onAbort, { once: true });
    operation.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

export async function fetchPublicHttpUrl(
  value: string,
  maxBytes = 200_000,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const url = await assertPublicHttpUrl(value);
  signal?.throwIfAborted();
  return withAbort(
    fetchPinnedPublicUrl({
      url: url.toString(),
      timeoutMs: 12_000,
      maxBytes,
      headers: { accept: "text/html,text/plain" },
    }),
    signal,
  );
}
