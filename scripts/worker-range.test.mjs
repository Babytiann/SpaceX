import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../worker.mjs';

const audio = Uint8Array.from({ length: 257 }, (_, i) => i % 256);
const url = 'https://example.workers.dev/music/soundtrack.mp3';
const lastModified = 'Thu, 12 Nov 2026 08:00:00 GMT';

function assets({ data = audio, status = 200, headers = {} } = {}) {
  const state = { requests: [], response: null };
  const env = { ASSETS: { fetch(request) {
    state.requests.push(request);
    const body = request.method === 'HEAD' ? null : data;
    state.response = new Response(body, { status, headers: {
      'Content-Type': 'audio/mpeg',
      'ETag': '"track-v1"', 'Last-Modified': lastModified,
      'Cache-Control': 'public, max-age=0, must-revalidate', ...headers,
    } });
    return state.response;
  } } };
  return { env, state };
}

test('full audio and HEAD requests pass through unchanged', async () => {
  for (const method of ['GET', 'HEAD']) {
    const { env, state } = assets();
    const request = new Request(url, { method, headers: method === 'HEAD' ? { Range: 'bytes=0-4' } : {} });
    const response = await worker.fetch(request, env);
    assert.equal(response, state.response);
    assert.equal(state.requests[0], request);
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), method === 'HEAD' ? new Uint8Array() : audio);
  }
});

test('non-audio paths and non-GET methods pass through unchanged', async () => {
  for (const [path, method] of [['/textures/earth_color.jpg', 'GET'], ['/music/soundtrack.mp3', 'POST']]) {
    const { env, state } = assets();
    const request = new Request(new URL(path, url), { method, headers: { Range: 'bytes=1-2' } });
    assert.equal(await worker.fetch(request, env), state.response);
    assert.equal(state.requests[0], request);
  }
});

test('closed byte range returns exact bytes and preserves media/cache headers', async () => {
  const { env, state } = assets();
  const response = await worker.fetch(new Request(url, { headers: { Range: 'bytes=29-65', 'If-Range': '"track-v1"' } }), env);
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('Content-Range'), 'bytes 29-65/257');
  assert.equal(response.headers.get('Content-Length'), '37');
  assert.equal(response.headers.get('Accept-Ranges'), 'bytes');
  assert.equal(response.headers.get('Content-Type'), 'audio/mpeg');
  assert.equal(response.headers.get('ETag'), '"track-v1"');
  assert.equal(response.headers.get('Last-Modified'), lastModified);
  assert.equal(response.headers.get('Cache-Control'), 'public, max-age=0, must-revalidate');
  assert.equal(state.requests[0].headers.has('Range'), false);
  assert.equal(state.requests[0].headers.has('If-Range'), false);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), audio.slice(29, 66));
});

test('open-ended, suffix, clamped, and full ranges return the exact bytes', async () => {
  for (const [range, start, end] of [
    ['bytes=250-', 250, 256], ['bytes=-7', 250, 256],
    ['bytes=-999', 0, 256], ['bytes=250-999', 250, 256], ['bytes=0-256', 0, 256],
    ['bytes=0-0', 0, 0], ['bytes=256-256', 256, 256],
  ]) {
    const { env } = assets();
    const response = await worker.fetch(new Request(url, { headers: { Range: range } }), env);
    assert.equal(response.status, 206, range);
    assert.equal(response.headers.get('Content-Range'), `bytes ${start}-${end}/257`, range);
    assert.equal(response.headers.get('Content-Length'), String(end - start + 1), range);
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), audio.slice(start, end + 1), range);
  }
});

test('unsatisfiable ranges return 416 with the actual asset size', async () => {
  for (const range of ['bytes=257-', 'bytes=900-950', 'bytes=-0']) {
    const { env } = assets();
    const response = await worker.fetch(new Request(url, { headers: { Range: range } }), env);
    assert.equal(response.status, 416, range);
    assert.equal(response.headers.get('Content-Range'), 'bytes */257');
    assert.equal(response.headers.get('Content-Length'), '0');
    assert.equal(response.headers.get('Accept-Ranges'), 'bytes');
    assert.equal((await response.arrayBuffer()).byteLength, 0);
  }
});

test('malformed, reversed, and multipart ranges fall back to the full file', async () => {
  for (const range of ['bytes=-', 'bytes=abc', 'bytes=9-3', 'bytes=0-1,4-5', 'items=0-2']) {
    const { env, state } = assets();
    const response = await worker.fetch(new Request(url, { headers: { Range: range } }), env);
    assert.equal(response, state.response, range);
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), audio, range);
  }
});

test('If-Range mismatch, weak validators, and invalid dates return full content', async () => {
  for (const validator of ['"old-track"', 'W/"track-v1"', 'invalid', 'Thu, 12 Nov 2026 08:00:01 GMT']) {
    const { env, state } = assets();
    const response = await worker.fetch(new Request(url, { headers: { Range: 'bytes=0-7', 'If-Range': validator } }), env);
    assert.equal(response, state.response, validator);
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), audio, validator);
  }
});

test('an exactly matching If-Range HTTP date permits partial content', async () => {
  const { env } = assets();
  const response = await worker.fetch(new Request(url, { headers: { Range: 'bytes=2-9', 'If-Range': lastModified } }), env);
  assert.equal(response.status, 206);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), audio.slice(2, 10));
});

test('asset errors are not rewritten', async () => {
  const { env, state } = assets({ status: 404 });
  const response = await worker.fetch(new Request(url, { headers: { Range: 'bytes=0-7' } }), env);
  assert.equal(response, state.response);
});

test('an asset binding without Content-Length still supports Range', async () => {
  const { env, state } = assets();
  const response = await worker.fetch(new Request(url, { headers: { Range: 'bytes=100-199' } }), env);
  assert.equal(state.response.headers.has('Content-Length'), false);
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('Content-Range'), 'bytes 100-199/257');
  assert.equal(response.headers.get('Content-Length'), '100');
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), audio.slice(100, 200));
});
