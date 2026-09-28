// Copyright Reacon contributors. Licensed under Apache-2.0.
/** Options accepted by every generated JSON/CSV method. */
export interface RequestOptions extends RequestInit {
  /** Total network deadline, including response body reads. Defaults to 30s. */
  timeoutMs?: number;
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
  return error instanceof ReaconRequestTimeoutError || error instanceof ReaconRequestAbortedError || error instanceof ReaconTransportError;
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

/** One fetch attempt, no redirects/retries; the deadline remains active until
 * the body ends or is cancelled, including when callers use a Raw method. */
export async function fetchWithRequestPolicy(fetchApi: typeof fetch, url: string, options: RequestOptions, defaultTimeoutMs: number): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647) throw new RangeError('timeoutMs must be positive and at most 2147483647');
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
    const { timeoutMs: _timeout, ...init } = options;
    const response = await fetchApi(url, { ...init, redirect: 'manual', signal: controller.signal });
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
