// Copyright Reacon contributors. Licensed under Apache-2.0.
import { createParser } from 'eventsource-parser';
import { Configuration, ConfigurationParameters, InitOverrideFunction } from './runtime.js';
import { DomainsApi, EmailsApi, LeadsApi, VerificationApi, ListLeadsRequest, ListEmailsRequest, ListEmailMentionsRequest } from './apis/index.js';
import { ReaconRequestAbortedError } from './Http.js';
import {
  VerificationStage, VerificationStageFromJSON,
  VerificationProgress, VerificationProgressFromJSON,
  VerificationFinal, VerificationFinalFromJSON,
  VerificationStreamError, VerificationStreamErrorFromJSON,
} from './models/index.js';

export type VerificationEvent =
  | { type: 'stage'; data: VerificationStage; raw: Record<string, unknown> }
  | { type: 'progress'; data: VerificationProgress; raw: Record<string, unknown> }
  | { type: 'final'; data: VerificationFinal; raw: Record<string, unknown> }
  | { type: 'unknown'; data: Record<string, unknown>; raw: Record<string, unknown> };

export class ReaconProtocolError extends Error {
  constructor(message: string) { super(message); this.name = 'ReaconProtocolError'; }
}
export class ReaconTimeoutError extends Error {
  constructor(public readonly phase: 'idle' | 'total') {
    super(`Reacon ${phase} timeout`); this.name = 'ReaconTimeoutError';
  }
}
export class ReaconStreamApiError extends Error {
  public readonly requestId?: string;
  constructor(public readonly status: number, public readonly headers: Headers, public readonly body: unknown, public readonly event?: VerificationStreamError) {
    super(event ? `Reacon stream failed: ${event.code}` : `Reacon returned HTTP ${status}`);
    this.name = 'ReaconStreamApiError';
    this.requestId = headers.get('x-request-id') ?? undefined;
  }
}

export interface VerificationStreamOptions {
  cacheMaxAge?: 'live' | '1d' | '1w' | '1m';
  onlyIfFree?: 'true' | 'false';
  signal?: AbortSignal;
  /** Deadline from the first iteration through completion, including body reads. */
  totalTimeoutMs?: number;
  /** Maximum wait for the next network chunk; consumer processing does not reset the total deadline. */
  idleTimeoutMs?: number;
  /** Maximum buffered event characters. Defaults to 1 MiB. */
  maxEventChars?: number;
}

