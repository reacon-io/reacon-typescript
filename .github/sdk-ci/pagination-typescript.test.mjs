import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const modulePath = process.env.REACON_HTTP_SDK_MODULE;
if (!modulePath) throw new Error('Run against an installed package entry point');
const sdk = process.env.REACON_HTTP_MODULE_MODE === 'cjs'
  ? createRequire(import.meta.url)(modulePath) : await import(pathToFileURL(modulePath));
const page = (ids, nextCursor = null) => ({ results: ids.map(id => ({ id, email: `${id}@example.invalid` })), nextCursor, totalCount: ids.length, groupTotals: null });
function fixture(pages, extra = {}) {
  const calls = [];
  const client = new sdk.Reacon({ apiKey: 'synthetic', basePath: 'https://fixture.invalid', ...extra, fetchApi: async (url, init) => {
    calls.push({ url: new URL(url), headers: new Headers(init.headers), signal: init.signal });
    assert.equal(new Headers(init.headers).get('x-api-key'), 'synthetic');
    const response = pages[calls.length - 1];
    assert(response !== undefined, 'Unexpected extra request');
    return response instanceof Response ? response : new Response(JSON.stringify(response), { headers: { 'content-type': 'application/json' } });
  } });
  return { client, calls };
}
const collect = async iterable => { const items = []; for await (const item of iterable) items.push(item); return items; };

