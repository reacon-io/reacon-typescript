const assert = require('node:assert/strict');
const { Reacon, ReaconProtocolError, ReaconTimeoutError, ReaconStreamApiError } = globalThis.REACON_STREAM_SDK ?? require(process.env.SDK_DIRECTORY + '/dist');
async function collect(stream) { const values = []; for await (const value of stream) values.push(value); return values; }
async function main() {
  const basePath = process.env.REACON_TEST_URL;
  const mode = process.env.REACON_STREAM_MODE ?? 'typescript';
  const client = new Reacon({ basePath, apiKey: `synthetic-${mode}` });
  const isolated = new Reacon({ basePath, apiKey: `isolated-${mode}` });
  client.verification.stream('never@example.test'); // creating a stream sends nothing
  const preCancelled = new AbortController(); preCancelled.abort();
  await assert.rejects(() => collect(client.verification.stream('never@example.test', { signal: preCancelled.signal })), error => error.name === 'AbortError');
  const stream = (scenario, options = {}) => client.verification.stream(`${scenario}@example.test`, { onlyIfFree: 'true', totalTimeoutMs: 5000, idleTimeoutMs: 2000, ...options });
  const [events, isolatedEvents] = await Promise.all([
    collect(stream('success')),
    collect(isolated.verification.stream('isolated@example.test', { onlyIfFree: 'true', totalTimeoutMs: 5000 })),
  ]);
  for (const values of [events, isolatedEvents]) {
    assert.deepEqual(values.map(event => event.type), ['stage', 'unknown', 'progress', 'final']);
    assert.equal(values[0].raw.label, 'hé🚀'); assert.equal(values[1].raw.future.value, 'hé🚀');
    assert.equal(values[3].data.result.acceptsAll, null); assert.equal(values[3].data.result.status, 'future-status');
  }
  await assert.rejects(() => collect(stream('error')), error => {
    assert.ok(error instanceof ReaconStreamApiError); assert.equal(error.status, 200);
    assert.equal(error.event.code, 'INSUFFICIENT_CREDITS'); assert.equal(error.event.remainingCredits, 0);
    assert.equal(error.requestId, 'req-stream'); return true;
  });
  for (const [scenario, status] of [['pre402', 402], ['pre429', 429], ['proxy', 502], ['redirect', 307]]) {
    await assert.rejects(() => collect(stream(scenario)), error => {
      assert.ok(error instanceof ReaconStreamApiError); assert.equal(error.status, status);
      if (status === 402 || status === 429) { assert.equal(error.body.code, 'FIXTURE_ERROR'); assert.equal(error.requestId, 'req-stream'); }
      if (status === 502) { assert.equal(error.requestId, undefined); assert.equal(typeof error.body, 'string'); }
      return true;
    });
  }
  for (const scenario of ['wrongtype', 'malformed', 'invalidresult', 'eof']) await assert.rejects(() => collect(stream(scenario)), ReaconProtocolError);
  await assert.rejects(() => collect(stream('disconnect')), error => !(error instanceof ReaconStreamApiError));
  for (const phase of ['idle', 'total']) await assert.rejects(() => collect(stream(phase, { idleTimeoutMs: 80, totalTimeoutMs: 200 })), error => {
    assert.ok(error instanceof ReaconTimeoutError); assert.equal(error.phase, phase); return true;
  });
  await assert.rejects(() => collect(stream('headers', { totalTimeoutMs: 200 })), ReaconTimeoutError);
  const controller = new AbortController();
  const cancel = stream('cancel', { signal: controller.signal });
  assert.equal((await cancel.next()).value.type, 'stage');
  const waiting = cancel.next(); setTimeout(() => controller.abort(), 20);
  await assert.rejects(() => waiting, error => error.name === 'AbortError');
  for await (const event of stream('early')) { assert.equal(event.type, 'stage'); break; }
  const closed = await fetch(basePath + '/_assert_closed'); assert.equal(closed.status, 200); assert.equal((await closed.json()).closed, true);
  console.log('TypeScript streaming: framing, terminal/error, isolation, timeout, cancellation and early-close assertions passed');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