function positive(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be positive and finite`);
  return value;
}
function object(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function classify(raw: Record<string, any>): VerificationEvent {
  if ('result' in raw) {
    const result = raw.result;
    if (!object(result) || typeof raw.updatedAt !== 'string' || typeof result.status !== 'string' || typeof result.catchAll !== 'boolean' || typeof result.disposable !== 'boolean' || !(result.acceptsAll === null || typeof result.acceptsAll === 'boolean'))
      throw new ReaconProtocolError('Malformed verification result event');
    return { type: 'final', data: VerificationFinalFromJSON(raw), raw };
  }
  if ('stage' in raw) {
    if (typeof raw.stage !== 'string' || typeof raw.updatedAt !== 'string') throw new ReaconProtocolError('Malformed verification stage event');
    return { type: 'stage', data: VerificationStageFromJSON(raw), raw };
  }
  if ('state' in raw) {
    if (typeof raw.state !== 'string' || typeof raw.requestId !== 'string' || typeof raw.updatedAt !== 'string') throw new ReaconProtocolError('Malformed verification progress event');
    return { type: 'progress', data: VerificationProgressFromJSON(raw), raw };
  }
  return { type: 'unknown', data: raw, raw };
}

/** Streaming is explicit, lazy and never reconnects or retries. */
export class VerificationClient extends VerificationApi {
  async *stream(email: string, options: VerificationStreamOptions = {}): AsyncGenerator<VerificationEvent> {
    const total = positive(options.totalTimeoutMs ?? 300_000, 'totalTimeoutMs');
    const idle = positive(options.idleTimeoutMs ?? 30_000, 'idleTimeoutMs');
    const maxBufferSize = positive(options.maxEventChars ?? 1024 * 1024, 'maxEventChars');
    if (typeof email !== 'string' || !email) throw new TypeError('email is required');
    if (options.onlyIfFree !== undefined && !['true', 'false'].includes(options.onlyIfFree)) throw new TypeError('Invalid onlyIfFree option');
    if (options.cacheMaxAge !== undefined && !['live', '1d', '1w', '1m'].includes(options.cacheMaxAge)) throw new TypeError('Invalid cacheMaxAge option');
    const controller = new AbortController();
    const onAbort = () => controller.abort(options.signal?.reason ?? new DOMException('Aborted', 'AbortError'));
    options.signal?.addEventListener('abort', onAbort, { once: true });
    if (options.signal?.aborted) onAbort();
    const timer = setTimeout(() => controller.abort(new ReaconTimeoutError('total')), total);
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    const close = async () => { if (reader) { try { await reader.cancel(); } catch {} } };
    try {
      if (controller.signal.aborted) throw controller.signal.reason;
      const url = new URL(this.configuration.basePath.replace(/\/$/, '') + '/v1/verify');
      url.searchParams.set('email', email);
      if (options.cacheMaxAge !== undefined) url.searchParams.set('cacheMaxAge', options.cacheMaxAge);
      if (options.onlyIfFree !== undefined) url.searchParams.set('onlyIfFree', options.onlyIfFree);
      const headers = new Headers(this.configuration.headers);
      headers.set('Accept', 'text/event-stream');
      if (this.configuration.apiKey) headers.set('X-API-Key', await this.configuration.apiKey('X-API-Key'));
      const response = await (this.configuration.fetchApi ?? fetch)(url.toString(), {
        method: 'GET', headers, signal: controller.signal, redirect: 'manual', credentials: this.configuration.credentials,
      });
      reader = response.body?.getReader();
      const read = async () => {
        const idleTimer = setTimeout(() => controller.abort(new ReaconTimeoutError('idle')), idle);
        try { return await reader!.read(); } finally { clearTimeout(idleTimer); }
      };
      if (!response.ok) {
        let body = ''; const decoder = new TextDecoder();
        if (reader) while (body.length < 64 * 1024) {
          const chunk = await read(); if (chunk.done) break;
          body += decoder.decode(chunk.value, { stream: true });
        }
        body = body.slice(0, 64 * 1024);
        let parsed: unknown = body; try { parsed = JSON.parse(body); } catch {}
        throw new ReaconStreamApiError(response.status, response.headers, parsed);
      }
      if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'text/event-stream' || !reader)
        throw new ReaconProtocolError('Expected a text/event-stream response body');
      const pending: string[] = [];
      const parser = createParser({ maxBufferSize, onEvent: event => pending.push(event.data),
        onError: error => { if (error.type === 'max-buffer-size-exceeded') throw new ReaconProtocolError('SSE event exceeds configured buffer limit'); },
      });
      const decoder = new TextDecoder('utf-8', { fatal: true });
      while (true) {
        const chunk = await read();
        if (chunk.done) throw new ReaconProtocolError('Verification stream ended before a terminal event');
        parser.feed(decoder.decode(chunk.value, { stream: true }));
        while (pending.length) {
          let raw: unknown;
          try { raw = JSON.parse(pending.shift()!); } catch { throw new ReaconProtocolError('Malformed SSE JSON payload'); }
          if (!object(raw)) throw new ReaconProtocolError('Expected an SSE JSON object');
          if ('error' in raw) {
            if (typeof raw.error !== 'string' || typeof raw.code !== 'string' || typeof raw.updatedAt !== 'string') throw new ReaconProtocolError('Malformed verification error event');
            throw new ReaconStreamApiError(response.status, response.headers, raw, VerificationStreamErrorFromJSON(raw));
          }
          const event = classify(raw);
          // Close before yielding final: the consumer need not call next again.
          if (event.type === 'final') {
            await close(); clearTimeout(timer); options.signal?.removeEventListener('abort', onAbort);
            yield event; return;
          }
          yield event;
        }
      }
    } catch (error) {
      if (controller.signal.aborted) throw controller.signal.reason;
      throw error;
    } finally {
      await close(); reader?.releaseLock(); clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      controller.abort();
    }
  }
}

export interface PaginationOptions {
  /** Maximum requests, including empty pages. Defaults to 100; zero makes no requests. */
  maxPages?: number;
  /** Maximum returned items. Each requested page is capped to the remaining bound. Defaults to 10000. */
  maxItems?: number;
  signal?: AbortSignal;
  /** Deadline for each page, including reading its body. */
  timeoutMs?: number;
}
export interface EmailPaginationOptions extends PaginationOptions {
  /** Explicit acknowledgement that listEmails may spend credits on every page. Not a spending cap. */
  allowPaidRequests?: boolean;
}
type CursorRequest = { cursor?: string; limit?: number; offset?: number; xLrCursor?: string; xLrLimit?: number };
type CursorPage = { results: unknown[]; nextCursor?: string | null };
const bound = (value: number, name: string) => {
  if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000) throw new RangeError(`${name} must be an integer from 0 to 1000000`);
  return value;
};
function cancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new ReaconRequestAbortedError(signal.reason);
}

/** Snapshot inputs immediately; make requests only as the caller advances. */
function cursorPages<Q extends CursorRequest, P extends CursorPage>(request: Q, options: PaginationOptions,
  fetchPage: (request: Q, options: PaginationOptions) => Promise<P>): AsyncGenerator<P> {
  const query = { ...request }, settings = { ...options };
  return (async function* () {
    const maxPages = bound(settings.maxPages ?? 100, 'maxPages'), maxItems = bound(settings.maxItems ?? 10000, 'maxItems');
    if (query.offset !== undefined) throw new TypeError('Cursor iterators do not accept offset; use the one-page method for offset pagination');
    const pageSize = Math.min(query.limit ?? 100, query.xLrLimit ?? 500);
    if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 500) throw new RangeError('Page size must be an integer from 1 to 500');
    const seen = new Set<string>();
    const firstCursor = query.xLrCursor ?? query.cursor;
    if (firstCursor !== undefined) seen.add(firstCursor);
    let count = 0;
    for (let index = 0; index < maxPages && count < maxItems; index++) {
      cancelled(settings.signal);
      const limit = Math.min(pageSize, maxItems - count);
      const page = await fetchPage({ ...query, limit, ...(query.xLrLimit !== undefined ? { xLrLimit: limit } : {}) }, settings);
      cancelled(settings.signal);
      if (!Array.isArray(page.results) || page.results.length > limit) throw new ReaconProtocolError('Pagination response exceeds requested item bound');
      count += page.results.length;
      const next = page.nextCursor;
      if (next != null && (typeof next !== 'string' || !next)) throw new ReaconProtocolError('Invalid pagination cursor');
      yield page;
      if (next == null || index + 1 >= maxPages || count >= maxItems) return;
      if (seen.has(next)) throw new ReaconProtocolError('Repeated pagination cursor');
      seen.add(next); query.cursor = next;
      if (query.xLrCursor !== undefined) query.xLrCursor = next;
    }
  })();
}
async function* cursorItems<T>(pages: AsyncGenerator<{ results: T[] }>, signal?: AbortSignal): AsyncGenerator<T> {
  for await (const page of pages) for (const item of page.results) { cancelled(signal); yield item; }
}

export class LeadsClient extends LeadsApi {
  pages(request: Omit<ListLeadsRequest, 'offset'>, options: PaginationOptions = {}) {
    return cursorPages(request, options, (query, settings) => this.listLeads(query, { signal: settings.signal, timeoutMs: settings.timeoutMs, retry: false }));
  }
  items(request: Omit<ListLeadsRequest, 'offset'>, options: PaginationOptions = {}) {
    return cursorItems(this.pages(request, options), options.signal);
  }
}
export class EmailsClient extends EmailsApi {
  private pageOverrides(query: CursorRequest, settings: PaginationOptions): InitOverrideFunction {
    return async ({ init }) => {
      const headers = new Headers(init.headers);
      // Configuration headers may use different casing from generated headers.
      // Replace the effective values, avoiding a stale comma-joined cursor.
      if (query.xLrCursor !== undefined) headers.set('X-LR-Cursor', query.xLrCursor);
      if (query.xLrLimit !== undefined) headers.set('X-LR-Limit', String(query.xLrLimit));
      return { headers, signal: settings.signal, timeoutMs: settings.timeoutMs, retry: false };
    };
  }
  private paginationRequest<Q extends CursorRequest>(request: Q): Q {
    const headers = new Headers(this.configuration.headers);
    const cursor = request.xLrCursor ?? headers.get('X-LR-Cursor') ?? undefined;
    const limit = request.xLrLimit ?? (headers.has('X-LR-Limit') ? Number(headers.get('X-LR-Limit')) : undefined);
    return { ...request, xLrCursor: cursor, xLrLimit: limit };
  }
  /** Every page may consume credits unless onlyIfFree is explicitly enabled. */
  pages(request: Omit<ListEmailsRequest, 'offset'>, options: EmailPaginationOptions = {}) {
    const query = this.paginationRequest(request), settings = { ...options };
    return cursorPages(query, settings, (next, pageOptions) => {
      if (query.onlyIfFree !== 'true' && settings.allowPaidRequests !== true) throw new TypeError('Set onlyIfFree to true or acknowledge allowPaidRequests');
      return this.listEmails(next, this.pageOverrides(next, pageOptions));
    });
  }
  items(request: Omit<ListEmailsRequest, 'offset'>, options: EmailPaginationOptions = {}) {
    return cursorItems(this.pages(request, options), options.signal);
  }
  mentionPages(request: ListEmailMentionsRequest, options: PaginationOptions = {}) {
    const query = this.paginationRequest(request);
    if (query.xLrLimit !== undefined) query.limit = query.xLrLimit; // Mentions use header precedence, not the email-list minimum rule.
    return cursorPages(query, options, (next, settings) => this.listEmailMentions(next, this.pageOverrides(next, settings)));
  }
  mentionItems(request: ListEmailMentionsRequest, options: PaginationOptions = {}) {
    return cursorItems(this.mentionPages(request, options), options.signal);
  }
}

export interface ReaconOptions extends Omit<ConfigurationParameters, 'apiKey'> { apiKey: string }
/** Each client has its own credentials and transport. Generated one-page JSON methods remain available. */
export class Reacon {
  readonly domains: DomainsApi;
  readonly emails: EmailsClient;
  readonly leads: LeadsClient;
  readonly verification: VerificationClient;
  constructor(options: ReaconOptions) {
    if (!options.apiKey) throw new TypeError('apiKey is required');
    const configuration = new Configuration({ ...options, headers: { ...options.headers } });
    this.domains = new DomainsApi(configuration);
    this.emails = new EmailsClient(configuration);
    this.leads = new LeadsClient(configuration);
    this.verification = new VerificationClient(configuration);
  }
}
