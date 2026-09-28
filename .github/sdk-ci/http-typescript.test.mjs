// Run against an installed/generated SDK: REACON_HTTP_SDK_MODULE=/absolute/module.js node --test <this file>
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { test, before, after } from 'node:test';

const modulePath = process.env.REACON_HTTP_SDK_MODULE;
if (!modulePath) throw new Error('REACON_HTTP_SDK_MODULE must name the package consumer entry point');
const sdk = process.env.REACON_HTTP_MODULE_MODE === 'cjs'
  ? createRequire(import.meta.url)(modulePath) : await import(pathToFileURL(modulePath));
const counts = new Map();
const requests = [];
let basePath;
const wire = { generic_emails: 1, personal_emails: 2, total: 3 };
const expected = { genericEmails: 1, personalEmails: 2, total: 3 };
const server = createServer((req, res) => {
  const scenario = req.headers['x-test-scenario'] ?? 'success';
  counts.set(scenario, (counts.get(scenario) ?? 0) + 1);
  requests.push({ scenario, method: req.method, url: req.url, key: req.headers['x-api-key'] });
  if (req.url === '/redirect-target') { res.end('{}'); return; }
  res.setHeader('content-type', 'application/json');
  res.setHeader('x-request-id', 'synthetic-request');
  if (scenario.startsWith('redirect-')) {
    res.writeHead(Number(scenario.split('-')[1]), { location: `${basePath}/redirect-target` });
    res.end('{}');
  } else if (scenario === 'lost-response') {
    req.socket.destroy();
  } else if (scenario === 'hang-headers') {
    // Keep the connection open until the consumer cancels it.
  } else if (scenario === 'hang-body') {
    res.writeHead(200); res.flushHeaders(); res.write('{');
  } else if (scenario === 'broken-body') {
    res.writeHead(200); res.flushHeaders(); res.write('{');
    setImmediate(() => req.socket.destroy());
  } else if (scenario === 'error-json') {
    res.writeHead(402, { 'x-credits-remaining': '0' });
    res.end(JSON.stringify({ code: 'insufficient_credits', credits: { remaining: 0 } }));
  } else if (scenario === 'error-nested') {
    res.writeHead(404); res.end(JSON.stringify({ error: { code: 'not_found', message: 'Synthetic missing email' } }));
  } else if (scenario === 'error-text') {
    res.writeHead(503, { 'content-type': 'text/plain', 'retry-after': '1' }); res.end('Synthetic unavailable');
  } else if (scenario === 'error-malformed') {
    res.writeHead(429, { 'retry-after': '1' }); res.end('{broken');
  } else if (scenario === 'malformed') {
    res.end('{broken');
  } else if (scenario === 'wrong-mime') {
    res.setHeader('content-type', 'text/html'); res.end(JSON.stringify(wire));
  } else if (scenario === 'slow-success') {
    const timer = setTimeout(() => res.end(JSON.stringify(wire)), 150);
    res.on('close', () => clearTimeout(timer));
  } else { res.end(JSON.stringify(wire)); }
});
before(async () => { server.listen(0, '127.0.0.1'); await once(server, 'listening'); basePath = `http://127.0.0.1:${server.address().port}`; });
after(async () => { const done = new Promise(resolve => server.close(resolve)); server.closeAllConnections(); await done; });
const config = (scenario, extra = {}) => new sdk.Configuration({ basePath, apiKey: 'synthetic-key', headers: { 'x-test-scenario': scenario }, requestTimeoutMs: 1000, ...extra });
const client = (scenario, extra) => new sdk.DomainsApi(config(scenario, extra));
const call = (api, options) => api.getDomainCounts({ domain: 'example.invalid' }, options);
async function rejection(promise) { try { await promise; assert.fail('Expected rejection'); } catch (error) { if (error.code === 'ERR_ASSERTION') throw error; return error; } }

