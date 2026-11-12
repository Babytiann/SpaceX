export default {
  async fetch(request, env) {
    const range = request.headers.get('Range');
    if (request.method !== 'GET' || new URL(request.url).pathname !== '/music/soundtrack.mp3' || !range) {
      return env.ASSETS.fetch(request);
    }

    // Static Assets ignores Range and does not expose Content-Length through its binding.
    const assetHeaders = new Headers(request.headers);
    assetHeaders.delete('Range');
    assetHeaders.delete('If-Range');
    const response = await env.ASSETS.fetch(new Request(request, { headers: assetHeaders }));
    if (response.status !== 200) return response;

    const ifRange = request.headers.get('If-Range');
    if (ifRange) {
      const date = Date.parse(ifRange);
      const matches = ifRange.startsWith('"')
        ? ifRange === response.headers.get('ETag')
        : !ifRange.startsWith('W/') && Number.isFinite(date)
          && date === Date.parse(response.headers.get('Last-Modified') ?? '');
      if (!matches) return response;
    }

    // Ignore malformed or multipart ranges; browsers only need one audio byte range at a time.
    const match = /^bytes=(\d*)-(\d*)$/i.exec(range);
    if (!match || (!match[1] && !match[2])) return response;
    if (match[1] && match[2] && Number(match[2]) < Number(match[1])) return response;

    // This handler is limited to the bundled 14.9 MB soundtrack, not arbitrary asset sizes.
    const buffer = new Uint8Array(await response.arrayBuffer());
    const size = buffer.byteLength;
    const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
    const requestedEnd = match[1] && match[2] ? Number(match[2]) : size - 1;
    const end = Math.min(requestedEnd, size - 1);
    const headers = new Headers(response.headers);
    headers.set('Accept-Ranges', 'bytes');
    if (start >= size || end < start) {
      headers.set('Content-Range', `bytes */${size}`);
      headers.set('Content-Length', '0');
      return new Response(null, { status: 416, headers });
    }
    headers.set('Content-Length', String(end - start + 1));
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
    return new Response(buffer.slice(start, end + 1), { status: 206, headers });
  },
};
