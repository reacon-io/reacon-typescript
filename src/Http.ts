// Copyright Reacon contributors. Licensed under Apache-2.0.
import { auditedRead, retryableStatuses, maximumMaxRetries } from './RetryPolicy.js';
export interface RetryOptions {
  /** Additional attempts, from zero to three. Retries are disabled by default. */
  maxRetries: number;
  /** Initial exponential-backoff bound, in milliseconds. Defaults to 100. */
  baseDelayMs?: number;
  /** Maximum wait, in milliseconds. Defaults to 2000. Longer Retry-After returns the final error. */
  maxDelayMs?: number;
}
/** Options accepted by every generated JSON/CSV method. */
export interface RequestOptions extends RequestInit {
  /** Total network deadline, including response body reads. Defaults to 30s. */
  timeoutMs?: number;
  /** Overrides safeRetries for this request. Only audited read routes may retry. */
  retry?: RetryOptions | false;
}
export class ReaconRetryPolicyError extends Error {
  constructor(message: string) { super(message); this.name = 'ReaconRetryPolicyError'; }
}

export class ReaconRequestTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super('Reacon request deadline exceeded'); this.name = 'ReaconRequestTimeoutError';
  }
}
export class ReaconRequestAbortedError extends Error {
  constructor(public readonly reason?: unknown) {
    super('Reacon request cancelled'); this.name = 'AbortError';
  }
}
export class ReaconTransportError extends Error {
  constructor(public readonly cause: unknown) {
    super('Reacon request transport failed'); this.name = 'ReaconTransportError';
  }
}
export class ReaconResponseDecodeError extends Error {
  public readonly status: number;
  public readonly headers: Headers;
  public readonly requestId?: string;
  constructor(response: Response, public readonly body: string, message: string) {
    super(message); this.name = 'ReaconResponseDecodeError';
    this.status = response.status; this.headers = new Headers(response.headers);
    this.requestId = response.headers.get('x-request-id') ?? undefined;
  }
}
export function isReaconRequestError(error: unknown): boolean {
  return error instanceof ReaconRequestTimeoutError || error instanceof ReaconRequestAbortedError || error instanceof ReaconTransportError || error instanceof ReaconRetryPolicyError;
}

function retryAfterMs(value: string | null): number | undefined {
  if (value === null) return undefined;
  if (/^\d+$/.test(value.trim())) return Number(value.trim()) * 1000;
  if (!/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(value)) return undefined;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}
function backoff(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const stop = () => { clearTimeout(timer); signal.removeEventListener('abort', stop); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', stop); resolve(); }, milliseconds);
    signal.addEventListener('abort', stop, { once: true });
    if (signal.aborted) stop();
  });
}

/** The API uses both flat errors and an error envelope. Keep the full body too. */
export function responseErrorCode(body: unknown): string | undefined {
  if (body === null || typeof body !== 'object') return undefined;
  const record = body as Record<string, unknown>;
  if (typeof record.code === 'string') return record.code;
  if (record.error !== null && typeof record.error === 'object') {
    const code = (record.error as Record<string, unknown>).code;
    if (typeof code === 'string') return code;
  }
  return undefined;
}

/** One attempt by default, bounded opt-in retries on audited reads only; the deadline remains active until
 * the body ends or is cancelled, including when callers use a Raw method. */