test('generated JSON operation serializes authentication and decodes the model', async () => {
  assert.deepEqual(await call(client('success')), expected);
  assert.deepEqual(requests.at(-1), { scenario: 'success', method: 'GET', url: '/v1/domains/example.invalid/counts', key: 'synthetic-key' });
});
for (const status of [301, 302, 303, 307, 308]) test(`HTTP ${status} is inspectable and never follows Location`, async () => {
  const scenario = `redirect-${status}`;
  const error = await rejection(call(client(scenario), { redirect: 'follow' }));
  assert.ok(error instanceof sdk.ResponseError); assert.equal(error.status, status);
  assert.equal(error.headers.get('location'), `${basePath}/redirect-target`);
  assert.equal(counts.get(scenario), 1);
  assert.equal(requests.filter(x => x.url === '/redirect-target').length, 0);
});
for (const scenario of ['hang-headers', 'hang-body']) test(`total deadline covers ${scenario}`, { timeout: 4000 }, async () => {
  const started = performance.now();
  const error = await rejection(call(client(scenario, { requestTimeoutMs: 80 })));
  assert.ok(error instanceof sdk.ReaconRequestTimeoutError); assert.equal(error.timeoutMs, 80);
  assert.ok(performance.now() - started < 1500);
});
test('per-call options and override function can extend or shorten the configured deadline', async () => {
  assert.deepEqual(await call(client('slow-success', { requestTimeoutMs: 40 }), { timeoutMs: 800 }), expected);
  assert.deepEqual(await call(client('slow-success', { requestTimeoutMs: 40 }), async () => ({ timeoutMs: 800 })), expected);
  const error = await rejection(call(client('hang-headers'), { timeoutMs: 40 }));
  assert.ok(error instanceof sdk.ReaconRequestTimeoutError); assert.equal(error.timeoutMs, 40);
});
test('pre-aborted request does not reach the server', async () => {
  const before = requests.length;
  const controller = new AbortController(); controller.abort('synthetic cancellation');
  const error = await rejection(call(client('success'), { signal: controller.signal }));
  assert.ok(error instanceof sdk.ReaconRequestAbortedError); assert.equal(error.name, 'AbortError');
  assert.equal(error.reason, 'synthetic cancellation'); assert.equal(requests.length, before);
});
for (const scenario of ['hang-headers', 'hang-body']) test(`caller cancellation covers ${scenario} and client can be reused`, async () => {
  const controller = new AbortController(); const api = client(scenario);
  const promise = call(api, { signal: controller.signal });
  const timer = setTimeout(() => controller.abort('synthetic cancellation'), 60);
  try { const error = await rejection(promise); assert.ok(error instanceof sdk.ReaconRequestAbortedError); }
  finally { clearTimeout(timer); }
  assert.deepEqual(await call(api, { headers: { 'x-test-scenario': 'success' } }), expected);
});
test('raw response body remains deadline-bound and may be cancelled by caller', async () => {
  const raw = await client('hang-body').getDomainCountsRaw({ domain: 'example.invalid' }, { timeoutMs: 60 });
  assert.ok(await rejection(raw.raw.text()) instanceof sdk.ReaconRequestTimeoutError);
  const cancelled = await client('hang-body').getDomainCountsRaw({ domain: 'example.invalid' });
  await cancelled.raw.body.cancel();
  assert.deepEqual(await call(client('success')), expected);
});
test('API errors preserve JSON, credit details, request ID, headers and readable Response', async () => {
  const error = await rejection(call(client('error-json')));
  assert.ok(error instanceof sdk.ResponseError); assert.equal(error.status, 402);
  assert.equal(error.code, 'insufficient_credits'); assert.equal(error.requestId, 'synthetic-request');
  assert.equal(error.headers.get('x-credits-remaining'), '0'); assert.equal(error.body.credits.remaining, 0);
  assert.deepEqual(await error.response.json(), error.body);
});
test('nested API error code is inspectable', async () => {
  const error = await rejection(new sdk.EmailsApi(config('error-nested')).revealEmail({ email: 'synthetic@example.invalid' }));
  assert.equal(error.status, 404); assert.equal(error.code, 'not_found');
  assert.equal(error.body.error.message, 'Synthetic missing email');
});
for (const scenario of ['error-text', 'error-malformed']) test(`${scenario} preserves body and Retry-After without retrying`, async () => {
  const before = counts.get(scenario) ?? 0;
  const error = await rejection(call(client(scenario)));
  assert.ok(error instanceof sdk.ResponseError); assert.equal(error.headers.get('retry-after'), '1');
  assert.equal(error.body, scenario === 'error-text' ? 'Synthetic unavailable' : '{broken');
  assert.equal(await error.response.text(), error.body); assert.equal(counts.get(scenario) - before, 1);
});
for (const scenario of ['malformed', 'wrong-mime']) test(`${scenario} successful response is a typed decode failure`, async () => {
  const error = await rejection(call(client(scenario)));
  assert.ok(error instanceof sdk.ReaconResponseDecodeError); assert.equal(error.status, 200);
  assert.equal(error.requestId, 'synthetic-request'); assert.equal(typeof error.body, 'string');
});
test('response-body connection loss is distinct from JSON decoding', async () => {
  assert.ok(await rejection(call(client('broken-body'))) instanceof sdk.ReaconTransportError);
});
for (const method of ['revealEmail', 'deleteEmail']) test(`lost response to ${method} is not replayed`, async () => {
  const api = new sdk.EmailsApi(config('lost-response'));
  // Warm the same origin's connection pool before the billable GET / mutation.
  await call(client('success'));
  const before = counts.get('lost-response') ?? 0;
  const error = await rejection(api[method]({ email: 'synthetic@example.invalid' }));
  assert.ok(error instanceof sdk.ReaconTransportError);
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(counts.get('lost-response') - before, 1);
  assert.equal(requests.at(-1).method, method === 'revealEmail' ? 'GET' : 'DELETE');
});