test('pages are lazy, snapshot filters, preserve envelopes and never prefetch on break', async () => {
  const { client, calls } = fixture([page(['one'], 'next'), page(['two'])]);
  const query = { teamId: 'team', search: 'original', sort: 'name', order: 'desc', group: 'company', filters: '{"tag":"fixture"}', limit: 1 };
  const options = { maxPages: 5, maxItems: 10 };
  const pages = client.leads.pages(query, options);
  query.search = 'changed'; options.maxPages = 0;
  assert.equal(calls.length, 0);
  for await (const result of pages) { assert.equal(result.nextCursor, 'next'); assert.equal(result.results[0].id, 'one'); break; }
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.searchParams.get('search'), 'original');
  assert.equal(calls[0].url.searchParams.get('group'), 'company');
});
test('items stop inside a page without fetching the next page', async () => {
  const { client, calls } = fixture([page(['one', 'two'], 'next')]);
  for await (const item of client.leads.items({ teamId: 'team', limit: 2 })) { assert.equal(item.id, 'one'); break; }
  assert.equal(calls.length, 1);
});
test('item bound caps the next request and retains all filters', async () => {
  const { client, calls } = fixture([page(['one', 'two'], 'next'), page(['three'], 'unused')]);
  const result = await collect(client.leads.items({ teamId: 'team', limit: 2, domain: 'example.invalid', position: 'Engineer', search: 'fixture', filters: '{}' }, { maxItems: 3 }));
  assert.deepEqual(result.map(x => x.id), ['one', 'two', 'three']);
  assert.equal(calls.length, 2); assert.equal(calls[1].url.searchParams.get('limit'), '1');
  assert.equal(calls[1].url.searchParams.get('cursor'), 'next');
  for (const key of ['domain', 'position', 'search', 'filters']) assert.equal(calls[0].url.searchParams.get(key), calls[1].url.searchParams.get(key));
});
test('empty pages with a cursor continue; final empty page ends', async () => {
  const { client, calls } = fixture([page([], 'next'), page(['one'], 'final'), page([])]);
  assert.equal((await collect(client.leads.items({ teamId: 'team' }))).length, 1);
  assert.equal(calls.length, 3);
});
test('page bound includes empty pages and zero bounds make no requests', async () => {
  const { client, calls } = fixture([page([], 'next')]);
  assert.deepEqual(await collect(client.leads.pages({ teamId: 'team' }, { maxPages: 0 })), []);
  assert.deepEqual(await collect(client.leads.items({ teamId: 'team' }, { maxItems: 0 })), []);
  assert.equal((await collect(client.leads.pages({ teamId: 'team' }, { maxPages: 1 }))).length, 1);
  assert.equal(calls.length, 1);
});
for (const cursors of [['a', 'a'], ['a', 'b', 'a']]) test(`cursor cycle ${cursors.join('/')} fails without another fetch`, async () => {
  const { client, calls } = fixture(cursors.map(cursor => page([], cursor)));
  await assert.rejects(collect(client.leads.pages({ teamId: 'team' })), sdk.ReaconProtocolError);
  assert.equal(calls.length, cursors.length);
});
test('initial cursor participates in cycle detection', async () => {
  const { client, calls } = fixture([page([], 'initial')]);
  await assert.rejects(collect(client.leads.pages({ teamId: 'team', cursor: 'initial' })), sdk.ReaconProtocolError);
  assert.equal(calls.length, 1);
});
test('invalid bounds and offset are rejected before requests', async () => {
  const { client, calls } = fixture([]);
  for (const value of [-1, 1.2, Infinity, NaN, 1000001]) {
    await assert.rejects(collect(client.leads.pages({ teamId: 'team' }, { maxPages: value })), RangeError);
    await assert.rejects(collect(client.leads.items({ teamId: 'team' }, { maxItems: value })), RangeError);
  }
  await assert.rejects(collect(client.leads.pages({ teamId: 'team', offset: 1 })), TypeError);
  assert.equal(calls.length, 0);
});
test('cancellation before first fetch and between buffered items stops work', async () => {
  const { client, calls } = fixture([page(['one', 'two'], 'next')]);
  const a = new AbortController(); a.abort();
  await assert.rejects(collect(client.leads.items({ teamId: 'team' }, { signal: a.signal })), sdk.ReaconRequestAbortedError);
  assert.equal(calls.length, 0);
  const b = new AbortController(), iterator = client.leads.items({ teamId: 'team' }, { signal: b.signal });
  await iterator.next(); b.abort();
  await assert.rejects(iterator.next(), sdk.ReaconRequestAbortedError); assert.equal(calls.length, 1);
});
test('API credit rejection ends iteration with no retry and an inspectable error', async () => {
  const { client, calls } = fixture([new Response(JSON.stringify({ code: 'insufficient_credits' }), { status: 402, headers: { 'content-type': 'application/json' } })]);
  await assert.rejects(collect(client.emails.items({ domain: 'example.invalid' }, { allowPaidRequests: true })), error => error instanceof sdk.ResponseError && error.status === 402 && error.code === 'insufficient_credits');
  assert.equal(calls.length, 1);
});
test('email iteration requires explicit free-only mode or paid-request acknowledgement', async () => {
  const { client, calls } = fixture([page([])]);
  await assert.rejects(collect(client.emails.items({ domain: 'example.invalid' })), TypeError); assert.equal(calls.length, 0);
  await collect(client.emails.items({ domain: 'example.invalid', onlyIfFree: 'true', sourcesLimit: 3 }));
  assert.equal(calls[0].url.searchParams.get('onlyIfFree'), 'true'); assert.equal(calls[0].url.searchParams.get('sourcesLimit'), '3');
});
test('email header cursor precedence advances without stale case-insensitive headers', async () => {
  const { client, calls } = fixture([page([], 'second'), page([])], { headers: { 'x-lr-cursor': 'configured', 'x-lr-limit': '3' } });
  await collect(client.emails.pages({ domain: 'example.invalid', cursor: 'query', xLrCursor: 'header', limit: 2, onlyIfFree: 'true' }));
  assert.equal(calls[0].headers.get('x-lr-cursor'), 'header'); assert.equal(calls[1].headers.get('x-lr-cursor'), 'second');
  assert.equal(calls[1].url.searchParams.get('cursor'), 'second');
  assert.equal(calls[0].headers.get('x-lr-limit'), '2'); assert.equal(calls[0].url.searchParams.get('limit'), '2');
});
test('mentions honor header limit precedence and keep email path encoding', async () => {
  const { client, calls } = fixture([page([], 'second'), page([])]);
  await collect(client.emails.mentionPages({ email: 'name+fixture@example.invalid', limit: 1, xLrLimit: 3, xLrCursor: 'first' }));
  assert.equal(calls[0].headers.get('x-lr-limit'), '3'); assert.equal(calls[1].headers.get('x-lr-cursor'), 'second');
  assert(calls[0].url.pathname.includes('name%2Bfixture%40example.invalid'));
});
test('server cannot cause items to exceed the configured bound', async () => {
  const { client, calls } = fixture([page(['one', 'two'])]);
  await assert.rejects(collect(client.leads.items({ teamId: 'team' }, { maxItems: 1 })), sdk.ReaconProtocolError);
  assert.equal(calls.length, 1);
});
test('page request bounds still hold when client-wide safe retries are configured', async () => {
  const { client, calls } = fixture([new Response('{"code":"unavailable"}', { status: 503, headers: { 'content-type': 'application/json' } })],
    { safeRetries: { maxRetries: 3 } });
  await assert.rejects(collect(client.leads.pages({ teamId: 'team' }, { maxPages: 1 })), error => error instanceof sdk.ResponseError && error.status === 503);
  assert.equal(calls.length, 1);
});