export async function fetchWithRequestPolicy(fetchApi: typeof fetch, url: string, options: RequestOptions, defaultTimeoutMs: number, defaultRetries?: RetryOptions): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647) throw new RangeError('timeoutMs must be positive and at most 2147483647');
  const eligible = auditedRead(options.method ?? 'GET', url) && options.body == null;
  const retry = options.retry === undefined ? (eligible ? defaultRetries : undefined) : options.retry;
  const maxRetries = retry ? retry.maxRetries : 0;
  const baseDelay = retry ? retry.baseDelayMs ?? 100 : 100, maxDelay = retry ? retry.maxDelayMs ?? 2000 : 2000;
  if (!Number.isSafeInteger(maxRetries) || maxRetries < 0 || maxRetries > maximumMaxRetries ||
      !Number.isFinite(baseDelay) || baseDelay < 1 || !Number.isFinite(maxDelay) || maxDelay < baseDelay || maxDelay > 60000)
    throw new ReaconRetryPolicyError('Invalid bounded retry settings');
  if (maxRetries > 0 && !eligible) throw new ReaconRetryPolicyError('Automatic retries are not allowed for this operation');
  const deadline = Date.now() + timeoutMs;
  const controller = new AbortController(), parent = options.signal;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let bodyController: ReadableStreamDefaultController<Uint8Array> | undefined;
  let finished = false;
  const cleanup = () => { finished = true; clearTimeout(timer); parent?.removeEventListener('abort', onAbort); };
  const stop = (reason: Error) => {
    if (finished) return;
    controller.abort(reason);
    try { bodyController?.error(reason); } catch { /* already terminal */ }
    void reader?.cancel(reason).catch(() => {});
    cleanup();
  };
  const onAbort = () => stop(new ReaconRequestAbortedError(parent?.reason));
  const timer = setTimeout(() => stop(new ReaconRequestTimeoutError(timeoutMs)), timeoutMs);
  parent?.addEventListener('abort', onAbort, { once: true });
  if (parent?.aborted) onAbort();
  try {
    if (controller.signal.aborted) throw controller.signal.reason;
    const { timeoutMs: _timeout, retry: _retry, ...init } = options;
    let response: Response;
    for (let attempt = 0; ; attempt++) {
      if (controller.signal.aborted) throw controller.signal.reason;
      response = await fetchApi(url, { ...init, redirect: 'manual', signal: controller.signal });
      if (controller.signal.aborted) { await response.body?.cancel(); throw controller.signal.reason; }
      if (attempt >= maxRetries || !retryableStatuses.includes(response.status)) break;
      const exponential = Math.min(maxDelay, baseDelay * 2 ** attempt);
      const delay = Math.max(exponential * (0.5 + Math.random() * 0.5), retryAfterMs(response.headers.get('retry-after')) ?? 0);
      // Never shorten server Retry-After or start another attempt past the total deadline.
      if (delay > maxDelay || delay >= deadline - Date.now()) break;
      await response.body?.cancel();
      await backoff(delay, controller.signal);
    }
    if (controller.signal.aborted) { await response.body?.cancel(); throw controller.signal.reason; }
    if (!response.body) { cleanup(); return response; }
    reader = response.body.getReader();
    const body = new ReadableStream<Uint8Array>({
      start(value) { bodyController = value; },
      async pull(value) {
        try {
          const item = await reader!.read();
          if (controller.signal.aborted) throw controller.signal.reason;
          if (item.done) { cleanup(); value.close(); } else value.enqueue(item.value);
        } catch (cause) {
          const error = controller.signal.aborted ? controller.signal.reason : new ReaconTransportError(cause);
          cleanup(); try { value.error(error); } catch { /* cancellation won */ }
          void reader?.cancel(error).catch(() => {});
        }
      },
      async cancel(reason) { cleanup(); controller.abort(reason); try { await reader?.cancel(reason); } catch {} },
    });
    const result = new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
    Object.defineProperty(result, 'url', { value: response.url });
    return result;
  } catch (cause) {
    cleanup();
    if (controller.signal.aborted) throw controller.signal.reason;
    throw new ReaconTransportError(cause);
  }
}

export async function responseErrorBody(response: Response): Promise<unknown> {
  const text = await response.clone().text();
  if (/^(application\/json|[^;]+\+json)(\s*;|$)/i.test(response.headers.get('content-type') ?? '')) {
    try { return JSON.parse(text); } catch { /* retain malformed error bodies */ }
  }
  return text;
}

export async function responseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!/^(application\/json|[^;]+\+json)(\s*;|$)/i.test(response.headers.get('content-type') ?? ''))
    throw new ReaconResponseDecodeError(response, text, 'Expected a JSON response');
  try { return JSON.parse(text); }
  catch { throw new ReaconResponseDecodeError(response, text, 'Malformed JSON response'); }
}
